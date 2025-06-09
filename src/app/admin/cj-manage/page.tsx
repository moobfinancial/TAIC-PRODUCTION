'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Using Tabs for filtering
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, CheckCircle, XCircle, EyeOff, Eye, RefreshCw, ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react';
import Image from 'next/image'; // For product images
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ImportedCjProduct {
  id: number; // Changed from platform_product_id to match API alias
  cj_product_id: string;
  display_name: string;
  selling_price: number;
  platform_category_id: number;
  // platform_category_name?: string; // Assuming API provides this or we join it
  image_url?: string;
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface ImportedProductsApiResponse {
  products: ImportedCjProduct[];
  // Add pagination if API supports it, otherwise client-side pagination or load all
}


export default function ManageCjProductsPage() {
  const { adminApiKey, loading: adminAuthLoading } = useAdminAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<ImportedCjProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());

  const fetchImportedProducts = useCallback(async () => {
    if (adminAuthLoading || !adminApiKey) {
      if (!adminAuthLoading) setError("Admin API Key not available.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/cj/imported-products', {
        headers: { 'X-Admin-API-Key': adminApiKey },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch imported products: ${response.statusText}`);
      }
      const data: ImportedProductsApiResponse = await response.json();
      // Assuming the API returns all products and we filter client-side as per subtask description.
      // If API supports filtering by status, add query param: ?status=${filterStatus} (for 'all', don't send param)
      const productsWithNumericPrice = (data.data || []).map(p => ({
        ...p,
        selling_price: typeof p.selling_price === 'string' ? parseFloat(p.selling_price) : p.selling_price
      }));
      setProducts(productsWithNumericPrice);
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Error Fetching Products", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [adminApiKey, adminAuthLoading, toast]);

  useEffect(() => {
    fetchImportedProducts();
  }, [fetchImportedProducts]);

  const handleSelectProduct = (productId: number, checked: boolean) => { // productId here refers to 'id'
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  };

  const filteredProducts = products.filter(p => {
    if (filterStatus === 'all') return true;
    return p.approval_status === filterStatus;
  });

  const handleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    } else {
      setSelectedProductIds(new Set());
    }
  };

  const updateProductStatus = async (productIds: number[], newStatus: { approvalStatus?: 'approved' | 'rejected', isActive?: boolean }) => {
    if (!adminApiKey) {
      toast({ title: "Authentication Error", description: "Admin API Key missing.", variant: "destructive" });
      return;
    }
    setIsLoading(true); // Indicate general loading for actions
    
    let endpoint = '/api/admin/cj/bulk-status-update';
    let payload: any = { productIds, ...newStatus };

    if (productIds.length === 1) {
      endpoint = `/api/admin/cj/products/${productIds[0]}/status`;
      payload = newStatus; // Single update API takes status directly in body
    }

    try {
      const response = await fetch(endpoint, {
        method: productIds.length === 1 ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': adminApiKey,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to update status');
      }
      toast({ title: "Status Updated", description: `Product(s) status updated successfully.` });
      fetchImportedProducts(); // Refresh list
      setSelectedProductIds(new Set()); // Clear selection
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  const renderProductActions = (product: ImportedCjProduct) => {
    return (
      <div className="space-x-2">
        {product.approval_status === 'pending' && (
          <Button size="sm" variant="outline" onClick={() => updateProductStatus([product.id], { approvalStatus: 'approved', isActive: true })} disabled={isLoading}>
            <ShieldCheck className="mr-1 h-4 w-4" /> Approve
          </Button>
        )}
        {(product.approval_status === 'pending' || product.approval_status === 'approved') && (
          <Button size="sm" variant="destructiveOutline" onClick={() => updateProductStatus([product.id], { approvalStatus: 'rejected', isActive: false })} disabled={isLoading}>
            <ShieldX className="mr-1 h-4 w-4" /> Reject
          </Button>
        )}
        {product.approval_status === 'approved' && product.is_active && (
          <Button size="sm" variant="outline" onClick={() => updateProductStatus([product.id], { isActive: false })} disabled={isLoading}>
            <EyeOff className="mr-1 h-4 w-4" /> Deactivate
          </Button>
        )}
        {product.approval_status === 'approved' && !product.is_active && (
          <Button size="sm" variant="outline" onClick={() => updateProductStatus([product.id], { isActive: true })} disabled={isLoading}>
            <Eye className="mr-1 h-4 w-4" /> Activate
          </Button>
        )}
      </div>
    );
  };
  
  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected', isActive: boolean) => {
    if (status === 'approved' && isActive) return <Badge variant="success" className="bg-green-500">Approved & Active</Badge>;
    if (status === 'approved' && !isActive) return <Badge variant="secondary" className="bg-yellow-500 text-white">Approved & Inactive</Badge>;
    if (status === 'pending') return <Badge variant="outline" className="border-orange-500 text-orange-500">Pending Approval</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="bg-red-500">Rejected</Badge>;
    return <Badge>{status}</Badge>;
  };

  if (adminAuthLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-2">Loading admin data...</p></div>;
  }
  if (error && !isLoading) { // Show error only if not also loading (to prevent flicker)
    return (
      <div className="p-4 m-auto max-w-md text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-3" />
        <p className="text-lg font-semibold text-destructive">Error Loading Products</p>
        <p className="text-sm text-muted-foreground mb-3">{error}</p>
        <Button onClick={fetchImportedProducts} variant="outline"><RefreshCw className="mr-2 h-4 w-4"/>Retry</Button>
      </div>
    );
  }


  return (
    <ProtectedRoute>
      <div className="space-y-6 p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold">Manage Imported CJ Products</h1>

        <Tabs value={filterStatus} onValueChange={(value) => setFilterStatus(value as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending Approval</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {selectedProductIds.size > 0 && (
          <div className="flex items-center space-x-3 p-3 bg-muted rounded-md border my-4">
            <p className="text-sm font-medium">{selectedProductIds.size} product(s) selected.</p>
            <Button size="sm" onClick={() => updateProductStatus(Array.from(selectedProductIds), { approvalStatus: 'approved', isActive: true })} disabled={isLoading}>
                <ShieldCheck className="mr-1 h-4 w-4" /> Approve Selected
            </Button>
            <Button size="sm" variant="destructiveOutline" onClick={() => updateProductStatus(Array.from(selectedProductIds), { approvalStatus: 'rejected', isActive: false })} disabled={isLoading}>
                <ShieldX className="mr-1 h-4 w-4" /> Reject Selected
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedProductIds(new Set())} disabled={isLoading}>Clear Selection</Button>
          </div>
        )}

        {isLoading && products.length === 0 ? (
           <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-2">Loading products...</p></div>
        ) : !isLoading && filteredProducts.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">
            No products found for status: <span className="font-semibold">{filterStatus}</span>.
          </p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                       <Checkbox
                        checked={selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0}
                        onCheckedChange={(checked) => handleSelectAllOnPage(!!checked)}
                        aria-label="Select all on page"
                        disabled={filteredProducts.length === 0}
                      />
                    </TableHead>
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Name & CJ ID</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          id={`select-${product.id}`}
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={(checked) => handleSelectProduct(product.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          let imgSrc = product.image_url;
                          if (imgSrc && typeof imgSrc === 'string' && imgSrc.startsWith('[') && imgSrc.endsWith(']')) {
                            try {
                              const parsed = JSON.parse(imgSrc);
                              if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string' && parsed[0].trim() !== '') {
                                imgSrc = parsed[0];
                              } else {
                                imgSrc = undefined; // Malformed array, empty, or not a string element
                              }
                            } catch (e) {
                              console.warn('Failed to parse image_url:', imgSrc, e);
                              imgSrc = undefined; // Parsing failed
                            }
                          }
                          // Basic check if imgSrc is now a valid-looking URL string
                          if (imgSrc && typeof imgSrc === 'string' && !(imgSrc.startsWith('http://') || imgSrc.startsWith('https://') || imgSrc.startsWith('/'))) {
                            console.warn('Invalid image URL format after processing:', imgSrc);
                            imgSrc = undefined; // Not a valid scheme or relative path
                          }

                          return imgSrc ? (
                            <Image src={imgSrc} alt={product.display_name} width={50} height={50} className="rounded object-cover aspect-square" />
                          ) : (
                            <div className="w-[50px] h-[50px] bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">No Image</div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{product.display_name}</div>
                        <div className="text-xs text-muted-foreground">CJ ID: {product.cj_product_id}</div>
                        <div className="text-xs text-muted-foreground">Platform ID: {product.id}</div>
                      </TableCell>
                      <TableCell>${product.selling_price.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(product.approval_status, product.is_active)}</TableCell>
                      <TableCell className="text-right">{renderProductActions(product)}</TableCell>
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
