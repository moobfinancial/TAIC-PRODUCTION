'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  
  if (!productId) {
    return <div>Product ID is missing</div>;
  }
  const { isAuthenticated, loading, token } = useMerchantAuth();
  const { toast } = useToast();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch product details
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchProduct = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/merchant/products/${productId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch product: ${response.status}`);
        }

        const data = await response.json();
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product');
        toast({
          title: 'Error',
          description: 'Could not load product details',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [productId, isAuthenticated, token, toast]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/merchant/login');
    }
  }, [isAuthenticated, loading, router]);

  const handleDelete = async () => {
    if (!token) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/merchant/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete product: ${response.status}`);
      }

      toast({
        title: 'Success',
        description: 'Product deleted successfully',
        variant: 'default',
      });
      
      router.push('/merchant/products');
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete product',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Show loading state while checking authentication or fetching product
  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading product details...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
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
        
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Error Loading Product</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => router.refresh()}>Try Again</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show product not found
  if (!product) {
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
        
        <Card>
          <CardHeader>
            <CardTitle>Product Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The product you are looking for does not exist or has been removed.</p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/merchant/products">View All Products</Link>
            </Button>
          </CardFooter>
        </Card>
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
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{product.category}</Badge>
            <span className="text-sm text-muted-foreground">
              ID: {product.id}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/merchant/products/edit/${product.id}`}>
              <Edit className="mr-1 h-4 w-4" /> Edit
            </Link>
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                <Trash2 className="mr-1 h-4 w-4" /> 
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the product
                  "{product.name}" from your store.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Price</h3>
              <p className="text-xl font-semibold">{product.price} TAIC</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Stock</h3>
              <div className="flex items-center gap-2">
                <p className="text-xl font-semibold">{product.stock} units</p>
                {product.stock > 0 ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> In Stock
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <AlertCircle className="mr-1 h-3 w-3" /> Out of Stock
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
            <p className="whitespace-pre-line">{product.description || 'No description provided.'}</p>
          </div>
          
          {product.imageUrl && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Product Image</h3>
                <div className="relative w-full h-64 border rounded-md overflow-hidden">
                  {/* Next.js Image component with proper sizing */}
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="object-contain w-full h-full"
                  />
                </div>
              </div>
            </>
          )}
          
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium text-muted-foreground">Created</h3>
              <p>{new Date(product.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <h3 className="font-medium text-muted-foreground">Last Updated</h3>
              <p>{new Date(product.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/merchant/products">View All Products</Link>
          </Button>
          <Button asChild>
            <Link href={`/merchant/products/edit/${product.id}`}>
              <Edit className="mr-2 h-4 w-4" /> Edit Product
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
