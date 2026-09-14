import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import useAssets from '../hooks/useAssets';
import { 
  Calendar, Clock, Tv, User, Building2, Search, Filter, 
  ChevronLeft, ChevronRight, CalendarDays, List, Info, 
  CheckCircle2, AlertCircle, Sparkles, PlusCircle, ArrowRight
} from 'lucide-react';

export default function SchedulePage() {
  const { assets, fetchAssets } = useAssets();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);

  useEffect(() => {
    fetchAssets();
    fetchSchedule();
  }, [fetchAssets]);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const res = await client.get('/loans/schedule', {
        params: { all: 'true' }
      });
      setLoans(res.data.loans || []);
    } catch (err) {
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered loans
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      // Asset filter
      if (selectedAssetId && loan.assetId !== selectedAssetId) return false;
      
      // Status filter
      if (statusFilter && loan.status !== statusFilter) return false;

      // Search query (peminjam name, departemen, namaTv, keperluan)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const userName = loan.user?.nama?.toLowerCase() || '';
        const userDept = (loan.user?.departemen || loan.departemen || '').toLowerCase();
        const tvName = loan.asset?.namaTv?.toLowerCase() || '';
        const tvCode = loan.asset?.kodeInventaris?.toLowerCase() || '';
        const req = loan.keperluan?.toLowerCase() || '';

        const match = userName.includes(query) || 
                      userDept.includes(query) || 
                      tvName.includes(query) || 
                      tvCode.includes(query) || 
                      req.includes(query);
        if (!match) return false;
      }

      return true;
    });
  }, [loans, selectedAssetId, statusFilter, searchQuery]);

  // Current active loans (happening right now)
  const activeNowLoans = useMemo(() => {
    const now = new Date();
    return loans.filter((l) => {
      const start = new Date(l.tglPinjam);
      const end = new Date(l.tglKembaliRencana);
      return (l.status === 'ONGOING' || l.status === 'APPROVED') && now >= start && now <= end;
    });
  }, [loans]);

  // Calendar calculations
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month filler days to complete grid (up to multiple of 7)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  const getEventsForDate = (date) => {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    return filteredLoans.filter((loan) => {
      const start = new Date(loan.tglPinjam);
      start.setHours(0, 0, 0, 0);
      const end = new Date(loan.tglKembaliRencana);
      end.setHours(23, 59, 59, 999);

      return target >= start && target <= end;
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700 rounded-lg">Menunggu Approval</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">Disetujui (Booking)</span>;
      case 'ONGOING':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg animate-pulse">Sedang Dipinjam</span>;
      case 'OVERDUE':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">Terlambat Kembali</span>;
      case 'RETURNED':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-500 rounded-lg">Selesai</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-600 rounded-lg">Ditolak</span>;
      default:
        return <span className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-lg">{status}</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <CalendarDays className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-800">Jadwal & Peminjam Smart TV</h1>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Lihat secara transparan siapa saja rekan kerja yang sedang meminjam atau sudah menjadwalkan Smart TV pada tanggal tertentu untuk menghindari bentrok pemakaian.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              to="/loans/new"
              className="inline-flex items-center px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Ajukan Peminjaman
            </Link>
          </div>
        </div>
      </div>

      {/* Live Active Now Banner */}
      {activeNowLoans.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              <span>Unit Sedang Dipakai Saat Ini ({activeNowLoans.length} TV)</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-600">Realtime Tracking</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeNowLoans.map((loan) => (
              <div key={loan.id} className="bg-white/80 backdrop-blur-sm border border-emerald-200/80 rounded-xl p-3.5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Tv className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[150px]">{loan.asset?.namaTv}</span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {loan.asset?.lokasi || 'Lokasi TV'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-1">
                  <div className="flex items-center space-x-1.5 font-semibold text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{loan.user?.nama}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({loan.user?.departemen || loan.departemen})</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sampai: <b>{formatDate(loan.tglKembaliRencana)}</b></span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic truncate pt-0.5">"{loan.keperluan}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & View Switcher Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari peminjam, departemen, atau unit TV..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:outline-none focus:border-slate-400 focus:bg-white transition-colors font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters & View toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* TV Dropdown Filter */}
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold focus:outline-none focus:border-slate-400"
            >
              <option value="">Semua Smart TV ({assets.length})</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.namaTv} ({asset.ukuran})
                </option>
              ))}
            </select>

            {/* Status Dropdown Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold focus:outline-none focus:border-slate-400"
            >
              <option value="">Semua Status</option>
              <option value="ONGOING">Sedang Dipinjam (Aktif)</option>
              <option value="APPROVED">Disetujui (Booking Terdaftar)</option>
              <option value="PENDING">Menunggu Persetujuan</option>
              <option value="RETURNED">Sudah Dikembalikan</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Daftar</span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Kalender</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Result Summary Tag */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 font-medium">
          <span>
            Menampilkan <b>{filteredLoans.length}</b> data peminjaman
            {selectedAssetId && ` untuk TV terpilih`}
            {searchQuery && ` dengan pencarian "${searchQuery}"`}
          </span>
          {(selectedAssetId || statusFilter || searchQuery) && (
            <button
              onClick={() => {
                setSelectedAssetId('');
                setStatusFilter('');
                setSearchQuery('');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
          <p className="text-xs text-slate-400 font-medium">Memuat jadwal dan daftar peminjam...</p>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST / TABLE TIMELINE VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {filteredLoans.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Tv className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Tidak ada jadwal peminjaman yang cocok</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Silakan coba ubah filter TV, status, atau kata kunci pencarian Anda.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLoans.map((loan) => (
                <div 
                  key={loan.id} 
                  className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: TV & Peminjam Info */}
                  <div className="flex items-start space-x-4">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 font-extrabold text-sm shadow-sm">
                      {loan.user?.nama?.charAt(0).toUpperCase() || 'U'}
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-800">
                          {loan.user?.nama}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <Building2 className="w-3 h-3 mr-1 text-slate-400" />
                          {loan.user?.departemen || loan.departemen}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-xs font-bold text-indigo-900">
                        <Tv className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        <span className="hover:underline">{loan.asset?.namaTv}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">({loan.asset?.kodeInventaris} · {loan.asset?.ukuran})</span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100 max-w-xl">
                        <span className="font-bold text-slate-700">Keperluan: </span>
                        {loan.keperluan}
                      </p>
                    </div>
                  </div>

                  {/* Right: Date Range & Status */}
                  <div className="flex flex-col md:items-end space-y-2.5 flex-shrink-0 pl-15 md:pl-0">
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(loan.status)}
                    </div>

                    <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 text-right space-y-1">
                      <div className="flex items-center md:justify-end space-x-1.5 text-[11px] font-bold text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Mulai: {formatDate(loan.tglPinjam)}</span>
                      </div>
                      <div className="flex items-center md:justify-end space-x-1.5 text-[11px] font-bold text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Selesai: {formatDate(loan.tglKembaliRencana)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* CALENDAR MONTH GRID VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          {/* Month Navigator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="text-base font-bold text-slate-800 capitalize">
                {currentMonth.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                Hari Ini
              </button>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 uppercase tracking-wider">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
              <div key={day} className="py-1.5">{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((item, index) => {
              const dateEvents = getEventsForDate(item.date);
              const isToday = new Date().toDateString() === item.date.toDateString();

              return (
                <div
                  key={index}
                  onClick={() => dateEvents.length > 0 && setSelectedDayEvents({ date: item.date, events: dateEvents })}
                  className={`min-h-[90px] md:min-h-[110px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                    item.isCurrentMonth
                      ? 'bg-white border-slate-200 hover:border-slate-400'
                      : 'bg-slate-50/60 border-slate-100 text-slate-300'
                  } ${isToday ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''} ${
                    dateEvents.length > 0 ? 'cursor-pointer hover:shadow-xs' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center'
                          : item.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {item.date.getDate()}
                    </span>

                    {dateEvents.length > 0 && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        {dateEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Badges of events on this day */}
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dateEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-white font-medium truncate flex items-center space-x-1"
                        title={`${event.user?.nama} - ${event.asset?.namaTv} (${event.keperluan})`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                        <span className="truncate">{event.user?.nama?.split(' ')[0]}: {event.asset?.namaTv?.replace('Smart TV ', '')}</span>
                      </div>
                    ))}
                    {dateEvents.length > 2 && (
                      <div className="text-[8px] font-bold text-indigo-600 pl-1">
                        +{dateEvents.length - 2} lainnya...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day Events Modal */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Jadwal Tanggal {selectedDayEvents.date.toLocaleDateString('id-ID', { dateStyle: 'full' })}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Terdapat {selectedDayEvents.events.length} peminjaman Smart TV pada tanggal ini
                </p>
              </div>
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 divide-y divide-slate-100">
              {selectedDayEvents.events.map((ev) => (
                <div key={ev.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-800">{ev.user?.nama}</span>
                      <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        {ev.user?.departemen || ev.departemen}
                      </span>
                    </div>
                    {getStatusBadge(ev.status)}
                  </div>

                  <div className="text-xs font-bold text-indigo-900 flex items-center space-x-1.5">
                    <Tv className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{ev.asset?.namaTv} ({ev.asset?.ukuran})</span>
                  </div>

                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 font-medium">
                    <p><span className="font-bold">Keperluan:</span> {ev.keperluan}</p>
                    <p className="text-slate-500">
                      <span className="font-bold">Waktu:</span> {formatDate(ev.tglPinjam)} s/d {formatDate(ev.tglKembaliRencana)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
