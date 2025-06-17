
'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { WishlistProvider } from '@/contexts/WishlistContext';
import { Toaster } from "@/components/ui/toaster";
import { Web3ModalProvider } from '@/components/providers/Web3ModalProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Web3ModalProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            {children}
            <Toaster />
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </Web3ModalProvider>
  );
}
