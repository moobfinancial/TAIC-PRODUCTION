
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PackagePlus, ListChecks, PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default function MerchantProductsPage() {
  // In a real app, this would fetch and display the merchant's products
  const mockProducts = [
    // { id: '1', name: 'Sample Product 1', price: 100, stock: 10, category: 'Electronics' },
    // { id: '2', name: 'Sample Product 2', price: 50, stock: 5, category: 'Books' },
  ];

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

      {mockProducts.length === 0 ? (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <PackagePlus className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl">No Products Yet</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              You haven&apos;t added any products to your store. Get started by adding your first product!
            </CardDescription>
            <Button asChild size="lg">
              <Link href="/merchant/products/new">Add Your First Product</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder for product cards when data is available */}
          {/* {mockProducts.map(product => (
            <Card key={product.id}>
              <CardHeader><CardTitle>{product.name}</CardTitle></CardHeader>
              <CardContent>
                <p>Price: {product.price} TAIC</p>
                <p>Stock: {product.stock}</p>
                <p>Category: {product.category}</p>
              </CardContent>
              <CardFooter><Button variant="outline">Edit</Button></CardFooter>
            </Card>
          ))} */}
          <p className="text-muted-foreground md:col-span-3 text-center">
            Product display will appear here once products are added and backend is connected.
          </p>
        </div>
      )}

      <div className="mt-12 text-center">
        <Button variant="outline" asChild>
          <Link href="/merchant/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
