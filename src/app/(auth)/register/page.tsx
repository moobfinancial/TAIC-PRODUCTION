
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext'; // Updated import
import { UserPlus, Gem } from 'lucide-react'; // UserPlus or Wallet icon

export default function RegisterPage() {
  const { isAuthenticated, isLoading } = useAuth(); // Use new context values
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard'); // Redirect if already logged in
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading state or null if redirecting
  if (isLoading || (!isLoading && isAuthenticated)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Gem className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12 min-h-[calc(100vh-150px)]">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" /> {/* Changed Icon */}
          <CardTitle className="text-3xl font-headline">Create Account via Wallet</CardTitle>
          <CardDescription>
            Account creation is now handled automatically when you connect your cryptocurrency wallet (e.g., MetaMask) for the first time.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">
            Please use the &quot;Connect Wallet&quot; button, typically found in the website header,
            to create your account and log in.
          </p>
          <Button asChild size="lg" className="w-full text-lg py-6 font-semibold">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
