import React from 'react';
import { useAuth } from '../../../src/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { session } = useAuth();

  if (session.loading) {
    // Show loading indicator while authentication is being checked
    return (
      <div className="auth-loading">
        <p>Checking authentication...</p>
      </div>
    );
  }

  // For board routes, we'll allow access even if not authenticated
  // The auth button in the toolbar will handle authentication
  return <>{children}</>;
};