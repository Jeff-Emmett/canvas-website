import "tldraw/tldraw.css";
import "@/css/style.css";
import "@/css/auth.css"; // Import auth styles
import "@/css/crypto-auth.css"; // Import crypto auth styles
import "@/css/starred-boards.css"; // Import starred boards styles
import "@/css/user-profile.css"; // Import user profile styles
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { useState, useEffect, lazy, Suspense } from 'react';

// Lazy load heavy route components for faster initial load
const Default = lazy(() => import("@/routes/Default").then(m => ({ default: m.Default })));
const Contact = lazy(() => import("@/routes/Contact").then(m => ({ default: m.Contact })));
const Board = lazy(() => import("./routes/Board").then(m => ({ default: m.Board })));
const Inbox = lazy(() => import("./routes/Inbox").then(m => ({ default: m.Inbox })));
const Presentations = lazy(() => import("./routes/Presentations").then(m => ({ default: m.Presentations })));
const Resilience = lazy(() => import("./routes/Resilience").then(m => ({ default: m.Resilience })));
const Dashboard = lazy(() => import("./routes/Dashboard").then(m => ({ default: m.Dashboard })));

// Import React Context providers
import { AuthProvider, useAuth } from './context/AuthContext';
import { FileSystemProvider } from './context/FileSystemContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationsDisplay from './components/NotificationsDisplay';
import { ErrorBoundary } from './components/ErrorBoundary';

// Import auth components
import CryptID from './components/auth/CryptID';
import CryptoDebug from './components/auth/CryptoDebug';

// Import Web3 provider for wallet integration
import { Web3Provider } from './providers/Web3Provider';

// Import Google Data test component
import { GoogleDataTest } from './components/GoogleDataTest';

// Lazy load Daily.co provider - only needed for video chat
const DailyProvider = lazy(() =>
  import('@daily-co/daily-react').then(m => ({ default: m.DailyProvider }))
);

// Loading skeleton for lazy-loaded routes
const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: '#fff',
    fontFamily: 'Inter, system-ui, sans-serif',
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      border: '3px solid rgba(255,255,255,0.1)',
      borderTopColor: '#4f46e5',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }} />
    <p style={{ marginTop: '16px', fontSize: '14px', opacity: 0.7 }}>Loading canvas...</p>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Daily.co call object - initialized lazily when needed
let dailyCallObject: any = null;
const getDailyCallObject = async () => {
  if (dailyCallObject) return dailyCallObject;

  try {
    // Only create call object if we're in a secure context and mediaDevices is available
    if (typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        navigator.mediaDevices) {
      const Daily = (await import('@daily-co/daily-js')).default;
      dailyCallObject = Daily.createCallObject();
    }
  } catch (error) {
    console.warn('Daily.co call object initialization failed:', error);
  }
  return dailyCallObject;
};

/**
 * Optional Auth Route component
 * Allows guests to browse, but provides login option
 */
const OptionalAuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);

  // Wait for authentication to initialize before rendering
  useEffect(() => {
    if (!session.loading) {
      setIsInitialized(true);
    }
  }, [session.loading]);

  if (!isInitialized) {
    return <div className="loading">Loading...</div>;
  }

  // Always render the content, authentication is optional
  return <>{children}</>;
};

/**
 * Component to redirect old /board/:slug URLs to canvas.jeffemmett.com/:slug/
 * This handles legacy URLs from jeffemmett.com/board/*
 */
const RedirectBoardSlug = () => {
  const { slug } = useParams<{ slug: string }>();

  // Redirect to canvas.jeffemmett.com for the canonical board URL
  useEffect(() => {
    if (slug) {
      window.location.href = `https://canvas.jeffemmett.com/${slug}/`;
    }
  }, [slug]);

  // Show loading while redirecting
  return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Redirecting to canvas...</div>;
};


/**
 * Main App with context providers
 */
const AppWithProviders = () => {

  /**
   * Auth page - renders login/register component (kept for direct access)
   */
  const AuthPage = () => {
    const { session } = useAuth();

    // Redirect to home if already authenticated
    if (session.authed) {
      return <Navigate to="/" />;
    }

    return (
      <div className="auth-page">
        <CryptID onSuccess={() => window.location.href = '/'} />
      </div>
    );
  };

    return (
    <ErrorBoundary>
      <AuthProvider>
        <Web3Provider>
          <FileSystemProvider>
            <NotificationProvider>
              <Suspense fallback={<LoadingSpinner />}>
                <DailyProvider callObject={null}>
                  <BrowserRouter>
                  {/* Display notifications */}
                  <NotificationsDisplay />

                  <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                      {/* Redirect routes without trailing slashes to include them */}
                      <Route path="/login" element={<Navigate to="/login/" replace />} />
                      <Route path="/contact" element={<Navigate to="/contact/" replace />} />
                      <Route path="/board/:slug" element={<RedirectBoardSlug />} />
                      <Route path="/inbox" element={<Navigate to="/inbox/" replace />} />
                      <Route path="/debug" element={<Navigate to="/debug/" replace />} />
                      <Route path="/dashboard" element={<Navigate to="/dashboard/" replace />} />
                      <Route path="/presentations" element={<Navigate to="/presentations/" replace />} />
                      <Route path="/presentations/resilience" element={<Navigate to="/presentations/resilience/" replace />} />

                      {/* Auth routes */}
                      <Route path="/login/" element={<AuthPage />} />

                      {/* Optional auth routes - all lazy loaded */}
                      <Route path="/" element={
                        <OptionalAuthRoute>
                          <Default />
                        </OptionalAuthRoute>
                      } />
                      <Route path="/contact/" element={
                        <OptionalAuthRoute>
                          <Contact />
                        </OptionalAuthRoute>
                      } />
                      <Route path="/board/:slug/" element={<RedirectBoardSlug />} />
                      <Route path="/inbox/" element={
                        <OptionalAuthRoute>
                          <Inbox />
                        </OptionalAuthRoute>
                      } />
                      <Route path="/debug/" element={
                        <OptionalAuthRoute>
                          <CryptoDebug />
                        </OptionalAuthRoute>
                      } />
                      <Route path="/dashboard/" element={
                        <OptionalAuthRoute>
                          <Dashboard />
                        </OptionalAuthRoute>
                      } />
                      <Route path="/presentations/" element={
                        <OptionalAuthRoute>
                          <Presentations />
                        </OptionalAuthRoute>
                      } />
                      <Route path="/presentations/resilience/" element={
                        <OptionalAuthRoute>
                          <Resilience />
                        </OptionalAuthRoute>
                      } />
                      {/* Google Data routes */}
                      <Route path="/google" element={<GoogleDataTest />} />
                      <Route path="/oauth/google/callback" element={<GoogleDataTest />} />

                      {/* Catch-all: Direct slug URLs serve board directly */}
                      {/* e.g., canvas.jeffemmett.com/ccc → shows board "ccc" */}
                      {/* Must be LAST to not interfere with other routes */}
                      <Route path="/:slug" element={
                        <OptionalAuthRoute>
                          <Board />
                        </OptionalAuthRoute>
                      } />
                      <Route path="/:slug/" element={
                        <OptionalAuthRoute>
                          <Board />
                        </OptionalAuthRoute>
                      } />
                    </Routes>
                  </Suspense>
                  </BrowserRouter>
                </DailyProvider>
              </Suspense>
            </NotificationProvider>
          </FileSystemProvider>
        </Web3Provider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

// Initialize the app
createRoot(document.getElementById("root")!).render(<AppWithProviders />);

export default AppWithProviders;