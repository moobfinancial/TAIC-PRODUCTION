'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Update useAuth import path
import { useAuth } from '@/contexts/AuthContext';
import { ProfileSection } from '@/components/dashboard/ProfileSection';
import { OrderHistory } from '@/components/dashboard/OrderHistory';
import { AIConversationHistory } from '@/components/dashboard/AIConversationHistory';
import { LayoutDashboard, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
  // Use isLoading and isAuthenticated from the new AuthContext
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect if not loading and not authenticated
    if (!isLoading && !isAuthenticated) {
      // Redirect to home or a generic landing page, as /login might be deprecated
      // The WalletConnectButton in Navbar should be the primary way to connect.
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-200px)]"><LayoutDashboard className="h-12 w-12 animate-pulse text-primary" /></div>;
  }

  // If not authenticated and no longer loading, the redirect should have happened.
  // But as a fallback, or if redirect is not immediate:
  if (!isAuthenticated || !user) {
    return (
        <div className="text-center py-20">
          <ShieldAlert className="mx-auto h-24 w-24 text-destructive mb-6" />
          <h1 className="text-3xl font-headline font-semibold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-8">You need to be logged in to view this page.</p>
          {/* The WalletConnectButton in Navbar is the way to login. */}
          {/* Optionally, add a button to navigate home if preferred. */}
          <Button asChild size="lg">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </div>
      );
  }

  // Fallback for username if it's null (e.g., only wallet address is available)
  const displayName = user.username || `User ${user.walletAddress.substring(0, 6)}...`;

  return (
    <div className="space-y-12">
      <header className="text-center">
        <LayoutDashboard className="mx-auto h-16 w-16 text-primary mb-4" />
        {/* Use displayName which handles null username */}
        <h1 className="text-4xl font-headline font-bold tracking-tight sm:text-5xl">Welcome to Your Dashboard, {displayName}!</h1>
        <p className="text-lg text-muted-foreground mt-2">Manage your account, view orders, and track AI interactions.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <ProfileSection />
        <OrderHistory />
      </div>
      
      <div>
        <AIConversationHistory />
      </div>
    </div>
  );
}
