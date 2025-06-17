'use client'

import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react';
import { WagmiProvider, WagmiConfig } from 'wagmi'; // Import WagmiConfig type
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mainnet, sepolia } from 'wagmi/chains';
import { ReactNode, useEffect, useState } from 'react';

// 1. Get your projectId upfront
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  console.error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Please add it to your .env.local file.');
}

// Metadata (can be defined at module level)
const metadata = {
  name: 'TAIC',
  description: 'The AI Corporation - Decentralized E-commerce',
  url: 'https://taic.com', // origin must match your domain & subdomain
  icons: ['/logo.png'],
};

const chains = [mainnet, sepolia] as const;

export function Web3ModalProvider({ children }: { children: ReactNode }) {
  const [wagmiConfig, setWagmiConfig] = useState<WagmiConfig | null>(null);
  const [queryClient, setQueryClient] = useState<QueryClient | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (projectId && !isInitialized && typeof window !== 'undefined') {
      const config = defaultWagmiConfig({
        chains,
        projectId,
        metadata,
        storage: null, // Disable wagmi's default persistence
      });
      setWagmiConfig(config);

      const client = new QueryClient();
      setQueryClient(client);

      createWeb3Modal({
        themeMode: 'dark',
        themeVariables: {
          '--w3m-font-family': 'Roboto, sans-serif',
          '--w3m-accent': '#007bff',
          '--w3m-color-mix': '#1E1E1E',
          '--w3m-color-mix-strength': 40,
          '--w3m-border-radius': '12px',
          '--w3m-z-index': 1000,
        },
        wagmiConfig: config,
        projectId,
        chains,
      });
      setIsInitialized(true);
    }
  }, [isInitialized]); // Rerun if isInitialized changes, though it won't after first true

  // Render children only after initialization to ensure context providers are ready
  if (!wagmiConfig || !queryClient) {
    // You might want to return a loader here or null
    return null; 
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
