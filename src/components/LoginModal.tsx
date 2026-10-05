import React, { useState } from 'react';
import { X, Mail, Lock, User, Shield, Eye, EyeOff, Loader2, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type TabId = 'general' | 'rescuer';
type GeneralMode = 'login' | 'register';

interface FormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  rescuerId: string;
  rescuerPassword: string;
}

export const LoginModal: React.FC = () => {
  const { closeLoginModal, loginWithGoogle, loginWithEmail, loginWithRescuerId, registerUser, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [generalMode, setGeneralMode] = useState<GeneralMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<FormState>({
    name: '', email: '', password: '', confirmPassword: '',
    rescuerId: '', rescuerPassword: '',
  });

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    setError(null);
  };

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      if (generalMode === 'register') {
        if (!form.name.trim()) { setError('Full name is required.'); return; }
        if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
        if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
        await registerUser(form.name, form.email, form.password);
      } else {
        await loginWithEmail(form.email, form.password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescuerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithRescuerId(form.rescuerId, form.rescuerPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid Rescuer ID or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      // Google Sign-In requires GIS SDK; show a helpful message
      await loginWithGoogle('');
    } catch {
      setError('Google Sign-In is not configured yet. Please use Email / Password below.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isLoading || isSubmitting;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closeLoginModal}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-[fadeSlideUp_0.25s_ease]">
        {/* Glow ring */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-cyan-500/30 via-blue-600/20 to-indigo-600/30 blur-sm" />

        <div className="relative rounded-2xl bg-[#070d1e] border border-[#1a2d5a]/80 shadow-[0_0_60px_rgba(0,210,255,0.08)] overflow-hidden">

          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-[#111d3a]">
            {/* Glow accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Logo */}
                <div className="relative w-9 h-9 flex items-center justify-center">
                  <svg className="w-9 h-9 drop-shadow-[0_0_10px_rgba(0,210,255,0.6)]" viewBox="0 0 32 32" fill="none">
                    <path d="M16 2L29 9.5V22.5L16 30L3 22.5V9.5L16 2Z" fill="#0c1a38" stroke="#00d2ff" strokeWidth="1.5" />
                    <path d="M16 2L29 9.5L16 17L3 9.5L16 2Z" fill="#1e40af" fillOpacity="0.85" />
                    <path d="M16 17V30L3 22.5V9.5L16 17Z" fill="#0284c7" fillOpacity="0.9" />
                    <path d="M16 17L29 9.5V22.5L16 30V17Z" fill="#0369a1" fillOpacity="0.75" />
                    <line x1="16" y1="17" x2="16" y2="30" stroke="#00d2ff" strokeWidth="1.5" />
                    <line x1="16" y1="17" x2="29" y2="9.5" stroke="#38bdf8" strokeWidth="1.5" />
                    <line x1="16" y1="17" x2="3" y2="9.5" stroke="#38bdf8" strokeWidth="1.5" />
                  </svg>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">Aero<span className="text-cyan-400 italic font-extrabold">Mesh</span></div>
                  <div className="text-[10px] font-mono tracking-[0.2em] text-slate-500 uppercase">Intelligence Platform</div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeLoginModal}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#0f1e40] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-4 p-1 rounded-xl bg-[#0a1225] border border-[#142345]">
              <button
                type="button"
                onClick={() => { setActiveTab('general'); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'general'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_12px_rgba(0,210,255,0.35)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                General User
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('rescuer'); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'rescuer'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-[0_0_12px_rgba(251,146,60,0.35)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Authorized Rescuer
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">

            {/* Error / Success */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* ── General User Tab ─────────────────────────────────────────── */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-[#1e3566] bg-[#0b1529] hover:bg-[#0d1a36] hover:border-cyan-500/40 text-sm font-semibold text-slate-200 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#142345]" />
                  <span className="text-[11px] text-slate-500 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-[#142345]" />
                </div>

                {/* Login / Register mode toggle */}
                <div className="flex p-1 rounded-xl bg-[#0a1225] border border-[#142345]">
                  {(['login', 'register'] as GeneralMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => { setGeneralMode(mode); setError(null); }}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        generalMode === mode
                          ? 'bg-[#0f1e40] text-cyan-400 border border-cyan-500/30'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleGeneralSubmit} className="space-y-3">
                  {generalMode === 'register' && (
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={form.name}
                        onChange={set('name')}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0b1429] border border-[#182d5a] focus:border-cyan-400 text-sm text-white placeholder:text-slate-500 outline-none transition-colors"
                      />
                    </div>
                  )}

                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={form.email}
                      onChange={set('email')}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0b1429] border border-[#182d5a] focus:border-cyan-400 text-sm text-white placeholder:text-slate-500 outline-none transition-colors"
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={form.password}
                      onChange={set('password')}
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#0b1429] border border-[#182d5a] focus:border-cyan-400 text-sm text-white placeholder:text-slate-500 outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {generalMode === 'register' && (
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Confirm Password"
                        value={form.confirmPassword}
                        onChange={set('confirmPassword')}
                        required
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#0b1429] border border-[#182d5a] focus:border-cyan-400 text-sm text-white placeholder:text-slate-500 outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-sm font-bold shadow-[0_0_20px_rgba(0,210,255,0.3)] hover:shadow-[0_0_30px_rgba(0,210,255,0.5)] transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                    {generalMode === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Authorized Rescuer Tab ────────────────────────────────────── */}
            {activeTab === 'rescuer' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-950/30 border border-amber-500/30">
                  <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    Authorized Rescuers use their unique <span className="font-mono text-amber-300">Rescuer ID</span> and password issued by AeroMesh Operations.
                  </p>
                </div>

                <form onSubmit={handleRescuerSubmit} className="space-y-3">
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Rescuer ID (e.g. RESC-2026-0001)"
                      value={form.rescuerId}
                      onChange={set('rescuerId')}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0b1429] border border-[#182d5a] focus:border-amber-400 text-sm text-white placeholder:text-slate-500 outline-none transition-colors font-mono"
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={form.rescuerPassword}
                      onChange={set('rescuerPassword')}
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#0b1429] border border-[#182d5a] focus:border-amber-400 text-sm text-white placeholder:text-slate-500 outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white text-sm font-bold shadow-[0_0_20px_rgba(251,146,60,0.3)] hover:shadow-[0_0_30px_rgba(251,146,60,0.5)] transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    Authenticate as Rescuer
                  </button>
                </form>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#111d3a] text-center">
            <p className="text-[10px] font-mono tracking-[0.15em] text-slate-600 uppercase">
              AeroMesh — Secured by JWT · All data encrypted
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
};
