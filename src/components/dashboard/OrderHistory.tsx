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

  const fetchOrdersCallback = useCallback(async () => {
    if (isAuthenticated && token) { // user?.id is not strictly needed for this API if JWT holds user ID
      setIsLoadingOrders(true);
      setError(null);
      try {
        const response = await fetch('/api/user/orders', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: "Failed to parse error response." })); // Catch if error response isn't valid JSON
          throw new Error(errData.error || `Failed to fetch orders: ${response.statusText}`);
        }
        const data: Order[] = await response.json();
        setOrders(data || []); // Ensure data is an array, even if API returns null for no orders
      } catch (err: any) {
        console.error("Error fetching orders:", err);
        setError(err.message || 'Could not load order history.');
        setOrders([]); // Clear orders on error
      } finally {
        setIsLoadingOrders(false);
      }
    } else if (!isAuthenticated && !authLoading) {
      // Not authenticated and auth is not loading anymore
      setOrders([]);
      setIsLoadingOrders(false);
      setError(null); // Not an error, just not logged in
    }
  }, [isAuthenticated, token, authLoading]); // Removed user?.id as JWT implies user context

  useEffect(() => {
    if (!authLoading) { // Only fetch when auth state is resolved
      fetchOrdersCallback();
    }
  }, [fetchOrdersCallback, authLoading]);


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
          <Button onClick={fetchOrdersCallback} variant="outline" className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4"/>Retry
          </Button>
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
                  <div className="flex justify-between items-start w-full pr-4"> {/* items-start for alignment */}
                    <div className="text-left">
                      <p className="font-medium">Order ID: {order.id.toString()}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.date).toLocaleDateString()} - {new Date(order.date).toLocaleTimeString()}
                      </p>
                       <Badge variant={order.status === 'completed' ? 'success' : 'secondary'} className="mt-1">{order.status || 'N/A'}</Badge>
                    </div>
                    <div className="flex flex-col items-end text-right">
                        <p className="text-xs text-muted-foreground">{order.items.length} item(s)</p>
                        <span className="font-semibold text-primary flex items-center">
                            <Gem className="mr-1 h-4 w-4" /> {parseFloat(String(order.totalAmount)).toLocaleString()} {order.currency || 'TAIC'}
                        </span>
                        {order.cashbackAwarded && order.cashbackAwarded > 0 && (
                          <p className="text-xs text-green-600 mt-0.5">
                            Cashback: {order.cashbackAwarded.toFixed(2)} {order.currency || 'TAIC'}
                          </p>
                        )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="bg-muted/20 p-4 rounded-md">
                  <h4 className="font-medium mb-2 text-sm">Order Items ({order.items.length}):</h4>
                  <ul className="space-y-2">
                    {order.items.map((item: OrderItem, index: number) => (
                      <li key={`${item.productId}-${index}`} className="flex items-center gap-3 p-2 bg-background rounded shadow-sm">
                        <Image 
                          src={item.imageUrl || 'https://placehold.co/64x64.png'} 
                          alt={item.name} 
                          width={40} // Reduced size for item list
                          height={40}
                          className="rounded aspect-square object-cover"
                          data-ai-hint="product image"
                        />
                        <div className="flex-grow">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity} &bull; Price: {parseFloat(String(item.price)).toLocaleString()} {order.currency || 'TAIC'}</p>
                          {item.cashbackPercentage && item.cashbackPercentage > 0 && (
                             <p className="text-xs text-green-600">Cashback: {item.cashbackPercentage}%</p>
                          )}
                        </div>
                        <p className="font-medium text-sm flex items-center">
                            <Gem className="mr-1 h-3 w-3 text-primary/70" /> {parseFloat(String(item.price * item.quantity)).toLocaleString()} {order.currency || 'TAIC'}
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
