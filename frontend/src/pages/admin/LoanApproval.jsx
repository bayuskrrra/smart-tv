import React, { useEffect, useState } from 'react';
import useLoans from '../../hooks/useLoans';
import { 
  Tv, User, Clock, Check, X, AlertTriangle, 
  ChevronRight, Calendar, Building2, ShieldAlert 
} from 'lucide-react';

export default function LoanApproval() {
  const { loans, loading, error, fetchLoans, approveLoan, rejectLoan } = useLoans();
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [catatanAdmin, setCatatanAdmin] = useState('');
  const [actionType, setActionType] = useState(''); // 'APPROVE' or 'REJECT'
  const [showActionModal, setShowActionModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchLoans({ status: 'PENDING' });

    // Auto-refresh every 10 seconds to sync with WhatsApp approvals
    const interval = setInterval(() => {
      fetchLoans({ status: 'PENDING' });
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchLoans]);

  const handleOpenAction = (loan, type) => {
    setSelectedLoan(loan);
    setActionType(type);
    setCatatanAdmin('');
    setShowActionModal(true);
  };

  const handleConfirmAction = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      if (actionType === 'APPROVE') {
        await approveLoan(selectedLoan.id, catatanAdmin);
      } else {
        await rejectLoan(selectedLoan.id, catatanAdmin);
      }
      setShowActionModal(false);
      fetchLoans({ status: 'PENDING' });
    } catch (err) {
      alert(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Persetujuan Peminjaman TV</h1>
        <p className="text-xs text-slate-400 font-medium">Proses persetujuan (approve/reject) dan perpanjangan peminjaman Smart TV.</p>
      </div>

      {/* Main Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm">
        {loading && loans.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-semibold">Memuat daftar pengajuan...</div>
        ) : loans.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Tv className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-650">Tidak ada pengajuan peminjaman baru</p>
            <p className="text-[10px] text-slate-400">Semua pengajuan pending telah diproses.</p>
          </div>
        ) : (
          loans.map((loan) => (
            <div key={loan.id} className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors">
              {/* Request Info */}
              <div className="space-y-4 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800">{loan.asset.namaTv}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">{loan.asset.kodeInventaris}</span>
                  </div>
                  {loan.isExtension && (
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-50 border border-amber-200 text-amber-700 rounded-lg">
                      PERPANJANGAN
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Peminjam</p>
                      <p className="text-slate-700 font-semibold">{loan.user.nama}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-slate-400">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Departemen</p>
                      <p className="text-slate-700 font-semibold">{loan.departemen}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-slate-400">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Rentang Waktu</p>
                      <p className="text-slate-700 font-semibold">
                        {new Date(loan.tglPinjam).toLocaleDateString('id-ID')} - {new Date(loan.tglKembaliRencana).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium">
                  <span className="font-bold text-slate-600">Keperluan:</span> {loan.keperluan}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 justify-end flex-shrink-0 w-full lg:w-auto">
                <button
                  onClick={() => handleOpenAction(loan, 'REJECT')}
                  className="w-full lg:w-auto px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors flex items-center justify-center"
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Tolak
                </button>
                <button
                  onClick={() => handleOpenAction(loan, 'APPROVE')}
                  className="w-full lg:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-md flex items-center justify-center"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Setujui
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirmation Modal */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form 
            onSubmit={handleConfirmAction}
            className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 border-slate-200 bg-white shadow-xl space-y-4 animate-slide-up"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                {actionType === 'APPROVE' ? 'Persetujuan Peminjaman' : 'Penolakan Peminjaman'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowActionModal(false)}
                className="text-slate-400 hover:text-slate-800 text-xs font-semibold"
              >
                Batal
              </button>
            </div>

            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Karyawan / Unit TV</p>
              <p className="text-xs font-bold text-slate-900 mt-1">
                {selectedLoan?.user.nama} • {selectedLoan?.asset.namaTv}
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Catatan / Instruksi Tambahan (Opsional)
              </label>
              <textarea
                rows="3"
                value={catatanAdmin}
                onChange={(e) => setCatatanAdmin(e.target.value)}
                placeholder={
                  actionType === 'APPROVE' 
                    ? 'Contoh: Disetujui. Silakan ambil unit TV beserta remote kontrol di Gedung A Lt.2.' 
                    : 'Contoh: Ditolak. Unit TV pada tanggal tersebut sedang dipakai untuk agenda Town Hall.'
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowActionModal(false)}
                className="px-4 py-2 rounded-xl hover:bg-slate-100 text-slate-400 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={processing}
                className={`px-5 py-2.5 rounded-xl text-slate-900 font-bold text-xs transition-colors shadow-md ${
                  actionType === 'APPROVE' 
                    ? 'bg-slate-900 hover:bg-slate-100' 
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {processing ? 'Memproses...' : actionType === 'APPROVE' ? 'Setujui Pengajuan' : 'Tolak Pengajuan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
