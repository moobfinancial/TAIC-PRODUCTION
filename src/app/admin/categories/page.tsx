'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Edit, Loader2, AlertCircle, ListTree, List } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  description: string | null;
  parent_category_id: number | null;
  created_at?: string;
  updated_at?: string;
  children?: Category[]; // For tree view
}

// Temporary Admin API Key for development - replace with secure auth
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";

export default function ManageCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [flatCategories, setFlatCategories] = useState<Category[]>([]); // For parent dropdown
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | undefined>(undefined); // Store as string for Select

  const [isAdding, setIsAdding] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');

  const fetchCategories = async (hierarchical = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/categories?hierarchical=${hierarchical}`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch categories: ${response.statusText}`);
      }
      const data: Category[] = await response.json();
      if (hierarchical) {
        setCategories(data); // Tree structure
        // For flat list for dropdown, always fetch flat or process from tree
        if (viewMode !== 'list' || flatCategories.length === 0) { // Fetch flat list if not already available or if current view isn't list
            const flatResponse = await fetch('/api/admin/categories?hierarchical=false', {
                headers: { 'X-Admin-API-Key': ADMIN_API_KEY },
            });
            const flatData = await flatResponse.json();
            setFlatCategories(flatData);
        }
      } else {
        setCategories(data); // Flat list
        setFlatCategories(data);
      }
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!ADMIN_API_KEY) {
        setError("Admin API Key is not configured. Please set NEXT_PUBLIC_ADMIN_API_KEY for development.");
        toast({title: "Configuration Error", description: "Admin API Key not found.", variant: "destructive"});
        setIsLoading(false);
        return;
    }
    fetchCategories(viewMode === 'tree');
  }, [viewMode]); // Refetch when viewMode changes

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast({ 
        title: "Validation Error", 
        description: "Category name is required.",
        variant: "destructive" 
      });
      return;
    }
    setIsAdding(true);
    setError(null);
    try {
      const body: any = {
        name: newCategoryName,
        description: newCategoryDescription || null,
      };
      if (newCategoryParentId && newCategoryParentId !== 'none') {
        body.parent_category_id = parseInt(newCategoryParentId, 10);
      }

      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': ADMIN_API_KEY,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || `Failed to add category: ${response.statusText}`);
      }

      toast({ title: "Success", description: `Category "${result.name}" added.` });
      setNewCategoryName('');
      setNewCategoryDescription('');
      setNewCategoryParentId(undefined);
      fetchCategories(viewMode === 'tree'); // Refresh list
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Error Adding Category", description: err.message, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const renderCategoryItem = (category: Category, level = 0) => (
    <div key={category.id} className={`p-2 border-b ${level > 0 ? `ml-${level * 4}` : ''}`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="font-semibold">{category.name} <span className="text-xs text-muted-foreground">(ID: {category.id})</span></p>
          {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
        </div>
        {/* Future actions: Edit, Delete */}
      </div>
      {viewMode === 'tree' && category.children && category.children.length > 0 && (
        <div className="mt-1 pl-4 border-l">
          {category.children.map(child => renderCategoryItem(child, level + 1))}
        </div>
      )}
    </div>
  );

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add New Category</CardTitle>
            <CardDescription>Create a new category for products.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <Label htmlFor="category-name">Category Name</Label>
                <Input
                  id="category-name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Electronics"
                  required
                />
              </div>
              <div>
                <Label htmlFor="category-description">Description (Optional)</Label>
                <Textarea
                  id="category-description"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="e.g., Gadgets, devices, and more"
                />
              </div>
              <div>
                <Label htmlFor="category-parent">Parent Category (Optional)</Label>
                <Select value={newCategoryParentId} onValueChange={setNewCategoryParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category (or none)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Top-level category)</SelectItem>
                    {flatCategories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isAdding || !ADMIN_API_KEY}>
                {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Add Category
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Manage Categories</CardTitle>
                <CardDescription>View and manage existing product categories.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setViewMode('list')} disabled={viewMode === 'list' || isLoading} title="List View">
                    <List className="h-4 w-4"/>
                </Button>
                <Button variant="outline" size="icon" onClick={() => setViewMode('tree')} disabled={viewMode === 'tree' || isLoading} title="Tree View">
                    <ListTree className="h-4 w-4"/>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading categories...
              </div>
            )}
            {error && !isLoading && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <h3 className="font-semibold">Error Fetching Categories</h3>
                </div>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}
            {!isLoading && !error && categories.length === 0 && (
              <p className="text-muted-foreground">No categories found.</p>
            )}
            {!isLoading && !error && categories.length > 0 && (
              <div className="space-y-2">
                {viewMode === 'list'
                  ? categories.map(category => renderCategoryItem(category, 0))
                  : categories.map(category => renderCategoryItem(category, 0)) /* renderCategoryItem handles tree for 'tree' mode */
                }
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
