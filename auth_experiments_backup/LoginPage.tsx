import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Shield, Mail, Lock, User, AlertCircle, CheckCircle2,
  ArrowRight, KeyRound, Eye, EyeOff, ShieldAlert, Sparkles, HelpCircle, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type AuthType = 'general' | 'rescuer';
type GeneralMode = 'login' | 'signup';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isRescuer, login, register, loginRescuer } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || (isRescuer ? '/dashboard' : '/');
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isRescuer, navigate, location]);

  const [authType, setAuthType] = useState<AuthType>('general');
  const [generalMode, setGeneralMode] = useState<GeneralMode>('login');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rescuerId, setRescuerId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  // Reset errors when toggling modes
  const handleAuthTypeChange = (type: AuthType) => {
    setAuthType(type);
    setError(null);
    setSuccessMsg(null);
  };

  const handleGeneralModeChange = (mode: GeneralMode) => {
    setGeneralMode(mode);
    setError(null);
    setSuccessMsg(null);
  };

  // Quick autofill for tester convenience
  const handleAutofillRescuer = (id: string) => {
    setRescuerId(id);
    setPassword('Rescuer@AeroMesh2026!');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (authType === 'general') {
        if (generalMode === 'signup') {
          if (!name.trim()) {
            throw new Error('Please enter your full name.');
          }
          if (!email.trim() || !email.includes('@')) {
            throw new Error('Please enter a valid email address.');
          }
          if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long.');
          }
          if (password !== confirmPassword) {
            throw new Error('Passwords do not match.');
          }

          const user = await register(name, email, password);
          setSuccessMsg(`Welcome, ${user.name}! Account registered successfully.`);
          navigate('/', { replace: true });
        } else {
          // General Login
          if (!email.trim()) {
            throw new Error('Please enter your email.');
          }
          if (!password) {
            throw new Error('Please enter your password.');
          }

          await login(email, password);
          navigate('/', { replace: true });
        }
      } else {
        // Rescuer Login
        if (!rescuerId.trim()) {
          throw new Error('Please enter your Rescuer ID.');
        }
        if (!password) {
          throw new Error('Please enter your password.');
        }

        await loginRescuer(rescuerId.trim(), password);
        // Authorized Rescuer goes straight to dashboard with responder state
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020712] text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Background Cybernetic Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 210, 255, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 210, 255, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 80%)',
        }}
      />

      {/* Atmospheric Ambient Lighting */}
      <div className="absolute top-[10%] left-[25%] w-[550px] h-[550px] bg-blue-600/12 blur-[170px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[15%] right-[20%] w-[500px] h-[500px] bg-cyan-500/12 blur-[160px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-3 group">
            {/* 3D Isometric Faceted Cube Logo */}
            <div className="relative w-10 h-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <svg className="w-10 h-10 drop-shadow-[0_0_16px_rgba(0,210,255,0.7)]" viewBox="0 0 32 32" fill="none">
                <path d="M16 2L29 9.5V22.5L16 30L3 22.5V9.5L16 2Z" fill="#0c1a38" stroke="#00d2ff" strokeWidth="1.5" />
                <path d="M16 2L29 9.5L16 17L3 9.5L16 2Z" fill="#1e40af" fillOpacity="0.85" />
                <path d="M16 17V30L3 22.5V9.5L16 17Z" fill="#0284c7" fillOpacity="0.9" />
                <path d="M16 17L29 9.5V22.5L16 30V17Z" fill="#0369a1" fillOpacity="0.75" />
                <line x1="16" y1="17" x2="16" y2="30" stroke="#00d2ff" strokeWidth="1.5" />
                <line x1="16" y1="17" x2="29" y2="9.5" stroke="#38bdf8" strokeWidth="1.5" />
                <line x1="16" y1="17" x2="3" y2="9.5" stroke="#38bdf8" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="text-2xl font-bold tracking-tight text-white font-sans">
              Aero<span className="text-cyan-400 font-extrabold italic">Mesh</span>
            </span>
          </Link>
          <p className="text-xs text-slate-400">
            AI-Powered Spatial Intelligence & Tactical Photogrammetry
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-[#080e1e]/90 backdrop-blur-xl border border-[#142345] rounded-2xl shadow-[0_0_40px_rgba(0,10,30,0.8)] p-6 sm:p-8 space-y-6">
          
          {/* Main User Type Toggle */}
          <div className="p-1 rounded-xl bg-[#040a18] border border-[#16274e] grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => handleAuthTypeChange('general')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authType === 'general'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_15px_rgba(0,210,255,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>General User</span>
            </button>

            <button
              type="button"
              onClick={() => handleAuthTypeChange('rescuer')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authType === 'rescuer'
                  ? 'bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-500 text-white shadow-[0_0_18px_rgba(37,99,235,0.5)] border border-cyan-400/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Authorized Rescuer</span>
            </button>
          </div>

          {/* Subheader / Mode Title */}
          {authType === 'general' ? (
            <div className="flex items-center justify-between border-b border-[#142345] pb-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  {generalMode === 'login' ? 'General User Sign In' : 'Create General Account'}
                </h2>
                <p className="text-xs text-slate-400">
                  {generalMode === 'login'
                    ? 'Access spatial analyses and 3D drone models'
                    : 'Register for personal drone inspection access'}
                </p>
              </div>

              {/* Mode switch button */}
              <button
                type="button"
                onClick={() => handleGeneralModeChange(generalMode === 'login' ? 'signup' : 'login')}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors underline cursor-pointer"
              >
                {generalMode === 'login' ? 'Create Account' : 'Sign In'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Authorized Rescuer Portal</h2>
                  <p className="text-xs text-slate-400">Tactical First Responder & Command Access</p>
                </div>
              </div>

              {/* Security Banner required by spec */}
              <div className="p-3 rounded-xl bg-blue-950/40 border border-cyan-500/30 text-cyan-200 text-xs flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <span className="font-semibold text-white">Authorized access only.</span> Credentials are issued by AeroMesh administration. Public registration is strictly restricted.
                </p>
              </div>
            </div>
          )}

          {/* Alerts */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* General User SIGNUP: Full Name */}
            {authType === 'general' && generalMode === 'signup' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Elena Rostova"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050b18] border border-[#16274e] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm text-white placeholder-slate-500 transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {/* GENERAL USER: Email */}
            {authType === 'general' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@aeromesh.ai"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050b18] border border-[#16274e] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm text-white placeholder-slate-500 transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {/* AUTHORIZED RESCUER: Rescuer ID */}
            {authType === 'rescuer' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Official Rescuer ID</label>
                <div className="relative">
                  <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                  <input
                    type="text"
                    required
                    value={rescuerId}
                    onChange={(e) => setRescuerId(e.target.value.toUpperCase())}
                    placeholder="e.g. FIRE-001 or SAR-001"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050b18] border border-[#16274e] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm font-mono uppercase text-cyan-300 placeholder-slate-500 transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">Password</label>
                {authType === 'general' && generalMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={authType === 'rescuer' ? '••••••••••••' : '••••••••'}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#050b18] border border-[#16274e] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm text-white placeholder-slate-500 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {authType === 'general' && generalMode === 'signup' && (
                <p className="text-[11px] text-slate-400">Must be at least 8 characters.</p>
              )}
            </div>

            {/* General User SIGNUP: Confirm Password */}
            {authType === 'general' && generalMode === 'signup' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050b18] border border-[#16274e] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm text-white placeholder-slate-500 transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                authType === 'rescuer'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_0_20px_rgba(0,210,255,0.4)]'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_0_20px_rgba(0,210,255,0.3)]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : authType === 'rescuer' ? (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Verify & Access Tactical Console</span>
                </>
              ) : generalMode === 'signup' ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Rescuer Test Accounts Helper */}
          {authType === 'rescuer' && (
            <div className="pt-4 border-t border-[#142345] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono text-cyan-400">Testing Accounts (Click to Autofill):</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleAutofillRescuer('FIRE-001')}
                  className="p-2 rounded-lg bg-[#050b18] hover:bg-[#0c1936] border border-[#16274e] hover:border-cyan-400/50 text-left transition-colors cursor-pointer"
                >
                  <p className="text-[11px] font-mono font-bold text-cyan-400">FIRE-001</p>
                  <p className="text-[10px] text-slate-400 truncate">Fire & Rescue Dept</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleAutofillRescuer('POLICE-001')}
                  className="p-2 rounded-lg bg-[#050b18] hover:bg-[#0c1936] border border-[#16274e] hover:border-cyan-400/50 text-left transition-colors cursor-pointer"
                >
                  <p className="text-[11px] font-mono font-bold text-cyan-400">POLICE-001</p>
                  <p className="text-[10px] text-slate-400 truncate">Police Aerial Unit</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleAutofillRescuer('SAR-001')}
                  className="p-2 rounded-lg bg-[#050b18] hover:bg-[#0c1936] border border-[#16274e] hover:border-cyan-400/50 text-left transition-colors cursor-pointer"
                >
                  <p className="text-[11px] font-mono font-bold text-cyan-400">SAR-001</p>
                  <p className="text-[10px] text-slate-400 truncate">Search & Rescue Force</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleAutofillRescuer('DISASTER-001')}
                  className="p-2 rounded-lg bg-[#050b18] hover:bg-[#0c1936] border border-[#16274e] hover:border-cyan-400/50 text-left transition-colors cursor-pointer"
                >
                  <p className="text-[11px] font-mono font-bold text-cyan-400">DISASTER-001</p>
                  <p className="text-[10px] text-slate-400 truncate">Disaster Response</p>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Back to Home Link */}
        <div className="text-center">
          <Link
            to="/"
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5"
          >
            <span>← Return to AeroMesh Public Overview</span>
          </Link>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[#080e1e] border border-[#16274e] p-6 space-y-4 shadow-2xl relative animate-scaleUp">
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Reset Account Access</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              To request a password reset for your AeroMesh account or update your emergency clearance, please contact your organization administrator or AeroMesh Security Operations at:
            </p>

            <div className="p-3 rounded-xl bg-[#040915] border border-[#16274e] font-mono text-xs text-cyan-300 text-center select-all">
              security@aeromesh.ai
            </div>

            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#0c1936] hover:bg-[#12244d] border border-[#1a2e5a] text-xs font-semibold text-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
