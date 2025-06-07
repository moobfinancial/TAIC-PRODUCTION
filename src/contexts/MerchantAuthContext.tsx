'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isTokenExpiredOrExpiringSoon, refreshToken } from '@/utils/tokenRefresh';

interface MerchantUser {
  id: string;
  email: string;
  businessName?: string;
  username: string;
  role: string;
}

interface MerchantAuthContextType {
  merchant: MerchantUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: MerchantUser) => void;
  logout: () => void;
  loading: boolean;
  authenticatedRequest: (url: string, options: RequestInit) => Promise<Response>;
}

const MerchantAuthContext = createContext<MerchantAuthContextType | undefined>(undefined);

export function MerchantAuthProvider({ children }: { children: ReactNode }) {
  const [merchant, setMerchant] = useState<MerchantUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('merchantToken');
    const storedUserData = localStorage.getItem('merchantUser');

    if (storedToken && storedUserData) {
      try {
        if (isTokenExpiredOrExpiringSoon(storedToken)) {
          refreshToken(storedToken).then(newToken => {
            if (newToken) {
              setToken(newToken);
              setMerchant(JSON.parse(storedUserData));
              localStorage.setItem('merchantToken', newToken);
            } else {
              logout();
            }
            setLoading(false);
          });
        } else {
          setToken(storedToken);
          setMerchant(JSON.parse(storedUserData));
          setLoading(false);
        }
      } catch (error) {
        console.error('Error parsing stored merchant user data:', error);
        localStorage.removeItem('merchantToken');
        localStorage.removeItem('merchantUser');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = (newToken: string, user: MerchantUser) => {
    setToken(newToken);
    setMerchant(user);
    localStorage.setItem('merchantToken', newToken);
    localStorage.setItem('merchantUser', JSON.stringify(user));
  };

  const logout = () => {
    setToken(null);
    setMerchant(null);
    localStorage.removeItem('merchantToken');
    localStorage.removeItem('merchantUser');
  };

  const authenticatedRequest = async (url: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('No authentication token available');
    }

    if (isTokenExpiredOrExpiringSoon(token)) {
      const newToken = await refreshToken(token);
      if (newToken) {
        setToken(newToken);
        localStorage.setItem('merchantToken', newToken);
      } else {
        logout();
        throw new Error('Authentication token expired and refresh failed');
      }
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      const newToken = await refreshToken(token);
      if (newToken) {
        setToken(newToken);
        localStorage.setItem('merchantToken', newToken);
        
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`,
          },
        });
      } else {
        logout();
        throw new Error('Authentication failed');
      }
    }

    return response;
  };

  const value = {
    merchant,
    token,
    isAuthenticated: !!token && !!merchant,
    login,
    logout,
    loading,
    authenticatedRequest,
  };

  return (
    <MerchantAuthContext.Provider value={value}>
      {children}
    </MerchantAuthContext.Provider>
  );
}

export function useMerchantAuth() {
  const context = useContext(MerchantAuthContext);
  if (context === undefined) {
    throw new Error('useMerchantAuth must be used within a MerchantAuthProvider');
  }
  return context;
}
