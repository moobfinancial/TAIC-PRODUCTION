'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProfileSection } from '@/components/dashboard/ProfileSection';
import { OrderHistory } from '@/components/dashboard/OrderHistory';
import { AIConversationHistory } from '@/components/dashboard/AIConversationHistory';
import { LayoutDashboard, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-200px)]"><LayoutDashboard className="h-12 w-12 animate-pulse text-primary" /></div>;
  }

  if (!user) {
    // This fallback can be shown briefly or if redirect fails
    return (
        <div className="text-center py-20">
          <ShieldAlert className="mx-auto h-24 w-24 text-destructive mb-6" />
          <h1 className="text-3xl font-headline font-semibold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-8">You need to be logged in to view this page.</p>
          <Button asChild size="lg">
            <Link href="/login?redirect=/dashboard">Login</Link>
          </Button>
        </div>
      );
  }

  return (
    <div className="space-y-12">
      <header className="text-center">
        <LayoutDashboard className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-headline font-bold tracking-tight sm:text-5xl">Welcome to Your Dashboard, {user.username}!</h1>
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
