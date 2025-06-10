'use client';

import { useState, useEffect } from 'react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { parseApiResponse } from '@/utils/apiHelpers'; // handleApiError is defined in this component
import ImageUploader from './ImageUploader';
import Image from 'next/image';

interface Category {
  id: string;
  name: string;
}

interface ProductFormProps {
  productId?: string; // If provided, we're editing an existing product
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface ProductData {
  id: string;
  name: string;
  description: string;
  price: number;
  basePrice?: number;
  imageUrl: string;
  categoryId?: string | null;
  stockQuantity: number;
  cashbackConfig?: {
    type: 'percentage' | 'fixed';
    value: number;
  } | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Define validation schema
const productSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be positive'),
  basePrice: z.number().positive('Base price must be positive').optional(),
  // Accept any non-empty string for imageUrl (including local paths starting with /uploads/)
  imageUrl: z.string().min(1, 'Image URL is required'),
  // Make categoryId optional without UUID validation
  categoryId: z.string().optional(),
  stockQuantity: z.number().int().nonnegative('Stock quantity must be a non-negative integer'),
  cashbackPercentage: z.number().min(0).max(100, 'Cashback percentage must be between 0 and 100').optional(),
  isActive: z.boolean().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function ProductForm({ productId }: ProductFormProps) {
  const { token, isAuthenticated, authenticatedRequest } = useMerchantAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: 0,
    basePrice: undefined,
    imageUrl: '',
    categoryId: undefined,
    stockQuantity: 0,
    cashbackPercentage: 0,
    isActive: true,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(productId ? true : false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const handleApiError = (error: unknown, defaultMessage: string, logError: boolean = true): string => {
    if (logError) {
      console.error('API Error:', error);
    }
    let errorMessage = defaultMessage;
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }
    
    setApiError(errorMessage);
    return errorMessage;
  };

  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch categories: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result && Array.isArray(result.categories)) {
          setCategories(result.categories);
        } else {
          console.error('Invalid categories response format:', result);
          throw new Error('Invalid categories response format');
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        handleApiError(error, 'Failed to fetch categories', true);
      }
    };

