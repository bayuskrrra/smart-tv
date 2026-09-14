import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  LayoutDashboard, Calendar, ClipboardCheck, 
  ArrowLeftRight, FileBarChart, MonitorPlay, X, 
  ShieldCheck
} from 'lucide-react';

const adminMenu = [
  { path: '/admin/dashboard', icon: LayoutDashboard, name: 'Dashboard' },
  { path: '/admin/schedule',  icon: Calendar,        name: 'Jadwal Peminjaman' },
  { path: '/admin/assets',    icon: MonitorPlay,     name: 'Manajemen TV' },
  { path: '/admin/loans',     icon: ClipboardCheck,  name: 'Persetujuan' },
  { path: '/admin/handover',  icon: ArrowLeftRight,  name: 'Serah Terima' },
  { path: '/admin/reports',   icon: FileBarChart,    name: 'Laporan Peminjaman' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();

  return (
    <>
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden" 
        />
      )}

      <aside className={`fixed top-0 bottom-0 left-0 z-50 md:static w-60 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen transition-transform duration-200 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Brand */}
        <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/logo-sekolah.png"
              alt="Logo SMP N 6 Denpasar"
              className="w-10 h-10 object-contain flex-shrink-0"
            />
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">SMP N 6 Denpasar</p>
              <p className="text-[11px] text-slate-400 font-medium">Sistem Peminjaman Smart TV</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.nama || 'Administrator'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-slate-500 font-medium truncate">{user?.departemen || 'IT'}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-semibold uppercase">
                  ADMIN
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Section Label */}
        <div className="px-4 pt-4 pb-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Panel Administrator
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          {adminMenu.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-slate-500" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-slate-100 text-[11px] text-slate-400">
          v1.0 Admin Portal
        </div>
      </aside>
    </>
  );
}
