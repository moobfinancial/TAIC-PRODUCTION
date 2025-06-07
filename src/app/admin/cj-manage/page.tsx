'use client';

'use client';

import * as React from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useState, useEffect, FormEvent, useCallback } from 'react';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

// Admin Components
import ProtectedRoute from '@/components/admin/ProtectedRoute';

// API Client
import { adminApi } from '@/lib/api/adminClient';

// Icons
import {
  Eye, EyeOff, Edit, Trash2, Search, ListChecks, 
  ChevronLeft, ChevronRight, Loader2, Globe, Check 
} from 'lucide-react';

// Next.js
import Image from 'next/image';

// We'll use the admin API client which handles authentication automatically

interface ImportedCjProduct {
  id: number; // Changed from platform_product_id to match API response
  cj_product_id: string;
  display_name: string;
  selling_price: number;
  cj_base_price: number; // Cost price from CJ
  image_url: string | null;
  is_active: boolean;
  platform_category_id: number;
  category_name?: string; // Should be joined in the API or fetched separately
  cashback_percentage?: number | null;
  display_description?: string | null;
  shipping_rules_id?: string | null;
  original_name?: string; // Original name before translation
  original_description?: string; // Original description before translation
  // Add other fields from cj_products table as needed for display/edit
}

interface PlatformCategory {
  id: number;
  name: string;
}

interface EditModalState {
  isOpen: boolean;
  product: ImportedCjProduct | null;
  // Form fields for editing
  displayName: string;
  displayDescription: string;
  platformCategoryId: string;
  sellingPrice: string;
  isActive: boolean;
  cashbackPercentage: string;
  shippingRulesId: string;
}

