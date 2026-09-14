import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(formData.email, formData.password);
      if (u.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        setError('Akses ditolak. Dashboard hanya dapat diakses oleh Administrator.');
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Email/Username atau kata sandi salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img
              src="/logo-sekolah.png"
              alt="Logo SMP N 6 Denpasar"
              className="w-20 h-20 object-contain drop-shadow-md"
            />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            SMP N 6 Denpasar
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Sistem Peminjaman Smart TV
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          {/* Header Action */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Portal Administrator
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Masuk untuk mengelola aset dan peminjaman
              </p>
            </div>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Admin Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Username atau Email Admin</label>
              <input
                type="text"
                name="email"
                value={formData.email}
                onChange={onChange}
                required
                placeholder="admin atau admin@admin.com"
                autoCapitalize="none"
                className="field"
              />
            </div>

            <div>
              <label className="label">Kata Sandi</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={onChange}
                  required
                  placeholder="••••••••"
                  className="field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary py-2.5 mt-2"
            >
              <span>{loading ? 'Memproses...' : 'Masuk ke Panel Admin'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Info Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 leading-relaxed">
              Peminjaman unit Smart TV oleh guru/karyawan dilakukan langsung melalui <strong>WhatsApp Bot</strong>.
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          Sistem Peminjaman Smart TV SMP N 6 Denpasar &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
