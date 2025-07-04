
'use client';

import type { ProductForAI } from '@/ai/schemas/shopping-assistant-schemas-new';
import { ProductCard } from './ProductCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Product } from '@/lib/types';

interface ProductCanvasProps {
  products: ProductForAI[];
  showVirtualTryOn?: boolean;
  productCardContext?: 'default' | 'giftIdea';
}

export function ProductCanvas({ products, showVirtualTryOn = false, productCardContext = 'default' }: ProductCanvasProps) {
  if (!products || products.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No products to display.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full pr-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard 
            key={product.id} 
            product={product as Product} 
            showVirtualTryOnButton={showVirtualTryOn}
            productContext={productCardContext}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
