import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Tv, ArrowRightLeft } from 'lucide-react';

export default function Layout() {
  const { user, viewMode, setViewMode, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Tv className="w-5 h-5" />
          </div>
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Memuat sistem...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const showBanner = user?.role === 'ADMIN' && viewMode === 'KARYAWAN';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        {showBanner && (
          <div className="h-10 px-4 md:px-6 bg-amber-50 border-b border-amber-200 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-amber-800 font-medium truncate">
              Pratinjau Mode Karyawan aktif. Anda sedang melihat antarmuka karyawan.
            </span>
            <button
              onClick={() => setViewMode('ADMIN')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition-colors"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>Kembali ke Admin</span>
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
