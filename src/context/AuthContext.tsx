import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '../lib/auth/types';
import { initialize } from '../lib/auth/init';

interface AuthContextType {
  session: Session;
  updateSession: (updatedSession: Partial<Session>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session>({
    username: '',
    authed: false,
    loading: false,
    backupCreated: null,
  });

  const updateSession = (updatedSession: Partial<Session>) => {
    setSession((prevSession) => ({
      ...prevSession,
      ...updatedSession,
    }));
  };

  return (
    <AuthContext.Provider value={{ session, updateSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};