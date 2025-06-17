
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Gem, Eye, Sparkles, Heart } from 'lucide-react';
import type { Product } from '@/lib/types';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { VTOModal } from '@/components/vto/VTOModal'; // Import VTOModal
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

const PLACEHOLDER_IMAGE_URL = 'https://placehold.co/600x400/EEE/31343C?text=No+Image';

const isValidImageUrl = (url: string | undefined | null): boolean => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return false;
  }
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
};
import { translateText, containsChineseCharacters } from '../../lib/translationUtils';

interface ProductCardProps {
  product: Product;
  showVirtualTryOnButton?: boolean;
  productContext?: 'default' | 'giftIdea';
}

export function ProductCard({ product, showVirtualTryOnButton = false, productContext = 'default' }: ProductCardProps) {
  const { addToCart } = useCart();
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth(); // Get isAuthenticated state

  const [translatedName, setTranslatedName] = useState<string>('');
  const [translatedDescription, setTranslatedDescription] = useState<string>('');
  const [isVtoModalOpen, setIsVtoModalOpen] = useState(false); // State for VTO Modal


  useEffect(() => {
    if (product) {
      // Translate name
      if (product.name && containsChineseCharacters(product.name)) {
        translateText(product.name).then(setTranslatedName);
      } else {
        setTranslatedName(product.name || '');
      }

      // Process and translate description
      let descriptionToProcess = product.description || '';
      const cjPrefix = "Imported from CJ: ";
      if (descriptionToProcess.startsWith(cjPrefix)) {
        descriptionToProcess = descriptionToProcess.substring(cjPrefix.length);
      }

      if (descriptionToProcess && containsChineseCharacters(descriptionToProcess)) {
        translateText(descriptionToProcess).then(setTranslatedDescription);
      } else {
        setTranslatedDescription(descriptionToProcess);
      }
    }
  }, [product]);

  const handleVirtualTryOn = () => {
    if (isAuthenticated) {
      setIsVtoModalOpen(true);
    } else {
      toast({
        title: 'Login Required',
        description: 'Please log in or connect your wallet to use the Virtual Try-On feature.',
        variant: 'destructive',
      });
    }
  };

  const canShowTryOnButton = () => {
    if (!showVirtualTryOnButton || productContext !== 'giftIdea') {
      return false;
    }
    const tryOnCategories = ['Fashion', 'Gadgets & Toys', 'Novelty', 'Electronics', 'Office Tech', 'Home & Garden'];
    return tryOnCategories.includes(product.category);
  };

  const isItemInWishlist = isInWishlist(product.id);

  const handleWishlistToggle = () => {
    if (isItemInWishlist) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 h-full group">
      <CardHeader className="p-0 relative">
        <div className="aspect-video relative w-full">
          <Image
            src={isValidImageUrl(product.imageUrl) ? product.imageUrl! : PLACEHOLDER_IMAGE_URL}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            priority={false}
            data-ai-hint={product.dataAiHint}
          />
        </div>
        <Button
            variant="ghost"
            size="icon"
            className={cn(
                "absolute top-2 right-2 z-10 bg-background/70 hover:bg-background text-primary rounded-full h-9 w-9",
                isItemInWishlist ? "text-destructive hover:text-destructive/90" : "text-muted-foreground hover:text-primary"
            )}
            onClick={handleWishlistToggle}
            aria-label={isItemInWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
            <Heart className={cn("h-5 w-5", isItemInWishlist && "fill-current text-destructive")} />
        </Button>
      </CardHeader>
      <CardContent className="p-6 flex-grow">
        <CardTitle className="text-xl font-headline mb-2">{translatedName || product.name}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground mb-4 h-20 overflow-hidden text-ellipsis">
          {translatedDescription || product.description}
        </CardDescription>
        
        {/* Price Section */}
        <div className="space-y-2">
          {/* TAIC Price */}
          <div className="flex items-center">
            <Gem className="h-5 w-5 text-primary mr-2" />
            <span className="text-lg font-semibold">
              {product.price.toLocaleString()} TAIC
            </span>
          </div>
          
          {/* Cash Price */}
          {product.price && ( // Display selling price as cash price
            <div className="flex items-center text-sm text-muted-foreground">
              <span className="mr-1">Cash:</span>
              <span className="font-medium">
                ${parseFloat(String(product.price)).toFixed(2)} 
              </span>
              {(product.cashbackPercentage && product.cashbackPercentage > 0) ? (
                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                  {product.cashbackPercentage}% Cashback
                </span>
              ) : null}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-6 pt-0 flex flex-col space-y-2">
        <Button className="w-full font-semibold" onClick={() => {
          // Create a copy of the product with translated name and description
          const translatedProduct = {
            ...product,
            name: translatedName || product.name,
            description: translatedDescription || product.description
          };
          addToCart(translatedProduct);
        }}>
          <PlusCircle className="mr-2 h-5 w-5" /> Add to Cart
        </Button>
        <Button asChild variant="outline" className="w-full font-semibold">
          <Link href={`/products/${product.id}`}>
            <Eye className="mr-2 h-5 w-5" /> View Details
          </Link>
        </Button>
        {canShowTryOnButton() && (
          <Button variant="secondary" className="w-full font-semibold" onClick={handleVirtualTryOn}>
            <Sparkles className="mr-2 h-5 w-5" /> Virtual Try-On
          </Button>
        )}
      </CardFooter>
      {isVtoModalOpen && (
        <VTOModal
          product={product}
          isOpen={isVtoModalOpen}
          onClose={() => setIsVtoModalOpen(false)}
        />
      )}
    </Card>
  );
}
