import React from 'react';
import { Shield, Activity, LogOut, Mail, Calendar } from 'lucide-react';
import { useIncident } from '../context/IncidentContext';
import { useAuth } from '../context/AuthContext';

export const ProfilePage: React.FC = () => {
  const { incident } = useIncident();
  const { user, logout } = useAuth();

  const userName = user?.name || 'Lead Geospatial Analyst';
  const userInitial = userName.charAt(0).toUpperCase() || 'A';
  const userEmail = user?.email || 'analyst@aeromesh.ai';
  const userId = user?.id ? `AM-USR-${user.id.slice(0, 8)}` : 'AM-OP-892';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '2026';

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Profile Header */}
        <div className="p-6 rounded-2xl bg-[#080e1e] border border-[#142345] shadow-glass flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 p-0.5 shadow-[0_0_25px_rgba(0,210,255,0.4)] flex-shrink-0">
              {user?.profile_image && !user.profile_image.includes('avatar_keshav') ? (
                <img
                  src={user.profile_image}
                  alt={userName}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-2xl bg-[#080e1e] flex items-center justify-center text-3xl font-extrabold text-cyan-400">
                  {userInitial}
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h1 className="text-2xl font-bold text-white">{userName}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-600/20 border border-cyan-400/40 text-cyan-400 text-xs font-semibold">
                  Lead Geospatial Analyst
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  {userEmail}
                </span>
                <span>•</span>
                <span>Analyst ID: {userId}</span>
              </div>
              <p className="text-xs text-slate-300">
                Authorized for drone telemetry ingestion, AI computer vision pipelines, and 3D mesh reviews.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0c1630] hover:bg-rose-950/40 border border-[#1a2d59] hover:border-rose-500/50 text-slate-300 hover:text-rose-300 text-xs font-semibold transition-all cursor-pointer flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Credentials & System Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#080e1e] border border-[#142345] shadow-glass flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Security Clearance</p>
              <p className="text-sm font-bold text-white">Tier 1 Recon (Verified)</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#080e1e] border border-[#142345] shadow-glass flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Recent Incident</p>
              <p className="text-sm font-bold text-emerald-400 font-mono">{incident.id}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#080e1e] border border-[#142345] shadow-glass flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Account Active Since</p>
              <p className="text-sm font-bold text-white">{memberSince}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
