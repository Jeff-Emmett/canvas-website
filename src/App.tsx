import { inject } from "@vercel/analytics";
import "tldraw/tldraw.css";
import "@/css/style.css";
import "@/styles/auth.css"; // Import auth styles
import { Default } from "@/routes/Default";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Contact } from "@/routes/Contact";
import { Board } from "./routes/Board";
import { Inbox } from "./routes/Inbox";
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
import Login from './components/auth/Login';

inject();

const callObject = Daily.createCallObject();

/**
 * Protected Route component
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
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

  // Redirect to login if not authenticated
  if (!session.authed) {
    return <Navigate to="/login" />;
  }

  // Render the protected content
  return <>{children}</>;
};

/**
 * Auth page - renders login/register component
 */
const AuthPage = () => {
  const { session } = useAuth();

  // Redirect to home if already authenticated
  if (session.authed) {
    return <Navigate to="/" />;
  }

  return (
    <div className="auth-page">
      <Login onSuccess={() => window.location.href = '/'} />
    </div>
  );
};

/**
 * Main App with context providers
 */
const AppWithProviders = () => {
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
                
                {/* Protected routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Default />
                  </ProtectedRoute>
                } />
                <Route path="/contact" element={
                  <ProtectedRoute>
                    <Contact />
                  </ProtectedRoute>
                } />
                <Route path="/board/:slug" element={
                  <ProtectedRoute>
                    <Board />
                  </ProtectedRoute>
                } />
                <Route path="/inbox" element={
                  <ProtectedRoute>
                    <Inbox />
                  </ProtectedRoute>
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