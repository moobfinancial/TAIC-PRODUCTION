
'use client';

import { MOCK_PRODUCTS } from '@/lib/constants';
import type { Product } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Gem, Tag, ShoppingCart, PackageOpen, Info, Heart, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { notFound, useParams } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'; // Import AlertDialog components
import type { VirtualTryOnOutput } from '@/ai/schemas/virtual-try-on.schema'; // Import types

export default function ProductDetailPage() {
  const params = useParams<{ id?: string }>();
  const { user } = useAuth(); // Get user from auth context
  const { addToCart } = useCart();
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [isTryingOn, setIsTryingOn] = useState(false);
  const [tryOnResult, setTryOnResult] = useState<VirtualTryOnOutput | null>(null);
  const [tryOnError, setTryOnError] = useState<string | null>(null);
  const [isTryOnModalOpen, setIsTryOnModalOpen] = useState(false);

  const currentId = params?.id;

  useEffect(() => {
    if (params === undefined || params === null) {
        setProduct(undefined);
        return;
    }
    if (typeof currentId === 'string') {
      const foundProduct = MOCK_PRODUCTS.find(p => p.id === currentId);
      setProduct(foundProduct || null);
    } else {
      setProduct(null);
    }
  }, [currentId, params]);

  if (product === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)]">
        <PackageOpen className="h-12 w-12 animate-pulse text-primary mb-4" />
        <p className="text-muted-foreground">Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    notFound();
  }

  const isItemInWishlist = isInWishlist(product.id);

  const handleWishlistToggle = () => {
    if (isItemInWishlist) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };
  
  const handleAddToCart = () => {
    addToCart(product);
  };

  const handleVirtualTryOn = async () => {
    if (!user || !user.profileImageUrl) {
      toast({
        title: "Profile Picture Required",
        description: "Please upload a profile picture in your dashboard to use the Virtual Try-On feature.",
        variant: "destructive",
      });
      // Optionally, redirect to dashboard or profile page: router.push('/dashboard');
      return;
    }

    if (!product) return;

    setIsTryingOn(true);
    setTryOnError(null);
    setTryOnResult(null);
    setIsTryOnModalOpen(true); // Open modal immediately to show loading state

    try {
      const response = await fetch('/api/virtual-try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userImageUrl: user.profileImageUrl,
          productImageUrl: product.imageUrl,
          userDescription: `User ${user.username || ''} view`, // Example, can be more dynamic
          productDescription: product.name,
        }),
      });

      const result: VirtualTryOnOutput = await response.json();

      if (!response.ok || result.errorMessage?.startsWith("Error")) { // Check for explicit error from flow
        throw new Error(result.errorMessage || `Virtual Try-On failed: ${response.statusText}`);
      }

      setTryOnResult(result);

    } catch (error: any) {
      console.error("Virtual Try-On API error:", error);
      setTryOnError(error.message || "An unexpected error occurred during Virtual Try-On.");
      // Toast is shown via the modal's error display or could be added here too
    } finally {
      setIsTryingOn(false);
    }
  };

  const canShowTryOnButton = () => {
    const tryOnCategories = ['Fashion', 'Gadgets & Toys', 'Novelty', 'Electronics', 'Office Tech', 'Home & Garden'];
    return tryOnCategories.includes(product.category);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <Button variant="outline" asChild>
          <Link href="/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
        <div className="relative aspect-[4/3] bg-card rounded-lg shadow-xl overflow-hidden border">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority
            data-ai-hint={product.dataAiHint || 'product image'}
          />
        </div>

        <div className="space-y-6">
          <h1 className="text-3xl lg:text-4xl font-headline font-bold">{product.name}</h1>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Tag className="h-4 w-4" />
            <span>Category: {product.category}</span>
          </div>

          <p className="text-3xl font-bold text-primary flex items-center">
            <Gem className="mr-2 h-7 w-7" /> {product.price.toLocaleString()} TAIC
          </p>
          
          <Card className="shadow-md bg-secondary/20 border">
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center">
                <Info className="mr-3 h-6 w-6 text-primary" />
                Product Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/80 leading-relaxed text-base">{product.description}</p>
            </CardContent>
          </Card>

          <div className="mt-8 pt-6 border-t flex flex-col gap-3">
             <Button 
               size="lg" 
               className="w-full font-semibold py-6 text-lg shadow-lg hover:shadow-xl transition-shadow" 
               onClick={handleAddToCart}
             >
               <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
             </Button>
             <Button
                size="lg"
                variant="outline"
                className={cn(
                    "w-full font-semibold py-6 text-lg shadow-lg hover:shadow-xl transition-shadow",
                    isItemInWishlist && "border-destructive text-destructive hover:bg-destructive/5 hover:text-destructive"
                )}
                onClick={handleWishlistToggle}
              >
                <Heart className={cn("mr-2 h-5 w-5", isItemInWishlist && "fill-current")} />
                {isItemInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
              </Button>
              {canShowTryOnButton() && (
                <Button 
                  size="lg" 
                  variant="secondary" 
                  className="w-full font-semibold py-6 text-lg shadow-lg hover:shadow-xl transition-shadow" 
                  onClick={handleVirtualTryOn}
                  disabled={isTryingOn || !user?.profileImageUrl} // Disable if no profile pic
                >
                  {isTryingOn ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-5 w-5" />
                  )}
                  Virtual Try-On {isTryingOn ? 'Loading...' : (!user?.profileImageUrl ? '(Needs Profile Pic)' : '')}
                </Button>
              )}
          </div>
        </div>
      </div>

      {/* Virtual Try-On Modal */}
      <AlertDialog open={isTryOnModalOpen} onOpenChange={setIsTryOnModalOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-primary" />
              Virtual Try-On Result
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tryOnResult?.errorMessage?.startsWith("SIMULATED:")
                ? "This is a simulated result. The feature is under development."
                : "Review your virtual try-on below."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4 space-y-4">
            {isTryingOn && (
              <div className="flex flex-col items-center justify-center p-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Generating your virtual try-on image...</p>
              </div>
            )}
            {tryOnError && !isTryingOn && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <h3 className="font-semibold">Try-On Failed</h3>
                </div>
                <p className="text-sm mt-1">{tryOnError}</p>
              </div>
            )}
            {tryOnResult && !isTryingOn && (
              <div className="space-y-3">
                {tryOnResult.errorMessage && (
                   <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-700 dark:text-amber-400">
                    <p className="text-sm font-medium">Note from AI:</p>
                    <p className="text-xs">{tryOnResult.errorMessage}</p>
                  </div>
                )}
                <div className="font-mono text-xs bg-muted p-3 rounded-md max-h-40 overflow-y-auto">
                  <p className="font-semibold mb-1">Generated Text Prompt (for image model):</p>
                  <pre className="whitespace-pre-wrap break-all">{tryOnResult.generatedTextPrompt || "No text prompt was generated."}</pre>
                </div>
                <div className="border rounded-md overflow-hidden aspect-square relative">
                  <Image
                    src={tryOnResult.generatedImageUrl || product.imageUrl} // Fallback to product image if URL is somehow empty
                    alt="Virtual Try-On Result (Placeholder)"
                    fill
                    className="object-contain"
                  />
                </div>
                 <p className="text-xs text-center text-muted-foreground">
                    (Placeholder image currently shown. Actual image generation is pending model integration.)
                 </p>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsTryOnModalOpen(false)}>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
