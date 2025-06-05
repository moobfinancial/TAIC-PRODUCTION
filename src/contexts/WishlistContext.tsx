
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { Product, WishlistItem, WishlistContextType } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";

export const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const WISHLIST_STORAGE_KEY = 'taicWishlistItems';

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedWishlistItems = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (storedWishlistItems) {
        setWishlistItems(JSON.parse(storedWishlistItems));
      }
    } catch (error) {
      console.error("Failed to parse wishlist items from localStorage", error);
      localStorage.removeItem(WISHLIST_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    // Only save if wishlistItems is not empty or if it was previously non-empty
    // This prevents writing an empty array on initial load if nothing was stored.
    if (wishlistItems.length > 0 || localStorage.getItem(WISHLIST_STORAGE_KEY)) {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistItems));
    }
  }, [wishlistItems]);

  const isInWishlist = useCallback((productId: string): boolean => {
    return wishlistItems.some(item => item.id === productId);
  }, [wishlistItems]);

  const addToWishlist = (product: Product) => {
    if (isInWishlist(product.id)) {
      toast({ title: "Already in Wishlist", description: `${product.name} is already in your wishlist.`, variant: "default" });
      return;
    }
    setWishlistItems(prevItems => [...prevItems, product]);
    toast({ title: "Added to Wishlist", description: `${product.name} has been added to your wishlist.` });
  };

  const removeFromWishlist = (productId: string) => {
    setWishlistItems(prevItems => prevItems.filter(item => item.id !== productId));
    toast({ title: "Removed from Wishlist", description: `Item has been removed from your wishlist.`, variant: "destructive" });
  };

  const getWishlistTotalValue = useCallback((): number => {
    return wishlistItems.reduce((total, item) => total + item.price, 0);
  }, [wishlistItems]);

  const getWishlistItemCount = useCallback((): number => {
    return wishlistItems.length;
  }, [wishlistItems]);

  const clearWishlist = () => {
    setWishlistItems([]);
    localStorage.removeItem(WISHLIST_STORAGE_KEY);
    toast({ title: "Wishlist Cleared", description: "All items have been removed from your wishlist." });
  };

  return (
    <WishlistContext.Provider value={{ wishlistItems, addToWishlist, removeFromWishlist, isInWishlist, getWishlistTotalValue, getWishlistItemCount, clearWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};
