'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ListOrdered, Gem, Package, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Updated import
import type { Order } from '@/lib/types'; // Assuming Order type is still relevant

export function OrderHistory() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth(); // Updated to use new AuthContext values
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      setIsLoadingOrders(true);
      return;
    }
    if (isAuthenticated && token) {
      // TODO: Replace with actual API call to fetch orders
      // For now, simulate or show placeholder
      console.log('OrderHistory: Would fetch orders with token:', token);
      // Example: fetchUserOrders(token).then(setOrders).catch(setError).finally(() => setIsLoadingOrders(false));
      setTimeout(() => { // Simulate API call
        setOrders([]); // Simulate empty response for now
        setIsLoadingOrders(false);
        // To test with mock data:
        // setOrders([
        //   { id: 'ord1', items: [{ productId: '1', name: 'Product A', price: 100, quantity: 1, imageUrl: 'https://placehold.co/64x64.png' }], totalAmount: 100, date: new Date().toISOString() }
        // ]);
      }, 1000);
    } else if (!isAuthenticated && !authLoading) {
      setOrders([]);
      setIsLoadingOrders(false);
      // setError("Please log in to view order history.");
    }
  }, [isAuthenticated, token, authLoading]);

  if (authLoading || isLoadingOrders) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-4">
            <ListOrdered className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl font-headline">Order History</CardTitle>
          </div>
          <CardDescription>Review your past purchases.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Loader2 className="mx-auto h-16 w-16 text-muted-foreground animate-spin mb-4" />
          <p className="text-muted-foreground text-lg">Loading order history...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
     return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
          <p className="text-destructive text-lg">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex items-center gap-4">
                <ListOrdered className="h-8 w-8 text-primary" />
                <CardTitle className="text-2xl font-headline">Order History</CardTitle>
            </div>
          <CardDescription>Review your past purchases.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Package className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">Please log in to view your order history.</p>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex items-center gap-4">
                <ListOrdered className="h-8 w-8 text-primary" />
                <CardTitle className="text-2xl font-headline">Order History</CardTitle>
            </div>
          <CardDescription>Review your past purchases.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Package className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">You haven&apos;t placed any orders yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-4">
            <ListOrdered className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl font-headline">Order History</CardTitle>
        </div>
        <CardDescription>Review your past purchases.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Accordion type="single" collapsible className="w-full">
            {orders.slice().reverse().map((order: Order) => (
              <AccordionItem value={order.id} key={order.id} className="border-b">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex justify-between w-full pr-4">
                    <div className="text-left">
                      <p className="font-medium">Order ID: {order.id.substring(order.id.length - 6)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.date).toLocaleDateString()} - {new Date(order.date).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                        <Badge variant="outline" className="mb-1">{order.items.length} item(s)</Badge>
                        <span className="font-semibold text-primary flex items-center">
                            <Gem className="mr-1 h-4 w-4" /> {order.totalAmount.toLocaleString()} TAIC
                        </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="bg-muted/20 p-4 rounded-md">
                  <ul className="space-y-3">
                    {order.items.map(item => (
                      <li key={item.productId} className="flex items-center gap-4 p-2 rounded-md bg-background shadow-sm">
                        <Image 
                          src={item.imageUrl || 'https://placehold.co/64x64.png'} 
                          alt={item.name} 
                          width={64} 
                          height={64} 
                          className="rounded object-cover aspect-square"
                          data-ai-hint="product image"
                        />
                        <div className="flex-grow">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-medium text-sm flex items-center">
                            <Gem className="mr-1 h-3 w-3 text-primary/70" /> {(item.price * item.quantity).toLocaleString()} TAIC
                        </p>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
