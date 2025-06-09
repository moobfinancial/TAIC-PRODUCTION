'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Gem, UserCircle2, UploadCloud, XCircle, Loader2, Coins } from 'lucide-react'; // Added Coins
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Label might not be used, can be removed if so
import { useToast } from '@/hooks/use-toast';

export function ProfileSection() {
  const { user, token, refreshUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // Initialize imagePreview with user.profileImageUrl if available
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Update imagePreview when user object changes (e.g., after login or refreshUser)
    // and no new file is currently selected for preview.
    if (user?.profileImageUrl && !selectedFile) {
      setImagePreview(user.profileImageUrl);
    } else if (!user?.profileImageUrl && !selectedFile) {
      // If user has no profile image and no file is selected, clear preview
      setImagePreview(null);
    }
    // No explicit cleanup needed for imagePreview if it's a direct URL string from user.profileImageUrl
    // Cleanup for blob URLs is handled in handleFileChange and handleRemoveImage
  }, [user, selectedFile]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (imagePreview && imagePreview.startsWith('blob:')) { // Revoke previous blob preview
      URL.revokeObjectURL(imagePreview);
    }
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file)); // Create new blob preview
      setUploadError(null); // Clear previous upload error
    } else {
      setSelectedFile(null);
      // Revert to user's actual profile image URL if they cancel selection
      setImagePreview(user?.profileImageUrl || null);
    }
  };

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedFile(null);
    setImagePreview(user?.profileImageUrl || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
    if (!user) { // Should ideally be covered by page auth, but good check
        toast({ title: "Authentication Error", description: "User not found. Please login again.", variant: "destructive" });
        return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('imageType', 'profile_picture'); // Consistent type
    formData.append('description', `Profile picture for user ${user.id}`);

    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `Upload failed with status ${response.status}`);
      }

      toast({ title: "Profile Picture Updated!", description: "Your new picture has been saved." });

      // The result.imageUrl should be the new persisted URL.
      // We set it directly to imagePreview for immediate UI update.
      setImagePreview(result.imageUrl);
      setSelectedFile(null); // Clear selection
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Refresh user data in AuthContext. This should update user.profileImageUrl
      // across the app (e.g., in Navbar avatar).
      if (refreshUser) {
        await refreshUser();
      }

    } catch (error: any) {
      console.error("Upload failed:", error);
      const errorMessage = error.message || "An unknown error occurred during upload.";
      setUploadError(errorMessage);
      toast({ title: "Upload Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // isAuthLoading handles the initial load of user data
  if (isAuthLoading) {
    return <Card className="shadow-lg"><CardHeader><CardTitle>Loading Profile...</CardTitle></CardHeader><CardContent><Loader2 className="h-8 w-8 animate-spin text-primary" /></CardContent></Card>;
  }
  if (!user) { // If still no user after auth loading, then don't render profile section
    return <Card className="shadow-lg"><CardHeader><CardTitle>Profile Not Available</CardTitle></CardHeader><CardContent><p>Please log in to view your profile.</p></CardContent></Card>;
  }

  const displayName = user.username || user.walletAddress.substring(0, 6) + "..." + user.walletAddress.substring(user.walletAddress.length - 4);
  const avatarFallback = (user.username || user.walletAddress || "U").substring(0, 2).toUpperCase();
  // Use imagePreview for AvatarImage src, which is dynamically updated.
  // Fallback to Vercel avatar if imagePreview is null.
  const currentAvatarSrc = imagePreview || `https://avatar.vercel.sh/${user.walletAddress}.png?size=128`;


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
              <AvatarImage src={currentAvatarSrc} alt={displayName} className="object-cover" />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            {selectedFile && imagePreview && imagePreview.startsWith('blob:') && (
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
            <p className="text-sm text-muted-foreground">Role: {user.role}</p>
            <div className="mt-3 space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                {selectedFile ? 'Change Selection' : (user.profileImageUrl ? 'Change Picture' : 'Upload Picture')}
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
              {selectedFile && ( // Show Save button only if a new file is selected
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
            </div>
            {uploadError && <p className="text-xs text-destructive mt-1">{uploadError}</p>}
            {!selectedFile && !user.profileImageUrl && <p className="text-xs text-muted-foreground mt-2">Upload a profile picture.</p>}
          </div>
        </div>
        
        <div className="space-y-2 pt-4 border-t">
          <h4 className="text-lg font-medium">TAIC Balance</h4>
          <div className="flex items-center text-3xl font-bold text-primary">
            <Gem className="mr-2 h-7 w-7" />
            <span>{user.taicBalance?.toLocaleString() || 0} TAIC</span>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h4 className="text-lg font-medium">Cashback Balance</h4>
          <div className="flex items-center text-2xl font-semibold text-green-600">
            <Coins className="mr-2 h-6 w-6" />
            <span>{(user.cashbackBalance || 0).toLocaleString()} TAIC</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
