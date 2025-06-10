'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

function AdminLoginPageContent() {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isAuthenticated, login } = useAdminAuth();

  // Redirect if already authenticated
  useEffect(() => {
    console.log(
      '[AdminLoginPage] Auth useEffect triggered. isAuthenticated:', 
      isAuthenticated, 
      '. Current searchParams:', 
      searchParams?.toString() || '{}',
      '. isLoading (local page state):',
      isLoading
    );
    if (isAuthenticated) {
      const redirectTo = searchParams?.get('from') || '/admin';
      console.log('[AdminLoginPage] isAuthenticated is TRUE. Attempting redirect to:', redirectTo);
      router.replace(redirectTo);
      console.log('[AdminLoginPage] router.replace called for:', redirectTo);
    } else {
      console.log('[AdminLoginPage] isAuthenticated is FALSE. Setting local isLoading to false.');
      setIsLoading(false); // This is the page's own loading indicator
    }
  }, [isAuthenticated, router, searchParams, isLoading]); // Added isLoading to dependencies as it's used in console.log

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AdminLoginPage] handleSubmit called at', Date.now(), 'isSubmitting:', isSubmitting, 'apiKey:', apiKey);

    if (isSubmitting) {
      console.warn('[AdminLoginPage] Submission already in progress. Aborting this call.');
      return;
    }
    
    if (!apiKey) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await login(apiKey); // login() is from useAdminAuth()
      
      if (success) {
        toast({
          title: 'Success',
          description: 'Login successful. Redirecting...',
        });
        // THE REDIRECTION IS NOW FULLY HANDLED BY THE useEffect hook listening to isAuthenticated
      }
      // If !success, the login function in AdminAuthContext already shows a toast for auth failure.
    } catch (error: any) {
      // This catch block is for unexpected errors thrown by the login() call itself,
      // not for authentication failures which login() handles internally.
      console.error('[AdminLoginPage] Unexpected error during login process:', error);
      toast({
        title: 'Login Error',
        description: error.message || 'An unexpected error occurred during the login process.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Portal</h1>
            <p className="text-gray-600 mt-2">Sign in with your admin API key</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Admin API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your admin API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full"
                disabled={isSubmitting}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Contact your administrator if you've lost your API key</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminLoginLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg font-semibold">Loading Login Page...</p>
      <p className="text-sm text-muted-foreground">Please wait a moment.</p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AdminLoginLoadingFallback />}>
      <AdminLoginPageContent />
    </Suspense>
  );
}
