import { inject } from "@vercel/analytics";
import "tldraw/tldraw.css";
import "@/css/style.css";
import "@/css/auth.css"; // Import auth styles
import "@/css/crypto-auth.css"; // Import crypto auth styles
import "@/css/starred-boards.css"; // Import starred boards styles
import "@/css/user-profile.css"; // Import user profile styles
import { Default } from "@/routes/Default";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Contact } from "@/routes/Contact";
import { Board } from "./routes/Board";
import { Inbox } from "./routes/Inbox";
import { Dashboard } from "./routes/Dashboard";
import { createRoot } from "react-dom/client";
import { DailyProvider } from "@daily-co/daily-react";
import Daily from "@daily-co/daily-js";
import { useState, useEffect } from 'react';

// Import React Context providers
import { AuthProvider, useAuth } from './context/AuthContext';
import { FileSystemProvider } from './context/FileSystemContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationsDisplay from './components/NotificationsDisplay';

// Import auth components
import CryptoLogin from './components/auth/CryptoLogin';
import CryptoDebug from './components/auth/CryptoDebug';

inject();

const callObject = Daily.createCallObject();

/**
 * Main App with context providers
 */
const AppWithProviders = () => {
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
        <CryptoLogin onSuccess={() => window.location.href = '/'} />
      </div>
    );
  };

    return (
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
              </Routes>
            </BrowserRouter>
          </DailyProvider>
        </NotificationProvider>
      </FileSystemProvider>
    </AuthProvider>
  );
};

// Initialize the app
createRoot(document.getElementById("root")!).render(<AppWithProviders />);

export default AppWithProviders;