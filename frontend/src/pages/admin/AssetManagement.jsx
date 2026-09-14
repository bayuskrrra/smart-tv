import React, { useEffect, useState } from 'react';
import useAssets from '../../hooks/useAssets';
import client from '../../api/client';
import { 
  Tv, Plus, Pencil, Trash2, QrCode, Search, 
  Upload, X, Check, AlertTriangle, ShieldCheck 
} from 'lucide-react';

export default function AssetManagement() {
  const { assets, loading, error, fetchAssets, createAsset, updateAsset, deleteAsset, generateQR } = useAssets();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  
  const [editingAsset, setEditingAsset] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [selectedAssetForQR, setSelectedAssetForQR] = useState(null);

  const [formData, setFormData] = useState({
    namaTv: '',
    kodeInventaris: '',
    merk: '',
    ukuran: '',
    lokasi: '',
    kondisi: 'Baik',
    status: 'TERSEDIA'
  });
  const [fotoFile, setFotoFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAssets({ search, status: statusFilter });
  }, [fetchAssets, search, statusFilter]);

  const handleOpenAdd = () => {
    setEditingAsset(null);
    setFormData({
      namaTv: '',
      kodeInventaris: '',
      merk: '',
      ukuran: '',
      lokasi: '',
      kondisi: 'Baik',
      status: 'TERSEDIA'
    });
    setFotoFile(null);
    setFormError('');
    setFormSuccess('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (asset) => {
    setEditingAsset(asset);
    setFormData({
      namaTv: asset.namaTv,
      kodeInventaris: asset.kodeInventaris,
      merk: asset.merk,
      ukuran: asset.ukuran,
      lokasi: asset.lokasi,
      kondisi: asset.kondisi,
      status: asset.status
    });
    setFotoFile(null);
    setFormError('');
    setFormSuccess('');
    setShowFormModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFotoFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    const submission = new FormData();
    Object.keys(formData).forEach(key => {
      submission.append(key, formData[key]);
    });
    if (fotoFile) {
      submission.append('foto', fotoFile);
    }

    try {
      if (editingAsset) {
        await updateAsset(editingAsset.id, submission);
        setFormSuccess('Asset berhasil diupdate!');
      } else {
        await createAsset(submission);
        setFormSuccess('Asset berhasil ditambahkan!');
      }

      setTimeout(() => {
        setShowFormModal(false);
        fetchAssets({ search, status: statusFilter });
      }, 1500);
    } catch (err) {
      setFormError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus unit TV ini?')) {
      try {
        await deleteAsset(id);
        fetchAssets({ search, status: statusFilter });
      } catch (err) {
        alert(err);
      }
    }
  };

  const handleOpenQR = async (asset) => {
    setSelectedAssetForQR(asset);
    try {
      if (asset.qrCodeUrl) {
        setQrCodeUrl(asset.qrCodeUrl);
      } else {
        const url = await generateQR(asset.id);
        setQrCodeUrl(url);
      }
      setShowQRModal(true);
    } catch (err) {
      alert('Gagal mendapatkan QR Code: ' + err);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'TERSEDIA':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'DIPINJAM':
        return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'MAINTENANCE':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'RUSAK':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Kelola Unit Smart TV</h1>
          <p className="text-xs text-slate-400 font-medium">Tambah, edit, hapus, atau generate QR code unit TV inventaris.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-100 text-white font-bold text-xs shadow-md transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Smart TV Baru
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama TV, merk, kode inventaris, atau lokasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs focus:outline-none focus:border-slate-400"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs focus:outline-none focus:border-slate-400 font-medium"
        >
          <option value="">Semua Status TV</option>
          <option value="TERSEDIA">Tersedia</option>
          <option value="DIPINJAM">Dipinjam</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="RUSAK">Rusak</option>
        </select>
      </div>

      {/* Asset Grid/Table Wrapper */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Mobile View: Grid of Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading && assets.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">Memuat data inventaris...</div>
          ) : assets.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">Tidak ada aset TV ditemukan.</div>
          ) : (
            assets.map((asset) => (
              <div key={asset.id} className="p-4 space-y-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center space-x-3.5">
                  <div className="w-14 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 text-slate-500">
                    {asset.fotoUrl ? (
                      <img src={asset.fotoUrl} alt={asset.namaTv} className="w-full h-full object-cover" />
                    ) : (
                      <Tv className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 text-xs truncate">{asset.namaTv}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">{asset.kodeInventaris} · {asset.merk}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                  <div>
                    <span className="text-slate-400 uppercase text-[8px] tracking-wider block mb-0.5">Lokasi</span>
                    <span className="text-slate-700">{asset.lokasi}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[8px] tracking-wider block mb-0.5">Ukuran</span>
                    <span className="text-slate-700">{asset.ukuran}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-400 uppercase text-[8px] tracking-wider block mb-0.5">Kondisi</span>
                    <span className="text-slate-700">{asset.kondisi}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-400 uppercase text-[8px] tracking-wider block mb-0.5">Status</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[8px] ${getStatusStyle(asset.status)}`}>
                      {asset.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenQR(asset)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-[10px] shadow-sm transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-400" />
                    <span>QR</span>
                  </button>
                  <button
                    onClick={() => handleOpenEdit(asset)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-[10px] shadow-sm transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-rose-250 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[10px] shadow-sm transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/50 font-bold text-slate-400">
                <th className="p-4">Foto / TV</th>
                <th className="p-4">Kode / Merk</th>
                <th className="p-4">Ukuran / Lokasi</th>
                <th className="p-4">Kondisi</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && assets.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400 text-xs font-semibold">Memuat data inventaris...</td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400 text-xs font-semibold">Tidak ada aset TV ditemukan.</td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/30 transition-colors font-semibold text-slate-700">
                    <td className="p-4">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-12 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 text-slate-500">
                          {asset.fotoUrl ? (
                            <img src={asset.fotoUrl} alt={asset.namaTv} className="w-full h-full object-cover" />
                          ) : (
                            <Tv className="w-5 h-5 text-slate-600" />
                          )}
                        </div>
                        <span className="font-bold text-slate-800">{asset.namaTv}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{asset.kodeInventaris}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{asset.merk}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-slate-850">{asset.ukuran}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{asset.lokasi}</p>
                    </td>
                    <td className="p-4 text-slate-500 font-semibold">{asset.kondisi}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg border font-bold text-[9px] ${getStatusStyle(asset.status)}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-2.5">
                        <button
                          onClick={() => handleOpenQR(asset)}
                          title="Tampilkan QR Code"
                          className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-450 hover:text-slate-700 transition-colors shadow-sm"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(asset)}
                          title="Edit Aset"
                          className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-450 hover:text-slate-700 transition-colors shadow-sm"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(asset.id)}
                          title="Hapus Aset"
                          className="p-1.5 rounded-lg border border-rose-250 hover:border-rose-350 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition-colors shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form 
            onSubmit={handleSubmit}
            className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 border-slate-200 bg-white shadow-xl space-y-4 animate-slide-up"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                {editingAsset ? 'Edit Detail Smart TV' : 'Tambah Smart TV Baru'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-slate-800 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>

            {formError && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                {formSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama TV</label>
                <input
                  type="text"
                  name="namaTv"
                  value={formData.namaTv}
                  onChange={handleInputChange}
                  required
                  placeholder="Contoh: Smart TV Ruang Training"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kode Inventaris</label>
                <input
                  type="text"
                  name="kodeInventaris"
                  value={formData.kodeInventaris}
                  onChange={handleInputChange}
                  required
                  placeholder="Contoh: TV-001"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Merk</label>
                <input
                  type="text"
                  name="merk"
                  value={formData.merk}
                  onChange={handleInputChange}
                  required
                  placeholder="Contoh: Samsung, LG, Sony"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ukuran Layar</label>
                <input
                  type="text"
                  name="ukuran"
                  value={formData.ukuran}
                  onChange={handleInputChange}
                  required
                  placeholder="Contoh: 55 inch"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lokasi Penyimpanan</label>
                <input
                  type="text"
                  name="lokasi"
                  value={formData.lokasi}
                  onChange={handleInputChange}
                  required
                  placeholder="Contoh: Gedung A Lt.2"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kondisi Awal</label>
                <input
                  type="text"
                  name="kondisi"
                  value={formData.kondisi}
                  onChange={handleInputChange}
                  required
                  placeholder="Contoh: Baik, lengkap dengan remot"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status Ketersediaan</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
                >
                  <option value="TERSEDIA">Tersedia</option>
                  <option value="DIPINJAM">Dipinjam</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="RUSAK">Rusak</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Upload Foto TV</label>
                <div className="relative flex items-center justify-center w-full h-10 border border-slate-200 bg-slate-50 rounded-lg hover:border-brand-500 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-4 h-4 mr-2 text-slate-500" />
                  <span className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]">
                    {fotoFile ? fotoFile.name : 'Pilih File Gambar'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 rounded-xl hover:bg-slate-100 text-slate-400 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-100 text-white font-bold text-xs transition-colors shadow-md disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Aset'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QR Code view modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 border-slate-200 bg-white shadow-xl text-center space-y-4 animate-slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">QR Code Smart TV</h3>
              <button 
                onClick={() => setShowQRModal(false)}
                className="text-slate-400 hover:text-slate-800 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner">
              <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
            </div>

            <div>
              <p className="text-xs font-extrabold text-slate-900">{selectedAssetForQR?.namaTv}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{selectedAssetForQR?.kodeInventaris}</p>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-700 text-slate-800 font-bold text-xs transition-colors"
            >
              Cetak QR Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
