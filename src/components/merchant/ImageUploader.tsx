'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { Upload, X } from 'lucide-react';

interface ImageUploaderProps {
  currentImageUrl: string;
  onImageUploaded: (url: string) => void;
}

export default function ImageUploader({ currentImageUrl, onImageUploaded }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { authenticatedRequest } = useMerchantAuth();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please select a valid image file (JPEG, PNG, WEBP, or GIF)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be less than 5MB');
      return;
    }

    // Clear previous errors
    setUploadError(null);
    
    // Create object URL for preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload the file
    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await authenticatedRequest('/api/merchant/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }
      
      const data = await response.json();
      
      // Call the callback with the new image URL
      onImageUploaded(data.url);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center">
        {/* Current or Preview Image */}
        <div className="relative w-full h-64 mb-4 bg-gray-100 rounded-md overflow-hidden">
          {(previewUrl || currentImageUrl) ? (
            <>
              <Image
                src={previewUrl || (currentImageUrl.startsWith('/') ? currentImageUrl : currentImageUrl)}
                alt="Product image"
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                style={{ objectFit: 'contain' }}
                className="rounded-md"
              />
              {previewUrl && (
                <button
                  type="button"
                  onClick={clearPreview}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                  aria-label="Remove preview"
                >
                  <X size={16} />
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No image selected
            </div>
          )}
        </div>

        {/* Upload Button */}
        <label className="flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md cursor-pointer hover:bg-primary/90 transition-colors">
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? 'Uploading...' : 'Upload Image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>

      {/* Error Message */}
      {uploadError && (
        <div className="text-red-500 text-sm mt-1">{uploadError}</div>
      )}
    </div>
  );
}
