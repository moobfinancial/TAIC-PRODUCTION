'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Package, 
  User, 
  Calendar,
  Search,
  Filter,
  Loader2,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Eye,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PendingProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category_name: string | null;
  merchant_id: string;
  merchant_name: string;
  merchant_email: string;
  approval_status: string;
  is_active: boolean;
  admin_review_notes: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  days_pending: number;
  priority_score: number;
  has_variants: boolean;
  variant_count: number;
  stock_quantity: number;
}

interface ApprovalQueueSummary {
  totalPending: number;
  highPriorityCount: number;
  overduePending: number;
  averagePendingDays: number;
  todaySubmissions: number;
  weeklySubmissions: number;
  merchantsWithPending: number;
}

export default function AdminProductApprovalPage() {
  const { toast } = useToast();

  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [summary, setSummary] = useState<ApprovalQueueSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('priority_score');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Load pending products
  const loadPendingProducts = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
        sortBy,
        sortOrder,
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/admin/products/pending-approval?${params}`, {
        headers: {
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending products');
      }

      const data = await response.json();
      setProducts(data.products || []);
      setSummary(data.summary || null);
    } catch (error: any) {
      console.error('Error loading pending products:', error);
      toast({
        title: "Error Loading Products",
        description: error.message || "Failed to load pending products",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Process approval/rejection
  const handleProcessApproval = async () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select at least one product to process",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const endpoint = selectedProducts.length === 1 
        ? `/api/admin/products/${selectedProducts[0]}/approve`
        : '/api/admin/products/bulk-approve';

      const requestBody = selectedProducts.length === 1 
        ? {
            action: approvalAction,
            adminNotes: adminNotes.trim() || undefined,
            adminId: 'admin_user', // This should come from admin auth context
            rejectionReason: approvalAction === 'reject' ? rejectionReason.trim() || undefined : undefined,
            setActive: true,
            notifyMerchant: true
          }
        : {
            productIds: selectedProducts,
            action: approvalAction,
            adminNotes: adminNotes.trim() || undefined,
            adminId: 'admin_user', // This should come from admin auth context
            rejectionReason: approvalAction === 'reject' ? rejectionReason.trim() || undefined : undefined,
            setActive: true,
            notifyMerchant: true
          };

      const response = await fetch(endpoint, {
        method: selectedProducts.length === 1 ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${approvalAction} products`);
      }

      toast({
        title: `${approvalAction === 'approve' ? 'Approval' : 'Rejection'} Successful`,
        description: result.message || `Products ${approvalAction}d successfully`,
      });

      setShowApprovalDialog(false);
      setSelectedProducts([]);
      setAdminNotes('');
      setRejectionReason('');
      await loadPendingProducts();
    } catch (error: any) {
      toast({
        title: `${approvalAction === 'approve' ? 'Approval' : 'Rejection'} Failed`,
        description: error.message || `Failed to ${approvalAction} products`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    loadPendingProducts();
  }, [sortBy, sortOrder]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPendingProducts();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityBadge = (score: number) => {
    if (score > 10) return <Badge variant="destructive">High Priority</Badge>;
    if (score > 5) return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Medium Priority</Badge>;
    return <Badge variant="outline">Low Priority</Badge>;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Package className="mr-3 h-8 w-8 text-primary" />
            Product Approval Queue
          </h1>
          <p className="text-muted-foreground">Review and approve merchant product submissions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={loadPendingProducts}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.totalPending}</div>
              <p className="text-xs text-muted-foreground">
                {summary.todaySubmissions} submitted today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.highPriorityCount}</div>
              <p className="text-xs text-muted-foreground">
                Require immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.overduePending}</div>
              <p className="text-xs text-muted-foreground">
                Pending &gt; 3 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Pending Time</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.averagePendingDays.toFixed(1)}d</div>
              <p className="text-xs text-muted-foreground">
                {summary.merchantsWithPending} merchants affected
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Queue</CardTitle>
          <CardDescription>
            Review pending product submissions and make approval decisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products or merchants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority_score">Priority Score</SelectItem>
                <SelectItem value="days_pending">Days Pending</SelectItem>
                <SelectItem value="created_at">Submission Date</SelectItem>
                <SelectItem value="merchant_name">Merchant Name</SelectItem>
                <SelectItem value="price">Price</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DESC">Descending</SelectItem>
                <SelectItem value="ASC">Ascending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedProducts.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => {
                    setApprovalAction('approve');
                    setShowApprovalDialog(true);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => {
                    setApprovalAction('reject');
                    setShowApprovalDialog(true);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          )}

          {/* Product List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading pending products...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No pending products</h3>
              <p className="text-muted-foreground">
                All products have been reviewed. Great job!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedProducts.length === products.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedProducts(products.map(p => p.id));
                    } else {
                      setSelectedProducts([]);
                    }
                  }}
                />
                <span className="text-sm font-medium">
                  Select all products ({products.length})
                </span>
              </div>

              {/* Product Cards */}
              <div className="grid gap-4">
                {products.map((product) => (
                  <div key={product.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start space-x-4">
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          }
                        }}
                      />
                      
                      {product.image_url && (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-20 h-20 object-cover rounded-md"
                        />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-medium truncate">{product.name}</h3>
                          <div className="flex items-center space-x-2">
                            {getPriorityBadge(product.priority_score)}
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              <Clock className="w-3 h-3 mr-1" />
                              {product.days_pending.toFixed(1)}d
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-2">
                          <div>
                            <span className="font-medium">Price:</span> ${product.price}
                          </div>
                          <div>
                            <span className="font-medium">Category:</span> {product.category_name || 'Uncategorized'}
                          </div>
                          <div>
                            <span className="font-medium">Merchant:</span> {product.merchant_name}
                          </div>
                          <div>
                            <span className="font-medium">Stock:</span> {product.stock_quantity}
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground mb-2">
                          Submitted: {formatDate(product.submitted_at)} • 
                          Priority Score: {product.priority_score.toFixed(1)}
                          {product.has_variants && ` • ${product.variant_count} variants`}
                        </div>
                        
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      </div>
                      
                      <div className="flex flex-col space-y-2">
                        <Button 
                          size="sm" 
                          onClick={() => {
                            setSelectedProducts([product.id]);
                            setApprovalAction('approve');
                            setShowApprovalDialog(true);
                          }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => {
                            setSelectedProducts([product.id]);
                            setApprovalAction('reject');
                            setShowApprovalDialog(true);
                          }}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval/Rejection Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {approvalAction === 'approve' ? (
                <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="mr-2 h-5 w-5 text-red-600" />
              )}
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Products
            </DialogTitle>
            <DialogDescription>
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} and provide feedback to the merchant.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adminNotes">Admin Notes</Label>
              <Textarea
                id="adminNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={`Add notes about this ${approvalAction}...`}
                rows={3}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {adminNotes.length}/2000 characters
              </p>
            </div>
            
            {approvalAction === 'reject' && (
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Rejection Reason</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why these products are being rejected..."
                  rows={2}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {rejectionReason.length}/1000 characters
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowApprovalDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleProcessApproval}
              disabled={isProcessing}
              variant={approvalAction === 'approve' ? 'default' : 'destructive'}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {approvalAction === 'approve' ? (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  {approvalAction === 'approve' ? 'Approve' : 'Reject'} Products
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
