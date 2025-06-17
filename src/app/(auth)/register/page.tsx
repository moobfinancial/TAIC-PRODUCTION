
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount } from 'wagmi';
import { Gem, UserPlus, Wallet } from 'lucide-react';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
  const { isAuthenticated, isLoading, loginWithWallet, error: authError, clearError } = useAuth();
  const router = useRouter();
  const [showEmailRegister, setShowEmailRegister] = useState(true); // Default to email registration form
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();

  useEffect(() => {
    // Redirect if already logged in via any method
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    // Automatically attempt login/registration once wallet is connected and address is available
    if (isConnected && address && !isAuthenticated && !isLoading) {
      // Clear previous auth errors before attempting wallet login/registration
      if (authError) clearError(); 
      loginWithWallet(address); // AuthContext.loginWithWallet handles new user creation
    }
    // Intentionally not including loginWithWallet, authError, clearError in deps to avoid re-triggering on their change,
    // only on connection status change.
  }, [isConnected, address, isAuthenticated, isLoading, router]);

  const handleWalletRegister = async () => {
    // Clear any previous auth errors before opening modal
    if (authError) clearError();
    await open(); // This will open the Web3Modal
    // The useEffect hook above will handle the loginWithWallet call upon successful connection.
  };

  if (isLoading || (!isLoading && isAuthenticated)) {
    return (
      <AuthLayout title="Loading..." description="Please wait while we check your session.">
        <div className="flex justify-center items-center p-10">
          <Gem className="h-16 w-16 animate-pulse text-primary" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create Your TAIC Account" description="Join our platform to explore unique products and services.">
      <div className="w-full max-w-md space-y-6">
        {showEmailRegister ? (
          <RegisterForm />
        ) : (
          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <Wallet className="mx-auto h-10 w-10 text-primary mb-3" />
              <CardTitle className="text-2xl font-headline">Register with Wallet</CardTitle>
              <CardDescription>
                Connect your wallet to create an account. It's fast and secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <Button onClick={handleWalletRegister} size="lg" className="w-full text-lg py-6 font-semibold" disabled={isLoading}>
                {isLoading ? 'Connecting...' : 'Connect Wallet & Register'}
              </Button>
            </CardContent>
             <CardFooter className="flex flex-col items-center text-sm">
                <p className="text-muted-foreground">
                    Already have an account?{' '}
                    <Link href="/login" className="font-medium text-primary hover:underline">
                        Log In
                    </Link>
                </p>
            </CardFooter>
          </Card>
        )}

        <div className="text-center text-sm text-muted-foreground">
          {showEmailRegister ? (
            <p>
              Prefer to use your wallet?{' '}
              <Button variant="link" onClick={() => setShowEmailRegister(false)} className="text-primary">
                Register with Wallet
              </Button>
            </p>
          ) : (
            <p>
              Want to use email and password?{' '}
              <Button variant="link" onClick={() => setShowEmailRegister(true)} className="text-primary">
                Register with Email
              </Button>
            </p>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
