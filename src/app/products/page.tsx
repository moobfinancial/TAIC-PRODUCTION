'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from '@/components/products/ProductCard';
import { MOCK_PRODUCTS } from '@/lib/constants';
import type { Product } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PackageSearch, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ProductsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  // Function to fetch products from the API
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      // Build the API URL with query parameters
      const url = new URL('/api/products/cj', window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('limit', '12'); // 12 products per page
      
      if (searchTerm) {
        url.searchParams.append('search', searchTerm);
      }
      
      if (selectedCategory !== 'all') {
        url.searchParams.append('category', selectedCategory);
      }
      
      url.searchParams.append('sort', sortBy);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Fetched data from /api/products/cj:', JSON.stringify(data, null, 2));
      
      // Update state with the fetched products and pagination info
      setProducts(data.products);
      setTotalPages(data.pagination.totalPages);
      setHasNextPage(data.pagination.hasNextPage);
      setHasPreviousPage(data.pagination.hasPreviousPage);
      
      // Extract unique categories from products
      const uniqueCategories = new Set<string>();
      uniqueCategories.add('all');
      data.products.forEach((product: any) => {
        if (product.category) {
          uniqueCategories.add(product.category);
        }
      });
      setCategories(Array.from(uniqueCategories));
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch products',
        variant: 'destructive',
      });
      // Fall back to mock products if API fails
      setProducts(MOCK_PRODUCTS);
      setCategories(['all', ...new Set(MOCK_PRODUCTS.map(p => p.category))]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch products when component mounts or when filters change
  useEffect(() => {
    fetchProducts();
  }, [page, sortBy, selectedCategory]);
  
  // Debounce search term changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory, sortBy]);

  return (
    <div className="space-y-8">
      <header className="text-center space-y-2">
        <PackageSearch className="mx-auto h-16 w-16 text-primary" />
        <h1 className="text-4xl font-headline font-bold tracking-tight sm:text-5xl">Our Products</h1>
        <p className="text-lg text-muted-foreground">
          Browse our exclusive collection of items, all priced in Demo TAIC.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-4 mb-8 p-4 bg-secondary/50 rounded-lg shadow">
        <Input
          type="text"
          placeholder="Search products..."
          className="flex-grow text-base"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={isLoading}
        />
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isLoading}>
            <SelectTrigger className="w-full md:w-[180px] text-base">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category} value={category} className="text-base">
                  {category === 'all' ? 'All Categories' : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy} disabled={isLoading}>
            <SelectTrigger className="w-full md:w-[180px] text-base">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest" className="text-base">Newest First</SelectItem>
              <SelectItem value="name_asc" className="text-base">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc" className="text-base">Name (Z-A)</SelectItem>
              <SelectItem value="price_asc" className="text-base">Price (Low to High)</SelectItem>
              <SelectItem value="price_desc" className="text-base">Price (High to Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading products...</span>
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products.map((product: Product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-12 pb-8">
              <Button 
                variant="outline" 
                onClick={() => setPage(page - 1)} 
                disabled={!hasPreviousPage || isLoading}
              >
                Previous
              </Button>
              <div className="text-sm px-4">
                Page {page} of {totalPages}
              </div>
              <Button 
                variant="outline" 
                onClick={() => setPage(page + 1)} 
                disabled={!hasNextPage || isLoading}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-muted-foreground">No products found matching your criteria.</p>
          {searchTerm || selectedCategory !== 'all' ? (
            <Button 
              variant="outline" 
              className="mt-4" 
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setSortBy('newest');
              }}
            >
              Clear Filters
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
