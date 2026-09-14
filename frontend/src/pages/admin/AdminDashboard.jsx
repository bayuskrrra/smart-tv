import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';
import { 
  Tv, Clock, Wrench, AlertTriangle, CheckCircle2, 
  ArrowRight, ClipboardCheck, ArrowLeftRight, FileBarChart, 
  TrendingUp, Calendar, AlertCircle 
} from 'lucide-react';

const statusConfig = {
  ONGOING:  { badge: 'badge-green', label: 'Aktif' },
  PENDING:  { badge: 'badge-amber', label: 'Menunggu Approval' },
  RETURNED: { badge: 'badge-gray',  label: 'Selesai' },
  REJECTED: { badge: 'badge-red',   label: 'Ditolak' },
  APPROVED: { badge: 'badge-blue',  label: 'Disetujui' },
  OVERDUE:  { badge: 'badge-red',   label: 'Terlambat' },
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.get('/reports/dashboard');
        setStats(res.data);
      } catch (err) {
        console.error('Error fetching admin dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        <span className="mt-3 text-xs text-slate-500 font-medium">Memuat data dashboard...</span>
      </div>
    );
  }

  const { 
    assetStats, 
    pendingCount = 0, 
    overdueLoans = [], 
    mostBorrowedAssets = [], 
    recentLoans = [] 
  } = stats || {};

  const kpis = [
    {
      label: 'Unit Tersedia',
      value: assetStats?.tersedia || 0,
      icon: Tv,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-100',
    },
    {
      label: 'Sedang Dipinjam',
      value: assetStats?.dipinjam || 0,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-100',
    },
    {
      label: 'Dalam Perbaikan',
      value: assetStats?.maintenance || 0,
      icon: Wrench,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-100',
    },
    {
      label: 'Rusak / Kendala',
      value: assetStats?.rusak || 0,
      icon: AlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50 border-rose-100',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard Utama</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Ringkasan inventaris Smart TV, status peminjaman aktif, dan aksi persetujuan.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="card p-4 sm:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tracking-tight">
                  {kpi.value}
                </p>
              </div>
              <div className={`w-11 h-11 rounded-xl border ${kpi.bg} flex items-center justify-center ${kpi.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Approval Banner */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-medium text-amber-900">
              Ada <strong className="font-bold">{pendingCount} pengajuan peminjaman</strong> yang memerlukan konfirmasi Anda.
            </span>
          </div>
          <Link
            to="/admin/loans"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <span>Tinjau Sekarang</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overdue Monitoring */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Monitoring Keterlambatan</h2>
              <span className="text-[11px] text-slate-400">Status real-time</span>
            </div>

            {overdueLoans.length === 0 ? (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50/60 border border-emerald-100 text-emerald-700 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Seluruh peminjaman tepat waktu. Tidak ada unit yang terlambat dikembalikan.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {overdueLoans.map((loan) => (
                  <div key={loan.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{loan.asset.namaTv}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Peminjam: {loan.user.nama} ({loan.user.departemen})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="badge badge-red">Terlambat</span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Batas: {new Date(loan.tglKembaliRencana).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Loans */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="section-title">Aktivitas Peminjaman Terbaru</h2>
              <Link to="/admin/schedule" className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentLoans.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Belum ada catatan peminjaman terkini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="t">
                  <thead>
                    <tr>
                      <th>Unit Smart TV</th>
                      <th>Peminjam</th>
                      <th>Periode</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLoans.map((loan) => {
                      const cfg = statusConfig[loan.status] || { badge: 'badge-gray', label: loan.status };
                      return (
                        <tr key={loan.id}>
                          <td className="font-semibold text-slate-800">
                            {loan.asset.namaTv}
                          </td>
                          <td>
                            <div className="text-xs font-medium text-slate-800">{loan.user.nama}</div>
                            <div className="text-[11px] text-slate-400">{loan.user.departemen}</div>
                          </td>
                          <td className="text-xs text-slate-600">
                            {new Date(loan.tglPinjam).toLocaleDateString('id-ID')}
                          </td>
                          <td>
                            <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col) */}
        <div className="space-y-6">
          {/* Most Borrowed TV */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Unit Paling Sering Dipinjam</h2>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>

            {mostBorrowedAssets.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada statistik peminjaman.</p>
            ) : (
              <div className="space-y-4">
                {mostBorrowedAssets.map((asset, i) => {
                  const max = mostBorrowedAssets[0]?.totalPinjam || 1;
                  const pct = Math.max(8, Math.round((asset.totalPinjam / max) * 100));
                  return (
                    <div key={asset.namaTv}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-medium text-slate-800 truncate">
                            {asset.namaTv}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-900 ml-2">
                          {asset.totalPinjam} kali
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-800 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card p-5">
            <h2 className="section-title mb-3">Pintasan Cepat</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { to: '/admin/assets',   label: 'Kelola TV',    icon: Tv },
                { to: '/admin/loans',    label: 'Persetujuan',  icon: ClipboardCheck },
                { to: '/admin/handover', label: 'Serah Terima', icon: ArrowLeftRight },
                { to: '/admin/reports',  label: 'Laporan',      icon: FileBarChart },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-slate-900 transition-all shadow-xs text-center"
                  >
                    <Icon className="w-4 h-4 text-slate-600" />
                    <span className="text-xs font-semibold">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
