
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount } from 'wagmi';
import { Gem, LogIn, Mail } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';
import { AuthLayout } from '@/components/layouts/AuthLayout';

export default function LoginPage() {
  const { isAuthenticated, isLoading, loginWithWallet, error: authError, clearError } = useAuth();
  const router = useRouter();
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const { open } = useWeb3Modal();
    const { address, isConnected } = useAccount();
  const attemptedLoginRef = useRef<string | null>(null);

  useEffect(() => {
    // Redirect if already logged in via any method
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    // Automatically attempt login once wallet is connected and address is available.
    // A ref is used to ensure login is attempted only once per new address connection, preventing race conditions.
    if (isConnected && address && !isAuthenticated && !isLoading && attemptedLoginRef.current !== address) {
      if (authError) clearError();
      loginWithWallet(address);
      attemptedLoginRef.current = address; // Mark this address as attempted
    }

    // If the user disconnects their wallet, reset the ref to allow a new login attempt next time.
    if (!isConnected && attemptedLoginRef.current) {
      attemptedLoginRef.current = null;
    }
  }, [isConnected, address, isAuthenticated, isLoading, loginWithWallet, authError, clearError]);

  const handleWalletLogin = async () => {
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
    <AuthLayout title="Welcome to TAIC" description="Log in or create an account to continue.">
      <div className="w-full max-w-md space-y-6">
        {!showEmailLogin ? (
          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <LogIn className="mx-auto h-10 w-10 text-primary mb-3" />
              <CardTitle className="text-2xl font-headline">Login with Wallet</CardTitle>
              <CardDescription>
                Connect your cryptocurrency wallet (e.g., MetaMask) to securely access your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <Button onClick={handleWalletLogin} size="lg" className="w-full text-lg py-6 font-semibold" disabled={isLoading}>
                {isLoading ? 'Connecting...' : 'Connect Wallet & Log In'}
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col items-center text-sm">
              <p className="text-muted-foreground">
                Prefer to use email and password?
              </p>
              <Button variant="link" onClick={() => setShowEmailLogin(true)} className="text-primary">
                Log In with Email
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <LoginForm /> // This component already has a link to register and a placeholder for wallet login
        )}

        {!showEmailLogin && (
            <div className="text-center text-sm text-muted-foreground">
                No account yet? Wallet login will create one for you, or {' '}
                <Link href="/register" className="font-medium text-primary hover:underline">
                    Sign up with Email
                </Link>
            </div>
        )}
         {showEmailLogin && (
            <div className="text-center text-sm text-muted-foreground">
                <Button variant="link" onClick={() => setShowEmailLogin(false)} className="text-primary">
                    Back to Wallet Login
                </Button>
            </div>
        )}
      </div>
    </AuthLayout>
  );
}
