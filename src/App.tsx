import "tldraw/tldraw.css"
import "@/css/style.css"
import { Default } from "@/routes/Default"
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import { Contact } from "@/routes/Contact"
import { Board } from "./routes/Board"
import { Inbox } from "./routes/Inbox"
import { Presentations } from "./routes/Presentations"
import { Resilience } from "./routes/Resilience"
import { createRoot } from "react-dom/client"
import { DailyProvider } from "@daily-co/daily-react"
import Daily from "@daily-co/daily-js"
import "tldraw/tldraw.css";
import "@/css/style.css";
import "@/css/auth.css"; // Import auth styles
import "@/css/crypto-auth.css"; // Import crypto auth styles
import "@/css/starred-boards.css"; // Import starred boards styles
import "@/css/user-profile.css"; // Import user profile styles
import "@/css/location.css"; // Import location sharing styles
import { Dashboard } from "./routes/Dashboard";
import { LocationShareCreate } from "./routes/LocationShareCreate";
import { LocationShareView } from "./routes/LocationShareView";
import { LocationDashboardRoute } from "./routes/LocationDashboardRoute";
import { useState, useEffect } from 'react';

// Import React Context providers
import { AuthProvider, useAuth } from './context/AuthContext';
import { FileSystemProvider } from './context/FileSystemContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationsDisplay from './components/NotificationsDisplay';
import { ErrorBoundary } from './components/ErrorBoundary';

// Import auth components
import CryptID from './components/auth/CryptID';
import CryptoDebug from './components/auth/CryptoDebug';

// Initialize Daily.co call object with error handling
let callObject: any = null;
try {
  // Only create call object if we're in a secure context and mediaDevices is available
  if (typeof window !== 'undefined' && 
      window.location.protocol === 'https:' && 
      navigator.mediaDevices) {
    callObject = Daily.createCallObject();
  }
} catch (error) {
  console.warn('Daily.co call object initialization failed:', error);
  // Continue without video chat functionality
}

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
        <FileSystemProvider>
          <NotificationProvider>
            <DailyProvider callObject={callObject}>
              <BrowserRouter>
                {/* Display notifications */}
                <NotificationsDisplay />
                
                <Routes>
                  {/* Auth routes */}
                  <Route path="/login" element={<AuthPage />} />
                  
                  {/* Optional auth routes */}
                  <Route path="/" element={
                    <OptionalAuthRoute>
                      <Default />
                    </OptionalAuthRoute>
                  } />
                  <Route path="/contact" element={
                    <OptionalAuthRoute>
                      <Contact />
                    </OptionalAuthRoute>
                  } />
                  <Route path="/board/:slug" element={
                    <OptionalAuthRoute>
                      <Board />
                    </OptionalAuthRoute>
                  } />
                  <Route path="/inbox" element={
                    <OptionalAuthRoute>
                      <Inbox />
                    </OptionalAuthRoute>
                  } />
                  <Route path="/debug" element={
                    <OptionalAuthRoute>
                      <CryptoDebug />
                    </OptionalAuthRoute>
                  } />
                  <Route path="/dashboard" element={
                    <OptionalAuthRoute>
                      <Dashboard />
                    </OptionalAuthRoute>
                  } />
                  <Route path="/presentations" element={
                    <OptionalAuthRoute>
                      <Presentations />
                    </OptionalAuthRoute>
                  } />
                  <Route path="/presentations/resilience" element={
                    <OptionalAuthRoute>
                      <Resilience />
                    </OptionalAuthRoute>
                  } />
                  {/* Location sharing routes */}
                  <Route path="/share-location" element={
                    <OptionalAuthRoute>
                      <LocationShareCreate />
                    </OptionalAuthRoute>
                  } />
                  <Route path="/location/:token" element={
                    <OptionalAuthRoute>
                      <LocationShareView />
                    </OptionalAuthRoute>
                  } />
                  <Route path="/location-dashboard" element={
                    <OptionalAuthRoute>
                      <LocationDashboardRoute />
                    </OptionalAuthRoute>
                  } />
                </Routes>
              </BrowserRouter>
            </DailyProvider>
          </NotificationProvider>
        </FileSystemProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

// Initialize the app
createRoot(document.getElementById("root")!).render(<AppWithProviders />);

export default AppWithProviders;