
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Gem, UserCircle2, UploadCloud, XCircle, Loader2 } from 'lucide-react';
// Update useAuth import path
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast'; // Import useToast

export function ProfileSection() {
  // updateUser is no longer provided by AuthContext in the same way.
  // Profile updates would typically involve an API call and then potentially a refresh of user data.
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(user?.profileImageUrl || null); // Initialize with user's current image
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Set initial image preview if user has a profile image URL
    if (user?.profileImageUrl && !selectedFile) {
      setImagePreview(user.profileImageUrl);
    }

    // Revoke the data uris to avoid memory leaks
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview); // Revoke previous preview
    }
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setImagePreview(null);
    }
  };

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) { // Only revoke if it's an object URL
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedFile(null);
    setImagePreview(user?.profileImageUrl || null); // Revert to user's current image or null
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear the file input
    }
    setUploadError(null);
  };

  const handleUploadImage = async () => {
    if (!selectedFile) {
      toast({ 
        title: "No file selected", 
        description: "Please select an image to upload.", 
        variant: "destructive" 
      });
      return;
    }
    if (!user) {
        toast({ title: "Authentication Error", description: "User not found.", variant: "destructive" });
        return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('userId', user.id); // Assuming user object has an 'id' field

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Upload failed with status ${response.status}`);
      }

      toast({ title: "Profile Picture Updated!", description: "Your new picture has been saved." });

      // Assuming updateUser can handle partial updates or specific profile image update
      // The AuthContext's user object is updated by fetching /api/auth/me.
      // For immediate UI update of the image, we set imagePreview.
      // A full user object refresh in context would happen on next load or if a refresh function is called.
      // For now, removing the direct call to updateUser as its previous form is gone.
      // if (updateUser) {
      //    const updatedUserDetails = { ...user, profileImageUrl: result.imageUrl };
      //    updateUser(updatedUserDetails);
      // }
      setImagePreview(result.imageUrl); // Show the new image from the URL (this is the persisted URL)
      setSelectedFile(null); // Clear selection

      // Optionally, to refresh the user data in AuthContext immediately,
      // AuthContext would need a function like `refreshUser()`
      // For example: if (auth.refreshUser) auth.refreshUser();

    } catch (error: any) {
      console.error("Upload failed:", error);
      const errorMessage = error.message || "An unknown error occurred during upload.";
      setUploadError(errorMessage);
      toast({ title: "Upload Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };


  if (!user) return null;

  const displayName = user.username || user.walletAddress.substring(0, 6) + "..." + user.walletAddress.substring(user.walletAddress.length - 4);
  const avatarFallback = (user.username || user.walletAddress || "U").substring(0, 2).toUpperCase();

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-4">
          <UserCircle2 className="h-8 w-8 text-primary" />
          <CardTitle className="text-2xl font-headline">My Profile</CardTitle>
        </div>
        <CardDescription>Your personal account information and profile picture.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
          <div className="relative group">
            <Avatar className="h-32 w-32 text-4xl border-2 border-primary/50 shadow-md">
              <AvatarImage src={imagePreview || `https://avatar.vercel.sh/${displayName}.png`} alt={displayName} className="object-cover" />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            {selectedFile && imagePreview && imagePreview.startsWith('blob:') && ( // Show remove only for new blob previews
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleRemoveImage}
                aria-label="Cancel selection"
              >
                <XCircle className="h-5 w-5" />
              </Button>
            )}
          </div>
          <div className="text-center sm:text-left flex-grow">
            <h3 className="text-2xl font-semibold">{displayName}</h3>
            {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
            <p className="text-muted-foreground">TAIC Balance Holder</p> {/* Updated description */}
            <div className="mt-3 space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                {imagePreview && imagePreview !== user.profileImageUrl ? 'Change Selection' : (user.profileImageUrl ? 'Change Picture' : 'Upload Picture')}
              </Button>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                id="profile-picture-upload"
                disabled={isUploading}
              />
              {selectedFile && imagePreview?.startsWith('blob:') && (
                <Button
                  size="sm"
                  onClick={handleUploadImage}
                  disabled={isUploading}
                  className="ml-2"
                >
                  {isUploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    'Save Picture'
                  )}
                </Button>
              )}
              {uploadError && <p className="text-xs text-destructive mt-1">{uploadError}</p>}
               {!selectedFile && <p className="text-xs text-muted-foreground mt-2">Upload a new profile picture.</p>}
            </div>
          </div>
        </div>
        
        <div className="space-y-2 pt-4 border-t">
          <h4 className="text-lg font-medium">Demo TAIC Balance</h4>
          <div className="flex items-center text-3xl font-bold text-primary">
            <Gem className="mr-2 h-7 w-7" />
            <span>{user.taicBalance?.toLocaleString() || 0} TAIC</span>
          </div>
        </div>
        {/* stakedTaicBalance is no longer part of the main User object from auth.
            If this information is still needed, it should be fetched from a separate API endpoint.
            For now, removing this section to align with the current User type.

        {user.stakedTaicBalance > 0 && ( // This would cause an error if stakedTaicBalance is not on user
           <div className="space-y-2">
            <h4 className="text-lg font-medium">Staked TAIC Balance (General)</h4>
            <div className="flex items-center text-2xl font-semibold text-green-600">
                <Gem className="mr-2 h-6 w-6" />
                <span>{user.stakedTaicBalance.toLocaleString()} TAIC</span>
            </div>
          </div>
        )}
        */}
      </CardContent>
    </Card>
  );
}
