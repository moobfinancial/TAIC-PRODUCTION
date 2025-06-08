'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useContext } from 'react';
import type { User, AuthContextType as OldAuthContextType } from '@/lib/types'; // User type is updated
import { ethers } from 'ethers';

// Define the new shape of the AuthContext, aligning with User and new auth methods
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithWallet: (walletAddress: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>; // Added refreshUser
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
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start with loading true for initial auth check

  const refreshUser = async () => {
    setIsLoading(true);
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
        } else {
          localStorage.removeItem('taicToken');
          setUser(null);
          setToken(null);
          setIsAuthenticated(false);
          console.warn('Session token is invalid or expired during refresh. User logged out.');
        }
      } catch (error) {
        console.error('Error refreshing user with stored token:', error);
        localStorage.removeItem('taicToken');
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      }
    } else {
      // No token found, ensure user is logged out state
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshUser(); // Call on initial mount
  }, []);

  const loginWithWallet = async (walletAddress: string) => {
    setIsLoading(true);
    setError(null); // Clear previous errors

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
        const errorData = await challengeResponse.json();
        throw new Error(errorData.error || 'Failed to get challenge');
      }
      const { nonce } = await challengeResponse.json();

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
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || 'Failed to verify signature');
      }

      const { token: newToken, user: authenticatedUser } = await verifyResponse.json();

      // 4. On success
      localStorage.setItem('taicToken', newToken);
      setToken(newToken);
      setUser(authenticatedUser);
      setIsAuthenticated(true);
      setError(null);

    } catch (err: any) {
      console.error('Login with wallet failed:', err);
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
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('taicToken');
    // Optionally, redirect or perform other cleanup
    console.log('User logged out');
  };
  
  // Placeholder for error state to communicate issues to UI if needed
  const [error, setError] = useState<string | null>(null);


  // The old `updateUser` is removed as per instructions.
  // If profile updates are needed, a new function like `updateUserProfile`
  // would make API calls rather than just updating localStorage.

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        loginWithWallet,
        logout,
        refreshUser, // Expose refreshUser
        // error, // Expose error if UI needs to display it
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
