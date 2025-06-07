'use client';

import { ReactNode } from 'react';
import { MerchantAuthProvider } from '@/contexts/MerchantAuthContext';

interface MerchantAuthWrapperProps {
  children: ReactNode;
}

export function MerchantAuthWrapper({ children }: MerchantAuthWrapperProps) {
  return (
    <MerchantAuthProvider>
      {children}
    </MerchantAuthProvider>
  );
}
