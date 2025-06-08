'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image'; // Use Next.js Image
import { Loader2, Image as ImageIcon, ArrowLeft, UploadCloud, AlertTriangle } from 'lucide-react'; // Added UploadCloud, AlertTriangle
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // For file input
import { useToast } from '@/hooks/use-toast'; // For upload feedback
import type { UserGalleryImage } from '@/lib/types'; // Import the new type

export default function GalleryPage() {
  const { user, token, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();

  const [images, setImages] = useState<UserGalleryImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false); // For try-on success message

  // State for new image upload
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);


  const fetchImages = useCallback(async (filterImageType?: string) => {
    if (!isAuthenticated || !token) {
      setIsLoadingImages(false);
      setImages([]);
      return;
    }
    setIsLoadingImages(true);
    setError(null);
    try {
      let apiUrl = '/api/user/images';
      if (filterImageType) {
        apiUrl += `?imageType=${encodeURIComponent(filterImageType)}`;
      }
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch images');
      }
      
      const data: UserGalleryImage[] = await response.json(); // API returns array directly
      setImages(data || []);
    } catch (err: any) {
      console.error('Error fetching images:', err);
      setError(err.message || 'Failed to load images. Please try again later.');
      setImages([]);
    } finally {
      setIsLoadingImages(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!authIsLoading) { // Only fetch when auth state is resolved
      fetchImages(); // Fetch all image types initially
    }
  }, [authIsLoading, isAuthenticated, fetchImages]);

  useEffect(() => {
    // Check for success message in URL (this logic can remain as is)
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('success') === 'true') {
        setShowSuccess(true);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('success');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
  }, []); // This effect only needs to run once on mount

  // Handle auth loading state
  if (authIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-gray-600">Loading authentication...</p>
      </div>
    );
  }

  // Handle not authenticated state
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 text-center">
        <ImageIcon className="mx-auto h-16 w-16 text-gray-400 mb-6" />
        <h1 className="text-2xl font-bold mb-4">My Image Gallery</h1>
        <p className="text-gray-600 mb-6">
          Please connect your wallet to view your gallery.
        </p>
        <Button asChild>
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    );
  }

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFileToUpload(event.target.files[0]);
    } else {
      setFileToUpload(null);
    }
  };

  const handleImageUpload = async () => {
    if (!fileToUpload) {
      toast({ title: "No file selected", description: "Please select an image to upload.", variant: "destructive" });
      return;
    }
    if (!token) {
      toast({ title: "Authentication Error", description: "You must be logged in to upload images.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('imageType', 'gallery_general'); // Or make this selectable
    if (uploadDescription) {
      formData.append('description', uploadDescription);
    }

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, // No Content-Type for FormData
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }
      toast({ title: "Image Uploaded", description: `Image "${result.galleryImageRecord?.description || fileToUpload.name}" uploaded successfully.` });
      setFileToUpload(null);
      setUploadDescription('');
      if (document.getElementById('imageUploadInput')) { // Reset file input
         (document.getElementById('imageUploadInput') as HTMLInputElement).value = "";
      }
      fetchImages(); // Refresh the gallery
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">My Image Gallery</h1>
          <p className="text-gray-600 mt-1">View and manage your uploaded images.</p>
        </div>
         <Button variant="outline" asChild>
          <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Link>
        </Button>
      </div>

      {/* Simple Image Upload Section */}
      <Card className="mb-8 shadow">
        <CardHeader>
          <CardTitle>Upload New Image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="imageUploadInput">Choose Image</Label>
              <Input id="imageUploadInput" type="file" accept="image/*" onChange={handleFileSelected} />
            </div>
            <div>
              <Label htmlFor="uploadDescription">Description (Optional)</Label>
              <Input
                id="uploadDescription"
                type="text"
                placeholder="e.g., My favorite moment"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleImageUpload} disabled={isUploading || !fileToUpload}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Upload Image
          </Button>
        </CardContent>
      </Card>


      {showSuccess && ( // This was for virtual try-on, can be repurposed or removed if gallery is generic
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5" /> {/* Changed Icon */}
          A previous action was successful! (e.g., Virtual Try-On image saved to gallery)
        </div>
      )}

      {isLoadingImages ? (
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-gray-600">Loading your gallery...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-destructive px-6 py-4 rounded-lg text-center">
           <AlertTriangle className="mx-auto h-10 w-10 mb-3" />
          <p className="font-medium text-lg">Error loading gallery</p>
          <p className="mt-1 text-sm">{error}</p>
          <Button onClick={() => fetchImages()} variant="outline" className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4"/>Retry
          </Button>
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <ImageIcon className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Your gallery is empty.</h3>
          <p className="mt-1 text-gray-500">Upload some images to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {images.map((image) => (
              <Card key={image.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                <div className="relative aspect-square w-full">
                  <Image
                    src={image.imageUrl}
                    alt={image.description || `Gallery image ${image.id}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-3 bg-card">
                  {image.description && <p className="text-sm text-muted-foreground truncate" title={image.description}>{image.description}</p>}
                  <p className="text-xs text-muted-foreground">Type: {image.imageType || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground">Uploaded: {new Date(image.createdAt).toLocaleDateString()}</p>
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
