import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import useAssets from '../../hooks/useAssets';
import client from '../../api/client';
import { 
  Tv, Calendar, Plus, Clock, CheckCircle2, 
  AlertTriangle, ArrowRight, User 
} from 'lucide-react';

const statusConfig = {
  PENDING:  { badge: 'badge-amber', label: 'Menunggu Approval' },
  APPROVED: { badge: 'badge-blue',  label: 'Disetujui' },
  ONGOING:  { badge: 'badge-green', label: 'Sedang Berjalan' },
  OVERDUE:  { badge: 'badge-red',   label: 'Terlambat' },
  RETURNED: { badge: 'badge-gray',  label: 'Selesai' },
  REJECTED: { badge: 'badge-red',   label: 'Ditolak' },
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { assets, fetchAssets } = useAssets();
  const [stats, setStats] = useState({ active: 0, pending: 0, returned: 0 });
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);

  useEffect(() => {
    fetchAssets();
    const load = async () => {
      try {
        const [lr, nr, sr] = await Promise.all([
          client.get('/loans'),
          client.get('/notifications'),
          client.get('/loans/schedule', { params: { all: 'true' } }),
        ]);
        const ls = lr.data.loans;
        setStats({
          active: ls.filter(l => ['ONGOING', 'OVERDUE'].includes(l.status)).length,
          pending: ls.filter(l => l.status === 'PENDING').length,
          returned: ls.filter(l => l.status === 'RETURNED').length,
        });
        setRecentNotifs(nr.data.notifications.slice(0, 4));
        setAllSchedules(sr.data.loans || []);
      } catch (e) {
        console.error('Error fetching employee dashboard:', e);
      }
    };
    load();
  }, [fetchAssets]);

  const activeBorrower = (assetId) => {
    const now = new Date();
    return allSchedules.find(l =>
      l.assetId === assetId &&
      ['ONGOING', 'APPROVED'].includes(l.status) &&
      new Date(l.tglPinjam) <= now && now <= new Date(l.tglKembaliRencana)
    );
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Selamat Datang, {user?.nama}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cek ketersediaan unit Smart TV dan lakukan pengajuan peminjaman ruangan.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/schedule"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-xs"
          >
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Jadwal Lengkap</span>
          </Link>

          {user?.isBlacklisted ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Peminjaman Ditangguhkan</span>
            </div>
          ) : (
            <Link
              to="/loans/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Ajukan Peminjaman</span>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Peminjaman Aktif</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{stats.active}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="card p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Menunggu Approval</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{stats.pending}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="card p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Selesai</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{stats.returned}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* TV Availability Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Katalog Unit Smart TV</h2>
          <span className="text-[11px] text-slate-400">Total {assets.length} Unit</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {assets.map((asset) => {
            const borrower = activeBorrower(asset.id);
            const isAvail = asset.status === 'TERSEDIA' && !borrower;
            return (
              <div key={asset.id} className="card p-4 flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {asset.kodeInventaris}
                    </span>
                    <span className={`badge ${isAvail ? 'badge-green' : 'badge-amber'}`}>
                      {isAvail ? 'Tersedia' : 'Sedang Dipakai'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">{asset.namaTv}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{asset.merk} · {asset.ukuran}</p>
                  <p className="text-xs text-slate-400 mt-1">{asset.lokasi}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {borrower ? (
                    <div className="text-[11px] text-slate-500 truncate">
                      Dipinjam: <strong className="text-slate-700">{borrower.user?.nama}</strong>
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-600 font-medium">
                      Siap dipinjam
                    </div>
                  )}

                  {!user?.isBlacklisted && (
                    <Link
                      to={`/loans/new?assetId=${asset.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 hover:text-slate-950"
                    >
                      <span>Pinjam</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
