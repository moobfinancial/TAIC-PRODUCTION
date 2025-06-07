'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useEffect, useState } from 'react';
import FirebaseImage from '@/components/ui/FirebaseImage';
import { Loader2, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface GalleryImage {
  url: string;
  name: string;
  createdAt: string;
  metadata: {
    productInfo?: {
      productId?: string;
      productName?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export default function GalleryPage() {
  const { user } = useAuth();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      // Get the user ID from localStorage
      const userData = localStorage.getItem('taicUser');
      const userId = userData ? JSON.parse(userData).id : null;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/user/images', {
        headers: {
          'x-user-id': userId
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch images');
      }
      
      const data = await response.json();
      setImages(data.images || []);
    } catch (error) {
      console.error('Error fetching images:', error);
      setError(error instanceof Error ? error.message : 'Failed to load images. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    fetchImages();
  }, [fetchImages, user?.id]);

  useEffect(() => {
    // Check for success message in URL
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('success') === 'true') {
        setShowSuccess(true);
        // Remove the success parameter from URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('success');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }

    fetchImages();
  }, [user?.id]);

  if (!user) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">My Virtual Try-On Gallery</h1>
        <p className="text-gray-600 mb-4">
          Please sign in to view your gallery.
        </p>
        <Link href="/login">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">My Virtual Try-On Gallery</h1>
          <p className="text-gray-600 mt-1">View all your virtual try-on sessions</p>
        </div>
        <Link 
          href="/products" 
          className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Try-On
        </Link>
      </div>

      {showSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Your virtual try-on was generated successfully!
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-gray-600">Loading your gallery...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Error loading gallery</span>
          </div>
          <p className="mt-2 text-sm">{error}</p>
          <button 
            onClick={() => fetchImages()} 
            className="mt-3 text-sm text-red-700 hover:underline flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try again
          </button>
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <ImageIcon className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No virtual try-ons yet</h3>
          <p className="mt-1 text-gray-500">Your virtual try-ons will appear here.</p>
          <div className="mt-6">
            <Link 
              href="/products" 
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Try on a product
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map((image, index) => {
            const metadata = image.metadata || {};
            const productInfo = metadata.productInfo || {};
            const productName = productInfo.productName || 'Unknown Product';
            const productImage = productInfo.productImage;
            const tryOnDate = new Date(image.createdAt);
            
            return (
              <div key={index} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
                <div className="relative aspect-square">
                  <FirebaseImage 
                    src={image.url} 
                    alt={`Virtual try-on with ${productName}`}
                    fill
                    className="object-cover"
                    priority={index < 4} // Load first 4 images with priority
                  />
                  {productImage && (
                    <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md">
                      <FirebaseImage
                        src={productImage}
                        alt={productName}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 line-clamp-1">{productName}</h3>
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {tryOnDate.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
