'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart, Users, Lightbulb, Sparkles, LayoutDashboard, LogOut, UserCircle, Gem, Coins, Landmark, Heart, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
// Switch to the new AuthContext
import { useAuth } from '@/contexts/AuthContext';
import WalletConnectButton from '@/components/wallet/WalletConnectButton'; // Import the new button
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { Logo } from '@/components/Logo';

export function Navbar() {
  // Use new state from AuthContext
  const { user, isAuthenticated } = useAuth(); // logout removed as WalletConnectButton handles it
  const { getCartItemCount } = useCart();
  const { getWishlistItemCount } = useWishlist();

  const navItems = [
    { href: '/products', label: 'Products', icon: <ShoppingCart /> },
    { href: '/ai-assistant', label: 'AI Assistant', icon: <Sparkles /> },
    { href: '/ai-product-ideas', label: 'Product Ideas', icon: <Lightbulb /> },
    { href: '/tokenomics', label: 'Tokenomics', icon: <Coins /> },
    { href: '/staking', label: 'Staking', icon: <Landmark /> },
    { href: '/affiliate', label: 'Affiliate', icon: <Users /> },
  ];

  // Helper function (if not already globally available or part of user model)
  const shortenAddress = (address: string, chars = 4): string => {
    if (!address) return "";
    const prefix = address.substring(0, chars + 2); // 0x + chars
    const suffix = address.substring(address.length - chars);
    return `${prefix}...${suffix}`;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-16 items-center">
        <Logo />
        <nav className="ml-10 hidden md:flex items-center space-x-6 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 transition-colors hover:text-primary text-foreground/80"
            >
              {React.cloneElement(item.icon, { className: "h-4 w-4"})}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center space-x-2">
          <Link href="/wishlist" passHref>
            <Button variant="ghost" size="icon" aria-label="Wishlist" className="relative">
              <Heart className="h-5 w-5" />
              {getWishlistItemCount() > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {getWishlistItemCount()}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/cart" passHref>
            <Button variant="ghost" size="icon" aria-label="Shopping Cart" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {getCartItemCount() > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {getCartItemCount()}
                </span>
              )}
            </Button>
          </Link>

          <WalletConnectButton />

          {isAuthenticated && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profileImageUrl || `https://avatar.vercel.sh/${user.username || user.walletAddress}.png?size=32`} alt={user.username || user.walletAddress} />
                    <AvatarFallback>{(user.username || user.walletAddress).substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.username || shortenAddress(user.walletAddress)}</p>
                    {user.email && (
                       <p className="text-xs leading-none text-muted-foreground">
                         {user.email}
                       </p>
                    )}
                    <p className="text-xs leading-none text-muted-foreground flex items-center">
                      <Gem className="mr-1 h-3 w-3 text-primary" /> {user.taicBalance?.toLocaleString() || 0} TAIC
                    </p>
                     {/* Added Cashback Balance display */}
                    <p className="text-xs leading-none text-muted-foreground flex items-center">
                      <Coins className="mr-1 h-3 w-3 text-yellow-500" /> {user.cashbackBalance?.toLocaleString() || 0} Cashback
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center">
                    <UserCircle className="mr-2 h-4 w-4" />
                    Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account/gallery" className="flex items-center">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    My Gallery
                  </Link>
                </DropdownMenuItem>
                {/* Logout is handled by WalletConnectButton, so no explicit logout item here. */}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
