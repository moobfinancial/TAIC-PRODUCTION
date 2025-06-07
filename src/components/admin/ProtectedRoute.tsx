'use client';

import { useRouter, usePathname } from 'next/navigation'; // Added usePathname
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  // requireAdmin prop was not used, removed for clarity
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname
  const [isClient, setIsClient] = useState(false);
  
  // Move console.log after isClient is initialized
  console.log(`[ProtectedRoute] Rendering for path: ${pathname}. AuthState: isAuthenticated=${isAuthenticated}, loading=${loading}, isClient=${isClient}`);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    console.log(`[ProtectedRoute] Effect check for path: ${pathname}. AuthState: isAuthenticated=${isAuthenticated}, loading=${loading}, isClient=${isClient}`);
    if (!loading && !isAuthenticated && isClient) {
      const safePathname = pathname || '/';
      const redirectUrl = `/admin/login?from=${encodeURIComponent(safePathname)}`;
      console.log(`[ProtectedRoute] Redirecting from ${safePathname} to ${redirectUrl}`);
      router.push(redirectUrl);
    }
  }, [isAuthenticated, loading, router, isClient, pathname]);

  if (loading || !isClient) {
    console.log(`[ProtectedRoute] Showing loader for path: ${pathname}.`);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading admin section...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log(`[ProtectedRoute] Not authenticated for path: ${pathname}, returning null (should be redirected by effect).`);
    return null; 
  }

  console.log(`[ProtectedRoute] Authenticated. Rendering children for path: ${pathname}.`);
  return <>{children}</>;
}
