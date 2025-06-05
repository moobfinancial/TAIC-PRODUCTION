'use client';

import { useState } from 'react';
import { ProductCard } from '@/components/products/ProductCard';
import { MOCK_PRODUCTS } from '@/lib/constants';
import type { Product } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PackageSearch } from 'lucide-react';

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');

  const categories = ['all', ...new Set(MOCK_PRODUCTS.map(p => p.category))];

  const filteredAndSortedProducts = MOCK_PRODUCTS
    .filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(product => selectedCategory === 'all' || product.category === selectedCategory)
    .sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });

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
        />
        <div className="flex gap-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-[180px] text-base">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc" className="text-base">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc" className="text-base">Name (Z-A)</SelectItem>
              <SelectItem value="price_asc" className="text-base">Price (Low to High)</SelectItem>
              <SelectItem value="price_desc" className="text-base">Price (High to Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredAndSortedProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredAndSortedProducts.map((product: Product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-muted-foreground">No products found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
