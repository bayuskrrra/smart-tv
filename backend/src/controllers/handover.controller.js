import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/helpers.js';

const prisma = new PrismaClient();

export async function recordPickup(req, res) {
  try {
    const { loanId } = req.params;
    const { kondisi, catatan } = req.body;

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { asset: true },
    });

    if (!loan) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }

    if (loan.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Hanya peminjaman APPROVED yang bisa diambil' });
    }

    let fotoUrl = null;
    if (req.file) {
      fotoUrl = `/uploads/handover/${req.file.filename}`;
    }

    // Create handover log
    const handoverLog = await prisma.handoverLog.create({
      data: {
        loanId,
        tipe: 'PENGAMBILAN',
        kondisi: kondisi || 'Baik',
        fotoUrl,
        catatan: catatan || null,
      },
    });

    // Update loan status to ONGOING
    await prisma.loan.update({
      where: { id: loanId },
      data: { status: 'ONGOING' },
    });

    // Update asset status to DIPINJAM
    await prisma.asset.update({
      where: { id: loan.assetId },
      data: { status: 'DIPINJAM' },
    });

    // Notify borrower
    await prisma.notification.create({
      data: {
        userId: loan.userId,
        title: 'TV Telah Diambil',
        message: `${loan.asset.namaTv} telah dicatat sebagai diambil. Harap kembalikan sebelum ${new Date(loan.tglKembaliRencana).toLocaleDateString('id-ID')}.`,
        type: 'info',
        refId: loanId,
      },
    });

    await createAuditLog(req.user.id, 'RECORD_PICKUP', 'handover', handoverLog.id, { loanId, kondisi });

    res.json({ message: 'Serah terima berhasil dicatat', handoverLog });
  } catch (error) {
    console.error('Record pickup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function recordReturn(req, res) {
  try {
    const { loanId } = req.params;
    const { kondisi, catatan, hasKerusakan } = req.body;

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { asset: true, user: true },
    });

    if (!loan) {
      return res.status(404).json({ error: 'Peminjaman tidak ditemukan' });
    }

    if (!['ONGOING', 'OVERDUE'].includes(loan.status)) {
      return res.status(400).json({ error: 'Hanya peminjaman ONGOING/OVERDUE yang bisa dikembalikan' });
    }

    let fotoUrl = null;
    if (req.file) {
      fotoUrl = `/uploads/handover/${req.file.filename}`;
    }

    // Create handover log
    const handoverLog = await prisma.handoverLog.create({
      data: {
        loanId,
        tipe: 'PENGEMBALIAN',
        kondisi: kondisi || 'Baik',
        fotoUrl,
        catatan: catatan || null,
      },
    });

    const now = new Date();
    const isLate = now > new Date(loan.tglKembaliRencana);

    // Update loan status
    await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'RETURNED',
        tglKembaliAktual: now,
      },
    });

    // Update asset status
    // hasKerusakan dikirim via FormData sebagai string, konversi ke boolean dulu
    const isRusak = hasKerusakan === true || hasKerusakan === 'true';
    const newAssetStatus = isRusak ? 'RUSAK' : 'TERSEDIA';
    await prisma.asset.update({
      where: { id: loan.assetId },
      data: {
        status: newAssetStatus,
        kondisi: kondisi || loan.asset.kondisi,
      },
    });

    // Update late count if returned late
    if (isLate) {
      await prisma.user.update({
        where: { id: loan.userId },
        data: { lateCount: { increment: 1 } },
      });
    }

    // Notify borrower
    await prisma.notification.create({
      data: {
        userId: loan.userId,
        title: 'Pengembalian Dicatat ✅',
        message: `Pengembalian ${loan.asset.namaTv} telah dicatat. ${isLate ? '⚠️ Pengembalian terlambat.' : 'Terima kasih!'}`,
        type: 'info',
        refId: loanId,
      },
    });

    await createAuditLog(req.user.id, 'RECORD_RETURN', 'handover', handoverLog.id, {
      loanId,
      kondisi,
      isLate,
      hasKerusakan,
    });

    res.json({
      message: 'Pengembalian berhasil dicatat',
      handoverLog,
      isLate,
    });
  } catch (error) {
    console.error('Record return error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getHandoverLogs(req, res) {
  try {
    const { loanId } = req.params;

    const logs = await prisma.handoverLog.findMany({
      where: { loanId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ logs });
  } catch (error) {
    console.error('Get handover logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
