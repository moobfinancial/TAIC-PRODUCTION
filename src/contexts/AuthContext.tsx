
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect } from 'react';
import type { User, AuthContextType } from '@/lib/types';
import { DEFAULT_TAIC_BALANCE } from '@/lib/constants';

// Extend the context type to include userId
type AuthContextWithUserId = AuthContextType & { userId: string | null };

export const AuthContext = createContext<AuthContextWithUserId | undefined>(undefined);

// Custom hook to use the auth context
export const useAuth = (): AuthContextWithUserId => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('taicUser');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser) as User;
        // Ensure new fields have default values if loading older user data
        setUser({
          ...parsedUser,
          stakedTaicBalance: parsedUser.stakedTaicBalance || 0,
          stakedWishlistGoals: parsedUser.stakedWishlistGoals || [],
        });
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('taicUser');
    }
    setLoading(false);
  }, []);

  const login = (username: string) => {
    let existingUser = null;
    try {
      const storedUser = localStorage.getItem('taicUser');
      if (storedUser) {
        const parsedUser: User = JSON.parse(storedUser);
        if (parsedUser.username.toLowerCase() === username.toLowerCase()) {
            existingUser = {
              ...parsedUser,
              stakedTaicBalance: parsedUser.stakedTaicBalance || 0,
              stakedWishlistGoals: parsedUser.stakedWishlistGoals || [],
            };
        }
      }
    } catch (error) {
        console.error("Error reading existing user during login:", error);
    }

    if (existingUser) {
        setUser(existingUser);
        localStorage.setItem('taicUser', JSON.stringify(existingUser));
    } else {
        const newUser: User = {
          id: Date.now().toString(),
          username,
          taicBalance: DEFAULT_TAIC_BALANCE,
          stakedTaicBalance: 0,
          orders: [],
          aiConversations: [],
          stakedWishlistGoals: [],
        };
        setUser(newUser);
        localStorage.setItem('taicUser', JSON.stringify(newUser));
    }
  };

  const register = (username: string) => {
    const newUser: User = {
      id: Date.now().toString(),
      username,
      taicBalance: DEFAULT_TAIC_BALANCE,
      stakedTaicBalance: 0,
      orders: [],
      aiConversations: [],
      stakedWishlistGoals: [],
    };
    setUser(newUser);
    localStorage.setItem('taicUser', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('taicUser');
  };
  
  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('taicUser', JSON.stringify(updatedUser));
  };

  if (loading) {
    return null; 
  }

  // Derive userId from the user object
  const userId = user?.id || null;

  return (
    <AuthContext.Provider value={{ user, userId, login, logout, register, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
