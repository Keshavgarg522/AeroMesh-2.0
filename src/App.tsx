import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { IncidentProvider, useIncident } from './context/IncidentContext';
import { Navbar } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { NewAnalysisPage } from './pages/NewAnalysisPage';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { ProfilePage } from './pages/ProfilePage';
import { AnalysisReportPage } from './pages/AnalysisReportPage';
import { AnalysisReportModal } from './components/AnalysisReportModal';

/** Gate shown when a protected route is accessed without auth */
function AuthGate() {
  const { openLoginModal } = useAuth();
  useEffect(() => { openLoginModal(); }, [openLoginModal]);
  return (
    <div className="min-h-[60vh] bg-[#050811] flex flex-col items-center justify-center gap-4">
      <p className="text-slate-400 text-sm">Please sign in to access this page.</p>
      <button
        type="button"
        onClick={openLoginModal}
        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold shadow-[0_0_20px_rgba(0,210,255,0.4)] hover:shadow-[0_0_30px_rgba(0,210,255,0.6)] transition-all cursor-pointer"
      >
        Sign In
      </button>
    </div>
  );
}

/** Wraps a route that requires authentication */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <AuthGate />;
  return <>{children}</>;
}

function AppContent() {
  const { isReportModalOpen, reportIncident, closeReport } = useIncident();
  const { showLoginModal } = useAuth();

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/new-analysis" element={
            <RequireAuth><NewAnalysisPage /></RequireAuth>
          } />
          <Route path="/history" element={
            <RequireAuth><HistoryPage /></RequireAuth>
          } />
          <Route path="/report" element={<AnalysisReportPage />} />
          <Route path="/report/:id" element={<AnalysisReportPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/analysis/:id" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Global Analysis Report Modal */}
      <AnalysisReportModal
        isOpen={isReportModalOpen}
        incident={reportIncident}
        onClose={closeReport}
      />

      {/* Global Login Modal */}
      {showLoginModal && <LoginModal />}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}

function AppWithAuth() {
  const { user } = useAuth();
  return (
    <IncidentProvider userId={user?.id ?? null}>
      <Router>
        <AppContent />
      </Router>
    </IncidentProvider>
  );
}

export default App;
