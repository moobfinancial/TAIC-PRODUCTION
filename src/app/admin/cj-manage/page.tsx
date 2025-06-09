'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Using Tabs for filtering
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, CheckCircle, XCircle, EyeOff, Eye, RefreshCw, ShieldCheck, ShieldX, ShieldAlert, Layers } from 'lucide-react'; // Added Layers
import Image from 'next/image'; // For product images

interface ImportedSupplierProduct { // Renamed from ImportedCjProduct
  platform_product_id: number;
  cj_product_id: string; // This ID comes from the supplier, so cj_product_id might still be descriptive if it's CJ's actual ID
  display_name: string;
  selling_price: number;
  platform_category_id: number;
  image_url?: string;
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface ImportedProductsApiResponse { // Consider renaming if it's generic enough
  products: ImportedSupplierProduct[];
}


export default function ManageSupplierProductsPage() { // Renamed component
  const { adminApiKey, loading: adminAuthLoading } = useAdminAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<ImportedSupplierProduct[]>([]); // Use renamed type
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());

  const fetchImportedProducts = useCallback(async () => {
    if (adminAuthLoading || !adminApiKey) {
      if (!adminAuthLoading) setError("Admin API Key not available.");
      setIsLoading(false); // Ensure loading is false if returning early
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Revert API path to /api/admin/cj/imported-products
      const response = await fetch('/api/admin/cj/imported-products', {
        headers: { 'X-Admin-API-Key': adminApiKey },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({})); // Catch if error response not JSON
        throw new Error(errData.error || `Failed to fetch imported products: ${response.statusText}`);
      }
      const data = await response.json(); // Type assertion might be needed if API response isn't strictly ImportedProductsApiResponse
      setProducts((data.products as ImportedSupplierProduct[]) || []);
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Error Fetching Products", description: err.message, variant: "destructive" });
      setProducts([]); // Clear products on error
    } finally {
      setIsLoading(false);
    }
  }, [adminApiKey, adminAuthLoading, toast]);

  useEffect(() => {
    if(!adminAuthLoading && adminApiKey) { // Fetch only when auth is resolved and key is present
        fetchImportedProducts();
    } else if (!adminAuthLoading && !adminApiKey) {
        setIsLoading(false);
        setError("Admin API Key not configured. Cannot load products.");
    }
  }, [fetchImportedProducts, adminAuthLoading, adminApiKey]);


  const handleSelectProduct = (productId: number, checked: boolean) => {
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
      setSelectedProductIds(new Set(filteredProducts.map(p => p.platform_product_id)));
    } else {
      setSelectedProductIds(new Set());
    }
  };

  const updateProductStatus = async (productIds: number[], newStatus: { approvalStatus?: 'approved' | 'rejected', isActive?: boolean }) => {
    if (!adminApiKey) {
      toast({ title: "Authentication Error", description: "Admin API Key missing.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    
    let endpoint = '/api/admin/cj/bulk-status-update'; // Reverted API path
    let payload: any = { productIds, ...newStatus };
    let method = 'POST';

    if (productIds.length === 1) {
      endpoint = `/api/admin/cj/products/${productIds[0]}/status`; // Reverted API path
      payload = newStatus;
      method = 'PUT';
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


  const renderProductActions = (product: ImportedSupplierProduct) => { // Use renamed type
    return (
      <div className="space-x-1 flex justify-end">
        {product.approval_status === 'pending' && (
          <Button size="xs" variant="outline" onClick={() => updateProductStatus([product.platform_product_id], { approvalStatus: 'approved', isActive: true })} disabled={isLoading} title="Approve">
            <ShieldCheck className="h-4 w-4" />
          </Button>
        )}
        {(product.approval_status === 'pending' || product.approval_status === 'approved') && (
          <Button size="xs" variant="destructiveOutline" onClick={() => updateProductStatus([product.platform_product_id], { approvalStatus: 'rejected', isActive: false })} disabled={isLoading} title="Reject">
            <ShieldX className="h-4 w-4" />
          </Button>
        )}
        {product.approval_status === 'approved' && product.is_active && (
          <Button size="xs" variant="outline" onClick={() => updateProductStatus([product.platform_product_id], { isActive: false })} disabled={isLoading} title="Deactivate">
            <EyeOff className="h-4 w-4" />
          </Button>
        )}
        {product.approval_status === 'approved' && !product.is_active && (
          <Button size="xs" variant="outline" onClick={() => updateProductStatus([product.platform_product_id], { isActive: true })} disabled={isLoading} title="Activate">
            <Eye className="h-4 w-4" />
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
        <h1 className="text-2xl md:text-3xl font-bold">Manage Imported Supplier Products</h1> {/* Updated title */}

        <Tabs value={filterStatus} onValueChange={(value) => setFilterStatus(value as any)}>
          <TabsList className="grid w-full grid-cols-4"> {/* Made tabs full width for better mobile */}
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
                    <TableHead className="w-[50px] sm:w-[60px]"> {/* Checkbox column */}
                       <Checkbox
                        checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length} // Corrected select all logic
                        onCheckedChange={(checked) => handleSelectAllOnPage(!!checked)}
                        aria-label="Select all on page"
                        disabled={filteredProducts.length === 0 || isLoading}
                      />
                    </TableHead>
                    <TableHead className="w-[60px] hidden sm:table-cell">Image</TableHead>
                    <TableHead>Name & Supplier PID</TableHead> {/* Updated text */}
                    <TableHead className="hidden md:table-cell">Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.platform_product_id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProductIds.has(product.platform_product_id)}
                          onCheckedChange={(checked) => handleSelectProduct(product.platform_product_id, !!checked)}
                          aria-label={`Select product ${product.platform_product_id}`}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {product.image_url ? (
                           <Image src={product.image_url} alt={product.display_name} width={40} height={40} className="rounded object-cover aspect-square" />
                        ) : (
                          <div className="w-[40px] h-[40px] bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">No Img</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{product.display_name}</div>
                        {/* Use cj_product_id for Supplier PID as it's the source identifier */}
                        <div className="text-xs text-muted-foreground">Supplier PID: {product.cj_product_id}</div>
                        <div className="text-xs text-muted-foreground">Platform ID: {product.platform_product_id}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">${product.selling_price.toFixed(2)}</TableCell>
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
```
