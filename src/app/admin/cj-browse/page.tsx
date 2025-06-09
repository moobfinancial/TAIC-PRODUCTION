'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // For import form
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, PackageSearch, Loader2, AlertCircle, Import, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image'; // For displaying product images
// Import the new helper and types from cjUtils.ts (or supplierUtils.ts if that's already renamed)
// For now, assuming cjUtils and CjCategory are still named this way until that lib is refactored.
// We can alias CjCategory for use in this file.
import { fetchAndTransformCjCategories, type CjCategory as SupplierCategory } from '@/lib/cjUtils';

// Temporary Admin API Key for development - replace with secure auth
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";

interface SupplierProduct { // Renamed from CjProduct
  pid: string; // Supplier Product ID (still 'pid' from CJ context)
  productName: string;
  productImage: string;
  productSku: string;
  categoryName: string; // Supplier Category Name
  sellPrice: string; // Supplier's cost price to us
}

interface SupplierProductListResponse { // Renamed from CjProductListResponse
  list: SupplierProduct[];
  total: number;
  pageNum: number;
  pageSize: number;
}

interface PlatformCategory {
  id: number;
  name: string;
  description: string | null;
  parent_category_id: number | null;
}

interface ImportModalState {
  isOpen: boolean;
  productToImport: CjProduct | null;
  platformCategoryId: string | undefined;
  sellingPrice: string;
  displayName: string;
  displayDescription: string;
}

