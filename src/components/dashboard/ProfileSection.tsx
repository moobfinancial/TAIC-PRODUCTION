'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Gem, UserCircle2, UploadCloud, XCircle, Loader2, Coins, Wallet, Mail, KeyRound, ShieldCheck, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Label might not be used, can be removed if so
import { useToast } from '@/hooks/use-toast';
import { useSignMessage, useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { shortenAddress, getUserDisplayName } from '@/utils/formatters';

export function ProfileSection() {
  const { user, token, refreshUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // Initialize imagePreview with user.profileImageUrl if available
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks for wallet interaction
  const { open: openWeb3Modal } = useWeb3Modal();
  const { address: connectedAddress, isConnected, chainId } = useAccount();
  const { signMessageAsync, isPending: isSigningMessage } = useSignMessage();

  // State for linking wallet
  const [isLinkingWallet, setIsLinkingWallet] = useState<boolean>(false);
  const [linkWalletError, setLinkWalletError] = useState<string | null>(null);

  // State for adding email/password
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [isAddingEmailPassword, setIsAddingEmailPassword] = useState<boolean>(false);
  const [addEmailPasswordError, setAddEmailPasswordError] = useState<string | null>(null);

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

  const handleLinkWallet = async () => {
    if (!user || !token) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }

    if (!isConnected || !connectedAddress) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet first to link it.", variant: "default" });
      setLinkWalletError("Please ensure your wallet is connected through the site first.");
      return;
    }

    setIsLinkingWallet(true);
    setLinkWalletError(null);

    try {
      // 1. Get challenge nonce
      const challengeResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/link-wallet-challenge`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!challengeResponse.ok) {
        const errorData = await challengeResponse.json();
        throw new Error(errorData.detail || 'Failed to get wallet challenge');
      }
      const { nonce } = await challengeResponse.json();

      // 2. Sign nonce
      const signature = await signMessageAsync({ message: nonce });

      // 3. Link wallet
      const linkResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/link-wallet`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet_address: connectedAddress, signature, nonce }),
      });

      if (!linkResponse.ok) {
        const errorData = await linkResponse.json();
        throw new Error(errorData.detail || 'Failed to link wallet');
      }

      toast({ title: "Wallet Linked!", description: "Your wallet has been successfully linked to your account." });
      if (refreshUser) await refreshUser();

    } catch (error: any) {
      console.error("Link wallet failed:", error);
      const errMsg = error.message || "An unknown error occurred while linking your wallet.";
      setLinkWalletError(errMsg);
      toast({ title: "Link Wallet Failed", description: errMsg, variant: "destructive" });
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const handleAddEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    if (!newEmail || !newPassword) {
      setAddEmailPasswordError("Email and password are required.");
      return;
    }

    setIsAddingEmailPassword(true);
    setAddEmailPasswordError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newEmail, password: newPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update profile with email/password');
      }

      toast({ title: "Email & Password Added!", description: "Your account is now secured with email and password." });
      setNewEmail('');
      setNewPassword('');
      if (refreshUser) await refreshUser();

    } catch (error: any) {
      console.error("Add email/password failed:", error);
      const errMsg = error.message || "An unknown error occurred.";
      setAddEmailPasswordError(errMsg);
      toast({ title: "Update Failed", description: errMsg, variant: "destructive" });
    } finally {
      setIsAddingEmailPassword(false);
    }
  };

  // isAuthLoading handles the initial load of user data
  if (isAuthLoading) {
    return <Card className="shadow-lg"><CardHeader><CardTitle>Loading Profile...</CardTitle></CardHeader><CardContent><Loader2 className="h-8 w-8 animate-spin text-primary" /></CardContent></Card>;
  }
  if (!user) { // If still no user after auth loading, then don't render profile section
    return <Card className="shadow-lg"><CardHeader><CardTitle>Profile Not Available</CardTitle></CardHeader><CardContent><p>Please log in to view your profile.</p></CardContent></Card>;
  }

  // Use the utility function to get a consistent display name
  const profileDisplayName = getUserDisplayName(user);
  const avatarFallback = (user.displayName || user.username || user.walletAddress || "XX").substring(0, 2).toUpperCase();
  // Use imagePreview for AvatarImage src, which is dynamically updated.
  // Fallback to Vercel avatar if imagePreview is null.
  const vercelAvatarName = user.displayName || user.username || user.walletAddress || 'default';
  const currentAvatarSrc = imagePreview || `https://avatar.vercel.sh/${vercelAvatarName}.png?size=128`;


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
              <AvatarImage src={currentAvatarSrc} alt={profileDisplayName} className="object-cover" />
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
            {!user.displayName && !user.username && user.walletAddress ? (
              <div className="flex items-center gap-2" title={user.walletAddress}>
                <Wallet className="h-6 w-6 text-primary flex-shrink-0" />
                <span className="text-lg font-semibold font-mono">{shortenAddress(user.walletAddress)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    navigator.clipboard.writeText(user.walletAddress!);
                    toast({ title: 'Copied!', description: 'Wallet address copied to clipboard.' });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <h3 className="text-2xl font-semibold">{profileDisplayName}</h3>
            )}
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

        {/* Link Wallet Section */}
        {user && user.email && !user.walletAddress && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h4 className="text-lg font-medium">Link a Wallet</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Connect a crypto wallet to your account for Web3 features and alternative login.
            </p>
            {!isConnected && (
                <Button onClick={() => openWeb3Modal()} variant="outline">
                    Connect Wallet to Site First
                </Button>
            )}
            {isConnected && connectedAddress && (
                 <Button onClick={handleLinkWallet} disabled={isLinkingWallet || isSigningMessage} className="w-full sm:w-auto">
                 {isLinkingWallet || isSigningMessage ? (
                   <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Linking...</>
                 ) : (
                   <><Wallet className="mr-2 h-4 w-4" /> Link {connectedAddress.substring(0, 6)}...{connectedAddress.substring(connectedAddress.length - 4)}</>
                 )}
               </Button>
            )}
            {linkWalletError && <p className="text-xs text-destructive mt-1">{linkWalletError}</p>}
          </div>
        )}

        {/* Add Email/Password Section */}
        {user && user.walletAddress && !user.email && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h4 className="text-lg font-medium">Secure Your Account</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Add an email and password to your wallet-based account for alternative login and account recovery options.
            </p>
            <form onSubmit={handleAddEmailPassword} className="space-y-3">
              <div>
                <Label htmlFor="newEmail">Email Address</Label>
                <Input 
                  id="newEmail" 
                  type="email" 
                  value={newEmail} 
                  onChange={(e) => setNewEmail(e.target.value)} 
                  placeholder="you@example.com"
                  required 
                  disabled={isAddingEmailPassword}
                />
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input 
                  id="newPassword" 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  placeholder="••••••••"
                  required 
                  minLength={8}
                  disabled={isAddingEmailPassword}
                />
              </div>
              <Button type="submit" disabled={isAddingEmailPassword} className="w-full sm:w-auto">
                {isAddingEmailPassword ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
                ) : (
                  <><KeyRound className="mr-2 h-4 w-4" /> Add Email & Password</>
                )}
              </Button>
            </form>
            {addEmailPasswordError && <p className="text-xs text-destructive mt-1">{addEmailPasswordError}</p>}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
