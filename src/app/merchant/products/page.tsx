
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ListChecks,
  PlusCircle,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Eye,
  AlertCircle,
  TrendingUp,
  Package,
  Loader2,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import ProductList from '@/components/merchant/ProductList';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface ProductApprovalStatus {
  id: string;
  name: string;
  approval_status: string;
  is_active: boolean;
  admin_review_notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  price: number;
  image_url: string | null;
}

interface ApprovalStatusSummary {
  totalProducts: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  draftCount: number;
  averageApprovalTime: number | null;
  recentSubmissions: number;
  recentApprovals: number;
  recentRejections: number;
}

export default function MerchantProductsPage() {
  const { isAuthenticated, loading, token } = useMerchantAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('all');
  const [products, setProducts] = useState<ProductApprovalStatus[]>([]);
  const [summary, setSummary] = useState<ApprovalStatusSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/merchant/login');
    }
  }, [isAuthenticated, loading, router]);
  
  // Load approval status data
  const loadApprovalStatus = async (status?: string) => {
    if (!token) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      params.append('includeInactive', 'true');
      params.append('sortBy', 'updated_at');
      params.append('sortOrder', 'DESC');

      const response = await fetch(`/api/merchant/products/approval-status?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch approval status');
      }

      const data = await response.json();
      setProducts(data.products || []);
      setSummary(data.summary || null);
    } catch (error: any) {
      console.error('Error loading approval status:', error);
      toast({
        title: "Error Loading Products",
        description: error.message || "Failed to load product approval status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Submit products for approval
  const handleSubmitForApproval = async () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select at least one product to submit for approval",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/merchant/products/submit-approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          productIds: selectedProducts,
          submissionNotes: submissionNotes.trim() || undefined
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit products for approval');
      }

      toast({
        title: "Submission Successful",
        description: result.message || "Products submitted for approval successfully",
      });

      setShowSubmitDialog(false);
      setSelectedProducts([]);
      setSubmissionNotes('');
      await loadApprovalStatus(activeTab);
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit products for approval",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load data when component mounts or tab changes
  useEffect(() => {
    if (token) {
      loadApprovalStatus(activeTab);
    }
  }, [token, activeTab]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading products...</p>
        </div>
      </div>
    );
  }

  // Helper functions
  const getStatusBadge = (status: string, isActive: boolean) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className={`${isActive ? 'text-green-600 border-green-600' : 'text-blue-600 border-blue-600'}`}>
          <CheckCircle className="w-3 h-3 mr-1" />{isActive ? 'Active' : 'Approved'}
        </Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

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

  const canSubmitForApproval = (product: ProductApprovalStatus) => {
    return product.approval_status !== 'pending';
  };

  const filteredProducts = products.filter(product => {
    if (activeTab === 'all') return true;
    if (activeTab === 'draft') return !['pending', 'approved', 'rejected'].includes(product.approval_status);
    return product.approval_status === activeTab;
  });

  const eligibleForSubmission = filteredProducts.filter(canSubmitForApproval);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Package className="mr-3 h-8 w-8 text-primary" />
            Product Management
          </h1>
          <p className="text-muted-foreground">Manage your products and approval workflow</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => loadApprovalStatus(activeTab)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/merchant/products/new">
              <PlusCircle className="mr-2 h-5 w-5" /> Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                {summary.recentSubmissions} submitted this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.pendingCount}</div>
              <p className="text-xs text-muted-foreground">
                Avg. {summary.averageApprovalTime ? `${summary.averageApprovalTime.toFixed(1)} hours` : 'N/A'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.approvedCount}</div>
              <p className="text-xs text-muted-foreground">
                {summary.recentApprovals} approved this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.rejectedCount}</div>
              <p className="text-xs text-muted-foreground">
                {summary.recentRejections} rejected this week
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Product Tabs and Actions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Product Approval Workflow</CardTitle>
              <CardDescription>
                Manage your product submissions and track approval status
              </CardDescription>
            </div>
            {selectedProducts.length > 0 && (
              <Button
                onClick={() => setShowSubmitDialog(true)}
                disabled={selectedProducts.every(id => !canSubmitForApproval(products.find(p => p.id === id)!))}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit {selectedProducts.length} for Approval
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All ({summary?.totalProducts || 0})</TabsTrigger>
              <TabsTrigger value="draft">Draft ({summary?.draftCount || 0})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({summary?.pendingCount || 0})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({summary?.approvedCount || 0})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({summary?.rejectedCount || 0})</TabsTrigger>
            </TabsList>

            <div className="mt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading products...</span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No products found</h3>
                  <p className="text-muted-foreground mb-4">
                    {activeTab === 'all'
                      ? "You haven't created any products yet."
                      : `No products in ${activeTab} status.`}
                  </p>
                  {activeTab === 'all' && (
                    <Button asChild>
                      <Link href="/merchant/products/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Your First Product
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Bulk Actions */}
                  {eligibleForSubmission.length > 0 && (
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedProducts.length === eligibleForSubmission.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProducts(eligibleForSubmission.map(p => p.id));
                            } else {
                              setSelectedProducts([]);
                            }
                          }}
                        />
                        <span className="text-sm font-medium">
                          Select all eligible products ({eligibleForSubmission.length})
                        </span>
                      </div>
                      {selectedProducts.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => setShowSubmitDialog(true)}
                        >
                          Submit {selectedProducts.length} for Approval
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Product List */}
                  <div className="grid gap-4">
                    {filteredProducts.map((product) => (
                      <div key={product.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start space-x-4">
                          {canSubmitForApproval(product) && (
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
                          )}

                          {product.image_url && (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-16 h-16 object-cover rounded-md"
                            />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-medium truncate">{product.name}</h3>
                              {getStatusBadge(product.approval_status, product.is_active)}
                            </div>

                            <div className="mt-1 text-sm text-muted-foreground">
                              <span className="font-medium">${product.price}</span>
                              {product.category_name && (
                                <span className="ml-2">• {product.category_name}</span>
                              )}
                            </div>

                            <div className="mt-2 text-xs text-muted-foreground">
                              Created: {formatDate(product.created_at)}
                              {product.submitted_at && (
                                <span className="ml-4">Submitted: {formatDate(product.submitted_at)}</span>
                              )}
                              {product.approved_at && (
                                <span className="ml-4">Approved: {formatDate(product.approved_at)}</span>
                              )}
                              {product.rejected_at && (
                                <span className="ml-4">Rejected: {formatDate(product.rejected_at)}</span>
                              )}
                            </div>

                            {product.admin_review_notes && (
                              <div className="mt-2 p-2 bg-muted rounded text-sm">
                                <div className="flex items-center text-muted-foreground mb-1">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Admin Notes:
                                </div>
                                <p>{product.admin_review_notes}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col space-y-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/merchant/products/${product.id}`}>
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Link>
                            </Button>

                            {canSubmitForApproval(product) && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedProducts([product.id]);
                                  setShowSubmitDialog(true);
                                }}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Submit
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Submit for Approval Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Send className="mr-2 h-5 w-5" />
              Submit Products for Approval
            </DialogTitle>
            <DialogDescription>
              Submit {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} for admin review and approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="submissionNotes">Submission Notes (Optional)</Label>
              <Textarea
                id="submissionNotes"
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                placeholder="Add any notes for the admin reviewer..."
                rows={3}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                {submissionNotes.length}/1000 characters
              </p>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Selected products will be submitted for approval and cannot be edited until reviewed.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSubmitDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitForApproval}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit for Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Back to Dashboard */}
      <div className="text-center">
        <Button variant="outline" asChild>
          <Link href="/merchant/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