export default function BrowseSupplierProductsPage() { // Renamed component
  const { adminApiKey, loading: adminAuthLoading, isAuthenticated } = useAdminAuth();
  const { toast } = useToast();

  // Search and Filter State
  const [keyword, setKeyword] = useState('');
  const [supplierCategoryId, setSupplierCategoryId] = useState(''); // Renamed from cjCategoryId
  const [currentPage, setCurrentPage] = useState(1);
  const [limitPerPage, setLimitPerPage] = useState(20);

  // API Response State
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]); // Renamed from cjProducts
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // State for product selection
  const [selectedSupplierProductIds, setSelectedSupplierProductIds] = useState(new Set<string>()); // Renamed

  // State for Supplier API Categories for filtering
  const [supplierApiCategories, setSupplierApiCategories] = useState<SupplierCategory[]>([]); // Renamed & uses aliased type
  const [isLoadingSupplierApiCategories, setIsLoadingSupplierApiCategories] = useState(false); // Renamed

  // Platform Categories for Import Modal
  const [platformCategories, setPlatformCategories] = useState<PlatformCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Import Modal State (for single import)
  interface SingleImportModalState { // Renamed to avoid conflict if CjProduct type was global
    isOpen: boolean;
    productToImport: SupplierProduct | null; // Uses renamed SupplierProduct
    platformCategoryId: string | undefined;
    sellingPrice: string;
    displayName: string;
    displayDescription: string;
  }
  const [importModal, setImportModal] = useState<SingleImportModalState>({ // Uses renamed type
    isOpen: false,
    productToImport: null,
    platformCategoryId: 'select-category',
    sellingPrice: '',
    displayName: '',
    displayDescription: '',
  });

  // State for Bulk Import Modal
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [bulkImportPlatformCategoryId, setBulkImportPlatformCategoryId] = useState<string>('');
  const [bulkImportMarkup, setBulkImportMarkup] = useState<string>('50'); // Default markup e.g. 50%
  const [isBulkImporting, setIsBulkImporting] = useState(false);


  // Debug: Log importModal state changes
  // useEffect(() => {
  //   console.log('importModal state changed:', importModal);
  // }, [importModal]);

  const [isImporting, setIsImporting] = useState(false); // For single import

  // Fetch Platform Categories
  useEffect(() => {
    const fetchPlatformCategories = async () => {
      if (adminAuthLoading) {
        console.log('[BrowseSupplierProductsPage] Admin auth is loading, skipping platform category fetch.');
        return;
      }
      if (!adminApiKey) {
        toast({title: "Authentication Error", description: "Admin API Key not found. Cannot load platform categories.", variant: "destructive"});
        setIsLoadingCategories(false);
        return;
      }
      setIsLoadingCategories(true);
      try {
        console.log('Fetching platform categories...');
        // API path /api/admin/categories remains the same
        const response = await fetch('/api/admin/categories?hierarchical=false', {
          headers: { 'X-Admin-API-Key': adminApiKey },
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to fetch platform categories:', response.status, errorText);
          throw new Error(`Failed to fetch platform categories: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Platform categories loaded:', data);
        setPlatformCategories(data);
      } catch (error: any) {
        console.error('Error loading platform categories:', error);
        toast({ title: "Error", description: `Could not load platform categories: ${error.message}`, variant: "destructive" });
      } finally {
        setIsLoadingCategories(false);
      }
    };
    if (!adminAuthLoading && adminApiKey) {
      fetchPlatformCategories();
    }
  }, [adminApiKey, adminAuthLoading, toast]);

  // Fetch Supplier API Categories for the filter dropdown
  useEffect(() => {
    const loadSupplierApiCategories = async () => { // Renamed function
      if (adminAuthLoading) {
        console.log('[BrowseSupplierProductsPage] Admin auth is loading, skipping Supplier API category fetch.');
        return;
      }
      if (!isAuthenticated) {
          toast({title: "Authentication Error", description: "You must be logged in as an admin.", variant: "destructive"});
          setIsLoadingSupplierApiCategories(false); // Use renamed state setter
          return;
      }

      setIsLoadingSupplierApiCategories(true); // Use renamed state setter
      try {
        const transformedCategories = await fetchAndTransformCjCategories(); // This helper fetches CJ data
        setSupplierApiCategories(transformedCategories); // Use renamed state setter
        console.log('[BrowseSupplierProductsPage] Fetched and transformed Supplier API Categories via helper:', transformedCategories);
      } catch (error: any) {
        toast({ title: "Error", description: `Could not load Supplier API categories: ${error.message}`, variant: "destructive" });
      } finally {
        setIsLoadingSupplierApiCategories(false); // Use renamed state setter
      }
    };
    if (!adminAuthLoading && isAuthenticated) {
      loadSupplierApiCategories();
    }
  }, [adminAuthLoading, isAuthenticated, toast]);

  const handleSearchSupplierProducts = async (page = 1) => { // Renamed function
    if (!adminApiKey || adminAuthLoading) { // Wait for auth to settle and key to be available
      toast({title: "Configuration Error", description: "Admin API Key not found or auth loading.", variant: "destructive"});
      return;
        toast({title: "Configuration Error", description: "Admin API Key not found or auth loading.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    setSearchError(null);
    setCurrentPage(page);

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limitPerPage),
    });
    if (keyword) params.append('keyword', keyword);
    if (supplierCategoryId) params.append('categoryId', supplierCategoryId); // Use renamed state

    try {
      // API path will be /api/admin/supplier/list-external after directory rename
      const response = await fetch(`/api/admin/cj/list-external?${params.toString()}`, {
        headers: { 'X-Admin-API-Key': adminApiKey },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || `Failed to fetch Supplier products: ${response.statusText}`);
      }

      const supplierApiResponseData = result.data || result;

      setSupplierProducts(supplierApiResponseData.list || []); // Use renamed state setter
      setTotalResults(supplierApiResponseData.total || 0);
      setTotalPages(Math.ceil((supplierApiResponseData.total || 0) / limitPerPage));
      setSelectedSupplierProductIds(new Set()); // Use renamed state setter
    } catch (err: any) {
      setSearchError(err.message);
      setSupplierProducts([]); // Use renamed state setter
      toast({ title: "Error Searching Supplier Products", description: err.message, variant: "destructive" }); // Updated toast
    } finally {
      setIsLoading(false);
    }
  };

  const openImportModal = (product: SupplierProduct) => { // Parameter type uses renamed interface
    // Handle case where productName might be a stringified array
    let productName = product.productName || '';
    try {
      // If productName is a stringified array, parse it and take the first item
      if (productName.startsWith('[') && productName.endsWith(']')) {
        const nameArray = JSON.parse(productName);
        if (Array.isArray(nameArray) && nameArray.length > 0) {
          productName = nameArray[0];
        }
      }
    } catch (e) {
      console.error('Error parsing product name:', e);
      // If parsing fails, keep the original name
    }

    // Suggest platform category
    let suggestedPlatformCategoryId: string = ''; // Default to empty string (for "Select a category")
    if (product.categoryName && platformCategories.length > 0) {
      const cjCategoryNameLower = product.categoryName.toLowerCase().trim();
      let matchedCategory = platformCategories.find(
        pCat => pCat.name.toLowerCase().trim() === cjCategoryNameLower
      );
      if (!matchedCategory) {
        matchedCategory = platformCategories.find(
          pCat => cjCategoryNameLower.includes(pCat.name.toLowerCase().trim()) ||
                  pCat.name.toLowerCase().trim().includes(cjCategoryNameLower)
        );
      }
      if (matchedCategory) {
        suggestedPlatformCategoryId = String(matchedCategory.id);
      }
    }

    setImportModal({
      isOpen: true,
      productToImport: product,
      platformCategoryId: suggestedPlatformCategoryId,
      sellingPrice: parseFloat(product.sellPrice) ? (parseFloat(product.sellPrice) * 1.5).toFixed(2) : '0.00',
      displayName: productName,
      displayDescription: `Sourced from Supplier: ${productName}`, // Updated text
    });
  };

  const handleImportProduct = async (e: FormEvent) => {
    e.preventDefault();

    if (!adminApiKey || adminAuthLoading) {
      toast({
        title: "Authentication Error",
        description: "Admin API Key not available or authentication is still loading. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Form submitted with state:', {
      productToImport: !!importModal.productToImport,
      platformCategoryId: importModal.platformCategoryId,
      sellingPrice: importModal.sellingPrice,
      hasPlatformCategory: !!importModal.platformCategoryId,
      hasSellingPrice: !!importModal.sellingPrice
    });

    // Updated validation to ensure a category is selected (not an empty string)
    if (!importModal.productToImport ||
        !importModal.platformCategoryId ||
        importModal.platformCategoryId === 'select-category' || // Explicitly check against placeholder if used
        importModal.platformCategoryId.trim() === '' || // Check for empty string
        !importModal.sellingPrice) {

      let errorDesc = "Please make sure to:\n";
      if (!importModal.platformCategoryId || importModal.platformCategoryId === 'select-category' || importModal.platformCategoryId.trim() === '') {
        errorDesc += '• Select a product category\n';
      }
      if (!importModal.sellingPrice) {
        errorDesc += '• Set a selling price\n';
      }
      
      toast({ 
        title: "Missing Required Fields", 
        description: errorDesc,
        variant: "destructive"
      });
      return;
    }
    
    setIsImporting(true);
    try {
      const payload = {
        cjProductId: importModal.productToImport.pid, // This field name in API payload refers to the source ID
        platform_category_id: parseInt(importModal.platformCategoryId, 10),
        selling_price: parseFloat(importModal.sellingPrice),
        display_name: importModal.displayName || importModal.productToImport.productName,
        display_description: importModal.displayDescription,
      };

      console.log('Sending import request with payload:', payload);
      
      // API path will be /api/admin/supplier/import-product after directory rename
      const response = await fetch('/api/admin/cj/import-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': adminApiKey,
        },
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();
      console.log('Import API response:', { status: response.status, result });
      
      if (!response.ok) {
        const errorMessage = result.error || result.message || `Failed to import product: ${response.statusText}`;
        console.error('Import failed:', errorMessage, result.details);
        throw new Error(errorMessage);
      }
      
      toast({ 
        title: "Product Imported", 
        description: `${result.product?.display_name || 'Product'} imported successfully with ID ${result.product?.id || 'unknown'}.`
      });
      
      // Reset the form
      setImportModal({ 
        isOpen: false, 
        productToImport: null, 
        platformCategoryId: undefined, 
        sellingPrice: '', 
        displayName: '', 
        displayDescription: '' 
      });
      
      // Optionally refresh the product list
      handleSearchSupplierProducts(currentPage); // Use renamed function
      
    } catch (error: any) {
      console.error('Error in handleImportProduct:', error);
      toast({ 
        title: "Import Failed", 
        description: error.message || 'An unknown error occurred while importing the product.', 
        variant: 'destructive' 
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Helper function to render Supplier Category options for the Select component
  const renderSupplierCategoryOptions = (categories: SupplierCategory[], level = 0): JSX.Element[] => { // Renamed & uses aliased type
    return categories.flatMap((category) => { // Removed index as it's not used for key
      const itemKey = category.id;
      const currentItem = (
        <SelectItem key={itemKey} value={String(category.id)}>
          <span style={{ paddingLeft: `${level * 15}px` }}>
            {level > 0 ? '↳ ' : ''}{category.name}
          </span>
        </SelectItem>
      );
      if (category.children && category.children.length > 0) {
        return [currentItem, ...renderSupplierCategoryOptions(category.children, level + 1)];
      }
      return [currentItem];
    });
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedSupplierProductIds(prev => { // Use renamed state setter
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  };

  const handleSelectAllOnPage = () => {
    setSelectedSupplierProductIds(prev => { // Use renamed state setter
      const newSet = new Set(prev);
      supplierProducts.forEach(p => newSet.add(p.pid)); // Use renamed product list
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedSupplierProductIds(new Set()); // Use renamed state setter
  };

  const handleOpenBulkImportModal = () => {
    if (selectedSupplierProductIds.size === 0) { // Use renamed state
      toast({ title: "No Products Selected", description: "Please select products to bulk import.", variant: "destructive" });
      return;
    }
    setIsBulkImportModalOpen(true);
  };

  const handleBulkImportConfirm = async () => {
    if (!adminApiKey) {
      toast({ title: "Authentication Error", description: "Admin API Key not available.", variant: "destructive" });
      return;
    }
    if (!bulkImportPlatformCategoryId) {
      toast({ title: "Validation Error", description: "Please select a platform category.", variant: "destructive" });
      return;
    }
    const markup = parseFloat(bulkImportMarkup);
    if (isNaN(markup) || markup < 0) {
      toast({ title: "Validation Error", description: "Please enter a valid non-negative markup percentage.", variant: "destructive" });
      return;
    }

    setIsBulkImporting(true);
    try {
      const payload = {
        cjProductIds: Array.from(selectedSupplierProductIds), // Use renamed state
        platformCategoryId: parseInt(bulkImportPlatformCategoryId, 10),
        pricingMarkupPercentage: markup,
      };
      // API path will be /api/admin/supplier/bulk-import after directory rename
      const response = await fetch('/api/admin/cj/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-API-Key': adminApiKey },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.message || 'Bulk import failed');
      }
      toast({
        title: "Bulk Import Processed",
        description: `${result.successfullyImported} products imported. ${result.failedImports} failed. ${result.alreadyExists} already existed.`,
      });
      setSelectedSupplierProductIds(new Set()); // Use renamed state setter
      setIsBulkImportModalOpen(false);
      // Optionally refresh current page search results
      // handleSearchSupplierProducts(currentPage);  // Use renamed function
    } catch (error: any) {
      toast({ title: "Bulk Import Error", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkImporting(false);
    }
  };


  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><PackageSearch className="mr-2 h-6 w-6" /> Browse Supplier Products</CardTitle>
            <CardDescription>Search for products directly from the default supplier to import.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleSearchSupplierProducts(1);}} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"> {/* Use renamed handler */}
              <Input placeholder="Keyword (Product Name)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              <Select
                value={supplierCategoryId} // Use renamed state
                onValueChange={(value) => setSupplierCategoryId(value === 'all' ? '' : value)}
                disabled={isLoadingSupplierApiCategories || isLoading} // Use renamed state
              >
                <SelectTrigger id="supplier-category-select" className="w-full"> {/* Updated ID */}
                  <SelectValue placeholder="Select Supplier Category" /> {/* Updated placeholder */}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="all-categories-static-key" value="all">All Categories</SelectItem>
                  {renderSupplierCategoryOptions(supplierApiCategories)} {/* Use renamed render func & state */}
                </SelectContent>
              </Select>
              {/* Add minPrice, maxPrice inputs if desired */}
              <Button type="submit" disabled={isLoading || !ADMIN_API_KEY || adminAuthLoading} className="lg:col-start-4">
                {isLoading && searchError === null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search Products {/* This text can remain generic */}
              </Button>
            </form>
            {searchError && (
                 <div className="p-4 mb-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-center">
                    <p>{searchError}</p>
                 </div>
            )}
          </CardContent>
        </Card>

        {isLoading && !searchError && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /> Loading products from Supplier...
          </div>
        )}

        {!isLoading && supplierProducts.length > 0 && ( // Use renamed product list
          <div key="product-list-wrapper" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAllOnPage} disabled={supplierProducts.length === 0}>Select Page ({supplierProducts.length})</Button>
                <Button variant="outline" size="sm" onClick={handleClearSelection} disabled={selectedSupplierProductIds.size === 0}>Clear Selection</Button>
                <span className="text-sm text-muted-foreground">{selectedSupplierProductIds.size} selected</span>
              </div>
              <Button onClick={handleOpenBulkImportModal} disabled={selectedSupplierProductIds.size === 0}>
                <Import className="mr-2 h-4 w-4"/> Import Selected ({selectedSupplierProductIds.size})
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {supplierProducts.map((product) => ( // Use renamed product list
                <Card key={product.pid} className="flex flex-col relative">
                  <div className="absolute top-2 right-2 z-10">
                    <Input
                      type="checkbox"
                      className="h-5 w-5 cursor-pointer"
                      checked={selectedSupplierProductIds.has(product.pid)} // Use renamed selection set
                      onCheckedChange={(checked) => handleSelectProduct(product.pid, !!checked)}
                    />
                  </div>
                  <CardHeader className="p-2 pt-8">
                    <div className="relative aspect-square w-full">
                      <Image 
                        src={product.productImage || '/placeholder.png'} 
                        alt={product.productName} 
                        fill 
                        className="object-contain rounded-t-md"
                        unoptimized={true}
                        loader={({ src }) => src}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 flex-grow space-y-1">
                    <p className="text-sm font-medium leading-tight h-10 overflow-hidden" title={product.productName}>{product.productName}</p>
                    <p className="text-xs text-muted-foreground">Supplier PID: {product.pid}</p> {/* Updated text */}
                    <p className="text-xs text-muted-foreground">Supplier Category: {product.categoryName}</p> {/* Updated text */}
                    <p className="text-sm font-semibold">Supplier Cost: ${parseFloat(product.sellPrice).toFixed(2)}</p> {/* Updated text */}
                  </CardContent>
                  <CardFooter className="p-3">
                    <Button size="sm" className="w-full" onClick={() => openImportModal(product)} disabled={isLoadingCategories}>
                      <Import className="mr-2 h-4 w-4"/> Import Single
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-6">
                <Button variant="outline" size="icon" onClick={() => handleSearchSupplierProducts(currentPage - 1)} disabled={currentPage <= 1 || isLoading}> {/* Use renamed handler */}
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">Page {currentPage} of {totalPages} ({totalResults} results)</span>
                <Button variant="outline" size="icon" onClick={() => handleSearchSupplierProducts(currentPage + 1)} disabled={currentPage >= totalPages || isLoading}> {/* Use renamed handler */}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
        {!isLoading && !searchError && supplierProducts.length === 0 && totalResults === 0 && ( // Use renamed product list
          <p className="text-center text-muted-foreground py-8">No products found for your criteria. Try different search terms.</p>
        )}
      </div>

      {/* Import Product Modal */}
      {importModal.isOpen && importModal.productToImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader>
              <CardTitle>Import Product to Platform</CardTitle>
              <CardDescription>Review details and set selling price for &quot;{importModal.productToImport.productName}&quot;.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleImportProduct} className="space-y-4">
                <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 relative flex-shrink-0">
                        <Image 
                          src={importModal.productToImport.productImage || '/placeholder.png'} 
                          alt={importModal.productToImport.productName} 
                          fill 
                          className="object-contain rounded-md border"
                          unoptimized={true}
                          loader={({ src }) => src}
                        />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{importModal.productToImport.productName}</p>
                        <p className="text-xs text-muted-foreground">Supplier PID: {importModal.productToImport.pid}</p> {/* Updated text */}
                        <p className="text-xs text-muted-foreground">Supplier Cost: ${parseFloat(importModal.productToImport.sellPrice).toFixed(2)}</p> {/* Updated text */}
                    </div>
                </div>
                <div>
                  <Label htmlFor="singleDisplayName">Display Name (Overrides Supplier Name)</Label> {/* Updated text */}
                  <Input id="singleDisplayName" value={importModal.displayName} onChange={(e) => setImportModal(s => ({...s, displayName: e.target.value}))} />
                </div>
                <div>
                  <Label htmlFor="singleDisplayDescription">Display Description (Overrides Supplier Description)</Label> {/* Updated text */}
                  <Textarea id="singleDisplayDescription" value={importModal.displayDescription} onChange={(e) => setImportModal(s => ({...s, displayDescription: e.target.value}))} rows={3}/>
                </div>
                <div>
                  <Label htmlFor="singlePlatformCategoryId">Platform Category <span className="text-destructive">*</span></Label>
                  <Select
                    value={importModal.platformCategoryId}
                    onValueChange={(value) => setImportModal(s => ({...s, platformCategoryId: value}))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Ensure a placeholder or default instruction is clear if platformCategoryId can be '' initially */}
                      <SelectItem value="" disabled>Select a platform category...</SelectItem>
                      {platformCategories.map(cat => (
                        <SelectItem key={`single-${cat.id}`} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="singleSellingPrice">Your Selling Price ($) <span className="text-destructive">*</span></Label>
                  <Input id="singleSellingPrice" type="number" step="0.01" value={importModal.sellingPrice} onChange={(e) => setImportModal(s => ({...s, sellingPrice: e.target.value}))} required />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setImportModal(prev => ({...prev, isOpen: false}))} disabled={isImporting}>Cancel</Button>
                  <Button 
                    type="submit" 
                    disabled={isImporting || !importModal.platformCategoryId || importModal.platformCategoryId.trim() === '' || !importModal.sellingPrice}
                  >
                    {isImporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Import className="mr-2 h-4 w-4" />
                    )}
                    Confirm Import
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Bulk Import Settings</CardTitle>
              <CardDescription>Configure settings for importing {selectedCjProductIds.size} selected products.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bulkPlatformCategoryId">Platform Category for ALL selected products <span className="text-destructive">*</span></Label>
                <Select
                  value={bulkImportPlatformCategoryId}
                  onValueChange={setBulkImportPlatformCategoryId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign a category to all selected products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" disabled>Select a platform category...</SelectItem>
                    {platformCategories.map(cat => (
                      <SelectItem key={`bulk-${cat.id}`} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bulkPricingMarkup">Pricing Markup Percentage (%) <span className="text-destructive">*</span></Label>
                <Input
                  id="bulkPricingMarkup"
                  type="number"
                  step="0.01"
                  value={bulkImportMarkup}
                  onChange={(e) => setBulkImportMarkup(e.target.value)}
                  placeholder="e.g., 50 for 50%"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">This percentage will be added to the CJ base price to set your selling price.</p>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsBulkImportModalOpen(false)} disabled={isBulkImporting}>Cancel</Button>
                <Button onClick={handleBulkImportConfirm} disabled={isBulkImporting || !bulkImportPlatformCategoryId || !bulkImportMarkup}>
                  {isBulkImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Import className="mr-2 h-4 w-4" />}
                  Confirm Bulk Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ProtectedRoute>
  );
}
