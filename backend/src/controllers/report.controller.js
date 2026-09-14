import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

export async function getDashboard(req, res) {
  try {
    // Asset counts by status
    const assetCounts = await prisma.asset.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const assetStats = {
      total: 0,
      tersedia: 0,
      dipinjam: 0,
      maintenance: 0,
      rusak: 0,
    };

    assetCounts.forEach((item) => {
      assetStats[item.status.toLowerCase()] = item._count.id;
      assetStats.total += item._count.id;
    });

    // Loan counts by status
    const loanCounts = await prisma.loan.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const loanStats = {};
    loanCounts.forEach((item) => {
      loanStats[item.status.toLowerCase()] = item._count.id;
    });

    // Pending approvals
    const pendingCount = await prisma.loan.count({ where: { status: 'PENDING' } });

    // Overdue loans
    const overdueLoans = await prisma.loan.findMany({
      where: { status: 'OVERDUE' },
      include: {
        asset: { select: { namaTv: true, kodeInventaris: true } },
        user: { select: { nama: true, departemen: true } },
      },
    });

    // Most borrowed assets (top 5)
    const mostBorrowed = await prisma.loan.groupBy({
      by: ['assetId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const mostBorrowedAssets = await Promise.all(
      mostBorrowed.map(async (item) => {
        const asset = await prisma.asset.findUnique({
          where: { id: item.assetId },
          select: { namaTv: true, kodeInventaris: true },
        });
        return {
          ...asset,
          totalPinjam: item._count.id,
        };
      })
    );

    // Recent loans
    const recentLoans = await prisma.loan.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        asset: { select: { namaTv: true, kodeInventaris: true } },
        user: { select: { nama: true, departemen: true } },
      },
    });

    // Late return stats
    const lateReturns = await prisma.loan.count({
      where: {
        status: 'RETURNED',
        tglKembaliAktual: { not: null },
      },
    });

    res.json({
      assetStats,
      loanStats,
      pendingCount,
      overdueLoans,
      mostBorrowedAssets,
      recentLoans,
      lateReturns,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getLoanReport(req, res) {
  try {
    const { startDate, endDate, departemen, status, page = 1, limit = 20 } = req.query;
    const where = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (departemen) where.departemen = departemen;
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        include: {
          asset: { select: { namaTv: true, kodeInventaris: true, merk: true } },
          user: { select: { nama: true, email: true, departemen: true } },
          approver: { select: { nama: true } },
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
    console.error('Loan report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function exportReport(req, res) {
  try {
    const { startDate, endDate, departemen, format = 'xlsx' } = req.query;
    const where = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (departemen) where.departemen = departemen;

    const loans = await prisma.loan.findMany({
      where,
      include: {
        asset: { select: { namaTv: true, kodeInventaris: true, merk: true } },
        user: { select: { nama: true, email: true, departemen: true } },
        approver: { select: { nama: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Laporan Peminjaman');

    sheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Tanggal Pengajuan', key: 'tglPengajuan', width: 18 },
      { header: 'Peminjam', key: 'peminjam', width: 20 },
      { header: 'Departemen', key: 'departemen', width: 15 },
      { header: 'Kode TV', key: 'kodeTv', width: 10 },
      { header: 'Nama TV', key: 'namaTv', width: 30 },
      { header: 'Tgl Pinjam', key: 'tglPinjam', width: 15 },
      { header: 'Tgl Kembali Rencana', key: 'tglKembaliRencana', width: 18 },
      { header: 'Tgl Kembali Aktual', key: 'tglKembaliAktual', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Keperluan', key: 'keperluan', width: 30 },
      { header: 'Disetujui Oleh', key: 'approver', width: 18 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    loans.forEach((loan, index) => {
      sheet.addRow({
        no: index + 1,
        tglPengajuan: new Date(loan.createdAt).toLocaleDateString('id-ID'),
        peminjam: loan.user.nama,
        departemen: loan.departemen,
        kodeTv: loan.asset.kodeInventaris,
        namaTv: loan.asset.namaTv,
        tglPinjam: new Date(loan.tglPinjam).toLocaleDateString('id-ID'),
        tglKembaliRencana: new Date(loan.tglKembaliRencana).toLocaleDateString('id-ID'),
        tglKembaliAktual: loan.tglKembaliAktual
          ? new Date(loan.tglKembaliAktual).toLocaleDateString('id-ID')
          : '-',
        status: loan.status,
        keperluan: loan.keperluan,
        approver: loan.approver?.nama || '-',
      });
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=laporan-peminjaman.csv');
      await workbook.csv.write(res);
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=laporan-peminjaman.xlsx');
      await workbook.xlsx.write(res);
    }

    res.end();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getOverdueReport(req, res) {
  try {
    const overdueLoans = await prisma.loan.findMany({
      where: { status: 'OVERDUE' },
      include: {
        asset: { select: { namaTv: true, kodeInventaris: true } },
        user: { select: { nama: true, email: true, departemen: true, noHp: true, lateCount: true } },
      },
      orderBy: { tglKembaliRencana: 'asc' },
    });

    res.json({ overdueLoans });
  } catch (error) {
    console.error('Overdue report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

