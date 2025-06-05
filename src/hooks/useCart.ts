import { useContext } from 'react';
import { CartContext } from '@/contexts/CartContext';
import type { CartContextType } from '@/lib/types';

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
