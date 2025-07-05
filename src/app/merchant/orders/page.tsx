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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, PackageSearch, Edit, RefreshCw, ExternalLink, BarChart3, Search, Filter, DollarSign, TrendingUp, AlertCircle, Package, Eye, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { Order, OrderItem } from '@/lib/types'; // Using existing types
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Enhanced MerchantOrder interface with real order processing data
interface MerchantOrder extends Order {
  userEmail?: string | null;
  merchantCommissionAmount?: number;
  merchantNetAmount?: number;
  orderItemsCount?: number;
  canFulfill?: boolean;
  fulfillmentStatus?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  lastStatusUpdate?: string;
}

export default function MerchantOrdersPage() {
  const { token, merchant, loading: merchantAuthLoading } = useMerchantAuth();
  const { toast } = useToast(); // Assuming user object has merchantId
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
    fulfillmentNotes: '',
  });
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);

  // Analytics and filtering state
  const [orderAnalytics, setOrderAnalytics] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOrderAnalytics = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/merchant/orders/analytics', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const analytics = await response.json();
        setOrderAnalytics(analytics);
      }
    } catch (error) {
      console.error('Error fetching order analytics:', error);
    }
  }, [token]);

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
    fetchOrderAnalytics();
  }, [fetchMerchantOrders, fetchOrderAnalytics]);

  const handleManageClick = (order: MerchantOrder) => {
    setSelectedOrder(order);
    setFormData({
      status: order.status || 'pending',
      shippingCarrier: order.shippingCarrier || '',
      trackingNumber: order.trackingNumber || '',
      fulfillmentNotes: '',
    });
    setIsModalOpen(true);
  };

  const quickStatusUpdate = async (orderId: number, newStatus: string) => {
    if (!token) {
      toast({
        title: "Authentication Error",
        description: "Please log in again to update orders.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(prev => ({ ...prev, [orderId]: true }));

    try {
      const response = await fetch(`/api/merchant/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update order status');
      }

      const result = await response.json();

      toast({
        title: "Order Updated",
        description: result.message || `Order status updated to ${newStatus}`,
      });

      // Refresh orders and analytics
      await fetchMerchantOrders();
      await fetchOrderAnalytics();

    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update order status",
        variant: "destructive",
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
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


  // Filter orders based on status and search term
  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch = searchTerm === '' ||
      order.id.toString().includes(searchTerm) ||
      order.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(2)} TAIC`;
  };

  return (
    // <ProtectedRoute> // Assuming MerchantAuthWrapper is used at layout level or this page is wrapped
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Your Orders</h1>
        <div className="flex gap-2">
          <Button
            variant={showAnalytics ? "default" : "outline"}
            onClick={() => setShowAnalytics(!showAnalytics)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button variant="outline" onClick={fetchMerchantOrders} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Orders
          </Button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {showAnalytics && orderAnalytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orderAnalytics.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                {orderAnalytics.recentOrders} in last 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(orderAnalytics.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                Net: {formatCurrency(orderAnalytics.netRevenue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fulfillment Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orderAnalytics.fulfillmentRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Orders delivered successfully
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Alerts</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {orderAnalytics.inventoryAlerts.lowStockProducts.length + orderAnalytics.inventoryAlerts.outOfStockProducts.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Products need attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders by ID, customer email, or product name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
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
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      #{order.id}
                      {order.merchantCommissionAmount && (
                        <div className="text-xs text-muted-foreground">
                          Net: {formatCurrency(order.merchantNetAmount || 0)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(order.date).toLocaleDateString()}
                      {order.lastStatusUpdate && (
                        <div className="text-xs text-muted-foreground">
                          Updated: {new Date(order.lastStatusUpdate).toLocaleDateString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{order.shippingRecipientName || 'N/A'}</TableCell>
                    <TableCell className="text-xs">
                      {order.items.map(item => item.name).join(', ').substring(0, 50)}...
                      ({order.orderItemsCount || order.items.length} items)
                      {order.merchantCommissionAmount && (
                        <div className="text-xs text-green-600">
                          Commission: {formatCurrency(order.merchantCommissionAmount)}
                        </div>
                      )}
                      {order.canFulfill === false && (
                        <div className="text-xs text-red-600">⚠️ Low stock</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={
                          order.status === 'delivered' ? 'default' :
                          order.status === 'shipped' ? 'secondary' :
                          order.status === 'processing' ? 'outline' :
                          order.status === 'cancelled' ? 'destructive' :
                          'outline'
                        }>
                          {order.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {order.status === 'processing' && <Package className="h-3 w-3 mr-1" />}
                          {order.status === 'shipped' && <Truck className="h-3 w-3 mr-1" />}
                          {order.status === 'delivered' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {order.status === 'cancelled' && <XCircle className="h-3 w-3 mr-1" />}
                          {order.status?.charAt(0).toUpperCase() + order.status?.slice(1) || 'N/A'}
                        </Badge>
                        {order.canFulfill === false && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Low Stock
                          </Badge>
                        )}
                      </div>
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
                      <div className="flex gap-1 justify-end flex-wrap">
                        {/* Quick action buttons based on current status */}
                        {order.status === 'pending' && order.canFulfill !== false && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => quickStatusUpdate(order.id, 'processing')}
                            disabled={actionLoading[order.id]}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Package className="h-3 w-3 mr-1" />
                            Process
                          </Button>
                        )}
                        {order.status === 'processing' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => quickStatusUpdate(order.id, 'shipped')}
                            disabled={actionLoading[order.id]}
                            className="text-sky-600 hover:text-sky-700"
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            Ship
                          </Button>
                        )}
                        {order.status === 'shipped' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => quickStatusUpdate(order.id, 'delivered')}
                            disabled={actionLoading[order.id]}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Deliver
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleManageClick(order)} disabled={actionLoading[order.id]}>
                          <Edit className="mr-1 h-3.5 w-3.5" /> Manage
                        </Button>
                      </div>
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
              <div>
                <Label htmlFor="fulfillmentNotes">Fulfillment Notes (Optional)</Label>
                <Textarea
                  id="fulfillmentNotes"
                  name="fulfillmentNotes"
                  value={formData.fulfillmentNotes}
                  onChange={handleModalFormChange}
                  placeholder="Add notes about order fulfillment, special instructions, or issues..."
                  rows={3}
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
