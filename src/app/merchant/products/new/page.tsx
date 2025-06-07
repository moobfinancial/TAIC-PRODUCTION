
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import ProductForm from '@/components/merchant/ProductForm';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useEffect } from 'react';

export default function AddNewProductPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useMerchantAuth();
  
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
          <p className="mt-4 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-start mb-8">
        <Button variant="outline" size="sm" asChild>
          <Link href="/merchant/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Link>
        </Button>
      </div>
      
      <div className="flex items-center gap-2 mb-6">
        <PackagePlus className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-headline font-bold">Add New Product</h1>
      </div>
      
      <ProductForm />
    </div>
  );
}
