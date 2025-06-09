'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ethers } from 'ethers';

const WalletConnectButton: React.FC = () => {
  const { user, loginWithWallet, logout, isLoading, isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false); // Renamed from isLoggingIn for clarity

  const handleConnect = async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask is not installed. Please install it to connect your wallet.');
      // Optionally, you could redirect to MetaMask installation page
      // window.open('https://metamask.io/download.html', '_blank');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // It's good practice to wrap provider interactions in try/catch
      const provider = new ethers.BrowserProvider(window.ethereum);

      // Request account access if not already connected
      // Note: eth_requestAccounts can throw if user rejects or closes MetaMask
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts || accounts.length === 0) {
        setError('No accounts found. Please ensure MetaMask is set up correctly.');
        setIsConnecting(false);
        return;
      }

      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();

      // loginWithWallet is expected to handle its own errors and loading states
      await loginWithWallet(walletAddress);

    } catch (err: any) {
      console.error('Failed to connect wallet or login:', err);
      // More user-friendly error messages
      if (err.code === 4001) { // EIP-1193 userRejectedRequest error
        setError('Connection request rejected. Please approve it in MetaMask.');
      } else if (err.message && err.message.includes("already pending")) {
        setError('A MetaMask request is already pending. Please check your MetaMask extension.');
      }
      else {
        setError(err.message || 'Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Effect to listen for account changes in MetaMask
  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // MetaMask is locked or user has disconnected all accounts
        if (isAuthenticated) {
          logout(); // Log out user if they disconnect from MetaMask
          setError("You've been logged out as your MetaMask account is disconnected.");
        }
      } else if (user && accounts[0].toLowerCase() !== user.walletAddress.toLowerCase() && isAuthenticated) {
        // New account selected in MetaMask
        logout(); // Log out current user
        setError("MetaMask account changed. Please connect with the new account if you wish.");
        // Optionally, you could attempt to log in with the new account automatically:
        // loginWithWallet(accounts[0]);
      }
    };

    if (typeof window.ethereum !== 'undefined' && (window.ethereum as any).on) {
      (window.ethereum as any).on('accountsChanged', handleAccountsChanged);
    }

    return () => {
      if (typeof window.ethereum !== 'undefined' && (window.ethereum as any).removeListener) {
        (window.ethereum as any).removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [user, isAuthenticated, logout, loginWithWallet]);


  if (isLoading || isConnecting) {
    return (
      <button
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-md cursor-not-allowed"
        disabled
      >
        Processing...
      </button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-3">
        <span className="hidden sm:inline text-sm text-gray-300 hover:text-white" title={user.walletAddress}>
          {truncateAddress(user.walletAddress)}
        </span>
        <button
          onClick={handleLogout}
          className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleConnect}
        disabled={isConnecting} // Though covered by the isLoading state above, explicit disable is fine
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {error && <p className="absolute mt-12 text-xs text-red-400">{error}</p>}
    </>
  );
};

export default WalletConnectButton;
