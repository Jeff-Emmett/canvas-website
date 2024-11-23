import { createContext, useContext, ReactNode, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

interface GoogleAuthContextType {
    isAuthenticated: boolean;
    setIsAuthenticated: (value: boolean) => void;
    user: any;
    setUser: (user: any) => void;
    accessToken: string | null;
    setAccessToken: (token: string | null) => void;
    logout: () => void;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    const logout = () => {
        setIsAuthenticated(false);
        setUser(null);
        setAccessToken(null);
    };

    return (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <GoogleAuthContext.Provider value={{
                isAuthenticated,
                setIsAuthenticated,
                user,
                setUser,
                accessToken,
                setAccessToken,
                logout,
            }}>
                {children}
            </GoogleAuthContext.Provider>
        </GoogleOAuthProvider>
    );
}

export function useGoogleAuth() {
    const context = useContext(GoogleAuthContext);
    if (context === undefined) {
        throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
    }
    return context;
} 