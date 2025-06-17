'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSignMessage, useDisconnect } from 'wagmi';
import type { User } from '@/lib/types'; // User type is updated

// Define the shape of the AuthContext, aligning with User and new auth methods
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithWallet: (walletAddress: string) => Promise<void>;
  loginWithEmailPassword: (email: string, password: string) => Promise<void>;
  registerUser: (userData: { email: string; password: string; name?: string }) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with true to check initial auth state
  const [error, setError] = useState<string | null>(null);

  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

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

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('taicToken');
    disconnect(); // Disconnect wallet session
    setError(null); // Clear any errors on logout
    // console.log('AuthContext: Logged out and disconnected wallet');
  }, [disconnect]);

  const loginWithWallet = useCallback(async (walletAddress: string) => {
    if (!walletAddress) {
      setError('Wallet address not provided for login.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Get challenge from the backend
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

      // 2. Sign the nonce using Wagmi's useSignMessage hook
      const messageToSign = `Logging in to TAIC: ${nonce}`;
      const signature = await signMessageAsync({ message: messageToSign });

      // 3. Verify the signature and log in
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

      // 4. On success, update the auth state
      localStorage.setItem('taicToken', newToken);
      setToken(newToken);
      setUser(authenticatedUser);
      setIsAuthenticated(true);

    } catch (err: any) {
      console.error('AuthContext: Login with wallet failed:', err);
      setError(err.message || 'An unknown error occurred during login.');
      // Clean up state and disconnect on failure
      logout(); 
    } finally {
      setIsLoading(false);
    }
  }, [signMessageAsync, logout]);

  const loginWithEmailPassword = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Login failed (status: ${response.status})`);
      }

      const { token: newToken, user: authenticatedUser } = await response.json();
      if (!newToken || !authenticatedUser) {
        throw new Error('Received invalid token or user data from server.');
      }

      localStorage.setItem('taicToken', newToken);
      setToken(newToken);
      setUser(authenticatedUser);
      setIsAuthenticated(true);
      // console.log('AuthContext: Email/Password Login successful', authenticatedUser);

    } catch (err: any) {
      console.error('AuthContext: Email/Password login failed:', err);
      setError(err.message || 'An unknown error occurred during login.');
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      localStorage.removeItem('taicToken');
    } finally {
      setIsLoading(false);
    }
  };

  const registerUser = async (userData: { email: string; password: string; name?: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Registration failed (status: ${response.status})`);
      }

      // Optionally, log the user in directly after registration
      // For now, we'll just set a success message or prompt them to log in.
      // Or, if the register endpoint returns a token and user:
      const { token: newToken, user: registeredUser } = await response.json();
      if (newToken && registeredUser) {
        localStorage.setItem('taicToken', newToken);
        setToken(newToken);
        setUser(registeredUser);
        setIsAuthenticated(true);
        // console.log('AuthContext: Registration successful and user logged in', registeredUser);
      } else {
        // If registration doesn't auto-login, you might want to redirect to login
        // or show a success message.
        console.log('AuthContext: Registration successful. Please log in.');
        // Potentially set a success message for the UI if not auto-logging in.
      }

    } catch (err: any) {
      console.error('AuthContext: Registration failed:', err);
      setError(err.message || 'An unknown error occurred during registration.');
      // Ensure state is clean if registration fails and doesn't auto-login
      // If auto-login is part of this, then also clear user/token/auth state.
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        loginWithWallet,
        loginWithEmailPassword,
        registerUser,
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
