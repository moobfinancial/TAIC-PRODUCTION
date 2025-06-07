
'use client';

import { Button } from '@/components/ui/button';
import { ListChecks, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import ProductList from '@/components/merchant/ProductList';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function MerchantProductsPage() {
  const { isAuthenticated, loading } = useMerchantAuth();
  const router = useRouter();
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/merchant/login');
    }
  }, [isAuthenticated, loading, router]);
  
  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
            <ListChecks className="mr-3 h-8 w-8 text-primary" />
            My Products
          </h1>
          <p className="text-lg text-muted-foreground mt-1">View, edit, and manage your product listings.</p>
        </div>
        <Button asChild className="mt-4 sm:mt-0">
          <Link href="/merchant/products/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Product
          </Link>
        </Button>
      </header>

      <ProductList />

      <div className="mt-12 text-center">
        <Button variant="outline" asChild>
          <Link href="/merchant/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
