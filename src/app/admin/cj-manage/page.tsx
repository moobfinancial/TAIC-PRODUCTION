'use client';

import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch'; // For is_active toggle
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ListChecks, Loader2, AlertCircle, Edit, Trash2, Search, Filter, XCircle, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // For delete confirmation

// Admin API Key must be exposed to the client via NEXT_PUBLIC_ prefix
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY;

if (!ADMIN_API_KEY && process.env.NODE_ENV === 'development') {
  console.warn('WARNING: NEXT_PUBLIC_ADMIN_API_KEY is not set. Please ensure it is defined in your .env.local file for API authentication to work correctly. Falling back to a placeholder, which will likely fail.');
}
const EFFECTIVE_ADMIN_API_KEY = ADMIN_API_KEY || 'DEV_FALLBACK_KEY_EXPECTED_TO_FAIL';

interface ImportedCjProduct {
  platform_product_id: number;
  cj_product_id: string;
  display_name: string;
  selling_price: number;
  image_url: string | null;
  is_active: boolean;
  platform_category_id: number;
  category_name?: string; // Should be joined in the API or fetched separately
  cashback_percentage?: number | null;
  display_description?: string | null;
  shipping_rules_id?: string | null;
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


  const fetchPlatformCategories = useCallback(async () => {
    if (!EFFECTIVE_ADMIN_API_KEY || EFFECTIVE_ADMIN_API_KEY === 'DEV_FALLBACK_KEY_EXPECTED_TO_FAIL') {
      console.error('EFFECTIVE_ADMIN_API_KEY is not set or is using fallback. Check NEXT_PUBLIC_ADMIN_API_KEY in .env.local');
      setIsLoadingCategories(false);
      toast({
        title: 'Configuration Error',
        description: 'Admin API key is not configured correctly. Please check environment variables.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingCategories(true);
    try {
      console.log('Fetching categories from API...');
      const response = await fetch('/api/admin/categories?hierarchical=false', {
        headers: { 
          'X-Admin-API-Key': EFFECTIVE_ADMIN_API_KEY,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Categories API response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Categories API error:', errorData);
        throw new Error(
          errorData.error || 
          `Failed to fetch platform categories: ${response.status} ${response.statusText}`
        );
      }
      
      const data = await response.json();
      console.log('Categories API response data:', data);
      
      // Ensure data is an array before setting state
      const categories = Array.isArray(data) ? data : [];
      
      console.log(`Setting ${categories.length} categories to state`);
      setPlatformCategories(categories);
      
      // If we have categories, log the first few
      if (categories.length > 0) {
        console.log('First category in response:', categories[0]);
      } else {
        console.warn('No categories returned from API');
      }
    } catch (error: any) {
      console.error('Error in fetchPlatformCategories:', error);
      toast({ 
        title: 'Error Loading Categories', 
        description: error.message || 'Could not load platform categories',
        variant: 'destructive',
      });
      // Ensure we have an empty array on error
      setPlatformCategories([]);
    } finally {
      setIsLoadingCategories(false);
    }
  }, [toast]);

  const fetchImportedProducts = useCallback(async (page = currentPage) => {
    if (!EFFECTIVE_ADMIN_API_KEY || EFFECTIVE_ADMIN_API_KEY === 'DEV_FALLBACK_KEY_EXPECTED_TO_FAIL') {
        toast({title: "Configuration Error", description: "Admin API Key not found.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    setListError(null);
    setCurrentPage(page);

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limitPerPage),
    });
    if (searchTerm) params.append('searchTerm', searchTerm);
    if (filterCategory) params.set('platform_category_id', filterCategory);
    if (filterIsActive !== undefined) params.set('isActive', filterIsActive);

    try {
      const response = await fetch(`/api/admin/cj/imported-products?${params.toString()}`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY || '' },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || `Failed to fetch products: ${response.statusText}`);
      }
      setProducts(result.data || []);
      setTotalResults(result.pagination?.totalCount || 0);
      setTotalPages(result.pagination?.totalPages || 0);
    } catch (err: any) {
      setListError(err.message);
      setProducts([]);
      toast({ title: "Error Fetching Products", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [EFFECTIVE_ADMIN_API_KEY, currentPage, limitPerPage, searchTerm, filterCategory, filterIsActive, toast]);

  // Effect to fetch platform categories on component mount
  useEffect(() => {
    console.log('useEffect: Initial call to fetchPlatformCategories');
    fetchPlatformCategories();
  }, [fetchPlatformCategories]); // fetchPlatformCategories is memoized

  // Effect to fetch imported products once categories are loaded and not still loading
  useEffect(() => {
    if (platformCategories.length > 0 && !isLoadingCategories) {
      console.log('useEffect: Categories loaded, calling fetchImportedProducts');
      fetchImportedProducts(currentPage); // Fetch for the current page
    } else if (!isLoadingCategories && platformCategories.length === 0) {
      console.log('useEffect: Categories loaded, but none available. Not fetching products.');
      // Optionally clear products or set an appropriate message if no categories mean no products can be shown
      setProducts([]);
      setTotalResults(0);
      setTotalPages(0);
    }
  }, [platformCategories, isLoadingCategories, fetchImportedProducts, currentPage]); // Add currentPage here

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetchImportedProducts(1); // Reset to page 1 on new search
  };

  const openEditModal = (product: ImportedCjProduct) => {
    console.log('Opening edit modal for product:', product);
    
    // Check if we have categories available
    if (platformCategories.length === 0) {
      console.error('Cannot open edit modal: No categories available');
      toast({
        title: 'Cannot Edit Product',
        description: 'No product categories are available. Please create categories first.',
        variant: 'destructive',
      });
      return;
    }
    
    // Ensure we have a valid category ID
    let categoryId: string;
    
    // If product has a valid category ID, use it
    if (product.platform_category_id) {
      const productCategoryId = String(product.platform_category_id);
      
      // Verify the category exists in our list
      const categoryExists = platformCategories.some(
        cat => String(cat.id) === productCategoryId
      );
      
      if (categoryExists) {
        categoryId = productCategoryId;
      } else {
        console.warn(`Product category ID ${productCategoryId} not found in available categories`);
        // Only default to first category if we have categories
        categoryId = platformCategories.length > 0 ? String(platformCategories[0].id) : '';
      }
    } else {
      // Default to first category if product has no category, but only if we have categories
      categoryId = platformCategories.length > 0 ? String(platformCategories[0].id) : '';
    }
    
    // If we still don't have a valid category ID, show an error
    if (!categoryId) {
      console.error('No valid category ID could be determined');
      toast({
        title: 'Error',
        description: 'Could not determine a valid category for this product.',
        variant: 'destructive',
      });
      return;
    }
    
    console.log('Setting category ID in edit modal:', categoryId);
    
    setEditModal({
      isOpen: true,
      product,
      displayName: product.display_name,
      displayDescription: product.display_description || '',
      platformCategoryId: categoryId,
      sellingPrice: String(product.selling_price),
      isActive: product.is_active,
      cashbackPercentage: String(product.cashback_percentage || '0.00'),
      shippingRulesId: product.shipping_rules_id || '',
    });
  };

  const handleUpdateProduct = async (e: FormEvent) => {
    e.preventDefault();
    
    console.log('Submitting product update with data:', {
      platformCategoryId: editModal.platformCategoryId,
      platformCategories: platformCategories.map(c => ({ id: c.id, name: c.name })),
      formData: {
        displayName: editModal.displayName,
        sellingPrice: editModal.sellingPrice,
      },
    });
    
    if (!editModal.product) {
      console.error('No product selected for update');
      toast({
        title: 'Error',
        description: 'No product selected for update',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate form
    if (!editModal.platformCategoryId) {
      console.error('No category selected');
      toast({
        title: 'Validation Error',
        description: 'Please select a valid category.',
        variant: 'destructive',
      });
      return;
    }
    
    // Verify the selected category exists
    const categoryExists = platformCategories.some(
      cat => String(cat.id) === editModal.platformCategoryId
    );
    
    if (!categoryExists) {
      console.error('Selected category does not exist:', editModal.platformCategoryId);
      toast({
        title: 'Validation Error',
        description: 'The selected category is no longer available. Please select another category.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!editModal.sellingPrice) {
      console.error('No selling price provided');
      toast({
        title: 'Validation Error',
        description: 'Please enter a selling price.',
        variant: 'destructive',
      });
      return;
    }
    
    const sellingPrice = parseFloat(editModal.sellingPrice);
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      console.error('Invalid selling price:', editModal.sellingPrice);
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid selling price greater than 0.',
        variant: 'destructive',
      });
      return;
    }
    setIsUpdating(true);
    try {
      const payload: Partial<ImportedCjProduct> = { // Use partial for updates
        display_name: editModal.displayName,
        display_description: editModal.displayDescription,
        platform_category_id: parseInt(editModal.platformCategoryId, 10),
        selling_price: parseFloat(editModal.sellingPrice),
        is_active: editModal.isActive,
        cashback_percentage: parseFloat(editModal.cashbackPercentage) || 0.00,
        shipping_rules_id: editModal.shippingRulesId || null,
      };

      const response = await fetch(`/api/admin/cj/imported-products/${editModal.product.platform_product_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': ADMIN_API_KEY || ''
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to update product');
      }
      toast({ title: "Success", description: "Product updated successfully." });
      setEditModal(prev => ({ ...prev, isOpen: false }));
      fetchImportedProducts(currentPage); // Refresh current page
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const openDeleteConfirm = (product: ImportedCjProduct) => {
    setProductToDelete(product);
    setShowDeleteConfirm(true);
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/cj/imported-products/${productToDelete.platform_product_id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY || '' },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null); // Try to parse error, but might not be JSON
        throw new Error(result?.error || result?.details || `Failed to delete product: ${response.statusText}`);
      }
      toast({ title: "Success", description: "Product deleted successfully." });
      setShowDeleteConfirm(false);
      setProductToDelete(null);
      fetchImportedProducts(currentPage); // Refresh
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to get category name from ID
  const getCategoryName = (id: number) => {
    if (!id) return 'N/A';
    return platformCategories.find(c => c.id === id)?.name || 'N/A';
  };

  return (
    <AdminLayout>
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
              <Button type="submit" disabled={isLoading || !ADMIN_API_KEY}>
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
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(p => (
                      <TableRow key={p.platform_product_id}>
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
                          <p className="text-xs text-muted-foreground">ID: {p.platform_product_id}</p>
                        </TableCell>
                        <TableCell className="text-xs">{p.cj_product_id}</TableCell>
                        <TableCell className="text-xs">{getCategoryName(p.platform_category_id)}</TableCell>
                        <TableCell>${Number(p.selling_price).toFixed(2)}</TableCell>
                        <TableCell>{p.is_active ? <span className="text-green-600 flex items-center"><Eye className="h-4 w-4 mr-1"/>Active</span> : <span className="text-red-600 flex items-center"><EyeOff className="h-4 w-4 mr-1"/>Inactive</span>}</TableCell>
                        <TableCell className="space-x-1">
                          <Button variant="outline" size="icon" onClick={() => openEditModal(p)}><Edit className="h-3.5 w-3.5"/></Button>
                          <Button variant="destructive" size="icon" onClick={() => openDeleteConfirm(p)}><Trash2 className="h-3.5 w-3.5"/></Button>
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
                <form id="edit-product-form" onSubmit={handleUpdateProduct} className="space-y-3">
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
                    <Label htmlFor="editCashbackPercentage">Cashback % (e.g., 5 for 5%)</Label>
                    <Input id="editCashbackPercentage" type="number" step="0.01" value={editModal.cashbackPercentage} onChange={(e) => setEditModal(s => ({...s, cashbackPercentage: e.target.value}))} />
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
                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
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
                Are you sure you want to delete product &quot;{productToDelete?.display_name}&quot; (ID: {productToDelete?.platform_product_id})? This action cannot be undone.
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
    </AdminLayout>
  );
}
