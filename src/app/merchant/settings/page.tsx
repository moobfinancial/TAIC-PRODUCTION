'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  User, 
  Wallet, 
  Bell, 
  Shield, 
  Save,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Settings interfaces
interface MerchantProfile {
  businessName: string;
  businessDescription: string;
  contactEmail: string;
  phoneNumber: string;
  businessAddress: string;
  taxId: string;
}

interface PayoutSettings {
  walletAddress: string;
  payoutSchedule: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  minimumPayoutAmount: number;
  currency: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  orderNotifications: boolean;
  payoutNotifications: boolean;
  marketingEmails: boolean;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  apiKeyVisible: boolean;
}

export default function MerchantSettingsPage() {
  const { merchant, isAuthenticated, loading, token } = useMerchantAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile>({
    businessName: '',
    businessDescription: '',
    contactEmail: '',
    phoneNumber: '',
    businessAddress: '',
    taxId: ''
  });
  
  const [payoutSettings, setPayoutSettings] = useState<PayoutSettings>({
    walletAddress: '',
    payoutSchedule: 'WEEKLY',
    minimumPayoutAmount: 50,
    currency: 'TAIC'
  });
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    orderNotifications: true,
    payoutNotifications: true,
    marketingEmails: false
  });
  
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    apiKeyVisible: false
  });
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKey] = useState('taic_sk_test_1234567890abcdef'); // Mock API key

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/merchant/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load settings data
  useEffect(() => {
    if (isAuthenticated && token && merchant) {
      loadSettingsData();
    }
  }, [isAuthenticated, token, merchant]);

  const loadSettingsData = async () => {
    setIsLoadingData(true);
    try {
      // TODO: Replace with real API calls
      // For now, using mock data and merchant context data
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Load merchant profile from context and mock additional data
      setMerchantProfile({
        businessName: merchant?.businessName || '',
        businessDescription: 'Premium electronics and accessories retailer',
        contactEmail: merchant?.email || '',
        phoneNumber: '+1 (555) 123-4567',
        businessAddress: '123 Commerce St, Business City, BC 12345',
        taxId: 'TAX123456789'
      });
      
      // Mock payout settings
      setPayoutSettings({
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        payoutSchedule: 'WEEKLY',
        minimumPayoutAmount: 50,
        currency: 'TAIC'
      });
      
    } catch (error) {
      console.error('Error loading settings data:', error);
      toast({
        title: "Error Loading Settings",
        description: "Unable to load your settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement real API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Profile Updated",
        description: "Your merchant profile has been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Unable to update your profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePayoutSettings = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement real API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Payout Settings Updated",
        description: "Your payout settings have been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Unable to update your payout settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      toast({
        title: "API Key Copied",
        description: "Your API key has been copied to the clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy API key to clipboard.",
        variant: "destructive"
      });
    }
  };

  // Show loading state while checking authentication
  if (loading || !merchant) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
            <Settings className="mr-3 h-8 w-8 text-primary" />
            Account Settings
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Manage your store profile, payout settings, and preferences.
          </p>
        </div>
      </header>

      {isLoadingData ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg">Loading settings...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Merchant Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Business Profile
              </CardTitle>
              <CardDescription>
                Update your business information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={merchantProfile.businessName}
                  onChange={(e) => setMerchantProfile(prev => ({ ...prev, businessName: e.target.value }))}
                  placeholder="Your business name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="businessDescription">Business Description</Label>
                <Textarea
                  id="businessDescription"
                  value={merchantProfile.businessDescription}
                  onChange={(e) => setMerchantProfile(prev => ({ ...prev, businessDescription: e.target.value }))}
                  placeholder="Describe your business"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={merchantProfile.contactEmail}
                  onChange={(e) => setMerchantProfile(prev => ({ ...prev, contactEmail: e.target.value }))}
                  placeholder="contact@yourbusiness.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  value={merchantProfile.phoneNumber}
                  onChange={(e) => setMerchantProfile(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="businessAddress">Business Address</Label>
                <Textarea
                  id="businessAddress"
                  value={merchantProfile.businessAddress}
                  onChange={(e) => setMerchantProfile(prev => ({ ...prev, businessAddress: e.target.value }))}
                  placeholder="Your business address"
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID (Optional)</Label>
                <Input
                  id="taxId"
                  value={merchantProfile.taxId}
                  onChange={(e) => setMerchantProfile(prev => ({ ...prev, taxId: e.target.value }))}
                  placeholder="Your tax identification number"
                />
              </div>
              
              <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>

          {/* Payout Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="mr-2 h-5 w-5" />
                Payout Settings
              </CardTitle>
              <CardDescription>
                Configure how and when you receive payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="walletAddress">TAIC Wallet Address</Label>
                <div className="flex space-x-2">
                  <Input
                    id="walletAddress"
                    value={payoutSettings.walletAddress}
                    onChange={(e) => setPayoutSettings(prev => ({ ...prev, walletAddress: e.target.value }))}
                    placeholder="0x..."
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyApiKey}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your Fantom network wallet address for receiving TAIC Coin payouts
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payoutSchedule">Payout Schedule</Label>
                <Select 
                  value={payoutSettings.payoutSchedule} 
                  onValueChange={(value: 'DAILY' | 'WEEKLY' | 'MONTHLY') => 
                    setPayoutSettings(prev => ({ ...prev, payoutSchedule: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="minimumPayout">Minimum Payout Amount</Label>
                <div className="flex space-x-2">
                  <Input
                    id="minimumPayout"
                    type="number"
                    min="1"
                    step="0.01"
                    value={payoutSettings.minimumPayoutAmount}
                    onChange={(e) => setPayoutSettings(prev => ({ ...prev, minimumPayoutAmount: parseFloat(e.target.value) || 0 }))}
                  />
                  <div className="flex items-center px-3 border rounded-md bg-muted">
                    <span className="text-sm font-medium">{payoutSettings.currency}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum amount required before automatic payouts are processed
                </p>
              </div>
              
              <Button onClick={handleSavePayoutSettings} disabled={isSaving} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Payout Settings'}
              </Button>
            </CardContent>
          </Card>
          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="mr-2 h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose what notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive general platform updates via email
                  </p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="orderNotifications">Order Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you receive new orders
                  </p>
                </div>
                <Switch
                  id="orderNotifications"
                  checked={notificationSettings.orderNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationSettings(prev => ({ ...prev, orderNotifications: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="payoutNotifications">Payout Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about payout processing and completion
                  </p>
                </div>
                <Switch
                  id="payoutNotifications"
                  checked={notificationSettings.payoutNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationSettings(prev => ({ ...prev, payoutNotifications: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="marketingEmails">Marketing Emails</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive tips, promotions, and platform updates
                  </p>
                </div>
                <Switch
                  id="marketingEmails"
                  checked={notificationSettings.marketingEmails}
                  onCheckedChange={(checked) =>
                    setNotificationSettings(prev => ({ ...prev, marketingEmails: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Security & API
              </CardTitle>
              <CardDescription>
                Manage your account security and API access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="twoFactor">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {securitySettings.twoFactorEnabled ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  )}
                  <Switch
                    id="twoFactor"
                    checked={securitySettings.twoFactorEnabled}
                    onCheckedChange={(checked) =>
                      setSecuritySettings(prev => ({ ...prev, twoFactorEnabled: checked }))
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex space-x-2">
                  <Input
                    type={securitySettings.apiKeyVisible ? "text" : "password"}
                    value={apiKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSecuritySettings(prev => ({ ...prev, apiKeyVisible: !prev.apiKeyVisible }))}
                  >
                    {securitySettings.apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleCopyApiKey}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use this API key to integrate with TAIC's merchant APIs
                </p>
              </div>

              <div className="pt-4">
                <Button variant="destructive" className="w-full">
                  Regenerate API Key
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Warning: Regenerating your API key will invalidate the current key and may break existing integrations.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Back to Dashboard */}
      <div className="mt-12 text-center">
        <Button variant="outline" asChild>
          <Link href="/merchant/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
