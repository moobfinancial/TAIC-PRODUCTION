'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useContext } from 'react';
import type { User } from '@/lib/types'; // User type is updated
import { ethers } from 'ethers';

// Define the shape of the AuthContext, aligning with User and new auth methods
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithWallet: (walletAddress: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  error: string | null; // Added error state for UI feedback
  clearError: () => void; // Added function to clear error
}

// Create the context with an undefined initial value
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Custom hook to use the auth context
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const refreshUser = async () => {
    // console.log('AuthContext: refreshing user...');
    setIsLoading(true);
    setError(null);
    const storedToken = localStorage.getItem('taicToken');

    if (storedToken) {
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setToken(storedToken);
          setIsAuthenticated(true);
          // console.log('AuthContext: User refreshed successfully', data.user);
        } else {
          localStorage.removeItem('taicToken');
          setUser(null);
          setToken(null);
          setIsAuthenticated(false);
          if (response.status !== 401) { // Don't set error for normal expired token leading to logout
            const errorData = await response.json().catch(() => ({})); // Catch if res not json
            setError(errorData.message || `Session expired or invalid (status: ${response.status}). Please login again.`);
          }
          // console.warn('AuthContext: Session token is invalid or expired during refresh. User logged out.');
        }
      } catch (err: any) {
        console.error('AuthContext: Error refreshing user:', err);
        localStorage.removeItem('taicToken');
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        setError(err.message || 'Failed to connect to server while refreshing session.');
      }
    } else {
      // No token found, ensure user is logged out state
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      // console.log('AuthContext: No token found, user is logged out.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshUser(); // Call on initial mount
  }, []);

  const loginWithWallet = async (walletAddress: string) => {
    setIsLoading(true);
    setError(null);

    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask is not installed. Please install MetaMask.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Get challenge
      const challengeResponse = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: walletAddress.toLowerCase() }),
      });

      if (!challengeResponse.ok) {
        const errorData = await challengeResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to get challenge (status: ${challengeResponse.status})`);
      }
      const { nonce } = await challengeResponse.json();
      if (!nonce) {
        throw new Error('Received empty nonce from server.');
      }

      // 2. Sign nonce
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const messageToSign = `Logging in to TAIC: ${nonce}`; // Must match backend
      const signature = await signer.signMessage(messageToSign);

      // 3. Verify signature and login
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: walletAddress.toLowerCase(), signature }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to verify signature (status: ${verifyResponse.status})`);
      }

      const { token: newToken, user: authenticatedUser } = await verifyResponse.json();
      if (!newToken || !authenticatedUser) {
        throw new Error('Received invalid token or user data from server.');
      }

      // 4. On success
      localStorage.setItem('taicToken', newToken);
      setToken(newToken);
      setUser(authenticatedUser);
      setIsAuthenticated(true);
      // console.log('AuthContext: Login successful', authenticatedUser);

    } catch (err: any) {
      console.error('AuthContext: Login with wallet failed:', err);
      setError(err.message || 'An unknown error occurred during login.');
      // Ensure state is clean if login fails
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      localStorage.removeItem('taicToken');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // console.log('AuthContext: Logging out user...');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('taicToken');
    setError(null); // Clear any errors on logout
    // Optionally, redirect or perform other cleanup
    // console.log('AuthContext: User logged out');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        loginWithWallet,
        logout,
        refreshUser,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
