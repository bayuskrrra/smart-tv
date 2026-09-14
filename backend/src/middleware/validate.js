import { BadRequestError } from '../utils/errors.js';

export function validateLoanRequest(req, res, next) {
  const { assetId, tglPinjam, tglKembaliRencana, keperluan, departemen } = req.body;

  const errors = [];

  if (!assetId) errors.push('Asset ID wajib diisi');
  if (!tglPinjam) errors.push('Tanggal pinjam wajib diisi');
  if (!tglKembaliRencana) errors.push('Tanggal kembali rencana wajib diisi');
  if (!keperluan) errors.push('Keperluan wajib diisi');
  if (!departemen) errors.push('Departemen wajib diisi');

  if (tglPinjam && tglKembaliRencana) {
    const pinjam = new Date(tglPinjam);
    const kembali = new Date(tglKembaliRencana);
    if (kembali <= pinjam) {
      errors.push('Tanggal kembali harus setelah tanggal pinjam');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validasi gagal', details: errors });
  }

  next();
}

export function validateAsset(req, res, next) {
  const { namaTv, kodeInventaris, merk, ukuran, lokasi } = req.body;

  const errors = [];

  if (!namaTv) errors.push('Nama TV wajib diisi');
  if (!kodeInventaris) errors.push('Kode inventaris wajib diisi');
  if (!merk) errors.push('Merk wajib diisi');
  if (!ukuran) errors.push('Ukuran wajib diisi');
  if (!lokasi) errors.push('Lokasi wajib diisi');

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validasi gagal', details: errors });
  }

  next();
}
