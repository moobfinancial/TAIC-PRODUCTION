'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect } from 'react';
import type { Product, CartItem, CartContextType } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { translateText, containsChineseCharacters } from '@/lib/translationUtils';

export const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedCartItems = localStorage.getItem('taicCartItems');
      if (storedCartItems) {
        setCartItems(JSON.parse(storedCartItems));
      }
    } catch (error) {
      console.error("Failed to parse cart items from localStorage", error);
      localStorage.removeItem('taicCartItems');
    }
  }, []);

  useEffect(() => {
    if (cartItems.length > 0 || localStorage.getItem('taicCartItems')) {
       localStorage.setItem('taicCartItems', JSON.stringify(cartItems));
    }
  }, [cartItems]);

  const addToCart = async (product: Product) => {
    // Ensure we have an English description
    let englishDescription = product.description;
    if (containsChineseCharacters(product.description)) {
      try {
        englishDescription = await translateText(product.description, 'en', 'auto');
      } catch (error) {
        console.error('Error translating product description:', error);
        // If translation fails, keep the original description
        englishDescription = product.description;
      }
    }

    // Create a product with the English description
    const productWithEnglishDescription = {
      ...product,
      description: englishDescription
    };

    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      if (existingItem) {
        return prevItems.map(item =>
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1, description: englishDescription } 
            : item
        );
      }
      return [...prevItems, { ...product, quantity: 1, description: englishDescription }];
    });
    
    toast({ title: "Added to cart", description: `${product.name} has been added to your cart.` });
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId));
    toast({ title: "Removed from cart", description: `Item has been removed from your cart.`, variant: "destructive" });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('taicCartItems');
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getCartItemCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };


  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartItemCount }}>
      {children}
    </CartContext.Provider>
  );
};
