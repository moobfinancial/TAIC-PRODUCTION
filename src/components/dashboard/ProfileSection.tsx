
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Gem, UserCircle2, UploadCloud, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast'; // Import useToast

export function ProfileSection() {
  const { user, updateUser } = useAuth(); // Assuming updateUser can handle profile image updates
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
      // And that user object in context will be updated, triggering re-render
      if (updateUser) {
         // Create a new user object with the updated profileImageUrl
        const updatedUserDetails = { ...user, profileImageUrl: result.imageUrl };
        updateUser(updatedUserDetails); // This should update the context
      }
      setImagePreview(result.imageUrl); // Show the new image from the URL
      setSelectedFile(null); // Clear selection

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
              <AvatarImage src={imagePreview || `https://avatar.vercel.sh/${user.username}.png`} alt={user.username || "User"} className="object-cover" />
              <AvatarFallback>{user.username ? user.username.substring(0, 2).toUpperCase() : 'U'}</AvatarFallback>
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
            <h3 className="text-2xl font-semibold">{user.username}</h3>
            <p className="text-muted-foreground">TAIC Enthusiast</p>
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
            <span>{user.taicBalance.toLocaleString()} TAIC</span>
          </div>
        </div>
        {user.stakedTaicBalance > 0 && (
           <div className="space-y-2">
            <h4 className="text-lg font-medium">Staked TAIC Balance (General)</h4>
            <div className="flex items-center text-2xl font-semibold text-green-600">
                <Gem className="mr-2 h-6 w-6" />
                <span>{user.stakedTaicBalance.toLocaleString()} TAIC</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
