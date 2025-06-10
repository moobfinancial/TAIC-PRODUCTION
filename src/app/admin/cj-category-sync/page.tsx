'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, ListTree, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
// Assuming CjCategory might be renamed to SupplierCategory in cjUtils eventually.
// For now, if cjUtils still exports CjCategory, we use it.
import { CjCategory as SupplierCategory } from '@/lib/cjUtils';

interface SyncResult {
  addedCount?: number;
  existedCount?: number;
  errorCount?: number;
  errorsList?: { categoryName: string; parentId?: number | null; error: string }[];
  message?: string;
}

export default function SupplierCategorySyncPage() { // Renamed component
  const { adminApiKey, loading: adminAuthLoading } = useAdminAuth();
  const { toast } = useToast();

  const [supplierCategoriesPreview, setSupplierCategoriesPreview] = useState<SupplierCategory[]>([]); // Renamed state
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isPreviewFetched, setIsPreviewFetched] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchSupplierCategoriesForPreview = useCallback(async () => { // Renamed function
    if (!adminApiKey) {
      toast({ title: "Authentication Error", description: "Admin API Key not available.", variant: "destructive" });
      setPreviewError("Admin API Key not available.");
      return;
    }
    setIsLoadingPreview(true);
    setPreviewError(null);
    setSupplierCategoriesPreview([]); // Use renamed state setter
    setIsPreviewFetched(false);
    setSyncResult(null);
    setSyncError(null);

    try {
      // This API path will be updated when directory renames happen.
      // For now, it refers to the route that fetches CJ categories.
      const response = await fetch('/api/admin/cj/cj-categories-route', {
        headers: { 'X-Admin-API-Key': adminApiKey },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Failed to fetch Supplier categories: ${response.statusText}`); // Updated message
      }
      const data: SupplierCategory[] = await response.json();
      setSupplierCategoriesPreview(data || []); // Use renamed state setter
      setIsPreviewFetched(true);
      if (!data || data.length === 0) {
        toast({ title: "No Categories", description: "No categories were returned from the supplier.", variant: "default" });
      }
    } catch (err: any) {
      setPreviewError(err.message);
      toast({ title: "Error Fetching Preview", description: err.message, variant: "destructive" });
    } finally {
      setIsLoadingPreview(false);
    }
  }, [adminApiKey, toast]);

  const handleSyncCategories = useCallback(async () => {
    if (!adminApiKey) {
      toast({ title: "Authentication Error", description: "Admin API Key not available.", variant: "destructive" });
      setSyncError("Admin API Key not available.");
      return;
    }
    if (!isPreviewFetched || supplierCategoriesPreview.length === 0) { // Use renamed state
        toast({ title: "No Categories to Sync", description: "Please fetch categories for preview first.", variant: "default"});
        return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);

    try {
      // This API path will be updated when directory renames happen.
      const response = await fetch('/api/admin/cj/sync-platform-categories', {
        method: 'POST',
        headers: {
          'X-Admin-API-Key': adminApiKey,
          'Content-Type': 'application/json',
        },
      });

      const resultData: SyncResult = await response.json();

      if (!response.ok) {
        throw new Error(resultData.message || `Sync failed: ${response.statusText}`);
      }
      setSyncResult(resultData);
      toast({
        title: "Sync Completed",
        description: resultData.message || `Added: ${resultData.addedCount}, Existing: ${resultData.existedCount}, Errors: ${resultData.errorCount}`
      });
    } catch (err: any) {
      setSyncError(err.message);
      toast({ title: "Error During Sync", description: err.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }, [adminApiKey, toast, isPreviewFetched, supplierCategoriesPreview]); // Use renamed state

  const renderSupplierCategoryNode = (category: SupplierCategory, level: number = 0): JSX.Element[] => { // Renamed function
    const items: JSX.Element[] = [];
    items.push(
      <div key={category.id} style={{ marginLeft: `${level * 20}px` }} className="py-1 text-sm">
        {level > 0 && <span className="mr-2 text-muted-foreground">↳</span>}
        {category.name} <span className="text-xs text-muted-foreground">(Supplier ID: {category.id})</span> {/* Updated text */}
      </div>
    );
    if (category.children && category.children.length > 0) {
      category.children.forEach(child => {
        items.push(...renderSupplierCategoryNode(child, level + 1)); // Recursive call to renamed function
      });
    }
    return items;
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8 space-y-6">
        <h1 className="text-3xl font-bold">Supplier Category Synchronization</h1>

        <Card>
          <CardHeader>
            <CardTitle>Step 1: Fetch & Preview Supplier Categories</CardTitle>
            <CardDescription>
              Fetch the current category tree from the default supplier.
              This allows you to preview the categories before attempting to sync them with the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchSupplierCategoriesForPreview} disabled={isLoadingPreview || adminAuthLoading}> {/* Use renamed handler */}
              {isLoadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListTree className="mr-2 h-4 w-4" />}
              Fetch & Preview Supplier Categories
            </Button>
            {previewError && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> <p>{previewError}</p>
              </div>
            )}
            {isPreviewFetched && !isLoadingPreview && !previewError && (
              supplierCategoriesPreview.length > 0 ? ( // Use renamed state
                <ScrollArea className="mt-4 h-72 w-full rounded-md border p-4">
                  <h3 className="font-semibold mb-2">Fetched Categories Preview:</h3>
                  {supplierCategoriesPreview.map(cat => renderSupplierCategoryNode(cat, 0))} {/* Use renamed render func & state */}
                </ScrollArea>
              ) : (
                <p className="mt-4 text-muted-foreground">No categories found or fetched from the supplier.</p>
              )
            )}
          </CardContent>
        </Card>

        {isPreviewFetched && supplierCategoriesPreview.length > 0 && ( // Use renamed state
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Synchronize to Platform</CardTitle>
              <CardDescription>
                This action will attempt to add any new supplier categories found into the platform&apos;s category system,
                maintaining their hierarchical structure. Existing categories (matched by name and parent) will be skipped.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleSyncCategories} disabled={isSyncing || isLoadingPreview || adminAuthLoading}>
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync Supplier Categories to Platform {/* Updated text */}
              </Button>
              {syncError && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> <p>{syncError}</p>
                </div>
              )}
              {syncResult && !isSyncing && (
                <div className="mt-4 p-4 border rounded-md bg-muted/20 space-y-2">
                  <h3 className="font-semibold text-lg">Synchronization Result:</h3>
                  {syncResult.message && <p className="text-sm text-muted-foreground">{syncResult.message}</p>}
                  <p className="text-sm"><CheckCircle className="inline h-4 w-4 mr-1 text-green-600"/>Added: {syncResult.addedCount ?? 'N/A'}</p>
                  <p className="text-sm"><ListTree className="inline h-4 w-4 mr-1 text-blue-600"/>Existing (Skipped): {syncResult.existedCount ?? 'N/A'}</p>
                  <p className="text-sm"><XCircle className="inline h-4 w-4 mr-1 text-red-600"/>Errors: {syncResult.errorCount ?? 'N/A'}</p>
                  {syncResult.errorsList && syncResult.errorsList.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mt-2">Error Details:</h4>
                      <ScrollArea className="h-32 mt-1 p-2 border rounded bg-background">
                        <ul className="text-xs list-disc list-inside">
                          {syncResult.errorsList.map((err, idx) => (
                            <li key={idx}><strong>{err.categoryName}</strong> (Parent ID: {err.parentId ?? 'None'}): {err.error}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
