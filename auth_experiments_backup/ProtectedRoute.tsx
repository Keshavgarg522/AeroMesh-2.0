import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRescuer?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireRescuer = false }) => {
  const { isAuthenticated, isLoading, isRescuer } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020712] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Ambient lighting */}
        <div className="absolute top-1/3 w-96 h-96 bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/3 w-96 h-96 bg-blue-600/10 blur-[140px] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center space-y-5">
          {/* AeroMesh 3D Logo with Pulse */}
          <div className="relative w-12 h-12 flex items-center justify-center animate-pulse">
            <svg className="w-12 h-12 drop-shadow-[0_0_18px_rgba(0,210,255,0.8)]" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L29 9.5V22.5L16 30L3 22.5V9.5L16 2Z" fill="#0c1a38" stroke="#00d2ff" strokeWidth="1.5" />
              <path d="M16 2L29 9.5L16 17L3 9.5L16 2Z" fill="#1e40af" fillOpacity="0.85" />
              <path d="M16 17V30L3 22.5V9.5L16 17Z" fill="#0284c7" fillOpacity="0.9" />
              <path d="M16 17L29 9.5V22.5L16 30V17Z" fill="#0369a1" fillOpacity="0.75" />
              <line x1="16" y1="17" x2="16" y2="30" stroke="#00d2ff" strokeWidth="1.5" />
              <line x1="16" y1="17" x2="29" y2="9.5" stroke="#38bdf8" strokeWidth="1.5" />
              <line x1="16" y1="17" x2="3" y2="9.5" stroke="#38bdf8" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs uppercase tracking-widest font-mono text-cyan-300 font-semibold">
              Verifying AeroMesh Credentials...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireRescuer && !isRescuer) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
