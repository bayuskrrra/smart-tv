import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { 
  FileSpreadsheet, FileDown, Search, ShieldAlert, 
  UserMinus, UserPlus, Filter, Calendar, AlertTriangle 
} from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('REPORTS'); // 'REPORTS' or 'BLACKLIST'
  const [loans, setLoans] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters for reports
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [departemenFilter, setDepartemenFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // User search/filter
  const [userSearch, setUserSearch] = useState('');

  // Blacklist form state
  const [selectedUser, setSelectedUser] = useState(null);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'REPORTS') {
      fetchReportData();
    } else {
      fetchUserData();
    }
  }, [activeTab, startDate, endDate, departemenFilter, statusFilter, userSearch]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const res = await client.get('/reports/loans', {
        params: {
          startDate,
          endDate,
          departemen: departemenFilter,
          status: statusFilter
        }
      });
      setLoans(res.data.loans);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const res = await client.get('/users', {
        params: { search: userSearch }
      });
      setUsers(res.data.users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format) => {
    // Generate direct download link
    const query = new URLSearchParams({
      startDate,
      endDate,
      departemen: departemenFilter,
      format
    }).toString();
    
    window.open(`/api/reports/export?${query}`, '_blank');
  };

  const handleOpenBlacklist = (user) => {
    setSelectedUser(user);
    setBlacklistReason('');
    setShowBlacklistModal(true);
  };

  const handleToggleBlacklist = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await client.put(`/users/${selectedUser.id}/blacklist`, {
        isBlacklisted: !selectedUser.isBlacklisted,
        reason: blacklistReason
      });
      setShowBlacklistModal(false);
      fetchUserData();
    } catch (err) {
      alert('Gagal mengubah status blacklist: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">PENDING</span>;
      case 'APPROVED':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">APPROVED</span>;
      case 'ONGOING':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">ONGOING</span>;
      case 'OVERDUE':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">OVERDUE</span>;
      case 'RETURNED':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-500/10 border border-slate-500/20 text-slate-400 rounded-lg">RETURNED</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">REJECTED</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Title */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Laporan & Blacklist</h1>
        <p className="text-xs text-slate-400">Analisis data peminjaman bulanan dan kelola sanksi keterlambatan karyawan.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200/80">
        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'REPORTS' 
              ? 'border-brand-500 text-slate-600 bg-slate-100/5' 
              : 'border-transparent text-slate-400 hover:text-slate-800'
          }`}
        >
          Laporan Peminjaman
        </button>
        <button
          onClick={() => setActiveTab('BLACKLIST')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'BLACKLIST' 
              ? 'border-brand-500 text-slate-600 bg-slate-100/5' 
              : 'border-transparent text-slate-400 hover:text-slate-800'
          }`}
        >
          Kelola Blacklist User
        </button>
      </div>

      {activeTab === 'REPORTS' ? (
        /* REPORTS TAB */
        <div className="space-y-6">
          {/* Filters card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 border-slate-200 bg-white space-y-4">
            <h2 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center">
              <Filter className="w-4 h-4 mr-1.5" />
              Filter Laporan
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mulai Tanggal</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-850 bg-slate-50/60 text-slate-700 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sampai Tanggal</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-850 bg-slate-50/60 text-slate-700 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Departemen</label>
                <select
                  value={departemenFilter}
                  onChange={(e) => setDepartemenFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-850 bg-slate-50 text-slate-700 text-xs focus:outline-none focus:border-slate-400 font-medium"
                >
                  <option value="">Semua Departemen</option>
                  <option value="Marketing">Marketing</option>
                  <option value="HR">HR / HRD</option>
                  <option value="Finance">Finance</option>
                  <option value="Engineering">Engineering / IT</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status Peminjaman</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-850 bg-slate-50 text-slate-700 text-xs focus:outline-none focus:border-slate-400 font-medium"
                >
                  <option value="">Semua Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="ONGOING">Ongoing</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="RETURNED">Returned</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-850">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:border-slate-700 text-slate-700 font-bold text-xs transition-colors flex items-center"
              >
                <FileDown className="w-4 h-4 mr-1.5 text-slate-400" />
                Export CSV
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-md flex items-center"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                Export Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Mobile View: Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading && loans.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">Memuat laporan...</div>
              ) : loans.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">Tidak ada data peminjaman sesuai filter.</div>
              ) : (
                loans.map((loan) => (
                  <div key={loan.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">TANGGAL PINJAM</span>
                        <span className="text-xs font-bold text-slate-800">{new Date(loan.tglPinjam).toLocaleDateString('id-ID')}</span>
                      </div>
                      {getStatusBadge(loan.status)}
                    </div>

                    <div className="text-[10px] text-slate-505 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-150 space-y-1.5">
                      <p><span className="text-slate-400 font-bold">Peminjam:</span> {loan.user.nama} ({loan.departemen})</p>
                      <p><span className="text-slate-400 font-bold">Unit TV:</span> {loan.asset.namaTv} ({loan.asset.kodeInventaris})</p>
                      <p>
                        <span className="text-slate-400 font-bold">Kembali Rencana:</span> {new Date(loan.tglKembaliRencana).toLocaleDateString('id-ID')}
                      </p>
                      {loan.tglKembaliAktual && (
                        <p>
                          <span className="text-slate-400 font-bold">Kembali Aktual:</span> {new Date(loan.tglKembaliAktual).toLocaleDateString('id-ID')}
                        </p>
                      )}
                      <p><span className="text-slate-400 font-bold">Penyetuju:</span> {loan.approver?.nama || '-'}</p>
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
                    <th className="p-4">Tanggal Pinjam</th>
                    <th className="p-4">Peminjam / Dept</th>
                    <th className="p-4">Unit TV</th>
                    <th className="p-4">Tgl Pengembalian</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Penyetuju</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && loans.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-450 font-semibold">Memuat laporan...</td>
                    </tr>
                  ) : loans.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-450 font-semibold">Tidak ada data peminjaman sesuai filter.</td>
                    </tr>
                  ) : (
                    loans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-slate-50/30 transition-colors font-semibold text-slate-700">
                        <td className="p-4 text-slate-700">
                          {new Date(loan.tglPinjam).toLocaleDateString('id-ID')}
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{loan.user.nama}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{loan.departemen}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{loan.asset.namaTv}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{loan.asset.kodeInventaris}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-slate-700 font-semibold">Rencana: {new Date(loan.tglKembaliRencana).toLocaleDateString('id-ID')}</p>
                          {loan.tglKembaliAktual && (
                            <p className="text-[10px] text-slate-400 font-semibold">Aktual: {new Date(loan.tglKembaliAktual).toLocaleDateString('id-ID')}</p>
                          )}
                        </td>
                        <td className="p-4">
                          {getStatusBadge(loan.status)}
                        </td>
                        <td className="p-4 text-slate-500 font-semibold">
                          {loan.approver?.nama || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* BLACKLIST TAB */
        <div className="space-y-6">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Cari karyawan berdasarkan nama, email, atau dept..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs focus:outline-none focus:border-slate-400"
            />
          </div>

          {/* User checklist table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Mobile View: Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading && users.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">Memuat data karyawan...</div>
              ) : users.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">Tidak ada user ditemukan.</div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-800 text-xs">{user.nama}</h3>
                        <p className="text-[10px] text-slate-400 font-semibold">{user.email}</p>
                      </div>
                      {user.isBlacklisted ? (
                        <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[8px]">BLACKLIST</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[8px]">AKTIF</span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-505 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-150 space-y-1">
                      <p><span className="text-slate-400 font-bold">Departemen:</span> {user.departemen}</p>
                      <p>
                        <span className="text-slate-400 font-bold">Terlambat:</span>{' '}
                        <span className={`font-bold ${user.lateCount > 0 ? 'text-amber-600' : 'text-slate-500'}`}>{user.lateCount} kali</span>
                      </p>
                      <p><span className="text-slate-400 font-bold">Alasan Blacklist:</span> {user.blacklistReason || '-'}</p>
                    </div>

                    <div className="flex justify-end pt-1">
                      {user.isBlacklisted ? (
                        <button
                          onClick={() => handleOpenBlacklist(user)}
                          className="w-full px-3 py-1.5 rounded-xl border border-emerald-250 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] uppercase tracking-wider transition-colors inline-flex items-center justify-center shadow-sm"
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1" />
                          Lepas Blacklist
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenBlacklist(user)}
                          className="w-full px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] uppercase tracking-wider transition-colors inline-flex items-center justify-center shadow-sm"
                        >
                          <UserMinus className="w-3.5 h-3.5 mr-1" />
                          Blacklist Karyawan
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
                    <th className="p-4">Nama / Email</th>
                    <th className="p-4">Departemen</th>
                    <th className="p-4">Total Terlambat</th>
                    <th className="p-4">Status Blacklist</th>
                    <th className="p-4">Alasan</th>
                    <th className="p-4 text-right">Aksi Sanksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400 text-xs font-semibold">Memuat data karyawan...</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400 text-xs font-semibold">Tidak ada user ditemukan.</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/30 transition-colors font-semibold text-slate-700">
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{user.nama}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{user.email}</p>
                        </td>
                        <td className="p-4 text-slate-700">{user.departemen}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            user.lateCount > 0 ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-slate-100 text-slate-550'
                          }`}>
                            {user.lateCount} kali
                          </span>
                        </td>
                        <td className="p-4">
                          {user.isBlacklisted ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[9px]">YA</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold text-[9px]">TIDAK</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-500 font-semibold max-w-[200px] truncate">{user.blacklistReason || '-'}</td>
                        <td className="p-4 text-right">
                          {user.isBlacklisted ? (
                            <button
                              onClick={() => handleOpenBlacklist(user)}
                              className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] uppercase tracking-wider transition-colors inline-flex items-center shadow-sm"
                            >
                              <UserPlus className="w-3.5 h-3.5 mr-1" />
                              Lepas Blacklist
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenBlacklist(user)}
                              className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] uppercase tracking-wider transition-colors inline-flex items-center shadow-sm"
                            >
                              <UserMinus className="w-3.5 h-3.5 mr-1" />
                              Blacklist
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
        </div>
      )}

      {/* Blacklist Modal Form */}
      {showBlacklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form 
            onSubmit={handleToggleBlacklist}
            className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 border-slate-200 bg-white shadow-xl space-y-4 animate-slide-up"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                {selectedUser?.isBlacklisted ? 'Lepas Sanksi Blacklist' : 'Berikan Sanksi Blacklist'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowBlacklistModal(false)}
                className="text-slate-400 hover:text-slate-800 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>

            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Karyawan Terpilih</p>
              <p className="text-xs font-bold text-slate-900 mt-1">{selectedUser?.nama} ({selectedUser?.departemen})</p>
            </div>

            {!selectedUser?.isBlacklisted ? (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Alasan Blacklist</label>
                <textarea
                  rows="3"
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  required
                  placeholder="Contoh: Sering terlambat mengembalikan unit TV dan tidak membalas chat admin."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400"
                />
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start">
                <AlertTriangle className="w-5 h-5 mr-2.5 flex-shrink-0 mt-0.5" />
                <p className="font-semibold leading-relaxed">
                  Apakah Anda yakin ingin melepas status blacklist dari user ini? User akan kembali dapat mengajukan peminjaman unit TV.
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowBlacklistModal(false)}
                className="px-4 py-2 rounded-xl hover:bg-slate-100 text-slate-400 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2.5 rounded-xl text-slate-900 font-bold text-xs transition-colors shadow-md ${
                  selectedUser?.isBlacklisted 
                    ? 'bg-emerald-600 hover:bg-emerald-500' 
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {submitting ? 'Memproses...' : selectedUser?.isBlacklisted ? 'Lepas Blacklist' : 'Blacklist Karyawan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
