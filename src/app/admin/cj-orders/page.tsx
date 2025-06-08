'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, Send, RefreshCw, ExternalLink } from 'lucide-react';
import Link from 'next/link'; // For linking to order details if needed
import type { Order, OrderItem } from '@/lib/types'; // Assuming Order and OrderItem are relevant

// Define AdminOrder type based on what /api/admin/orders returns
interface AdminOrder extends Order {
  userEmail?: string | null;
  // Other fields like shipping address are already in Order type
}

export default function ManageCjOrdersPage() {
  const { adminApiKey, loading: adminAuthLoading } = useAdminAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchOrdersForAdmin = useCallback(async () => {
    if (adminAuthLoading || !adminApiKey) {
      if (!adminAuthLoading && !adminApiKey) {
        setError("Admin API Key not available.");
        toast({ title: "Authentication Error", description: "Admin API Key not available.", variant: "destructive" });
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/orders', {
        headers: { 'X-Admin-API-Key': adminApiKey },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch orders: ${response.statusText}`);
      }
      const data: AdminOrder[] = await response.json();
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Error Fetching Orders", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [adminApiKey, adminAuthLoading, toast]);

  useEffect(() => {
    fetchOrdersForAdmin();
  }, [fetchOrdersForAdmin]);

  const handleSubmitToCj = async (orderId: number) => {
    if (!adminApiKey) {
      toast({ title: "Auth Error", description: "Admin API key missing.", variant: "destructive" });
      return;
    }
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/submit-to-cj`, {
        method: 'POST',
        headers: { 'X-Admin-API-Key': adminApiKey },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || `Failed to submit order ${orderId} to CJ`);
      }
      toast({ title: "Order Submitted to CJ", description: `Order ${orderId} (CJ ID: ${result.cjOrderId}) submitted. Platform status: ${result.platformOrderStatus}.` });
      fetchOrdersForAdmin(); // Refresh the list
    } catch (err: any) {
      toast({ title: "Submission Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleRefreshCjStatus = async (orderId: number) => {
    if (!adminApiKey) {
      toast({ title: "Auth Error", description: "Admin API key missing.", variant: "destructive" });
      return;
    }
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/refresh-cj-status`, {
        method: 'POST',
        headers: { 'X-Admin-API-Key': adminApiKey },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || `Failed to refresh status for order ${orderId}`);
      }
      toast({ title: "CJ Status Refreshed", description: result.message || `Status for order ${orderId} refreshed. New CJ status: ${result.details?.cjShippingStatus}` });
      fetchOrdersForAdmin(); // Refresh the list
    } catch (err: any) {
      toast({ title: "Refresh Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  if (adminAuthLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-2">Loading admin data...</p></div>;
  }


  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Manage Customer Orders (CJ Fulfillment)</h1>
            <Button variant="outline" onClick={fetchOrdersForAdmin} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Orders
            </Button>
        </div>

        {isLoading && orders.length === 0 && (
           <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading orders...</p></div>
        )}
        {error && !isLoading && (
            <Card className="border-destructive">
                <CardHeader className="bg-destructive/10">
                    <CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2"/> Error Fetching Orders</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <p>{error}</p>
                    <Button variant="outline" onClick={fetchOrdersForAdmin} className="mt-4">Try Again</Button>
                </CardContent>
            </Card>
        )}

        {!isLoading && !error && orders.length === 0 && (
          <p className="text-center text-muted-foreground py-10">No orders found.</p>
        )}

        {!isLoading && !error && orders.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CJ Order ID</TableHead>
                    <TableHead>CJ Status</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell className="text-xs">{order.userEmail || `User ID: ${order.user_id}`}</TableCell>
                      <TableCell className="text-xs">{new Date(order.date).toLocaleDateString()}</TableCell>
                      <TableCell>{order.totalAmount.toFixed(2)} {order.currency}</TableCell>
                      <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${order.status === 'completed' ? 'bg-yellow-100 text-yellow-800' : order.status === 'processing' ? 'bg-blue-100 text-blue-800' : order.status === 'shipped' ? 'bg-sky-100 text-sky-800' : order.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{order.status}</span></TableCell>
                      <TableCell className="text-xs">{order.cjOrderId || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{order.cjShippingStatus || 'N/A'}</TableCell>
                      <TableCell className="text-xs">
                        {order.trackingNumber ?
                          ( <Link href={`https://t.17track.net/en#nums=${order.trackingNumber}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {order.trackingNumber} <ExternalLink className="inline h-3 w-3 ml-1"/>
                            </Link>
                          ) : 'N/A'}
                        {order.shippingCarrier && <span className="block text-muted-foreground text-[10px]">({order.shippingCarrier})</span>}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSubmitToCj(order.id)}
                          disabled={!!order.cjOrderId || actionLoading[order.id] || (order.status !== 'completed' && order.status !== 'pending_payment_confirmation_cj')}
                          title={order.cjOrderId ? "Already submitted to CJ" : (order.status !== 'completed' && order.status !== 'pending_payment_confirmation_cj') ? `Order status must be 'completed' or 'pending_payment_confirmation_cj' (is ${order.status})` : "Submit to CJ"}
                        >
                          {actionLoading[order.id] && actionLoading[order.id] === true && order.cjOrderId === null ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                          Submit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRefreshCjStatus(order.id)}
                          disabled={!order.cjOrderId || actionLoading[order.id]}
                          title={!order.cjOrderId ? "No CJ Order ID to refresh" : "Refresh CJ Status"}
                        >
                          {actionLoading[order.id] && actionLoading[order.id] === true && order.cjOrderId !== null ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                          Refresh
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
