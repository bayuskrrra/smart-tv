import React, { useEffect, useState, useRef } from 'react';
import useLoans from '../../hooks/useLoans';
import client from '../../api/client';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  Tv, User, Calendar, Upload, FileText, ArrowUpRight, 
  ArrowDownLeft, CheckCircle, AlertTriangle, Scan, X, Camera 
} from 'lucide-react';

export default function HandoverPage() {
  const { loans, loading, fetchLoans, recordPickup, recordReturn } = useLoans();
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [actionType, setActionType] = useState(''); // 'PICKUP' or 'RETURN'
  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Form Fields
  const [kondisi, setKondisi] = useState('Baik');
  const [catatan, setCatatan] = useState('');
  const [hasKerusakan, setHasKerusakan] = useState(false);
  const [fotoFile, setFotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const scannerRef = useRef(null);

  useEffect(() => {
    fetchLoans();

    // Auto-refresh every 10 seconds to sync with WhatsApp approvals
    const interval = setInterval(() => {
      fetchLoans();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchLoans]);

  // Handle Scanning QR
  const startScanning = () => {
    setShowScanner(true);
    setSuccess('');
    setError('');
    
    // Allow React layout to render the reader element before instantiating scanner
    setTimeout(() => {
      const qrScanner = new Html5QrcodeScanner(
        "qr-reader", 
        { fps: 10, qrbox: 250 },
        /* verbose= */ false
      );
      
      qrScanner.render(
        async (decodedText) => {
          qrScanner.clear();
          setShowScanner(false);
          
          try {
            // Decoded text is a JSON string generated from QR Code
            const data = JSON.parse(decodedText);
            
            // Search asset and its active loan
            const res = await client.get(`/assets/scan/${data.kode}`);
            const asset = res.data.asset;
            
            if (asset && asset.loans && asset.loans.length > 0) {
              const activeLoan = asset.loans[0];
              // Launch form based on status
              if (activeLoan.status === 'APPROVED') {
                handleOpenForm(activeLoan, 'PICKUP');
              } else if (['ONGOING', 'OVERDUE'].includes(activeLoan.status)) {
                handleOpenForm(activeLoan, 'RETURN');
              } else {
                setError(`Aset ${data.kode} ditemukan, tetapi status peminjaman adalah ${activeLoan.status}.`);
              }
            } else {
              setError(`Aset ${data.kode} ditemukan, tetapi tidak memiliki peminjaman aktif.`);
            }
          } catch (err) {
            setError('Gagal membaca data QR Code atau TV tidak ditemukan.');
          }
        }, 
        (err) => {
          // scanner scanning...
        }
      );
      
      scannerRef.current = qrScanner;
    }, 100);
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setShowScanner(false);
  };

  const handleOpenForm = (loan, type) => {
    setSelectedLoan(loan);
    setActionType(type);
    setKondisi(type === 'PICKUP' ? 'Baik' : 'Baik, lengkap');
    setCatatan('');
    setHasKerusakan(false);
    setFotoFile(null);
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleFileChange = (e) => {
    setFotoFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const submission = new FormData();
    submission.append('kondisi', kondisi);
    submission.append('catatan', catatan);
    if (fotoFile) {
      submission.append('foto', fotoFile);
    }
    if (actionType === 'RETURN') {
      submission.append('hasKerusakan', hasKerusakan);
    }

    try {
      if (actionType === 'PICKUP') {
        await recordPickup(selectedLoan.id, submission);
        setSuccess('Pengambilan TV berhasil dicatat! Status TV diperbarui.');
      } else {
        await recordReturn(selectedLoan.id, submission);
        setSuccess('Pengembalian TV berhasil dicatat! Status TV diperbarui.');
      }

      setTimeout(() => {
        setShowModal(false);
        fetchLoans();
      }, 1500);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const eligibleForHandover = loans.filter(l => 
    l.status === 'APPROVED' || l.status === 'ONGOING' || l.status === 'OVERDUE'
  );

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header and Scan Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Serah Terima & Pengembalian</h1>
          <p className="text-xs text-slate-400 font-medium">Catat serah terima TV saat pengambilan atau pengembalian dengan checklist kondisi.</p>
        </div>
        <button
          onClick={startScanning}
          className="inline-flex items-center px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-100 text-white font-bold text-xs shadow-md transition-colors"
        >
          <Scan className="w-4 h-4 mr-2" />
          Scan QR Code Cepat
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs font-semibold rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center">
          <AlertTriangle className="w-4.5 h-4.5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* QR Scanner Overlay Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-50/90 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 border-slate-200 bg-white shadow-xl text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-extrabold text-slate-400 uppercase">Scanner QR Code</span>
              <button onClick={stopScanning} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl bg-black border border-slate-200">
              <div id="qr-reader" className="w-full"></div>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              Arahkan kamera ke QR Code unit TV untuk memproses serah terima secara otomatis.
            </p>
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading && eligibleForHandover.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">Memuat data peminjaman...</div>
          ) : eligibleForHandover.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">Tidak ada peminjaman yang siap untuk serah terima saat ini.</div>
          ) : (
            eligibleForHandover.map((loan) => (
              <div key={loan.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-800 text-xs">{loan.asset.namaTv}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">{loan.asset.kodeInventaris}</p>
                  </div>
                  {loan.status === 'APPROVED' ? (
                    <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[9px]">READY FOR PICKUP</span>
                  ) : loan.status === 'OVERDUE' ? (
                    <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[9px]">OVERDUE</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[9px]">ONGOING / OUT</span>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 font-semibold space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                  <p><span className="text-slate-400">Peminjam:</span> {loan.user.nama} ({loan.departemen})</p>
                  <p><span className="text-slate-400">Masa Pinjam:</span> {new Date(loan.tglPinjam).toLocaleDateString('id-ID')} s/d {new Date(loan.tglKembaliRencana).toLocaleDateString('id-ID')}</p>
                </div>

                <div className="flex justify-end pt-1">
                  {loan.status === 'APPROVED' ? (
                    <button
                      onClick={() => handleOpenForm(loan, 'PICKUP')}
                      className="w-full px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors inline-flex items-center justify-center shadow-sm"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                      Serahkan TV
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenForm(loan, 'RETURN')}
                      className="w-full px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors inline-flex items-center justify-center shadow-sm"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />
                      Terima Kembali
                    </button>
                  )}
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
                <th className="p-4">Unit TV</th>
                <th className="p-4">Peminjam</th>
                <th className="p-4">Masa Pinjam</th>
                <th className="p-4">Status Pengajuan</th>
                <th className="p-4 text-right">Aksi Serah Terima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && eligibleForHandover.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 text-xs font-semibold">Memuat data peminjaman...</td>
                </tr>
              ) : eligibleForHandover.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 text-xs font-semibold">Tidak ada peminjaman yang siap untuk serah terima saat ini.</td>
                </tr>
              ) : (
                eligibleForHandover.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/30 transition-colors font-semibold text-slate-700">
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{loan.asset.namaTv}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{loan.asset.kodeInventaris}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{loan.user.nama}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{loan.departemen}</p>
                    </td>
                    <td className="p-4 font-semibold text-slate-700">
                      <p>{new Date(loan.tglPinjam).toLocaleDateString('id-ID')}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">s/d {new Date(loan.tglKembaliRencana).toLocaleDateString('id-ID')}</p>
                    </td>
                    <td className="p-4">
                      {loan.status === 'APPROVED' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[9px]">READY FOR PICKUP</span>
                      ) : loan.status === 'OVERDUE' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[9px]">OVERDUE</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[9px]">ONGOING / OUT</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {loan.status === 'APPROVED' ? (
                        <button
                          onClick={() => handleOpenForm(loan, 'PICKUP')}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors inline-flex items-center shadow-sm"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                          Serahkan TV
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenForm(loan, 'RETURN')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors inline-flex items-center shadow-sm"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />
                          Terima Kembali
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Handover Pickup/Return Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form 
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 border-slate-200 bg-white shadow-xl space-y-4 animate-slide-up"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                {actionType === 'PICKUP' ? 'Konfirmasi Penyerahan TV' : 'Konfirmasi Pengembalian TV'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-800 text-xs font-semibold"
              >
                Batal
              </button>
            </div>

            {error && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                {success}
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Detail Unit & Peminjam</p>
              <p className="text-xs font-bold text-slate-900">{selectedLoan?.asset.namaTv} ({selectedLoan?.asset.kodeInventaris})</p>
              <p className="text-[10px] text-slate-400">Peminjam: {selectedLoan?.user.nama} ({selectedLoan?.user.departemen})</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pemeriksaan Kondisi TV</label>
              <input
                type="text"
                value={kondisi}
                onChange={(e) => setKondisi(e.target.value)}
                required
                placeholder="Contoh: Layar bersih, kabel lengkap, remot berfungsi"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Catatan Tambahan</label>
              <textarea
                rows="2"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Beri keterangan tambahan jika ada..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Upload Foto Kondisi</label>
                <div className="relative flex items-center justify-center w-full h-10 border border-slate-200 bg-slate-50 rounded-lg hover:border-brand-500 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Camera className="w-4 h-4 mr-2 text-slate-500" />
                  <span className="text-[10px] text-slate-400 font-bold truncate max-w-[120px]">
                    {fotoFile ? fotoFile.name : 'Ambil Foto TV'}
                  </span>
                </div>
              </div>

              {actionType === 'RETURN' && (
                <div className="flex items-center h-full pt-6">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasKerusakan}
                      onChange={(e) => setHasKerusakan(e.target.checked)}
                      className="w-4.5 h-4.5 text-brand-600 bg-slate-50 border-slate-200 rounded focus:ring-brand-500 focus:ring-2 focus:ring-offset-slate-900"
                    />
                    <span className="ml-2 text-[10px] font-bold text-rose-400 uppercase tracking-wide">
                      Ada Kerusakan / Kehilangan
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl hover:bg-slate-100 text-slate-400 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-100 text-white font-bold text-xs transition-colors shadow-md disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Konfirmasi Digital'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
