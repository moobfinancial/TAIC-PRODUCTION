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
import { PlusCircle, Trash2, Edit, Loader2, AlertCircle, ListTree, List, Save } from 'lucide-react'; // Added Save

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
  const [newCategoryParentId, setNewCategoryParentId] = useState<string>(''); // Store as string for Select, init as '' for "None"

  const [isSubmitting, setIsSubmitting] = useState(false); // Renamed from isAdding
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

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
    // Ensure flatCategories is also updated when viewMode changes and hierarchical fetch is done
    if (ADMIN_API_KEY) { // Check if ADMIN_API_KEY is available
      fetchCategories(viewMode === 'tree');
    }
  }, [viewMode, ADMIN_API_KEY]); // Added ADMIN_API_KEY dependency

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryDescription('');
    setNewCategoryParentId(''); // Reset to "None" or empty
  };

  const handleEditClick = (category: Category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryDescription(category.description || '');
    setNewCategoryParentId(category.parent_category_id ? String(category.parent_category_id) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = async (categoryId: number) => {
    if (!window.confirm("Are you sure you want to delete this category? This action cannot be undone.")) {
      return;
    }
    if (!ADMIN_API_KEY) {
      toast({ title: "Error", description: "Admin API key not configured.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true); // Use general submitting state or a specific deleting state
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to delete category: ${response.statusText}`);
      }
      toast({ title: "Success", description: "Category deleted successfully." });
      fetchCategories(viewMode === 'tree'); // Refresh list
      handleCancelEdit(); // Clear form if deleted category was being edited
    } catch (err: any) {
      toast({ title: "Error Deleting Category", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleSubmitCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast({ title: "Validation Error", description: "Category name is required.", variant: "destructive" });
      return;
    }
    if (!ADMIN_API_KEY) {
      toast({ title: "Error", description: "Admin API key not configured.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: any = {
      name: newCategoryName.trim(),
      description: newCategoryDescription.trim() || null,
    };
    if (newCategoryParentId && newCategoryParentId !== '') { // Check for empty string instead of 'none'
      payload.parent_category_id = parseInt(newCategoryParentId, 10);
    } else {
      payload.parent_category_id = null; // Explicitly set to null if no parent
    }

    let url = '/api/admin/categories';
    let method = 'POST';

    if (editingCategory) {
      url = `/api/admin/categories/${editingCategory.id}`;
      method = 'PUT';
      // Ensure we don't send empty strings for optional fields if they weren't changed
      // The backend PUT should handle optional fields correctly.
      // For PUT, only send fields that are meant to be updated.
      // However, current backend PUT expects all fields or uses refine.
      // For simplicity, sending all, backend will ignore if not changed or use Zod .optional()
    }

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': ADMIN_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || `Failed to ${editingCategory ? 'update' : 'add'} category: ${response.statusText}`);
      }

      toast({ title: "Success", description: `Category "${result.name}" ${editingCategory ? 'updated' : 'added'}.` });
      handleCancelEdit(); // Resets form and editingCategory
      fetchCategories(viewMode === 'tree'); // Refresh list
    } catch (err: any) {
      setError(err.message); // Consider setting specific API error to state for display
      toast({ title: `Error ${editingCategory ? 'Updating' : 'Adding'} Category`, description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCategoryItem = (category: Category, level = 0) => (
    <div key={category.id} className={`p-3 border-b ${level > 0 ? `ml-${level * 6}` : ''} hover:bg-gray-50/50`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="font-semibold">{category.name} <span className="text-xs text-muted-foreground">(ID: {category.id})</span></p>
          {category.description && <p className="text-sm text-muted-foreground italic">{category.description}</p>}
          {category.parent_category_id && <p className="text-xs text-blue-500">Parent ID: {category.parent_category_id}</p>}
        </div>
        <div className="space-x-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => handleEditClick(category)} disabled={isSubmitting}>
            <Edit className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(category.id)} disabled={isSubmitting}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>
      {viewMode === 'tree' && category.children && category.children.length > 0 && (
        <div className="mt-2 pl-4 border-l-2 border-slate-200">
          {category.children.map(child => renderCategoryItem(child, level + 1))}
        </div>
      )}
    </div>
  );

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{editingCategory ? `Edit Category: ${editingCategory.name}` : 'Add New Category'}</CardTitle>
            <CardDescription>
              {editingCategory ? 'Update the details of this category.' : 'Create a new category for products.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitCategory} className="space-y-4">
              <div>
                <Label htmlFor="category-name">Category Name*</Label>
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
                <Select
                  value={newCategoryParentId}
                  onValueChange={setNewCategoryParentId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent (or none for top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (Top-level category)</SelectItem>
                    {flatCategories
                      .filter(cat => cat.id !== editingCategory?.id) // Prevent self-parenting in dropdown
                      .map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name} (ID: {cat.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2">
                <Button type="submit" disabled={isSubmitting || !ADMIN_API_KEY}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                    editingCategory ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />
                  }
                  {editingCategory ? 'Update Category' : 'Add Category'}
                </Button>
                {editingCategory && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSubmitting}>
                    Cancel Edit
                  </Button>
                )}
              </div>
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
