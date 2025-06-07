'use client';

import { useState, useEffect } from 'react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { parseApiResponse, handleApiError } from '@/utils/apiHelpers';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse {
  products: Product[];
  pagination: PaginationData;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  basePrice?: number;
  imageUrl: string;
  stockQuantity: number;
  isActive: boolean;
  categoryName?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ProductList() {
  const { token, isAuthenticated, authenticatedRequest } = useMerchantAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });

  const fetchProducts = async (page = 1) => {
    if (!isAuthenticated) {
      setError('You must be logged in to view products');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await authenticatedRequest(`/api/merchant/products?page=${page}&limit=${pagination.limit}`, {});
      const data = await parseApiResponse<ApiResponse>(response);
      setProducts(data.products);
      setPagination(data.pagination);
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load products';
      setError(errorMessage);
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchProducts();
    }
  }, [isAuthenticated, token]);

  const handlePageChange = (newPage: number) => {
    fetchProducts(newPage);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const response = await authenticatedRequest(`/api/merchant/products/${productId}`, {
        method: 'DELETE'
      });
      
      await parseApiResponse(response);
      
      // Show success message
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
        variant: 'default',
      });

      // Refresh the product list
      fetchProducts(pagination.page);
    } catch (error) {
      handleApiError(error, 'Failed to delete product');
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading products...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {error}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="mb-4">You haven't added any products yet.</p>
        <Link href="/merchant/products/new" className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
          Add Your First Product
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Your Products</h2>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 border-b text-left">Image</th>
              <th className="py-2 px-4 border-b text-left">Name</th>
              <th className="py-2 px-4 border-b text-left">Price</th>
              <th className="py-2 px-4 border-b text-left">Stock</th>
              <th className="py-2 px-4 border-b text-left">Category</th>
              <th className="py-2 px-4 border-b text-left">Status</th>
              <th className="py-2 px-4 border-b text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b">
                  <div className="w-16 h-16 relative">
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      sizes="64px"
                      className="object-cover rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder-image.jpg';
                      }}
                    />
                  </div>
                </td>
                <td className="py-2 px-4 border-b">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-gray-500 truncate max-w-xs">
                    {product.description.length > 50 
                      ? `${product.description.substring(0, 50)}...` 
                      : product.description}
                  </div>
                </td>
                <td className="py-2 px-4 border-b">
                  <div>${product.price.toFixed(2)}</div>
                  {product.basePrice && (
                    <div className="text-sm text-gray-500 line-through">
                      ${product.basePrice.toFixed(2)}
                    </div>
                  )}
                </td>
                <td className="py-2 px-4 border-b">
                  {product.stockQuantity}
                </td>
                <td className="py-2 px-4 border-b">
                  {product.categoryName || 'Uncategorized'}
                </td>
                <td className="py-2 px-4 border-b">
                  <span className={`px-2 py-1 rounded text-xs ${
                    product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2 px-4 border-b">
                  <div className="flex space-x-2">
                    <Link 
                      href={`/merchant/products/edit/${product.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <nav className="flex items-center">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 rounded border mr-2 disabled:opacity-50"
            >
              Previous
            </button>
            
            <div className="flex space-x-1">
              {[...Array(pagination.totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => handlePageChange(i + 1)}
                  className={`px-3 py-1 rounded ${
                    pagination.page === i + 1
                      ? 'bg-blue-600 text-white'
                      : 'border hover:bg-gray-100'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 rounded border ml-2 disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
