'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, ListTree, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { CjCategory } from '@/lib/cjUtils'; // Assuming path from previous refactor

interface SyncResult {
  addedCount?: number;
  existedCount?: number;
  errorCount?: number;
  errorsList?: { categoryName: string; parentId?: number | null; error: string }[];
  message?: string;
}

export default function CjCategorySyncPage() {
  const { adminApiKey, loading: adminAuthLoading } = useAdminAuth();
  const { toast } = useToast();

  const [cjCategoriesPreview, setCjCategoriesPreview] = useState<CjCategory[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isPreviewFetched, setIsPreviewFetched] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchCjCategoriesForPreview = useCallback(async () => {
    if (!adminApiKey) {
      toast({ title: "Authentication Error", description: "Admin API Key not available.", variant: "destructive" });
      setPreviewError("Admin API Key not available.");
      return;
    }
    setIsLoadingPreview(true);
    setPreviewError(null);
    setCjCategoriesPreview([]);
    setIsPreviewFetched(false);
    setSyncResult(null); // Clear previous sync results
    setSyncError(null);

    try {
      const response = await fetch('/api/admin/cj/cj-categories-route', {
        headers: { 'X-Admin-API-Key': adminApiKey },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Failed to fetch CJ categories: ${response.statusText}`);
      }
      const data: CjCategory[] = await response.json();
      setCjCategoriesPreview(data || []);
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
    if (!isPreviewFetched || cjCategoriesPreview.length === 0) {
        toast({ title: "No Categories to Sync", description: "Please fetch categories for preview first.", variant: "warning"});
        return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);

    try {
      const response = await fetch('/api/admin/cj/sync-platform-categories', {
        method: 'POST',
        headers: {
          'X-Admin-API-Key': adminApiKey,
          'Content-Type': 'application/json', // Though body is empty for this specific POST
        },
        // Body can be empty if the API doesn't expect one for this trigger
      });

      const resultData: SyncResult = await response.json();

      if (!response.ok) {
        throw new Error(resultData.error || resultData.message || `Sync failed: ${response.statusText}`);
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
  }, [adminApiKey, toast, isPreviewFetched, cjCategoriesPreview]);

  const renderCjCategoryNode = (category: CjCategory, level: number = 0): JSX.Element[] => {
    const items: JSX.Element[] = [];
    items.push(
      <div key={category.id} style={{ marginLeft: `${level * 20}px` }} className="py-1 text-sm">
        {level > 0 && <span className="mr-2 text-muted-foreground">↳</span>}
        {category.name} <span className="text-xs text-muted-foreground">(ID: {category.id})</span>
      </div>
    );
    if (category.children && category.children.length > 0) {
      category.children.forEach(child => {
        items.push(...renderCjCategoryNode(child, level + 1));
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
              Fetch the current category tree from the supplier (CJ Dropshipping).
              This allows you to preview the categories before attempting to sync them with the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchCjCategoriesForPreview} disabled={isLoadingPreview || adminAuthLoading}>
              {isLoadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListTree className="mr-2 h-4 w-4" />}
              Fetch & Preview Supplier Categories
            </Button>
            {previewError && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> <p>{previewError}</p>
              </div>
            )}
            {isPreviewFetched && !isLoadingPreview && !previewError && (
              cjCategoriesPreview.length > 0 ? (
                <ScrollArea className="mt-4 h-72 w-full rounded-md border p-4">
                  <h3 className="font-semibold mb-2">Fetched Categories Preview:</h3>
                  {cjCategoriesPreview.map(cat => renderCjCategoryNode(cat, 0))}
                </ScrollArea>
              ) : (
                <p className="mt-4 text-muted-foreground">No categories found or fetched from the supplier.</p>
              )
            )}
          </CardContent>
        </Card>

        {isPreviewFetched && cjCategoriesPreview.length > 0 && (
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
                Sync Categories to Platform
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