export default function ManageImportedCjProductsPage() {
  const { adminApiKey, loading: adminAuthLoading } = useAdminAuth();
  const { toast } = useToast();

  // List & Filter State
  const [products, setProducts] = useState<ImportedCjProduct[]>([]);
  const [platformCategories, setPlatformCategories] = useState<PlatformCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined); // undefined means all categories
  const [filterIsActive, setFilterIsActive] = useState<string | undefined>(undefined); // undefined means any status

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [limitPerPage, setLimitPerPage] = useState(10); // Default limit
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);

  // Edit Modal State
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    product: null,
    displayName: '',
    displayDescription: '',
    platformCategoryId: '', // Will be set when opening modal with a product
    sellingPrice: '',
    isActive: true,
    cashbackPercentage: '0.00',
    shippingRulesId: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete Confirmation Dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ImportedCjProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [publishingProductId, setPublishingProductId] = useState<number | null>(null);


  const fetchPlatformCategories = useCallback(async () => {
    if (adminAuthLoading) {
      console.log('Admin auth is loading, skipping category fetch.');
      return;
    }
    if (!adminApiKey) {
      toast({ title: "Authentication Error", description: "Admin API key is missing. Cannot fetch categories.", variant: "destructive" });
      setIsLoadingCategories(false);
      return;
    }
    setIsLoadingCategories(true);
    try {
      console.log('Fetching categories from API...');
      const { data, error } = await adminApi.get(adminApiKey, '/categories?hierarchical=false');
      
      if (error) {
        throw new Error(error);
      }
      
      // Ensure data is an array before setting state
      const categories = Array.isArray(data) ? data : [];
      console.log(`Fetched ${categories.length} categories`);
      setPlatformCategories(categories);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load product categories',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingCategories(false);
    }
  }, [toast, adminApiKey, adminAuthLoading]);

  const fetchImportedProducts = useCallback(async (page: number = 1) => {
    if (adminAuthLoading) {
      console.log('Admin auth is loading, skipping product fetch.');
      return;
    }
    if (!adminApiKey) {
      toast({ title: "Authentication Error", description: "Admin API key is missing. Cannot fetch products.", variant: "destructive" });
      setIsLoading(false);
      setListError("Admin API key is missing.");
      setProducts([]);
      setTotalPages(0);
      setTotalResults(0);
      return;
    }
    setIsLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limitPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(filterCategory && filterCategory !== '__ALL_CATEGORIES__' && { category: filterCategory }),
        ...(filterIsActive && filterIsActive !== '__ANY_STATUS__' && { isActive: filterIsActive })
      });

      const { data, error } = await adminApi.get(adminApiKey, `/cj/imported-products?${params}`);
      
      if (error) {
        throw new Error(error);
      }
      
      // The API returns products in response.data and pagination in response.pagination
      setProducts(data.data || []); 
      setTotalPages(data.pagination?.totalPages || 0);
      setTotalResults(data.pagination?.total || 0);
      setCurrentPage(page);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      setListError(error.message || 'Failed to load products');
      toast({
        title: "Error",
        description: error.message || 'Failed to load products',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, limitPerPage, searchTerm, filterCategory, filterIsActive, adminApiKey, adminAuthLoading]);

  // Effect to fetch platform categories on component mount
  useEffect(() => {
    if (!adminAuthLoading && adminApiKey) {
      fetchPlatformCategories();
    }
  }, [fetchPlatformCategories, adminAuthLoading, adminApiKey]); // fetchPlatformCategories is memoized

  // Effect to fetch imported products once categories are loaded and not still loading
  useEffect(() => {
    if (!adminAuthLoading && adminApiKey) {
      fetchImportedProducts(currentPage);
    } else if (!adminAuthLoading && !adminApiKey) {
      setProducts([]);
      setTotalPages(0);
      setTotalResults(0);
      setListError("Admin authentication required to load products.");
      toast({ title: "Authentication Required", description: "Please log in as admin to view products.", variant: "destructive" });
    }
  }, [fetchImportedProducts, currentPage, adminAuthLoading, adminApiKey, toast]); // Fetch for the current page

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetchImportedProducts(1); // Reset to page 1 on new search
  };

  const openEditModal = (productToEdit: ImportedCjProduct) => {
    console.log('--- openEditModal START ---');
    
    if (!productToEdit) {
      console.error('openEditModal ERROR: productToEdit is null or undefined.');
      return;
    }
    
    // Check for id, allowing 0 as a potentially valid ID
    if (productToEdit.id === undefined && productToEdit.id !== 0) {
      console.error('openEditModal ERROR: product.id is missing or invalid. Value:', productToEdit.id);
      toast({ title: 'Error Opening Modal', description: 'Product ID is missing or invalid (Code: OEM_P04).', variant: 'destructive' });
      return;
    }

    console.log('openEditModal: product passed initial validation. Product ID:', productToEdit.id);

    if (platformCategories.length === 0) {
      console.error('openEditModal ERROR: No platform categories available to populate dropdown.');
      toast({ 
        title: 'Error', 
        description: 'Categories not loaded. Please wait and try again.', 
        variant: 'destructive' 
      });
      return;
    }

    // Convert cashback percentage from decimal to percentage (e.g., 0.05 -> 5)
    const cashbackValue = typeof productToEdit.cashback_percentage === 'number' 
      ? productToEdit.cashback_percentage 
      : typeof productToEdit.cashback_percentage === 'string'
        ? parseFloat(productToEdit.cashback_percentage) || 0
        : 0;
    
    // Convert to whole number percentage (e.g., 0.05 -> 5)
    const cashbackPercent = cashbackValue !== 0 ? (cashbackValue * 100).toString() : '';

    // Set the selected category ID for the dropdown
    const categoryId = productToEdit.platform_category_id?.toString() || '';
    
    const newModalState = {
      isOpen: true,
      product: { ...productToEdit },
      displayName: productToEdit.display_name || '',
      displayDescription: productToEdit.display_description || '',
      platformCategoryId: categoryId,
      sellingPrice: productToEdit.selling_price != null ? String(productToEdit.selling_price) : '',
      isActive: productToEdit.is_active != null ? productToEdit.is_active : true,
      cashbackPercentage: cashbackPercent,
      shippingRulesId: productToEdit.shipping_rules_id || '',
    };

    console.log('openEditModal: Setting new modal state with category:', categoryId, 'and cashback:', cashbackPercent);
    setEditModal(newModalState);
  };


  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    // Capture a snapshot of the editModal state at the moment of submission
    const { 
      product: productSnapshot,
      displayName: displayNameSnapshot,
      displayDescription: displayDescriptionSnapshot,
      platformCategoryId: platformCategoryIdSnapshot,
      sellingPrice: sellingPriceSnapshot,
      isActive: isActiveSnapshot,
      cashbackPercentage: cashbackPercentageSnapshot,
      shippingRulesId: shippingRulesIdSnapshot
    } = editModal;

    if (isUpdating) {
      console.log('Update already in progress, aborting.');
      return;
    }

    // Validate the product and its ID
    if (!productSnapshot?.id && productSnapshot?.id !== 0) {
      console.error('Product ID is missing or invalid:', productSnapshot);
      toast({
        title: 'Error Updating Product',
        description: 'Product information is missing or invalid. Please try again.',
        variant: 'destructive',
      });
      return;
    }
    
    const productId = productSnapshot.id;
    console.log('Using Product ID for update:', productId);

    // Validate required fields
    if (!platformCategoryIdSnapshot) {
      toast({ title: 'Validation Error', description: 'Please select a valid category.', variant: 'destructive' });
      return;
    }
    
    const sellingPrice = parseFloat(sellingPriceSnapshot);
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      toast({ title: 'Validation Error', description: 'Please enter a valid selling price greater than 0.', variant: 'destructive' });
      return;
    }
    
    if (!displayNameSnapshot?.trim()) {
      toast({ title: 'Validation Error', description: 'Display Name cannot be empty.', variant: 'destructive' });
      return;
    }
    
    // Parse and validate cashback percentage
    let cashbackDecimal = 0;
    if (cashbackPercentageSnapshot) {
      const cashbackValue = parseFloat(cashbackPercentageSnapshot);
      if (isNaN(cashbackValue) || cashbackValue < 0 || cashbackValue > 100) {
        toast({ title: 'Validation Error', description: 'Cashback percentage must be between 0 and 100.', variant: 'destructive' });
        return;
      }
      cashbackDecimal = cashbackValue / 100; // Convert percentage to decimal (5 -> 0.05)
    }
    
    setIsUpdating(true);
    
    try {
      const payload = {
        display_name: displayNameSnapshot.trim(),
        display_description: displayDescriptionSnapshot?.trim() || null,
        platform_category_id: Number(platformCategoryIdSnapshot),
        selling_price: sellingPrice,
        is_active: isActiveSnapshot,
        cashback_percentage: cashbackDecimal,
        shipping_rules_id: shippingRulesIdSnapshot?.trim() || null,
      };

      console.log('Update payload:', {
        productId,
        payload,
        cashback: {
          input: cashbackPercentageSnapshot,
          parsed: cashbackDecimal,
        }
      });

      if (!adminApiKey) {
        throw new Error('Admin API key is missing. Please log in again.');
      }

      const { data, error } = await adminApi.put(
        adminApiKey,
        `/cj/imported-products/${productId}`,
        payload
      ) as { data: ImportedCjProduct; error: string | null };

      if (error) {
        throw new Error(error);
      }

      toast({ 
        title: 'Success', 
        description: 'Product updated successfully.',
        variant: 'default'
      });
      
      // Close modal and refresh product list
      setEditModal(prev => ({ ...prev, isOpen: false }));
      fetchImportedProducts(currentPage);
      
    } catch (error: any) {
      console.error('Update failed:', error);
      toast({ 
        title: 'Update Failed', 
        description: error.message || 'Failed to update product', 
        variant: 'destructive' 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openDeleteConfirm = (product: ImportedCjProduct) => {
    setProductToDelete(product);
    setShowDeleteConfirm(true);
  };

  const handleDeleteProduct = async () => {
    if (adminAuthLoading || !adminApiKey) {
      toast({ title: "Authentication Error", description: "Admin API key is missing. Cannot delete product.", variant: "destructive" });
      setIsDeleting(false);
      return;
    }
    if (!productToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await adminApi.delete(
        adminApiKey,
        `/cj/imported-products/${productToDelete.id}`
      );
      
      if (error) {
        throw new Error(error);
      }
      
      toast({ title: "Success", description: "Product deleted successfully." });
      setShowDeleteConfirm(false);
      setProductToDelete(null);
      fetchImportedProducts(currentPage);
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message || 'Failed to delete product', variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleTogglePublish = async (product: ImportedCjProduct) => {
    if (adminAuthLoading || !adminApiKey) {
      toast({ title: "Authentication Error", description: "Admin API key is missing. Cannot update product status.", variant: "destructive" });
      setPublishingProductId(null);
      return;
    }
    // Set the current product as publishing to show loading state
    setPublishingProductId(product.id);
    
    try {
      // Toggle the is_active status
      const newActiveStatus = !product.is_active;
      
      const { error } = await adminApi.put(
        adminApiKey,
        `/cj/imported-products/${product.id}`,
        { is_active: newActiveStatus }
      );
      
      if (error) {
        throw new Error(error);
      }
      
      // Refresh the product list
      fetchImportedProducts(currentPage);
      
      toast({
        title: "Success",
        description: `Product ${newActiveStatus ? 'published' : 'unpublished'} successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || 'Failed to update product status',
        variant: "destructive",
      });
    } finally {
      // Clear the loading state
      setPublishingProductId(null);
    }
  };
  const getCategoryName = (id: number) => {
    if (!id) return 'N/A';
    return platformCategories.find(c => c.id === id)?.name || 'N/A';
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><ListChecks className="mr-2 h-6 w-6" /> Manage Imported CJ Products</CardTitle>
            <CardDescription>View, filter, edit, and delete products imported from CJdropshipping.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearchSubmit} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 items-end">
              <Input placeholder="Search name/description..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <Select value={filterCategory === undefined ? "__ALL_CATEGORIES__" : filterCategory} onValueChange={(value) => setFilterCategory(value === "__ALL_CATEGORIES__" ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Filter by category..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL_CATEGORIES__">All Categories</SelectItem>
                  {platformCategories.map(cat => <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterIsActive === undefined ? "__ANY_STATUS__" : filterIsActive} onValueChange={(value) => setFilterIsActive(value === "__ANY_STATUS__" ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Filter by status..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ANY_STATUS__">Any Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={isLoading}>
                <Search className="mr-2 h-4 w-4" /> Filter Products
              </Button>
            </form>

            {listError && (
                 <div className="p-4 mb-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-center">
                    <p>{listError}</p>
                 </div>
            )}
            {isLoading && (
              <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            )}
            {!isLoading && products.length === 0 && !listError && (
              <p className="text-center text-muted-foreground py-8">No imported products found matching your criteria.</p>
            )}
            {!isLoading && products.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Name (Platform ID)</TableHead>
                      <TableHead>CJ ID</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p, index) => (
                      <TableRow key={`product-${p.id || 'unknown'}-${p.cj_product_id || index}`}>
                        <TableCell>
                          {(() => {
                            let imageUrlToDisplay: string | null = null;
                            if (p.image_url) {
                              try {
                                const parsedUrls = JSON.parse(p.image_url);
                                if (Array.isArray(parsedUrls) && parsedUrls.length > 0 && typeof parsedUrls[0] === 'string') {
                                  imageUrlToDisplay = parsedUrls[0];
                                }
                              } catch (e) {
                                console.error('Failed to parse image_url:', p.image_url, e);
                              }
                            }
                            return imageUrlToDisplay ? 
                              <img src={imageUrlToDisplay} alt={p.display_name} width={40} height={40} className="rounded object-cover aspect-square" /> : 
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs">No Img</div>;
                          })()}
                        </TableCell>
                        <TableCell>
                          {p.display_name}
                          <p className="text-xs text-muted-foreground">ID: {p.id}</p>
                        </TableCell>
                        <TableCell className="text-xs">{p.cj_product_id}</TableCell>
                        <TableCell className="text-xs">{getCategoryName(p.platform_category_id)}</TableCell>
                        <TableCell className="font-mono">${Number(p.cj_base_price).toFixed(2)}</TableCell>
                        <TableCell className="font-mono">${Number(p.selling_price).toFixed(2)}</TableCell>
                        <TableCell>
                          {(() => {
                            const profit = Number(p.selling_price) - Number(p.cj_base_price);
                            const profitMargin = (profit / Number(p.selling_price)) * 100;
                            const profitClass = profitMargin < 15 ? 'text-amber-600' : profitMargin < 30 ? 'text-green-600' : 'text-emerald-600 font-semibold';
                            return (
                              <div className={`font-mono ${profitClass}`}>
                                ${profit.toFixed(2)}
                                <span className="text-xs block">{profitMargin.toFixed(1)}%</span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>{p.is_active ? <span className="text-green-600 flex items-center"><Eye className="h-4 w-4 mr-1"/>Active</span> : <span className="text-red-600 flex items-center"><EyeOff className="h-4 w-4 mr-1"/>Inactive</span>}</TableCell>
                        <TableCell className="space-x-1">
                          <Button variant="outline" size="icon" onClick={() => openEditModal(p)} title="Edit Product"><Edit className="h-3.5 w-3.5"/></Button>
                          <Button 
                            variant={p.is_active ? "default" : "outline"} 
                            size="icon" 
                            onClick={() => handleTogglePublish(p)}
                            disabled={publishingProductId === p.id}
                            title={p.is_active ? "Unpublish from Store" : "Publish to Store"}
                          >
                            {publishingProductId === p.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : p.is_active ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Globe className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => openDeleteConfirm(p)} title="Delete Product"><Trash2 className="h-3.5 w-3.5"/></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center space-x-2 mt-6">
                    <Button variant="outline" size="icon" onClick={() => fetchImportedProducts(currentPage - 1)} disabled={currentPage <= 1 || isLoading}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Page {currentPage} of {totalPages} ({totalResults} results)</span>
                    <Button variant="outline" size="icon" onClick={() => fetchImportedProducts(currentPage + 1)} disabled={currentPage >= totalPages || isLoading}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit Product Modal */}
        {editModal.isOpen && editModal.product && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className="w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
              <CardHeader>
                <CardTitle>Edit Imported Product</CardTitle>
                <CardDescription>Update details for &quot;{editModal.product.display_name}&quot;.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow overflow-y-auto pr-2 space-y-3">
                <form 
                  id="edit-product-form" 
                  onSubmit={handleUpdateProduct} 
                  className="space-y-3"
                >
                  <div>
                    <Label htmlFor="editDisplayName">Display Name</Label>
                    <Input id="editDisplayName" value={editModal.displayName} onChange={(e) => setEditModal(s => ({...s, displayName: e.target.value}))} />
                  </div>
                  <div>
                    <Label htmlFor="editDisplayDescription">Display Description</Label>
                    <Textarea id="editDisplayDescription" value={editModal.displayDescription} onChange={(e) => setEditModal(s => ({...s, displayDescription: e.target.value}))} rows={4}/>
                  </div>
                  <div>
                    <Label htmlFor="editPlatformCategoryId">Platform Category</Label>
                    {isLoadingCategories ? (
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading categories...</span>
                      </div>
                    ) : platformCategories.length === 0 ? (
                      <div className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                        No categories available. Please create categories first.
                      </div>
                    ) : (
                      <Select 
                        value={editModal.platformCategoryId || undefined} 
                        onValueChange={(val) => setEditModal(s => ({...s, platformCategoryId: val}))}
                        disabled={isLoadingCategories}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category..." />
                        </SelectTrigger>
                        <SelectContent>
                          {platformCategories.map(cat => (
                            <SelectItem key={cat.id} value={String(cat.id)}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="editSellingPrice">Selling Price ($)</Label>
                    <Input id="editSellingPrice" type="number" step="0.01" value={editModal.sellingPrice} onChange={(e) => setEditModal(s => ({...s, sellingPrice: e.target.value}))} />
                  </div>
                   <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="editCashbackPercentage">Cashback Percentage</Label>
                      <span className="text-xs text-muted-foreground">Enter a value between 0-100</span>
                    </div>
                    <div className="relative">
                      <Input 
                        id="editCashbackPercentage" 
                        type="number" 
                        min="0"
                        max="100"
                        step="0.5"
                        value={editModal.cashbackPercentage} 
                        onChange={(e) => {
                          // Allow only numbers and one decimal point
                          const value = e.target.value;
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setEditModal(s => ({
                              ...s, 
                              cashbackPercentage: value === '' ? '' : 
                                parseFloat(value) > 100 ? '100' : value
                            }));
                          }
                        }}
                        placeholder="e.g., 5 for 5%"
                        className="pr-12"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="editShippingRulesId">Shipping Rules ID (Optional)</Label>
                    <Input id="editShippingRulesId" value={editModal.shippingRulesId} onChange={(e) => setEditModal(s => ({...s, shippingRulesId: e.target.value}))} />
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch id="editIsActive" checked={editModal.isActive} onCheckedChange={(checked) => setEditModal(s => ({...s, isActive: checked}))} />
                    <Label htmlFor="editIsActive">Product Active (Visible in Storefront)</Label>
                  </div>
                </form>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2 border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setEditModal(prev => ({...prev, isOpen: false}))} disabled={isUpdating}>Cancel</Button>
                  <Button type="submit" form="edit-product-form" disabled={isUpdating}>
                    {isUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : 'Update Product'}
                  </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete product &quot;{productToDelete?.display_name}&quot; (ID: {productToDelete?.id})? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setShowDeleteConfirm(false); setProductToDelete(null);}} disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteProduct} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete Product
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </ProtectedRoute>
  );
}