    fetchCategories();
  }, []);

  // If editing, fetch the product data
  useEffect(() => {
    const fetchProductData = async () => {
      if (!productId || !isAuthenticated || !token) return;

      try {
        setIsLoading(true);
        const response = await authenticatedRequest(`/api/merchant/products/${productId}`, {});
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} ${errorText || response.statusText}`);
        }
        
        const result: ApiResponse<ProductData> = await response.json();
        
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response format from server');
        }
        
        const product = result as unknown as ProductData;
        
        // Extract cashback percentage from cashback_config if it exists
        let cashbackPercentage = 0;
        if (product.cashbackConfig?.type === 'percentage') {
          cashbackPercentage = product.cashbackConfig.value;
        }

        setFormData({
          name: product.name,
          description: product.description,
          price: product.price,
          basePrice: product.basePrice,
          imageUrl: product.imageUrl,
          categoryId: product.categoryId || undefined,
          stockQuantity: product.stockQuantity,
          cashbackPercentage,
          isActive: product.isActive,
        });
      } catch (error) {
        const errorMessage = handleApiError(error, 'Failed to load product data', true);
        setApiError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProductData();
  }, [productId, isAuthenticated, token, authenticatedRequest]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    
    // Handle different input types
    if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    
    // Validate form data
    try {
      productSchema.parse(formData);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path) {
            newErrors[err.path[0]] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      // Log form data for debugging
      console.log('Form data being submitted:', formData);
      
      // Prepare the request payload
      const payload = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        basePrice: formData.basePrice,
        imageUrl: formData.imageUrl,
        categoryId: formData.categoryId || null, // Ensure null is sent if empty
        stockQuantity: formData.stockQuantity,
        cashbackConfig: formData.cashbackPercentage 
          ? { type: 'percentage', value: formData.cashbackPercentage }
          : null, // Use null instead of undefined
        isActive: formData.isActive,
      };

      // Log the payload for debugging
      console.log('Payload being sent to API:', payload);

      // Determine if we're creating or updating
      const url = productId 
        ? `/api/merchant/products/${productId}`
        : '/api/merchant/products';
      
      const method = productId ? 'PUT' : 'POST';
      
      // Make the API request
      const response = await authenticatedRequest(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      // Check if response is OK before parsing
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', response.status, errorText);
        throw new Error(`API error: ${response.status} ${errorText || response.statusText}`);
      }
      
      const result = await response.json() as ApiResponse<ProductData>;
      console.log('API response data:', result);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Show success message
      toast({
        title: 'Success',
        description: productId ? 'Product updated successfully' : 'Product created successfully',
        variant: 'default',
      });
      
      // Redirect to products list
      router.push('/merchant/products');
    } catch (error) {
      console.error('Form submission error:', error);
      const errorMessage = handleApiError(error, 'Failed to save product', false);
      setApiError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };



  if (isLoading) {
    return <div className="text-center py-10">Loading product data...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {productId ? 'Edit Product' : 'Add New Product'}
      </h2>
      
      {apiError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {apiError}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block text-gray-700 font-medium mb-2">
            Product Name*
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Enter product name"
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>
        
        <div className="mb-4">
          <label htmlFor="description" className="block text-gray-700 font-medium mb-2">
            Description*
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="Enter product description"
            rows={4}
          />
          {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="price" className="block text-gray-700 font-medium mb-2">
              Price ($)*
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`w-full px-3 py-2 border rounded-md ${errors.price ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="0.00"
            />
            {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
          </div>
          
          <div>
            <label htmlFor="basePrice" className="block text-gray-700 font-medium mb-2">
              Base Price ($) <span className="text-gray-500 text-sm">(Optional)</span>
            </label>
            <input
              type="number"
              id="basePrice"
              name="basePrice"
              value={formData.basePrice || ''}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`w-full px-3 py-2 border rounded-md ${errors.basePrice ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="0.00"
            />
            {errors.basePrice && <p className="text-red-500 text-sm mt-1">{errors.basePrice}</p>}
          </div>
        </div>
        
        <div className="mb-4">
          <label htmlFor="categoryId" className="block text-gray-700 font-medium mb-2">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            value={formData.categoryId || ''}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md ${errors.categoryId ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">Select a category</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.categoryId && <p className="text-red-500 text-sm mt-1">{errors.categoryId}</p>}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">
            Product Image*
          </label>
          <div className="space-y-4">
            <ImageUploader 
              currentImageUrl={formData.imageUrl} 
              onImageUploaded={(url) => {
                setUploadedImageUrl(url);
                setFormData(prev => ({
                  ...prev,
                  imageUrl: url
                }));
              }} 
            />
            <div className="flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>
            <div>
              <label htmlFor="imageUrl" className="block text-gray-700 font-medium mb-2">
                Image URL
              </label>
              <input
                type="text"
                id="imageUrl"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md ${errors.imageUrl ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="https://example.com/image.jpg"
                disabled={!!uploadedImageUrl}
              />
              {errors.imageUrl && <p className="text-red-500 text-sm mt-1">{errors.imageUrl}</p>}
              {uploadedImageUrl && (
                <button 
                  type="button" 
                  onClick={() => {
                    setUploadedImageUrl(null);
                    setFormData(prev => ({ ...prev, imageUrl: '' }));
                  }}
                  className="text-red-500 text-sm mt-1 hover:underline"
                >
                  Clear uploaded image and use URL instead
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="stockQuantity" className="block text-gray-700 font-medium mb-2">
              Stock Quantity*
            </label>
            <input
              type="number"
              id="stockQuantity"
              name="stockQuantity"
              value={formData.stockQuantity}
              onChange={handleChange}
              min="0"
              step="1"
              className={`w-full px-3 py-2 border rounded-md ${errors.stockQuantity ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="0"
            />
            {errors.stockQuantity && <p className="text-red-500 text-sm mt-1">{errors.stockQuantity}</p>}
          </div>
        </div>
        
        <div className="mb-4">
          <label htmlFor="cashbackPercentage" className="block text-gray-700 font-medium mb-2">
            Cashback Percentage (%)
          </label>
          <input
            type="number"
            id="cashbackPercentage"
            name="cashbackPercentage"
            value={formData.cashbackPercentage || 0}
            onChange={handleChange}
            min="0"
            max="100"
            step="0.1"
            className={`w-full px-3 py-2 border rounded-md ${errors.cashbackPercentage ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="0"
          />
          {errors.cashbackPercentage && <p className="text-red-500 text-sm mt-1">{errors.cashbackPercentage}</p>}
        </div>
        
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="mr-2"
            />
            <span className="text-gray-700">Product is active and available for purchase</span>
          </label>
        </div>
        
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => router.push('/merchant/products')}
            className="bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 transition duration-300"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-300 disabled:bg-blue-400"
          >
            {isSubmitting ? 'Saving...' : (productId ? 'Update Product' : 'Add Product')}
          </button>
        </div>
      </form>
    </div>
  );
}
