'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ListOrdered, Gem, Package } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { Order } from '@/lib/types';

export function OrderHistory() {
  const { user } = useAuth();

  if (!user || user.orders.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex items-center gap-4">
                <ListOrdered className="h-8 w-8 text-primary" />
                <CardTitle className="text-2xl font-headline">Order History</CardTitle>
            </div>
          <CardDescription>Your past simulated purchases.</CardDescription>
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
        <CardDescription>Review your past simulated purchases.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Accordion type="single" collapsible className="w-full">
            {user.orders.slice().reverse().map((order: Order) => (
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
