'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2, AlertTriangle, UploadCloud, Sparkles, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';

interface VTOModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

export function VTOModal({ product, isOpen, onClose }: VTOModalProps) {
  const { token, isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const [userImageFile, setUserImageFile] = useState<File | null>(null);
  const [userImageUrlPreview, setUserImageUrlPreview] = useState<string | null>(null);
  const [generatedVtoImageUrl, setGeneratedVtoImageUrl] = useState<string | null>(null);
  const [isLoadingVTO, setIsLoadingVTO] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [vtoError, setVtoError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setUserImageFile(null);
    if (userImageUrlPreview) {
      URL.revokeObjectURL(userImageUrlPreview);
    }
    setUserImageUrlPreview(null);
    setGeneratedVtoImageUrl(null);
    setUploadError(null);
    setVtoError(null);
    setIsLoadingVTO(false);
  }, [userImageUrlPreview]);

  // Effect to revoke object URL
  useEffect(() => {
    // This effect now only handles cleanup on unmount or when isOpen becomes false
    let currentPreview = userImageUrlPreview;
    return () => {
      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
      }
    };
  }, []); // Removed userImageUrlPreview from deps to avoid premature revoke

  // Reset form when modal is closed or product changes
  useEffect(() => {
    if (!isOpen) {
      // Delay reset to allow modal close animation
      setTimeout(resetForm, 300);
    }
  }, [isOpen, resetForm]);


  const handleUserImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGeneratedVtoImageUrl(null); // Clear previous VTO result
    setUploadError(null);
    setVtoError(null);

    if (userImageUrlPreview) { // Revoke previous object URL immediately
      URL.revokeObjectURL(userImageUrlPreview);
      setUserImageUrlPreview(null);
    }

    const file = event.target.files?.[0];
    if (file) {
      setUserImageFile(file);
      setUserImageUrlPreview(URL.createObjectURL(file));
    } else {
      setUserImageFile(null);
      // setUserImageUrlPreview(null); // Already handled by revoke
    }
  };

  const handlePerformVTO = async () => {
    if (!isAuthenticated || !user) {
      toast({ title: 'Authentication Required', description: 'Please log in to use Virtual Try-On.', variant: 'destructive' });
      return;
    }
    if (!userImageFile) {
      toast({ title: 'No User Image', description: 'Please select an image of yourself for the try-on.', variant: 'destructive' });
      return;
    }
    if (!token) {
      toast({ title: 'Authentication Error', description: 'Missing authentication token.', variant: 'destructive' });
      return;
    }

    setIsLoadingVTO(true);
    setUploadError(null);
    setVtoError(null);
    setGeneratedVtoImageUrl(null);

    let uploadedUserImageCloudUrl = '';

    // Step 1: Upload user image
    try {
      const formData = new FormData();
      formData.append('file', userImageFile);
      formData.append('imageType', 'vto_user_source');
      formData.append('description', `User source image for VTO with product: ${product.name}`);

      const uploadResponse = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error || 'Failed to upload your image.');
      }
      uploadedUserImageCloudUrl = uploadResult.imageUrl;
      toast({ title: 'Your Image Uploaded', description: 'Now starting Virtual Try-On...' });
    } catch (err: any) {
      setUploadError(err.message);
      toast({ title: 'Image Upload Failed', description: err.message, variant: 'destructive' });
      setIsLoadingVTO(false);
      return;
    }

    // Step 2: Call VTO API
    try {
      const vtoApiPayload = {
        userImageUrl: uploadedUserImageCloudUrl,
        productImageUrl: product.imageUrl,
        userDescription: "user model wearing product", // Generic description
        productDescription: product.name,
        productId: product.id,
        productName: product.name, // productName is useful for description in gallery later
      };

      const vtoResponse = await fetch('/api/virtual-try-on', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(vtoApiPayload),
      });

      const vtoResult = await vtoResponse.json();
      if (!vtoResponse.ok) {
        throw new Error(vtoResult.error || vtoResult.message || 'Virtual Try-On API request failed.');
      }

      if (vtoResult.errorMessage && !vtoResult.generatedImageUrl) {
        // If AI returns an error message and no image (e.g. safety filter)
         throw new Error(vtoResult.errorMessage);
      }

      setGeneratedVtoImageUrl(vtoResult.generatedImageUrl);
      toast({ title: 'Virtual Try-On Complete!', description: 'Check out your new look.' });

    } catch (err: any) {
      setVtoError(err.message);
      toast({ title: 'Virtual Try-On Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoadingVTO(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="mr-2 h-5 w-5 text-primary" />
            Virtual Try-On: {product.name}
          </DialogTitle>
          <DialogDescription>
            Upload an image of yourself to see how this product looks on you.
            Ensure your face is clearly visible and the image is well-lit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Product:</h3>
              <div className="border rounded-md p-2 flex flex-col items-center">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  width={150}
                  height={150}
                  className="object-contain rounded"
                />
                <p className="text-xs text-center mt-1 text-muted-foreground">{product.name}</p>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Your Image:</h3>
              <Input type="file" accept="image/*" onChange={handleUserImageChange} disabled={isLoadingVTO} id="vto-user-image-upload"/>
              {userImageUrlPreview && (
                <div className="border rounded-md p-2 flex flex-col items-center mt-2">
                  <Image
                    src={userImageUrlPreview}
                    alt="Your selected image"
                    width={150}
                    height={150}
                    className="object-contain rounded"
                  />
                </div>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> <p>{uploadError}</p>
            </div>
          )}
          {vtoError && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> <p>{vtoError}</p>
            </div>
          )}

          {isLoadingVTO && (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">Performing Virtual Try-On... This may take a moment.</p>
              {uploadError === null && <p className="text-xs text-muted-foreground">(Uploading your image first...)</p>}
            </div>
          )}

          {generatedVtoImageUrl && !isLoadingVTO && (
            <div className="space-y-3 pt-3">
              <h3 className="font-semibold text-center text-lg">Your Virtual Try-On Result!</h3>
              <div className="border rounded-md p-2 flex justify-center bg-muted/20">
                <Image
                  src={generatedVtoImageUrl}
                  alt="Virtual Try-On Result"
                  width={300} // Adjust size as needed
                  height={300}
                  className="object-contain rounded"
                />
              </div>
              <Button variant="outline" onClick={resetForm} className="w-full">
                <RefreshCcw className="mr-2 h-4 w-4" /> Try another image or product
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="mt-auto pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          </DialogClose>
          {!generatedVtoImageUrl && (
            <Button
              type="button"
              onClick={handlePerformVTO}
              disabled={!userImageFile || isLoadingVTO}
            >
              {isLoadingVTO ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              Start Virtual Try-On
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
