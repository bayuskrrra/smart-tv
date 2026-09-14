import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import useAssets from '../../hooks/useAssets';
import useLoans from '../../hooks/useLoans';
import client from '../../api/client';
import { 
  Tv, Calendar, FileText, Building2, HelpCircle, 
  AlertTriangle, CheckCircle, Info, ArrowLeft 
} from 'lucide-react';

export default function NewLoanPage() {
  const { user } = useAuth();
  const { assets, fetchAssets } = useAssets();
  const { createLoan, loading: submitLoading } = useLoans();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    assetId: '',
    tglPinjam: '',
    tglKembaliRencana: '',
    keperluan: '',
    departemen: user?.departemen || 'Marketing'
  });

  const [availability, setAvailability] = useState({
    checked: false,
    available: false,
    checking: false,
    conflict: null,
    error: null
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [existingSchedules, setExistingSchedules] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  useEffect(() => {
    fetchAssets();
    fetchTVTimeline();
  }, [fetchAssets]);

  const fetchTVTimeline = async () => {
    try {
      setLoadingSchedule(true);
      const res = await client.get('/loans/schedule', { params: { all: 'true' } });
      setExistingSchedules(res.data.loans || []);
    } catch (err) {
      console.error('Error fetching schedules in NewLoanPage:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Filter schedules for the currently selected TV
  const selectedTVSchedules = existingSchedules.filter(
    (s) => s.assetId === formData.assetId && ['APPROVED', 'ONGOING', 'PENDING'].includes(s.status)
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setAvailability({ checked: false, available: false, checking: false, conflict: null, error: null });
    setError('');
  };

  const verifyAvailability = async () => {
    if (!formData.assetId || !formData.tglPinjam || !formData.tglKembaliRencana) {
      setError('Harap pilih TV, tanggal pinjam, dan tanggal kembali terlebih dahulu.');
      return;
    }

    const start = new Date(formData.tglPinjam);
    const end = new Date(formData.tglKembaliRencana);
    if (end <= start) {
      setError('Tanggal pengembalian rencana harus setelah tanggal pinjam.');
      return;
    }

    setAvailability(prev => ({ ...prev, checking: true, checked: false, error: null }));
    setError('');

    try {
      const res = await client.get('/loans/check-availability', {
        params: {
          assetId: formData.assetId,
          tglPinjam: formData.tglPinjam,
          tglKembaliRencana: formData.tglKembaliRencana
        }
      });

      setAvailability({
        checked: true,
        available: res.data.available,
        checking: false,
        conflict: res.data.conflict,
        error: null
      });
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Gagal mengecek ketersediaan TV';
      setAvailability(prev => ({ ...prev, checking: false, error: errMsg }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (user?.isBlacklisted) {
      setError('Status akun Anda diblacklist. Pengajuan ditolak.');
      return;
    }

    if (!availability.checked) {
      setError('Harap lakukan cek ketersediaan jadwal terlebih dahulu.');
      return;
    }

    if (!availability.available) {
      setError('Jadwal bentrok. Silakan ganti TV atau tanggal peminjaman.');
      return;
    }

    try {
      await createLoan(formData);
      setSuccess('Pengajuan peminjaman berhasil terkirim! Mengalihkan ke riwayat...');
      setTimeout(() => {
        navigate('/loans');
      }, 2000);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header back */}
      <div className="flex items-center space-x-3">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Ajukan Peminjaman Smart TV</h1>
          <p className="text-xs text-slate-500">Silakan isi formulir peminjaman berikut dengan benar</p>
        </div>
      </div>

      {user?.isBlacklisted && (
        <div className="flex items-start p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-bold">Akun Ter-blacklist</p>
            <p className="font-medium text-rose-600 mt-1">{user?.blacklistReason || 'Status peminjaman ditangguhkan oleh admin.'}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start p-3 text-xs font-semibold rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
          <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start p-3 text-xs font-semibold rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
          <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Pilih Smart TV</label>
              <div className="relative">
                <Tv className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  name="assetId"
                  value={formData.assetId}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400 appearance-none font-medium"
                >
                  <option value="">-- Pilih Unit TV --</option>
                  {assets.map((asset) => (
                    <option 
                      key={asset.id} 
                      value={asset.id}
                      disabled={asset.status === 'RUSAK' || asset.status === 'MAINTENANCE'}
                    >
                      {asset.namaTv} ({asset.ukuran}) [{asset.status}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Departemen Peminjam</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  name="departemen"
                  value={formData.departemen}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400 appearance-none font-medium"
                >
                  <option value="Marketing">Marketing</option>
                  <option value="HR">HR / HRD</option>
                  <option value="Finance">Finance / Accounting</option>
                  <option value="Engineering">Engineering / IT</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tanggal Mulai Pinjam</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="datetime-local"
                  name="tglPinjam"
                  value={formData.tglPinjam}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-850 text-xs focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tanggal Pengembalian Rencana</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="datetime-local"
                  name="tglKembaliRencana"
                  value={formData.tglKembaliRencana}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-850 text-xs focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Keperluan Peminjaman</label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <textarea
                name="keperluan"
                rows="4"
                value={formData.keperluan}
                onChange={handleInputChange}
                required
                placeholder="Contoh: Meeting evaluasi penjualan bulanan dengan Tim Marketing di Ruang Rapat Lt.2."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-850 text-xs focus:outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={verifyAvailability}
              disabled={availability.checking}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
            >
              {availability.checking ? 'Mengecek...' : 'Cek Ketersediaan TV'}
            </button>

            <button
              type="submit"
              disabled={submitLoading || user?.isBlacklisted || !availability.checked || !availability.available}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Kirim Pengajuan
            </button>
          </div>
        </form>

        {/* Right Info Box */}
        <div className="space-y-6">
          {/* Selected TV Bookings Timeline */}
          {formData.assetId && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">Jadwal Terisi TV Ini</h2>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {selectedTVSchedules.length} Jadwal
                </span>
              </div>

              {selectedTVSchedules.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-700 text-xs font-medium text-center space-y-1">
                  <p className="font-bold">Jadwal Masih Kosong</p>
                  <p className="text-[10px] text-emerald-600">Belum ada peminjaman untuk unit TV ini. Tanggal tersedia penuh.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedTVSchedules.map((s) => (
                    <div key={s.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{s.user?.nama}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          s.status === 'ONGOING' ? 'bg-emerald-100 text-emerald-800' :
                          s.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {s.status === 'ONGOING' ? 'Dipakai' : s.status === 'APPROVED' ? 'Booking' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{s.user?.departemen || s.departemen}</span>
                      </p>
                      <p className="text-[10px] text-slate-600 font-medium flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{new Date(s.tglPinjam).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} s/d {new Date(s.tglKembaliRencana).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">Status Jadwal</h2>
            
            {!availability.checked ? (
              <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 rounded-xl text-center text-slate-500">
                <HelpCircle className="w-7 h-7 mb-2 text-slate-400" />
                <p className="text-xs font-bold text-slate-700">Belum Diperiksa</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Lakukan pengecekan jadwal untuk memastikan unit TV tidak bentrok.</p>
              </div>
            ) : availability.available ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-250 text-emerald-700 space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4.5 h-4.5 flex-shrink-0 text-emerald-600" />
                  <span className="text-xs font-bold">Jadwal Tersedia!</span>
                </div>
                <p className="text-[10px] text-emerald-600 leading-relaxed font-semibold">Smart TV dapat dipinjam pada rentang tanggal tersebut. Anda dapat melanjutkan pengiriman form.</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 space-y-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 text-rose-600" />
                  <span className="text-xs font-bold">Jadwal Bentrok!</span>
                </div>
                {availability.conflict && (
                  <div className="text-[10px] text-rose-600 space-y-1 pt-1 font-semibold leading-relaxed">
                    <p><span className="font-extrabold">Peminjam:</span> {availability.conflict.peminjam} ({availability.conflict.departemen})</p>
                    <p><span className="font-extrabold">Mulai:</span> {new Date(availability.conflict.tglPinjam).toLocaleString('id-ID')}</p>
                    <p><span className="font-extrabold">Selesai:</span> {new Date(availability.conflict.tglKembaliRencana).toLocaleString('id-ID')}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-3">Ketentuan Peminjaman</h2>
            <ul className="space-y-2 text-[10px] text-slate-500 font-semibold leading-relaxed list-disc list-inside">
              <li>Peminjaman wajib diajukan maksimal H-1 sebelum pemakaian.</li>
              <li>Pastikan memeriksa kondisi TV saat pengambilan & pengembalian bersama Admin.</li>
              <li>Keterlambatan pengembalian dapat berakibat blacklist otomatis oleh sistem.</li>
              <li>Pengajuan perpanjangan memerlukan persetujuan ulang oleh Admin Aset.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
