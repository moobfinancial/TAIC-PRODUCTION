
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
import { translateText, containsChineseCharacters } from '@/lib/translationUtils';

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
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [translatedName, setTranslatedName] = useState<string>('');
  const [translatedDescription, setTranslatedDescription] = useState<string>('');

  const currentId = params?.id;

  useEffect(() => {
    if (params === undefined || params === null) {
        setProduct(undefined);
        return;
    }
    
    const fetchProductDetails = async () => {
      if (typeof currentId !== 'string') {
        setProduct(null);
        return;
      }
      
      try {
        // Fetch from the CJ products API
        const response = await fetch(`/api/products/cj/${currentId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.product) {
            // Format the product data to match the expected Product type
            const formattedProduct: Product = {
              id: data.product.id,
              name: data.product.name, // Name already cleaned in API
              description: data.product.description || '',
              price: data.product.price,
              base_price: data.product.base_price || undefined,
              imageUrl: data.product.imageUrl || '',
              additionalImages: [
                ...(data.product.imageUrls || []).filter((url: string) => url !== data.product.imageUrl),
                ...(data.product.additionalImages || [])
              ].filter(Boolean),
              category: data.product.category,
              variants: data.product.variants || [],
              cashbackPercentage: data.product.cashbackPercentage || 0
            };
            setProduct(formattedProduct);
            return;
          }
        }
        
        // If product not found, show error state
        setProduct(null);
        toast({
          title: "Product not found",
          description: "The requested product could not be found.",
          variant: "destructive"
        });
        
      } catch (error) {
        console.error('Error fetching product details:', error);
        setProduct(null);
        toast({
          title: "Error loading product",
          description: "There was a problem loading the product details. Please try again later.",
          variant: "destructive"
        });
      }
    };
    
    fetchProductDetails();
  }, [currentId, params]);

  // Set initial selected image when product loads
  useEffect(() => {
    if (product?.imageUrl) {
      setSelectedImage(product.imageUrl);
    }
  }, [product?.imageUrl]);

  useEffect(() => {
    if (product) {
      // Translate name
      if (containsChineseCharacters(product.name)) {
        translateText(product.name).then(setTranslatedName);
      } else {
        setTranslatedName(product.name);
      }

      // Process and translate description
      let descriptionToProcess = product.description || '';
      const cjPrefix = "Imported from CJ: ";
      if (descriptionToProcess.startsWith(cjPrefix)) {
        descriptionToProcess = descriptionToProcess.substring(cjPrefix.length);
      }

      if (containsChineseCharacters(descriptionToProcess)) {
        translateText(descriptionToProcess).then(setTranslatedDescription);
      } else {
        setTranslatedDescription(descriptionToProcess);
      }
    }
  }, [product]);

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

  // Combine main image and additional images for the gallery
  const allImages = product ? [product.imageUrl, ...(product.additionalImages || [])] : [];

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
        {/* Main Product Image */}
        <div className="space-y-4">
          <div className="relative aspect-[4/3] bg-card rounded-lg shadow-xl overflow-hidden border">
            {selectedImage ? (
              <Image
                src={selectedImage}
                alt={product?.name || 'Product image'}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-contain"
                priority
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <AlertCircle className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground ml-2">Image not available</p>
              </div>
            )}
          </div>
          
          {/* Thumbnail Gallery */}
          {allImages.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {allImages.map((img, index) => (
                <div 
                  key={index}
                  className={cn(
                    "relative h-20 w-20 rounded border cursor-pointer transition-all",
                    selectedImage === img ? "border-primary border-2" : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => setSelectedImage(img)}
                >
                  <Image
                    src={img}
                    alt={`${product?.name || 'Product'} - view ${index + 1}`}
                    fill
                    sizes="80px"
                    className="object-contain p-1"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{translatedName || product?.name}</h1>
            <div className="flex items-center mt-2 space-x-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{product?.category}</span>
            </div>
          </div>

          {/* Price Section */}
          <div className="space-y-2">
            <div className="flex items-center">
              <Gem className="h-6 w-6 text-primary mr-2" />
              <span className="text-2xl font-bold">
                {product?.price?.toLocaleString()} TAIC
              </span>
              {product?.cashbackPercentage > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                  {product.cashbackPercentage}% Cashback
                </span>
              )}
            </div>
            
            {/* Cash price if available */}
            {product?.base_price && (
              <div className="text-muted-foreground">
                <span className="mr-1">Cash price:</span>
                <span className="font-medium">
                  ${parseFloat(String(product.base_price)).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Description</h2>
            <p className="text-muted-foreground">
              {translatedDescription.trim() || 'No description available for this product.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-6 space-y-3">
            <Button 
              size="lg" 
              className="w-full font-semibold" 
              onClick={handleAddToCart}
            >
              <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
            </Button>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 font-semibold" 
                onClick={handleWishlistToggle}
              >
                <Heart className={cn(
                  "mr-2 h-5 w-5",
                  isInWishlist(product?.id || '') ? "fill-red-500 text-red-500" : ""
                )} />
                {isInWishlist(product?.id || '') ? 'Saved' : 'Save'}
              </Button>
              
              {canShowTryOnButton() && (
                <Button 
                  variant="secondary" 
                  className="flex-1 font-semibold" 
                  onClick={handleVirtualTryOn}
                  disabled={isTryingOn || !user?.profileImageUrl}
                >
                  {isTryingOn ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-5 w-5" />
                  )}
                  {isTryingOn ? 'Loading...' : 'Try On'}
                </Button>
              )}
            </div>
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
