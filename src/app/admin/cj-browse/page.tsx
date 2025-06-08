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

// Temporary Admin API Key for development - replace with secure auth
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";

interface CjProduct {
  // Define based on expected fields from CJ API's product list
  // This will likely need adjustment once actual API response is known
  pid: string; // CJ Product ID
  productName: string; // Or productNameEn
  productImage: string;
  productSku: string; // Example, might be part of variants
  categoryName: string; // CJ Category Name
  sellPrice: string; // CJ's price to you (string from API, convert to number)
  // Add other fields as needed for display
}

interface CjProductListResponse {
  list: CjProduct[];
  total: number;
  pageNum: number;
  pageSize: number;
}

// Interfaces for raw CJ API category structure from their endpoint
interface RawCjApiL3Category {
  categoryId: string;
  categoryName: string;
}

interface RawCjApiL2Category {
  categorySecondName: string;
  categorySecondList?: RawCjApiL3Category[];
}

interface RawCjApiL1Category {
  categoryFirstName: string;
  categoryFirstList?: RawCjApiL2Category[];
}

// Interface for CJ Category (matching the TransformedCjCategory from backend)
interface CjCategory {
  id: string;
  name: string;
  children?: CjCategory[];
}

// Transformation function
function transformCjApiDataToCjCategories(rawCategories: RawCjApiL1Category[]): CjCategory[] {
  if (!rawCategories || !Array.isArray(rawCategories)) {
    return [];
  }

  const mapL3 = (l3Cat: RawCjApiL3Category): CjCategory => ({
    id: l3Cat.categoryId, // L3 has a proper ID from CJ
    name: l3Cat.categoryName,
    // L3 categories typically don't have children in this CJ structure
  });

  const mapL2 = (l2Cat: RawCjApiL2Category, l1Index: number, l2Index: number): CjCategory => {
    const children = (l2Cat.categorySecondList || []).map(mapL3);
    return {
      // Generate a unique ID for L2 categories as CJ API doesn't provide one
      id: `cj-l2-${l1Index}-${l2Index}-${l2Cat.categorySecondName.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: l2Cat.categorySecondName,
      children: children.length > 0 ? children : undefined,
    };
  };

  return rawCategories.map((l1Cat, l1Index) => {
    const children = (l1Cat.categoryFirstList || []).map((l2Cat, l2Index) => mapL2(l2Cat, l1Index, l2Index));
    return {
      // Generate a unique ID for L1 categories
      id: `cj-l1-${l1Index}-${l1Cat.categoryFirstName.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: l1Cat.categoryFirstName,
      children: children.length > 0 ? children : undefined,
    };
  });
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

export default function BrowseCjProductsPage() {
  const { adminApiKey, loading: adminAuthLoading, isAuthenticated } = useAdminAuth();
  const { toast } = useToast();

  // Search and Filter State
  const [keyword, setKeyword] = useState('');
  const [cjCategoryId, setCjCategoryId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limitPerPage, setLimitPerPage] = useState(20); // Corresponds to pageSize

  // API Response State
  const [cjProducts, setCjProducts] = useState<CjProduct[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // State for product selection
  const [selectedCjProductIds, setSelectedCjProductIds] = useState(new Set<string>());

  // State for CJ API Categories for filtering
  const [cjApiCategories, setCjApiCategories] = useState<CjCategory[]>([]);
  const [isLoadingCjApiCategories, setIsLoadingCjApiCategories] = useState(false);

  // Platform Categories for Import Modal
  const [platformCategories, setPlatformCategories] = useState<PlatformCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Import Modal State (for single import)
  const [importModal, setImportModal] = useState<ImportModalState>({
    isOpen: false,
    productToImport: null,
    platformCategoryId: 'select-category', // Ensure this is a string if Select expects it
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
      if (adminAuthLoading) { // Check auth loading state
        console.log('[BrowseCjProductsPage] Admin auth is loading, skipping platform category fetch.');
        return;
      }
      if (!adminApiKey) { // Use reactive adminApiKey
        toast({title: "Authentication Error", description: "Admin API Key not found. Cannot load platform categories.", variant: "destructive"});
        setIsLoadingCategories(false);
        return;
      }
      setIsLoadingCategories(true);
      try {
        console.log('Fetching platform categories...');
        const response = await fetch('/api/admin/categories?hierarchical=false', { // Fetch flat list
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
    if (!adminAuthLoading && adminApiKey) { // Check auth loading state
      fetchPlatformCategories();
    }
  }, [adminApiKey, adminAuthLoading, toast]); // Add adminAuthLoading, re-add toast for completeness 

  // Fetch CJ API Categories for the filter dropdown
  useEffect(() => {
    const fetchCjApiCategories = async () => {
      if (adminAuthLoading) { // Check auth loading state
        console.log('[BrowseCjProductsPage] Admin auth is loading, skipping CJ API category fetch.');
        return;
      }
      if (!adminApiKey) { // Use reactive adminApiKey
        toast({title: "Authentication Error", description: "Admin API Key not found. Cannot load CJ API categories.", variant: "destructive"});
        setIsLoadingCjApiCategories(false);
        return;
      };
      setIsLoadingCjApiCategories(true);
      try {
        const response = await fetch('/api/admin/cj/cj-categories-route', {
          headers: { 'X-Admin-API-Key': adminApiKey },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.details || 'Failed to fetch CJ categories');
        }
        const data = await response.json();
        const transformedCategories = transformCjApiDataToCjCategories(data as RawCjApiL1Category[]);
        setCjApiCategories(transformedCategories);
        console.log('[BrowseCjProductsPage] Fetched and transformed CJ API Categories:', transformedCategories);
      } catch (error: any) {
        toast({ title: "Error", description: `Could not load CJ API categories: ${error.message}`, variant: "destructive" });
      } finally {
        setIsLoadingCjApiCategories(false);
      }
    };
    if (!adminAuthLoading && adminApiKey) { // Check auth loading state
      fetchCjApiCategories();
    }
  }, [adminApiKey, adminAuthLoading, toast]); // Add adminAuthLoading, re-add toast for completeness 

  const handleSearchCjProducts = async (page = 1) => {
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
    if (cjCategoryId) params.append('categoryId', cjCategoryId);

    try {
      const response = await fetch(`/api/admin/cj/list-external?${params.toString()}`, {
        headers: { 'X-Admin-API-Key': adminApiKey },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || `Failed to fetch CJ products: ${response.statusText}`);
      }

      // Assuming result.data contains the list and pagination info as per CJ API structure
      // This needs to be adjusted based on the actual structure returned by your /api/admin/cj/list-external
      const cjApiResponseData = result.data || result; // Adjust if result.data is not the primary container

      setCjProducts(cjApiResponseData.list || []);
      setTotalResults(cjApiResponseData.total || 0);
      setTotalPages(Math.ceil((cjApiResponseData.total || 0) / limitPerPage));
      setSelectedCjProductIds(new Set()); // Clear selection on new search/page
    } catch (err: any) {
      setSearchError(err.message);
      setCjProducts([]);
      toast({ title: "Error Searching CJ Products", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openImportModal = (product: CjProduct) => {
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

    setImportModal({
      isOpen: true,
      productToImport: product,
      platformCategoryId: '', // Empty string for initial state
      sellingPrice: parseFloat(product.sellPrice) ? (parseFloat(product.sellPrice) * 1.5).toFixed(2) : '0.00',
      displayName: productName,
      displayDescription: `Imported from CJ: ${productName}`,
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

    if (!importModal.productToImport || !importModal.platformCategoryId || !importModal.sellingPrice) {
      console.log('Validation failed:', {
        missingProduct: !importModal.productToImport,
        missingCategory: !importModal.platformCategoryId,
        missingPrice: !importModal.sellingPrice
      });
      
      toast({ 
        title: "Missing Required Fields", 
        description: `Please make sure to:\n` +
                   `${!importModal.platformCategoryId ? '• Select a product category\n' : ''}` +
                   `${!importModal.sellingPrice ? '• Set a selling price\n' : ''}`,
        variant: "destructive"
      });
      return;
    }
    
    setIsImporting(true);
    try {
      const payload = {
        cjProductId: importModal.productToImport.pid,
        platform_category_id: parseInt(importModal.platformCategoryId, 10),
        selling_price: parseFloat(importModal.sellingPrice),
        display_name: importModal.displayName || importModal.productToImport.productName,
        display_description: importModal.displayDescription,
      };

      console.log('Sending import request with payload:', payload);
      
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
      handleSearchCjProducts(currentPage);
      
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

  // Helper function to render CJ Category options for the Select component
  const renderCjCategoryOptions = (categories: CjCategory[], level = 0): JSX.Element[] => {
    return categories.flatMap((category, index) => {
      const itemKey = category.id;
      const currentItem = (
        <SelectItem key={itemKey} value={String(category.id)}>
          <span style={{ paddingLeft: `${level * 15}px` }}>
            {level > 0 ? '↳ ' : ''}{category.name}
          </span>
        </SelectItem>
      );
      if (category.children && category.children.length > 0) {
        return [currentItem, ...renderCjCategoryOptions(category.children, level + 1)];
      }
      return [currentItem];
    });
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedCjProductIds(prev => {
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
    setSelectedCjProductIds(prev => {
      const newSet = new Set(prev);
      cjProducts.forEach(p => newSet.add(p.pid));
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedCjProductIds(new Set());
  };

  const handleOpenBulkImportModal = () => {
    if (selectedCjProductIds.size === 0) {
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
        cjProductIds: Array.from(selectedCjProductIds),
        platformCategoryId: parseInt(bulkImportPlatformCategoryId, 10),
        pricingMarkupPercentage: markup,
      };
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
      setSelectedCjProductIds(new Set());
      setIsBulkImportModalOpen(false);
      // Optionally refresh current page search results
      // handleSearchCjProducts(currentPage);
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
            <CardTitle className="flex items-center"><PackageSearch className="mr-2 h-6 w-6" /> Browse CJdropshipping Products</CardTitle>
            <CardDescription>Search for products directly from CJdropshipping to import.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleSearchCjProducts(1);}} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Input placeholder="Keyword (Product Name)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              <Select
                value={cjCategoryId}
                onValueChange={(value) => setCjCategoryId(value === 'all' ? '' : value)} // Allow unsetting
                disabled={isLoadingCjApiCategories || isLoading}
              >
                <SelectTrigger id="cj-category-select" className="w-full">
                  <SelectValue placeholder="Select CJ Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="all-categories-static-key" value="all">All Categories</SelectItem>
                  {renderCjCategoryOptions(cjApiCategories)}
                </SelectContent>
              </Select>
              {/* Add minPrice, maxPrice inputs if desired */}
              <Button type="submit" disabled={isLoading || !ADMIN_API_KEY || adminAuthLoading} className="lg:col-start-4">
                {isLoading && searchError === null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search Products
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
            <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /> Loading products from CJ...
          </div>
        )}

        {!isLoading && cjProducts.length > 0 && (
          <div key="product-list-wrapper" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAllOnPage} disabled={cjProducts.length === 0}>Select Page ({cjProducts.length})</Button>
                <Button variant="outline" size="sm" onClick={handleClearSelection} disabled={selectedCjProductIds.size === 0}>Clear Selection</Button>
                <span className="text-sm text-muted-foreground">{selectedCjProductIds.size} selected</span>
              </div>
              <Button onClick={handleOpenBulkImportModal} disabled={selectedCjProductIds.size === 0}>
                <Import className="mr-2 h-4 w-4"/> Import Selected ({selectedCjProductIds.size})
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cjProducts.map((product) => (
                <Card key={product.pid} className="flex flex-col relative">
                  <div className="absolute top-2 right-2 z-10">
                    <Input
                      type="checkbox"
                      className="h-5 w-5 cursor-pointer"
                      checked={selectedCjProductIds.has(product.pid)}
                      onCheckedChange={(checked) => handleSelectProduct(product.pid, !!checked)}
                    />
                  </div>
                  <CardHeader className="p-2 pt-8"> {/* Added pt-8 for checkbox space */}
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
                    <p className="text-xs text-muted-foreground">CJ ID: {product.pid}</p>
                    <p className="text-xs text-muted-foreground">CJ Category: {product.categoryName}</p>
                    <p className="text-sm font-semibold">CJ Price: ${parseFloat(product.sellPrice).toFixed(2)}</p>
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
                <Button variant="outline" size="icon" onClick={() => handleSearchCjProducts(currentPage - 1)} disabled={currentPage <= 1 || isLoading}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">Page {currentPage} of {totalPages} ({totalResults} results)</span>
                <Button variant="outline" size="icon" onClick={() => handleSearchCjProducts(currentPage + 1)} disabled={currentPage >= totalPages || isLoading}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
        {!isLoading && !searchError && cjProducts.length === 0 && totalResults === 0 && (
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
                        <p className="text-xs text-muted-foreground">CJ ID: {importModal.productToImport.pid}</p>
                        <p className="text-xs text-muted-foreground">CJ Price: ${parseFloat(importModal.productToImport.sellPrice).toFixed(2)}</p>
                    </div>
                </div>
                <div>
                  <Label htmlFor="singleDisplayName">Display Name (Overrides CJ Name)</Label>
                  <Input id="singleDisplayName" value={importModal.displayName} onChange={(e) => setImportModal(s => ({...s, displayName: e.target.value}))} />
                </div>
                <div>
                  <Label htmlFor="singleDisplayDescription">Display Description (Overrides CJ Description)</Label>
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
                      <SelectItem value="select-category" disabled className="text-muted-foreground">
                        Select a category
                      </SelectItem>
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
                    disabled={isImporting || !importModal.platformCategoryId || !importModal.sellingPrice || importModal.platformCategoryId === 'select-category'}
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
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
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
