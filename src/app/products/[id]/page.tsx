
'use client';

import { MOCK_PRODUCTS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/firebase';
import type { Product, ProductVariant } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Gem, Tag, ShoppingCart, PackageOpen, Info, Heart, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { notFound, useParams } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
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
  // user and token will be used
  const { user, token } = useAuth();
  const router = useRouter();
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

  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // Helper function to validate HTTP/HTTPS URLs
  const isValidHttpUrl = (stringToValidate: string | undefined | null): stringToValidate is string => {
    if (!stringToValidate || typeof stringToValidate !== 'string' || stringToValidate.trim() === '') {
      return false;
    }
    try {
      const url = new URL(stringToValidate);
      return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "firebase:"; // Added firebase for Firebase Storage URLs
    } catch (_) {
      return false;
    }
  };

  const [attributeOptions, setAttributeOptions] = useState<Record<string, string[]>>({});
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

  // Effect to initialize attributes and selected variant when product loads
  useEffect(() => {
    if (product && product.variants && product.variants.length > 0) {
      const options: Record<string, Set<string>> = {};
      product.variants.forEach((variant: ProductVariant) => {
        if (variant.attributes && typeof variant.attributes === 'object') {
          for (const key in variant.attributes) {
          if (!options[key]) {
            options[key] = new Set();
          }
            options[key].add(String(variant.attributes[key]));
          }
        } // End if variant.attributes is an object
      });
      const finalOptions: Record<string, string[]> = {};
      for (const key in options) {
        finalOptions[key] = Array.from(options[key]).sort(); // Sort options for consistent display
      }
      setAttributeOptions(finalOptions);

      // Initialize selectedAttributes with the first option for each attribute
      const initialAttributes: Record<string, string> = {};
      let firstVariantAttributes = product.variants[0].attributes;
      if (Object.keys(finalOptions).length > 0) {
        Object.keys(finalOptions).forEach(key => {
            if (firstVariantAttributes && firstVariantAttributes[key]) {
                initialAttributes[key] = String(firstVariantAttributes[key]);
            } else if (finalOptions[key].length > 0) {
                initialAttributes[key] = String(finalOptions[key][0]);
            }
        });
      }
      setSelectedAttributes(initialAttributes);

      if (isValidHttpUrl(product.imageUrl)) {
        setSelectedImage(product.imageUrl);
      } else if (allImages.length > 0) { // allImages is now pre-filtered
        setSelectedImage(allImages[0]);
      } else {
        setSelectedImage(''); // Fallback to empty if no valid images
      }
      setCurrentPrice(product.price);

    } else {
      setAttributeOptions({});
      setSelectedAttributes({});
      if (product) { // Product exists but no variants
        if (isValidHttpUrl(product.imageUrl)) {
          setSelectedImage(product.imageUrl);
        } else if (allImages.length > 0) { // allImages is now pre-filtered
          setSelectedImage(allImages[0]);
        } else {
          setSelectedImage('');
        }
        setCurrentPrice(product.price);
      }
    }
  }, [product]);

  // Effect to update display (image, price) when selectedAttributes change
  useEffect(() => {
    if (product && product.variants && product.variants.length > 0 && Object.keys(selectedAttributes).length > 0) {
      const matchedVariant = product.variants.find((variant: ProductVariant) => {
        const attributes = variant.attributes;
        if (!attributes || typeof attributes !== 'object') return false;
        return Object.keys(selectedAttributes).every(key => {
          // Ensure the variant has the attribute and it matches the selected value
          return attributes.hasOwnProperty(key) && attributes[key] === selectedAttributes[key];
        });
      });

      if (matchedVariant) {
        let newSelectedImageCandidate = '';
        if (isValidHttpUrl(matchedVariant.imageUrl)) {
          newSelectedImageCandidate = matchedVariant.imageUrl;
        } else if (isValidHttpUrl(product.imageUrl)) {
          newSelectedImageCandidate = product.imageUrl;
        } else if (allImages.length > 0) { // allImages is pre-filtered
          newSelectedImageCandidate = allImages[0];
        }
        setSelectedImage(newSelectedImageCandidate);
        setCurrentPrice(matchedVariant.price !== undefined ? matchedVariant.price : product.price);
      } else {
        // If no matching variant, reset to product's main image or first available from allImages
        if (isValidHttpUrl(product.imageUrl)) {
          setSelectedImage(product.imageUrl);
        } else if (allImages.length > 0) { // allImages is pre-filtered
          setSelectedImage(allImages[0]);
        } else {
          setSelectedImage('');
        }
        setCurrentPrice(product.price);
      }
    }
  }, [selectedAttributes, product]);

  const handleAttributeChange = (attrName: string, value: string) => {
    setSelectedAttributes(prev => ({
      ...prev,
      [attrName]: value,
    }));
  };

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
        const response = await fetch(`/api/storefront/products/${currentId}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('DEBUG: Raw product data from API:', JSON.stringify(data.product, null, 2));
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
    if (!product) return;

    let itemToAdd: Product | null = null; 

    if (product.variants && product.variants.length > 0 && Object.keys(selectedAttributes).length > 0) {
      const matchedVariant = product.variants.find((variant: ProductVariant) => {
        const attributes = variant.attributes;
        if (!attributes || typeof attributes !== 'object') return false;
        return Object.keys(selectedAttributes).every(key => attributes.hasOwnProperty(key) && attributes[key] === selectedAttributes[key]);
      }
      );

      if (matchedVariant) {
        itemToAdd = {
          ...product, // Spread base product info
          id: matchedVariant.id, // Override with variant ID
          name: matchedVariant.name || product.name, 
          price: matchedVariant.price ?? product.price,
          imageUrl: matchedVariant.imageUrl || product.imageUrl,
          sku: matchedVariant.sku, 
          // Clear or adjust other fields like variants, additionalImages for the cart item
          variants: undefined, // A cart item is a single variant, not a list of them
          additionalImages: matchedVariant.imageUrl ? [matchedVariant.imageUrl] : [],
        };
      }
    } else if (!product.variants || product.variants.length === 0) {
      // Product has no variants, add the base product itself
      itemToAdd = product;
    }

    if (itemToAdd) {
      addToCart(itemToAdd);
      toast({
        title: "Added to cart",
        description: `${itemToAdd.name} has been added to your cart.`
      });
    } else {
      // Optional: Notify user if no item could be added (e.g., variant selection issue)
      toast({
        title: "Unable to Add to Cart",
        description: "Please ensure product options are correctly selected.",
        variant: "destructive"
      });
    }
  }; // End of handleAddToCart

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
      if (!user?.profileImageUrl) {
        throw new Error('Please upload a profile picture before using Virtual Try-On');
      }

      if (!product?.imageUrl) {
        throw new Error('Product image is missing');
      }

      console.log('Initiating virtual try-on with:', {
        userImageUrl: user.profileImageUrl ? `${user.profileImageUrl.substring(0, 50)}...` : 'missing',
        productImageUrl: product.imageUrl ? `${product.imageUrl.substring(0, 50)}...` : 'missing',
        productName: product.name
      });

      const response = await fetch('/api/virtual-try-on', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // Add Authorization header if token is available
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          userImageUrl: user.profileImageUrl, // This implies user must exist and have profileImageUrl
          productImageUrl: product.imageUrl,
          userDescription: `User ${user.username || user.walletAddress || 'Guest'}`, // Fallback for username
          productDescription: product.name,
          // userId: user?.id, // userId from JWT will be used on backend if this is a protected route
          // Include the product ID for reference
          productId: product.id,
        }),
      });

      const result = await response.json();
      console.log('Virtual try-on response:', {
        status: response.status,
        ok: response.ok,
        result: result ? {
          ...result,
          generatedImageUrl: result.generatedImageUrl ? `${result.generatedImageUrl.substring(0, 50)}...` : 'missing'
        } : 'no result'
      });

      if (!response.ok) {
        const errorMessage = result?.message || 
                           result?.error || 
                           `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      if (result.errorMessage) {
        throw new Error(result.errorMessage);
      }

      if (!result.generatedImageUrl) {
        throw new Error('No image URL returned from the server');
      }

      setTryOnResult(result);

      // Create a unique filename with timestamp and user ID
      const timestamp = Date.now();
      const filename = `virtual_try_on_${timestamp}.jpg`;
      // Ensure user.id is available for storage path
      const storagePath = `user_uploads/${user?.id || 'guest_uploads'}/virtual_try_on/${filename}`;

      // Upload the image to Firebase Storage with metadata
      const storageRef = ref(storage, storagePath);
      const metadata = {
        contentType: 'image/jpeg',
        metadata: {
          productInfo: {
            productId: product.id,
            productName: product.name,
            productImage: product.imageUrl || '',
          },
          createdAt: new Date().toISOString(),
        },
      };

      // Convert the image URL to a blob and upload
      const imageResponse = await fetch(result.generatedImageUrl);
      const blob = await imageResponse.blob();
      
      // Upload the file with metadata
      await uploadBytes(storageRef, blob, metadata);
      const imageUrl = await getDownloadURL(storageRef);
      
      console.log('Image uploaded to storage:', imageUrl);

      // Show success toast and redirect to gallery after a short delay
      toast({
        title: 'Success!',
        description: 'Your virtual try-on was generated successfully!',
        variant: 'default',
      });

      // Close the modal and redirect to gallery
      setIsTryOnModalOpen(false);

      // Small delay to allow the modal to close smoothly
      setTimeout(() => {
        router.push('/account/gallery?success=true');
      }, 500);

    } catch (error: any) {
      console.error("Virtual Try-On error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: error.code
      });

      let userFriendlyError = 'An unexpected error occurred during Virtual Try-On.';

      if (error.message.includes('profile picture')) {
        userFriendlyError = 'Please upload a profile picture before using Virtual Try-On';
      } else if (error.message.includes('OPENAI_API_KEY')) {
        userFriendlyError = 'Server configuration error. Please contact support.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userFriendlyError = 'Network error. Please check your connection and try again.';
      }
      
      setTryOnError(userFriendlyError);
      toast({
        title: 'Error',
        description: userFriendlyError,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsTryingOn(false);
    }
  };

  const canShowTryOnButton = () => {
    const tryOnCategories = ['Fashion', "Women's Fashion", 'Gadgets & Toys', 'Novelty', 'Electronics', 'Office Tech', 'Home & Garden'];
    const canShow = tryOnCategories.includes(product.category);
    console.log('Try-on button debug:', {
      category: product.category,
      canShow,
      hasProfileImage: !!user?.profileImageUrl,
      isLoggedIn: !!user,
      tryOnCategories
    });
    return canShow;
  };

  // Combine main image and additional images for the gallery, ensuring they are valid URLs
  const allImages = product
    ? [product.imageUrl, ...(product.additionalImages || [])]
        .filter(isValidHttpUrl)
    : [];



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
            {/* Cascade Debugging: Log selectedImage before main image render */}
            {isValidHttpUrl(selectedImage) ? (
              <Image
                src={selectedImage}
                alt={product?.name || 'Product image'}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-contain"

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
                  onClick={() => {
                    if (isValidHttpUrl(img)) setSelectedImage(img);
                  }}
                >
                  {isValidHttpUrl(img) ? (
                    <Image
                      src={img}
                      alt={`${product?.name || 'Product'} - view ${index + 1}`}
                      fill
                      sizes="80px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full w-full bg-muted">
                      <AlertCircle className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
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
              <span className="text-3xl font-bold text-primary">{currentPrice !== null ? currentPrice.toFixed(2) : 'N/A'} TAIC</span>
              {(product?.cashbackPercentage && product.cashbackPercentage > 0) ? (
                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                  {product.cashbackPercentage}% Cashback
                </span>
              ) : null}
            </div>
            
            {/* Cash price if available */}
            {product?.price && ( // Display selling price as cash price
              <div className="text-muted-foreground">
                <span className="mr-1">Cash price:</span>
                <span className="font-medium">
                  ${parseFloat(String(product.price)).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Variant Selectors */}
          {Object.keys(attributeOptions).length > 0 && (
            <div className="space-y-4 pt-4">
              {Object.entries(attributeOptions).map(([attrName, values]) => (
                <div key={attrName}>
                  <h3 className="text-sm font-semibold text-gray-800 capitalize mb-2">{attrName}</h3>
                  <div className="flex flex-wrap gap-2">
                    {values.map(value => (
                      <Button
                        key={value}
                        variant={selectedAttributes[attrName] === value ? 'default' : 'outline'}
                        onClick={() => handleAttributeChange(attrName, value)}
                        className="rounded-md"
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

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
                  {(() => {
                    const tryOnGeneratedUrl = tryOnResult?.generatedImageUrl;
                    const productMainImageUrl = product?.imageUrl;
                    let displayUrl = '';

                    if (isValidHttpUrl(tryOnGeneratedUrl)) {
                      displayUrl = tryOnGeneratedUrl;
                    } else if (isValidHttpUrl(productMainImageUrl)) {
                      displayUrl = productMainImageUrl;
                    }
                    
                    /* Cascade Debugging: Log try-on image URLs */
                    console.log('[Try-On Modal Image Check] tryOnGeneratedUrl:', tryOnGeneratedUrl, 'productMainImageUrl:', productMainImageUrl, 'displayUrl:', displayUrl, 'isValid:', isValidHttpUrl(displayUrl));

                    return isValidHttpUrl(displayUrl) ? (
                      <Image
                        src={displayUrl}
                        alt="Virtual Try-On Result"
                        fill
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground text-center px-4">Image not available for try-on.</p>
                      </div>
                    );
                  })()}
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

