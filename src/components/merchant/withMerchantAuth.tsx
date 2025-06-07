'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Higher-order component that protects routes requiring merchant authentication
 * Redirects to login page if user is not authenticated as a merchant
 */
export default function withMerchantAuth<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, loading } = useMerchantAuth();
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);

    // Handle client-side rendering
    useEffect(() => {
      setIsClient(true);
    }, []);

    // Redirect if not authenticated
    useEffect(() => {
      if (isClient && !loading && !isAuthenticated) {
        router.push('/merchant/login');
      }
    }, [isAuthenticated, loading, router, isClient]);

    // Show loading state while checking authentication
    if (loading || !isClient) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto" />
            <p className="mt-4 text-lg">Verifying merchant access...</p>
          </div>
        </div>
      );
    }

    // If authenticated, render the protected component
    if (isAuthenticated) {
      return <Component {...props} />;
    }

    // This should not be visible as we redirect, but just in case
    return null;
  };
}
