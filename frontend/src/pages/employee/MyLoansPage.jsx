import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useLoans from '../../hooks/useLoans';
import client from '../../api/client';
import { 
  Tv, Calendar, Clock, AlertCircle, Info, ChevronDown, 
  HelpCircle, ArrowRight, ShieldAlert
} from 'lucide-react';

export default function MyLoansPage() {
  const { loans, loading, error, fetchLoans, extendLoan } = useLoans();
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendData, setExtendData] = useState({
    tglKembaliRencana: '',
    keperluan: ''
  });
  const [extendError, setExtendError] = useState('');
  const [extendSuccess, setExtendSuccess] = useState('');
  const [extending, setExtending] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLoans(statusFilter ? { status: statusFilter } : {});

    // Auto-refresh every 10 seconds to sync with WhatsApp approvals
    const interval = setInterval(() => {
      fetchLoans(statusFilter ? { status: statusFilter } : {});
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchLoans, statusFilter]);

  const handleOpenExtend = (loan) => {
    setSelectedLoan(loan);
    setExtendData({
      tglKembaliRencana: '',
      keperluan: `Perpanjangan peminjaman ${loan.asset.namaTv} untuk kelanjutan agenda: ${loan.keperluan}`
    });
    setExtendError('');
    setExtendSuccess('');
    setShowExtendModal(true);
  };

  const handleExtendSubmit = async (e) => {
    e.preventDefault();
    setExtendError('');
    setExtendSuccess('');
    setExtending(true);

    try {
      await extendLoan(selectedLoan.id, extendData);
      setExtendSuccess('Pengajuan perpanjangan berhasil dikirim! Menunggu approval admin.');
      setTimeout(() => {
        setShowExtendModal(false);
        fetchLoans(statusFilter ? { status: statusFilter } : {});
      }, 2000);
    } catch (err) {
      setExtendError(err);
    } finally {
      setExtending(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700 rounded-lg">PENDING</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg">APPROVED</span>;
      case 'ONGOING':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">ONGOING / DIPAKAI</span>;
      case 'OVERDUE':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">TERLAMBAT (OVERDUE)</span>;
      case 'RETURNED':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600 rounded-lg">DIKEMBALIKAN</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">DITOLAK</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Riwayat & Pengajuan Peminjaman</h1>
          <p className="text-xs text-slate-500 font-medium">Lihat status tracking dan ajukan perpanjangan peminjaman Anda</p>
        </div>

        {/* Filter Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-4 pr-10 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs focus:outline-none focus:border-slate-400 appearance-none font-semibold min-w-[160px]"
          >
            <option value="">Semua Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="ONGOING">Ongoing</option>
            <option value="OVERDUE">Overdue</option>
            <option value="RETURNED">Returned</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center">
          <ShieldAlert className="w-4 h-4 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* Main List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs font-semibold">Memuat data...</div>
        ) : loans.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <Tv className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Tidak ada pengajuan peminjaman ditemukan</p>
            <p className="text-[10px] text-slate-400 mt-1">Coba ubah filter status atau buat pengajuan baru.</p>
          </div>
        ) : (
          loans.map((loan) => (
            <div 
              key={loan.id} 
              className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm"
            >
              {/* Left Column info */}
              <div className="space-y-4 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800">{loan.asset.namaTv}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">{loan.asset.kodeInventaris}</span>
                  </div>
                  {getStatusBadge(loan.status)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-medium text-slate-500">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Waktu Mulai Pinjam</p>
                      <p className="text-slate-700 font-semibold">{new Date(loan.tglPinjam).toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Batas Waktu Kembali</p>
                      <p className="text-slate-700 font-semibold">{new Date(loan.tglKembaliRencana).toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 md:col-span-2 lg:col-span-1">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Keperluan</p>
                      <p className="text-slate-700 font-semibold line-clamp-1">{loan.keperluan}</p>
                    </div>
                  </div>
                </div>

                {loan.catatanAdmin && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <span className="font-bold text-slate-700">Catatan Admin:</span> {loan.catatanAdmin}
                  </div>
                )}
              </div>

              {/* Action columns */}
              <div className="flex items-center space-x-3 justify-end flex-shrink-0">
                {['ONGOING', 'APPROVED'].includes(loan.status) && (
                  <button
                    onClick={() => handleOpenExtend(loan)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-sm"
                  >
                    Minta Perpanjangan
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Extension Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form 
            onSubmit={handleExtendSubmit}
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-5 animate-slide-up"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Form Pengajuan Perpanjangan</h3>
              <button 
                type="button"
                onClick={() => setShowExtendModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>

            {extendError && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
                {extendError}
              </div>
            )}

            {extendSuccess && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                {extendSuccess}
              </div>
            )}

            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Unit TV Terpilih</p>
              <p className="text-xs font-bold text-slate-800 mt-1">{selectedLoan?.asset.namaTv} ({selectedLoan?.asset.kodeInventaris})</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tanggal Pengembalian Baru</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="datetime-local"
                  name="tglKembaliRencana"
                  value={extendData.tglKembaliRencana}
                  onChange={(e) => setExtendData(prev => ({ ...prev, tglKembaliRencana: e.target.value }))}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Alasan / Detail Perpanjangan</label>
              <textarea
                rows="3"
                value={extendData.keperluan}
                onChange={(e) => setExtendData(prev => ({ ...prev, keperluan: e.target.value }))}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowExtendModal(false)}
                className="px-4 py-2 rounded-xl hover:bg-slate-100 text-slate-500 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={extending}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-md disabled:opacity-50"
              >
                {extending ? 'Memproses...' : 'Kirim Perpanjangan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
