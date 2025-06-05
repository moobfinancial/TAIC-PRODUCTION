'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
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

// Interface for CJ Category (matching the TransformedCjCategory from backend)
interface CjCategory {
  id: string; // Changed from categoryId
  name: string; // Changed from categoryNameEn/categoryName
  children?: CjCategory[];
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

  // State for CJ API Categories for filtering
  const [cjApiCategories, setCjApiCategories] = useState<CjCategory[]>([]);
  const [isLoadingCjApiCategories, setIsLoadingCjApiCategories] = useState(false);

  // Platform Categories for Import Modal
  const [platformCategories, setPlatformCategories] = useState<PlatformCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Import Modal State
  const [importModal, setImportModal] = useState<ImportModalState>({
    isOpen: false,
    productToImport: null,
    platformCategoryId: 'select-category',
    sellingPrice: '',
    displayName: '',
    displayDescription: '',
  });

  // Debug: Log importModal state changes
  useEffect(() => {
    console.log('importModal state changed:', importModal);
  }, [importModal]);

  const [isImporting, setIsImporting] = useState(false);

  // Fetch Platform Categories
  useEffect(() => {
    const fetchPlatformCategories = async () => {
      if (!ADMIN_API_KEY) {
        console.error('ADMIN_API_KEY is not set');
        return;
      }
      setIsLoadingCategories(true);
      try {
        console.log('Fetching platform categories...');
        const response = await fetch('/api/admin/categories?hierarchical=false', { // Fetch flat list
          headers: { 'X-Admin-API-Key': ADMIN_API_KEY },
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
    if (ADMIN_API_KEY) {
      console.log('ADMIN_API_KEY found, fetching platform categories...');
      fetchPlatformCategories();
    } else {
      console.error('ADMIN_API_KEY not found');
      toast({title: "Configuration Error", description: "Admin API Key not found.", variant: "destructive"});
    }
  }, [ADMIN_API_KEY, toast]); // Added ADMIN_API_KEY and toast to dependency array for completeness

  // Fetch CJ API Categories for the filter dropdown
  useEffect(() => {
    const fetchCjApiCategories = async () => {
      if (!ADMIN_API_KEY) return;
      setIsLoadingCjApiCategories(true);
      try {
        const response = await fetch('/api/admin/cj/cj-categories-route', {
          headers: { 'X-Admin-API-Key': ADMIN_API_KEY },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.details || 'Failed to fetch CJ categories');
        }
        const data: CjCategory[] = await response.json();
        console.log('[BrowseCjProductsPage] Fetched CJ API Categories:', data);
        setCjApiCategories(data);
      } catch (error: any) {
        toast({ title: "Error", description: `Could not load CJ API categories: ${error.message}`, variant: "destructive" });
      } finally {
        setIsLoadingCjApiCategories(false);
      }
    };
    if (ADMIN_API_KEY) {
      fetchCjApiCategories();
    }
    // We only want to run this once on mount if ADMIN_API_KEY is present, toast is for linting if it's not stable.
  }, [ADMIN_API_KEY, toast]); 

  const handleSearchCjProducts = async (page = 1) => {
    if (!ADMIN_API_KEY) {
        toast({title: "Configuration Error", description: "Admin API Key not found.", variant: "destructive"});
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
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY },
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
          'X-Admin-API-Key': ADMIN_API_KEY,
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
      // Use category.id (which is now guaranteed by backend transformation) and ensure it's a string
      const itemKey = `${level}-${String(category.id)}-${index}`;
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


  return (
    <AdminLayout>
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
              <Button type="submit" disabled={isLoading || !ADMIN_API_KEY} className="lg:col-start-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cjProducts.map((product) => {
                console.log(`[Image Debug] PID: ${product.pid}, Image URL: "${product.productImage}", Hostname from URL: "${new URL(product.productImage).hostname}"`);
                return (
                <Card key={product.pid} className="flex flex-col">
                  <CardHeader className="p-2">
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
                      <Import className="mr-2 h-4 w-4"/> Import
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
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
                  <Label htmlFor="displayName">Display Name (Overrides CJ Name)</Label>
                  <Input id="displayName" value={importModal.displayName} onChange={(e) => setImportModal(s => ({...s, displayName: e.target.value}))} />
                </div>
                <div>
                  <Label htmlFor="displayDescription">Display Description (Overrides CJ Description)</Label>
                  <Textarea id="displayDescription" value={importModal.displayDescription} onChange={(e) => setImportModal(s => ({...s, displayDescription: e.target.value}))} rows={3}/>
                </div>
                <div>
                  <Label htmlFor="platformCategoryId">Platform Category <span className="text-destructive">*</span></Label>
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
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sellingPrice">Your Selling Price ($) <span className="text-destructive">*</span></Label>
                  <Input id="sellingPrice" type="number" step="0.01" value={importModal.sellingPrice} onChange={(e) => setImportModal(s => ({...s, sellingPrice: e.target.value}))} required />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setImportModal(prev => ({...prev, isOpen: false}))} disabled={isImporting}>Cancel</Button>
                  <Button 
                    type="submit" 
                    disabled={isImporting || !importModal.platformCategoryId || !importModal.sellingPrice || importModal.platformCategoryId === 'select-category'}
                    onClick={() => {
                      console.log('Button clicked with state:', {
                        isImporting,
                        platformCategoryId: importModal.platformCategoryId,
                        sellingPrice: importModal.sellingPrice,
                        disabled: isImporting || !importModal.platformCategoryId || !importModal.sellingPrice || importModal.platformCategoryId === 'select-category'
                      });
                    }}
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
    </AdminLayout>
  );
}
