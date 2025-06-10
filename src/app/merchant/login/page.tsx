
'use client';

import React, { useState, type FormEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Store, Loader2 } from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';

function MerchantLoginPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { login, isAuthenticated } = useMerchantAuth();

  useEffect(() => {
    // Safe access to searchParams
    const registered = searchParams?.get('registered');
    if (registered === 'true') {
      toast({
        title: 'Registration Successful',
        description: 'Please log in with your new account.',
      });
    }
    
    // Redirect if already logged in
    if (isAuthenticated) {
      router.push('/merchant/dashboard');
    }
  }, [searchParams, isAuthenticated, router, toast]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email.trim() || !password.trim()) {
      toast({
        title: 'Login Failed',
        description: 'Please enter email and password.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/merchant/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      // Store token and user data in context
      login(data.token, data.user);
      
      toast({
        title: 'Login Successful',
        description: `Welcome back, ${data.user.businessName || data.user.username}!`,
      });
      
      // Redirect to merchant dashboard
      router.push('/merchant/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      toast({
        title: 'Login Failed',
        description: err instanceof Error ? err.message : 'Invalid email or password.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <Store className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-headline">Merchant Login</CardTitle>
          <CardDescription>Access your TAIC Showcase Merchant Dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="text-base"
              />
            </div>
            <Button type="submit" className="w-full text-lg py-6 font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Logging in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" /> Login to Merchant Dashboard
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have a merchant account?{' '}
            <Button variant="link" asChild className="p-0 h-auto">
              <Link href="/merchant/register">Register here</Link>
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function MerchantLoginLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg font-semibold">Loading Merchant Login...</p>
      <p className="text-sm text-muted-foreground">Please wait a moment.</p>
    </div>
  );
}

export default function MerchantLoginPage() {
  return (
    <Suspense fallback={<MerchantLoginLoadingFallback />}>
      <MerchantLoginPageContent />
    </Suspense>
  );
}
