import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/helpers.js';
import { sendLoanNotificationWA, sendExtensionNotificationWA, notifyBorrowerWA, sendLoanStatusUpdateToAdminGroup } from '../services/whatsapp.service.js';

const prisma = new PrismaClient();

export async function getLoans(req, res) {
  try {
    const { status, userId, assetId, departemen, page = 1, limit = 20 } = req.query;
    const where = {};

    // Karyawan can only see their own loans
    if (req.user.role === 'KARYAWAN') {
      where.userId = req.user.id;
    } else {
      if (userId) where.userId = userId;
    }

    if (status) where.status = status;
    if (assetId) where.assetId = assetId;
    if (departemen) where.departemen = departemen;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        include: {
          asset: { select: { namaTv: true, kodeInventaris: true, merk: true, ukuran: true } },
          user: { select: { nama: true, email: true, departemen: true } },
          approver: { select: { nama: true } },
          handoverLogs: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.loan.count({ where }),
    ]);

    res.json({
      loans,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getLoanById(req, res) {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id },
      include: {
        asset: true,
        user: { select: { id: true, nama: true, email: true, departemen: true, noHp: true } },
        approver: { select: { nama: true } },
        handoverLogs: { orderBy: { createdAt: 'asc' } },
        extensions: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!loan) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }

    // Karyawan can only view own loans
    if (req.user.role === 'KARYAWAN' && loan.userId !== req.user.id) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses' });
    }

    res.json({ loan });
  } catch (error) {
    console.error('Get loan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createLoan(req, res) {
  try {
    const { assetId, tglPinjam, tglKembaliRencana, keperluan, departemen } = req.body;



    // Check if asset exists and is available
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset tidak ditemukan' });
    }

    if (asset.status === 'RUSAK' || asset.status === 'MAINTENANCE') {
      return res.status(400).json({ error: `TV sedang dalam status ${asset.status}` });
    }

    // Check schedule conflict
    const conflict = await prisma.loan.findFirst({
      where: {
        assetId,
        status: { in: ['APPROVED', 'ONGOING'] },
        OR: [
          {
            tglPinjam: { lte: new Date(tglKembaliRencana) },
            tglKembaliRencana: { gte: new Date(tglPinjam) },
          },
        ],
      },
    });

    if (conflict) {
      return res.status(409).json({
        error: 'Jadwal bentrok dengan peminjaman lain',
        conflictWith: {
          tglPinjam: conflict.tglPinjam,
          tglKembaliRencana: conflict.tglKembaliRencana,
        },
      });
    }

    const loan = await prisma.loan.create({
      data: {
        assetId,
        userId: req.user.id,
        tglPinjam: new Date(tglPinjam),
        tglKembaliRencana: new Date(tglKembaliRencana),
        keperluan,
        departemen,
        status: 'PENDING',
      },
      include: {
        asset: { select: { namaTv: true, kodeInventaris: true } },
      },
    });

    // Notify admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: 'Pengajuan Peminjaman Baru',
        message: `${req.user.nama} mengajukan peminjaman ${loan.asset.namaTv} untuk ${keperluan}`,
        type: 'approval',
        refId: loan.id,
      })),
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: 'Pengajuan Terkirim',
        message: `Pengajuan peminjaman ${loan.asset.namaTv} sedang menunggu persetujuan admin`,
        type: 'info',
        refId: loan.id,
      },
    });

    await createAuditLog(req.user.id, 'CREATE_LOAN', 'loan', loan.id, { assetId, keperluan });

    // Send WhatsApp notification
    try {
      await sendLoanNotificationWA(
        loan,
        req.user.nama,
        loan.asset.namaTv,
        keperluan,
        departemen,
        tglPinjam,
        tglKembaliRencana,
        req.user.noHp
      );
    } catch (waErr) {
      console.error('WhatsApp notification error:', waErr.message);
    }

    res.status(201).json({ message: 'Pengajuan peminjaman berhasil', loan });
  } catch (error) {
    console.error('Create loan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function approveLoan(req, res) {
  try {
    const { id } = req.params;
    const { catatanAdmin } = req.body;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { asset: true, user: true },
    });

    if (!loan) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }

    if (loan.status !== 'PENDING') {
      return res.status(400).json({ error: 'Hanya peminjaman PENDING yang bisa di-approve' });
    }

    // Re-check schedule conflict
    const conflict = await prisma.loan.findFirst({
      where: {
        assetId: loan.assetId,
        id: { notIn: [id, loan.parentLoanId].filter(Boolean) },
        status: { in: ['APPROVED', 'ONGOING'] },
        OR: [
          {
            tglPinjam: { lte: loan.tglKembaliRencana },
            tglKembaliRencana: { gte: loan.tglPinjam },
          },
        ],
      },
    });

    if (conflict) {
      return res.status(409).json({ error: 'Jadwal bentrok dengan peminjaman lain yang sudah di-approve' });
    }

    const updated = await prisma.loan.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user.id,
        catatanAdmin: catatanAdmin || null,
      },
      include: {
        asset: { select: { namaTv: true } },
      },
    });

    // Notify borrower
    await prisma.notification.create({
      data: {
        userId: loan.userId,
        title: 'Peminjaman Disetujui ✅',
        message: `Peminjaman ${loan.asset.namaTv} Anda telah disetujui. ${catatanAdmin || 'Silakan ambil sesuai jadwal.'}`,
        type: 'approval',
        refId: loan.id,
      },
    });

    // Notify borrower via WhatsApp
    try {
      await notifyBorrowerWA(loan.userId,
        `✅ *Peminjaman Smart TV Disetujui!*\n\nUnit *${loan.asset.namaTv}* telah disetujui.\n${catatanAdmin || 'Silakan ambil sesuai jadwal.'}`
      );
    } catch (waErr) {
      console.error('WA approve notification error:', waErr.message);
    }

    // Notify admin group via WhatsApp
    try {
      await sendLoanStatusUpdateToAdminGroup(loan, 'APPROVED', req.user.nama);
    } catch (waGrpErr) {
      console.error('WA admin group notify error:', waGrpErr.message);
    }

    await createAuditLog(req.user.id, 'APPROVE_LOAN', 'loan', id, { catatanAdmin });

    res.json({ message: 'Peminjaman berhasil di-approve', loan: updated });
  } catch (error) {
    console.error('Approve loan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function rejectLoan(req, res) {
  try {
    const { id } = req.params;
    const { catatanAdmin } = req.body;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { asset: true, user: true },
    });

    if (!loan) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }

    if (loan.status !== 'PENDING') {
      return res.status(400).json({ error: 'Hanya peminjaman PENDING yang bisa di-reject' });
    }

    const updated = await prisma.loan.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: req.user.id,
        catatanAdmin: catatanAdmin || null,
      },
    });

    // Notify borrower
    await prisma.notification.create({
      data: {
        userId: loan.userId,
        title: 'Peminjaman Ditolak ❌',
        message: `Peminjaman ${loan.asset.namaTv} ditolak. ${catatanAdmin || 'Silakan hubungi admin untuk info lebih lanjut.'}`,
        type: 'approval',
        refId: loan.id,
      },
    });

    // Notify borrower via WhatsApp
    try {
      await notifyBorrowerWA(loan.userId,
        `❌ *Peminjaman Ditolak*\n\nPeminjaman *${loan.asset.namaTv}* ditolak.\n${catatanAdmin || 'Silakan hubungi admin untuk info lebih lanjut.'}`
      );
    } catch (waErr) {
      console.error('WA reject notification error:', waErr.message);
    }

    // Notify admin group via WhatsApp
    try {
      await sendLoanStatusUpdateToAdminGroup(loan, 'REJECTED', req.user.nama);
    } catch (waGrpErr) {
      console.error('WA admin group notify error:', waGrpErr.message);
    }

    await createAuditLog(req.user.id, 'REJECT_LOAN', 'loan', id, { catatanAdmin });

    res.json({ message: 'Peminjaman berhasil di-reject', loan: updated });
  } catch (error) {
    console.error('Reject loan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function extendLoan(req, res) {
  try {
    const { id } = req.params;
    const { tglKembaliRencana, keperluan } = req.body;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { asset: true },
    });

    if (!loan) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }

    if (loan.userId !== req.user.id) {
      return res.status(403).json({ error: 'Anda tidak dapat memperpanjang peminjaman orang lain' });
    }

    if (!['ONGOING', 'APPROVED'].includes(loan.status)) {
      return res.status(400).json({ error: 'Hanya peminjaman ONGOING/APPROVED yang bisa diperpanjang' });
    }

    const newKembali = new Date(tglKembaliRencana);
    if (newKembali <= loan.tglKembaliRencana) {
      return res.status(400).json({ error: 'Tanggal perpanjangan harus setelah tanggal kembali saat ini' });
    }

    // Check conflict for extension period
    const conflict = await prisma.loan.findFirst({
      where: {
        assetId: loan.assetId,
        id: { not: id },
        status: { in: ['APPROVED', 'ONGOING'] },
        OR: [
          {
            tglPinjam: { lte: newKembali },
            tglKembaliRencana: { gte: loan.tglKembaliRencana },
          },
        ],
      },
    });

    if (conflict) {
      return res.status(409).json({ error: 'Jadwal perpanjangan bentrok dengan peminjaman lain' });
    }

    // Create extension loan
    const extension = await prisma.loan.create({
      data: {
        assetId: loan.assetId,
        userId: loan.userId,
        tglPinjam: loan.tglKembaliRencana,
        tglKembaliRencana: newKembali,
        keperluan: keperluan || `Perpanjangan: ${loan.keperluan}`,
        departemen: loan.departemen,
        status: 'PENDING',
        isExtension: true,
        parentLoanId: id,
      },
    });

    // Notify admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: 'Pengajuan Perpanjangan',
        message: `${req.user.nama} mengajukan perpanjangan peminjaman ${loan.asset.namaTv}`,
        type: 'approval',
        refId: extension.id,
      })),
    });

    await createAuditLog(req.user.id, 'EXTEND_LOAN', 'loan', id, { extensionId: extension.id, tglKembaliRencana });

    // Send WhatsApp notification for extension
    try {
      await sendExtensionNotificationWA(
        extension,
        req.user.nama,
        loan.asset.namaTv,
        loan.tglKembaliRencana,
        tglKembaliRencana,
        req.user.noHp
      );
    } catch (waErr) {
      console.error('WhatsApp extension notification error:', waErr.message);
    }

    res.status(201).json({ message: 'Pengajuan perpanjangan berhasil', extension });
  } catch (error) {
    console.error('Extend loan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getSchedule(req, res) {
  try {
    const { startDate, endDate, assetId, status, all } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    } else {
      where.status = { in: ['PENDING', 'APPROVED', 'ONGOING', 'OVERDUE', 'RETURNED'] };
    }

    if (assetId) {
      where.assetId = assetId;
    }

    if (all !== 'true') {
      // Default: dari 30 hari yang lalu sampai 90 hari ke depan
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      where.OR = [
        { tglPinjam: { gte: start, lte: end } },
        { tglKembaliRencana: { gte: start, lte: end } },
        { tglPinjam: { lte: start }, tglKembaliRencana: { gte: end } },
      ];
    }

    const loans = await prisma.loan.findMany({
      where,
      include: {
        asset: { select: { id: true, namaTv: true, kodeInventaris: true, merk: true, ukuran: true, lokasi: true, status: true } },
        user: { select: { id: true, nama: true, departemen: true, email: true } },
      },
      orderBy: { tglPinjam: 'desc' },
    });

    res.json({ loans });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function checkAvailability(req, res) {
  try {
    const { assetId, tglPinjam, tglKembaliRencana } = req.query;

    if (!assetId || !tglPinjam || !tglKembaliRencana) {
      return res.status(400).json({ error: 'assetId, tglPinjam, dan tglKembaliRencana wajib diisi' });
    }

    const conflict = await prisma.loan.findFirst({
      where: {
        assetId,
        status: { in: ['APPROVED', 'ONGOING'] },
        OR: [
          {
            tglPinjam: { lte: new Date(tglKembaliRencana) },
            tglKembaliRencana: { gte: new Date(tglPinjam) },
          },
        ],
      },
      include: {
        user: { select: { nama: true, departemen: true } },
      },
    });

    res.json({
      available: !conflict,
      conflict: conflict
        ? {
            tglPinjam: conflict.tglPinjam,
            tglKembaliRencana: conflict.tglKembaliRencana,
            peminjam: conflict.user.nama,
            departemen: conflict.user.departemen,
          }
        : null,
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
