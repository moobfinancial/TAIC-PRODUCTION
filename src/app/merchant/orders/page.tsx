'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext'; // Assuming this context provides token and auth status
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, PackageSearch, Edit, RefreshCw, ExternalLink } from 'lucide-react';
import type { Order, OrderItem } from '@/lib/types'; // Using existing types
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Define AdminOrder type based on what /api/admin/orders returns
interface MerchantOrder extends Order {
  // If merchant API returns specific fields, add them. For now, assume it's compatible with Order.
  // The main difference will be that `items` array should only contain items from this merchant.
}

export default function MerchantOrdersPage() {
  const { token, merchant, loading: merchantAuthLoading } = useMerchantAuth(); // Assuming user object has merchantId
  const { toast } = useToast();

  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MerchantOrder | null>(null);
  const [formData, setFormData] = useState({
    status: '',
    shippingCarrier: '',
    trackingNumber: '',
  });
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);

  const fetchMerchantOrders = useCallback(async () => {
    if (merchantAuthLoading || !token) {
      if (!merchantAuthLoading && !token) {
        setError("Merchant authentication token not available.");
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // This API endpoint /api/merchant/orders will be created in the next step.
      const response = await fetch('/api/merchant/orders', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch merchant orders: ${response.statusText}`);
      }
      const data: MerchantOrder[] = await response.json();
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Error Fetching Orders", description: err.message, variant: "destructive" });
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, merchantAuthLoading, toast]);

  useEffect(() => {
    fetchMerchantOrders();
  }, [fetchMerchantOrders]);

  const handleManageClick = (order: MerchantOrder) => {
    setSelectedOrder(order);
    setFormData({
      status: order.status || 'pending',
      shippingCarrier: order.shippingCarrier || '',
      trackingNumber: order.trackingNumber || '',
    });
    setIsModalOpen(true);
  };

  const handleModalFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    // For Select, onValueChange provides the value directly, not e.target.value
    // This function is primarily for Input. Select's onValueChange is handled directly.
    if (e.target) {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }
  };

  const handleStatusChange = (value: string) => {
    setFormData(prev => ({ ...prev, status: value }));
  };


  const handleSaveChanges = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !token) {
      toast({ title: "Error", description: "No order selected or not authenticated.", variant: "destructive" });
      return;
    }
    setIsSubmittingUpdate(true);
    try {
      // This API endpoint /api/merchant/orders/[id] will be created in the next step.
      const response = await fetch(`/api/merchant/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to update order');
      }
      toast({ title: "Order Updated", description: `Order #${selectedOrder.id} fulfillment details saved.` });
      fetchMerchantOrders(); // Refresh the list
      setIsModalOpen(false);
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  if (merchantAuthLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-2">Loading merchant session...</p></div>;
  }

  // Render after auth check. If !user after loading, ProtectedRoute would handle it if page is wrapped.
  // For now, explicit check based on token/isLoading.
  if (!token && !merchantAuthLoading) {
     return (
        <div className="container mx-auto p-6 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-3" />
            <p className="text-lg font-semibold text-destructive">Access Denied</p>
            <p className="text-sm text-muted-foreground mb-3">Please log in as a merchant to view orders.</p>
            <Link href="/merchant/login">
                <Button variant="outline">Merchant Login</Button>
            </Link>
        </div>
     );
  }


  return (
    // <ProtectedRoute> // Assuming MerchantAuthWrapper is used at layout level or this page is wrapped
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Your Orders</h1>
        <Button variant="outline" onClick={fetchMerchantOrders} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Orders
        </Button>
      </div>

      {isLoading && orders.length === 0 ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading your orders...</p></div>
      ) : error ? (
        <Card className="border-destructive">
          <CardHeader className="bg-destructive/10"><CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2"/> Error Fetching Orders</CardTitle></CardHeader>
          <CardContent className="pt-4"><p>{error}</p><Button variant="outline" onClick={fetchMerchantOrders} className="mt-4">Try Again</Button></CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <div className="text-center py-10 bg-muted/20 rounded-lg">
          <PackageSearch className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-xl font-semibold text-muted-foreground">No orders found for your products yet.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items (Yours)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell className="text-xs">{new Date(order.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">{order.shippingRecipientName || 'N/A'}</TableCell>
                    <TableCell className="text-xs">
                      {order.items.map(item => item.name).join(', ').substring(0, 50)}...
                      ({order.items.reduce((sum, item) => sum + item.quantity, 0)} total items from you)
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'completed' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'shipped' ? 'bg-sky-100 text-sky-800' :
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'}`
                      }>
                        {order.status || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {order.trackingNumber ? (
                        <Link href={`https://t.17track.net/en#nums=${order.trackingNumber}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {order.trackingNumber} <ExternalLink className="inline h-3 w-3 ml-0.5"/>
                        </Link>
                      ) : 'N/A'}
                      {order.shippingCarrier && <span className="block text-muted-foreground text-[10px]">({order.shippingCarrier})</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleManageClick(order)} disabled={actionLoading[order.id]}>
                        <Edit className="mr-1 h-3.5 w-3.5" /> Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedOrder && (
        <Dialog open={isModalOpen} onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedOrder(null); // Clear selectedOrder when dialog closes
            setIsModalOpen(isOpen);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Order Fulfillment: #{selectedOrder.id}</DialogTitle>
              <DialogDescription>Update status and shipping details for this order.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveChanges} className="space-y-4 py-2">
              <div>
                <Label htmlFor="status">Order Status</Label>
                <Select name="status" value={formData.status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="shippingCarrier">Shipping Carrier</Label>
                <Input
                  id="shippingCarrier"
                  name="shippingCarrier"
                  value={formData.shippingCarrier}
                  onChange={handleModalFormChange}
                  placeholder="e.g., FedEx, USPS"
                />
              </div>
              <div>
                <Label htmlFor="trackingNumber">Tracking Number</Label>
                <Input
                  id="trackingNumber"
                  name="trackingNumber"
                  value={formData.trackingNumber}
                  onChange={handleModalFormChange}
                  placeholder="e.g., 123XYZ789"
                />
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmittingUpdate}>
                  {isSubmittingUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Updates
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
    // </ProtectedRoute>
  );
}
