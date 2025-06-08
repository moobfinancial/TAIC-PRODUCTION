"use client";

import React, { useState, useEffect, useContext } from 'react';
import { ethers } from 'ethers';
import { AuthContext } from '@/contexts/AuthContext'; // Assuming this path is correct

// Helper function to shorten wallet address
const shortenAddress = (address: string, chars = 4): string => {
  if (!address) return "";
  const prefix = address.substring(0, chars + 2); // 0x + chars
  const suffix = address.substring(address.length - chars);
  return `${prefix}...${suffix}`;
};

const WalletConnectButton: React.FC = () => {
  // These will come from AuthContext once it's refactored
  // For now, let's use placeholder state and functions
  // const { user, loginWithWallet, logout, isAuthenticated, isLoading } = useContext(AuthContext);

  // Placeholder AuthContext values - REMOVE WHEN AuthContext IS REFACTORED
  const [user, setUser] = useState<{ walletAddress: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const loginWithWallet = async (address: string) => {
    console.log("Attempting login with:", address);
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setUser({ walletAddress: address });
    setIsAuthenticated(true);
    setIsLoading(false);
    console.log("Logged in with:", address);
  };
  const logout = () => {
    console.log("Logging out");
    setUser(null);
    setIsAuthenticated(false);
  };
  // END OF PLACEHOLDER VALUES

  const [signerAddress, setSignerAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // This effect would ideally sync with AuthContext's user state
  useEffect(() => {
    if (isAuthenticated && user?.walletAddress) {
      setSignerAddress(user.walletAddress);
    } else {
      setSignerAddress(null);
    }
  }, [isAuthenticated, user]);

  const handleConnectWallet = async () => {
    setError(null);
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask is not installed. Please install MetaMask and try again.');
      // Consider providing a link to MetaMask installation
      // window.open('https://metamask.io/download.html', '_blank');
      return;
    }

    try {
      setIsLoading(true); // Use AuthContext's isLoading

      // Request to connect accounts
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setSignerAddress(address); // Local state update, AuthContext will handle the source of truth

      // Call loginWithWallet from AuthContext
      // This function will handle challenge-response and token storage
      await loginWithWallet(address);
      // No need to setUser or setIsAuthenticated here, AuthContext will do it

    } catch (err: any) {
      console.error('Error connecting wallet or logging in:', err);
      if (err.code === 4001) { // User rejected the request
        setError('Connection request denied. Please approve in MetaMask.');
      } else if (err.message && err.message.includes("MetaMask is not installed")) {
        setError('MetaMask is not installed. Please install it to connect your wallet.');
      } else {
        setError(`Connection failed: ${err.message || 'Unknown error'}`);
      }
      setIsLoading(false); // Use AuthContext's isLoading
    }
  };

  const handleLogout = () => {
    logout(); // Call logout from AuthContext
    setSignerAddress(null); // Clear local state
  };

  if (isLoading) {
    return (
      <button
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        disabled
      >
        Loading...
      </button>
    );
  }

  if (isAuthenticated && signerAddress) {
    return (
      <div className="flex items-center space-x-3">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Connected: {shortenAddress(signerAddress)}
        </span>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleConnectWallet}
        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        Connect Wallet
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Error: {error}
        </p>
      )}
    </>
  );
};

export default WalletConnectButton;
