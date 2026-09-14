import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/helpers.js';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';

const prisma = new PrismaClient();

export async function getAssets(req, res) {
  try {
    const { status, search } = req.query;
    const where = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { namaTv: { contains: search, mode: 'insensitive' } },
        { kodeInventaris: { contains: search, mode: 'insensitive' } },
        { merk: { contains: search, mode: 'insensitive' } },
        { lokasi: { contains: search, mode: 'insensitive' } },
      ];
    }

    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ assets });
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAssetById(req, res) {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: {
        loans: {
          include: { user: { select: { nama: true, departemen: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset tidak ditemukan' });
    }

    res.json({ asset });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createAsset(req, res) {
  try {
    const { namaTv, kodeInventaris, merk, ukuran, lokasi, kondisi } = req.body;

    const existing = await prisma.asset.findUnique({ where: { kodeInventaris } });
    if (existing) {
      return res.status(409).json({ error: 'Kode inventaris sudah digunakan' });
    }

    let fotoUrl = null;
    if (req.file) {
      fotoUrl = `/uploads/assets/${req.file.filename}`;
    }

    const asset = await prisma.asset.create({
      data: {
        namaTv,
        kodeInventaris,
        merk,
        ukuran,
        lokasi,
        kondisi: kondisi || 'Baik',
        fotoUrl,
      },
    });

    await createAuditLog(req.user.id, 'CREATE_ASSET', 'asset', asset.id, { namaTv, kodeInventaris });

    res.status(201).json({ message: 'Asset berhasil ditambahkan', asset });
  } catch (error) {
    console.error('Create asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateAsset(req, res) {
  try {
    const { id } = req.params;
    const { namaTv, kodeInventaris, merk, ukuran, lokasi, status, kondisi } = req.body;

    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Asset tidak ditemukan' });
    }

    if (kodeInventaris && kodeInventaris !== existing.kodeInventaris) {
      const duplicate = await prisma.asset.findUnique({ where: { kodeInventaris } });
      if (duplicate) {
        return res.status(409).json({ error: 'Kode inventaris sudah digunakan' });
      }
    }

    let fotoUrl = existing.fotoUrl;
    if (req.file) {
      fotoUrl = `/uploads/assets/${req.file.filename}`;
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        namaTv: namaTv || existing.namaTv,
        kodeInventaris: kodeInventaris || existing.kodeInventaris,
        merk: merk || existing.merk,
        ukuran: ukuran || existing.ukuran,
        lokasi: lokasi || existing.lokasi,
        status: status || existing.status,
        kondisi: kondisi || existing.kondisi,
        fotoUrl,
      },
    });

    await createAuditLog(req.user.id, 'UPDATE_ASSET', 'asset', asset.id, { changes: req.body });

    res.json({ message: 'Asset berhasil diupdate', asset });
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteAsset(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Asset tidak ditemukan' });
    }

    // Check if asset has active loans
    const activeLoans = await prisma.loan.count({
      where: {
        assetId: id,
        status: { in: ['PENDING', 'APPROVED', 'ONGOING'] },
      },
    });

    if (activeLoans > 0) {
      return res.status(400).json({ error: 'Tidak dapat menghapus asset yang masih memiliki peminjaman aktif' });
    }

    await prisma.asset.delete({ where: { id } });

    await createAuditLog(req.user.id, 'DELETE_ASSET', 'asset', id, { namaTv: existing.namaTv });

    res.json({ message: 'Asset berhasil dihapus' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function generateQRCode(req, res) {
  try {
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset tidak ditemukan' });
    }

    const qrDir = path.join(config.uploadDir, 'qrcodes');
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    const qrData = JSON.stringify({
      id: asset.id,
      kode: asset.kodeInventaris,
      nama: asset.namaTv,
    });

    const filename = `qr-${asset.kodeInventaris}.png`;
    const filepath = path.join(qrDir, filename);

    await QRCode.toFile(filepath, qrData, {
      width: 300,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    });

    const qrCodeUrl = `/uploads/qrcodes/${filename}`;

    await prisma.asset.update({
      where: { id },
      data: { qrCodeUrl },
    });

    res.json({ message: 'QR Code berhasil dibuat', qrCodeUrl });
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAssetByKode(req, res) {
  try {
    const { kode } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { kodeInventaris: kode },
      include: {
        loans: {
          where: { status: { in: ['ONGOING', 'APPROVED'] } },
          include: { user: { select: { nama: true, departemen: true } } },
        },
      },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset tidak ditemukan' });
    }

    res.json({ asset });
  } catch (error) {
    console.error('Get asset by kode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
