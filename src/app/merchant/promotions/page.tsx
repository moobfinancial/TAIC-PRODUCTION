'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Percent, 
  Gift, 
  TrendingUp, 
  Settings,
  Save,
  Plus,
  Edit,
  Trash2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Promotion interfaces
interface CashbackPromotion {
  id: string;
  productId?: string;
  productName?: string;
  cashbackPercentage: number;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  totalUsed: number;
  totalCost: number;
}

interface GlobalCashbackSettings {
  defaultCashbackPercentage: number;
  maxCashbackPercentage: number;
  isGlobalCashbackEnabled: boolean;
}

export default function MerchantPromotionsPage() {
  const { merchant, isAuthenticated, loading, token } = useMerchantAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [globalSettings, setGlobalSettings] = useState<GlobalCashbackSettings>({
    defaultCashbackPercentage: 2.0,
    maxCashbackPercentage: 10.0,
    isGlobalCashbackEnabled: true
  });
  
  const [promotions, setPromotions] = useState<CashbackPromotion[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/merchant/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load promotions data
  useEffect(() => {
    if (isAuthenticated && token) {
      loadPromotionsData();
    }
  }, [isAuthenticated, token]);

  const loadPromotionsData = async () => {
    setIsLoadingData(true);
    try {
      // TODO: Replace with real API calls
      // For now, using mock data to establish UI patterns
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock promotions data
      setPromotions([
        {
          id: 'promo_001',
          productId: 'prod_123',
          productName: 'Premium Wireless Headphones',
          cashbackPercentage: 5.0,
          isActive: true,
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-03-31T23:59:59Z',
          totalUsed: 15,
          totalCost: 67.50
        },
        {
          id: 'promo_002',
          productId: 'prod_456',
          productName: 'Smart Fitness Watch',
          cashbackPercentage: 3.0,
          isActive: true,
          startDate: '2025-01-01T00:00:00Z',
          totalUsed: 8,
          totalCost: 24.00
        },
        {
          id: 'promo_003',
          cashbackPercentage: 2.0,
          isActive: false,
          startDate: '2024-12-01T00:00:00Z',
          endDate: '2024-12-31T23:59:59Z',
          totalUsed: 45,
          totalCost: 180.00
        }
      ]);
      
    } catch (error) {
      console.error('Error loading promotions data:', error);
      toast({
        title: "Error Loading Promotions",
        description: "Unable to load your promotions data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSaveGlobalSettings = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement real API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Settings Updated",
        description: "Your global cashback settings have been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Unable to update your settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePromotionStatus = async (promotionId: string) => {
    try {
      // TODO: Implement real API call
      setPromotions(prev => prev.map(promo => 
        promo.id === promotionId 
          ? { ...promo, isActive: !promo.isActive }
          : promo
      ));
      
      toast({
        title: "Promotion Updated",
        description: "Promotion status has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Unable to update promotion status. Please try again.",
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
          <p className="mt-4 text-lg">Loading promotions...</p>
        </div>
      </div>
    );
  }

  const totalActiveCashback = promotions
    .filter(p => p.isActive)
    .reduce((sum, p) => sum + p.totalCost, 0);

  const totalPromotions = promotions.length;
  const activePromotions = promotions.filter(p => p.isActive).length;

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
            <BarChart3 className="mr-3 h-8 w-8 text-primary" />
            Cashback & Promotions
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Configure cashback rewards and promotional campaigns for your products.
          </p>
        </div>
        <Button className="mt-4 sm:mt-0">
          <Plus className="mr-2 h-4 w-4" />
          Create Promotion
        </Button>
      </header>

      {isLoadingData ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg">Loading promotions...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Promotions</CardTitle>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activePromotions}</div>
                <p className="text-xs text-muted-foreground">
                  Out of {totalPromotions} total promotions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cashback Cost</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {totalActiveCashback.toFixed(2)} TAIC
                </div>
                <p className="text-xs text-muted-foreground">
                  From active promotions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Cashback Rate</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activePromotions > 0 
                    ? (promotions.filter(p => p.isActive).reduce((sum, p) => sum + p.cashbackPercentage, 0) / activePromotions).toFixed(1)
                    : '0.0'
                  }%
                </div>
                <p className="text-xs text-muted-foreground">
                  Across active promotions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Global Cashback Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                Global Cashback Settings
              </CardTitle>
              <CardDescription>
                Configure default cashback settings for all your products
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="globalCashback">Enable Global Cashback</Label>
                  <p className="text-sm text-muted-foreground">
                    Apply default cashback to all products without specific promotions
                  </p>
                </div>
                <Switch
                  id="globalCashback"
                  checked={globalSettings.isGlobalCashbackEnabled}
                  onCheckedChange={(checked) => 
                    setGlobalSettings(prev => ({ ...prev, isGlobalCashbackEnabled: checked }))
                  }
                />
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultCashback">Default Cashback Percentage</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="defaultCashback"
                      type="number"
                      min="0"
                      max={globalSettings.maxCashbackPercentage}
                      step="0.1"
                      value={globalSettings.defaultCashbackPercentage}
                      onChange={(e) => setGlobalSettings(prev => ({ 
                        ...prev, 
                        defaultCashbackPercentage: parseFloat(e.target.value) || 0 
                      }))}
                    />
                    <div className="flex items-center px-3 border rounded-md bg-muted">
                      <span className="text-sm font-medium">%</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxCashback">Maximum Cashback Percentage</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="maxCashback"
                      type="number"
                      min="0"
                      max="50"
                      step="0.1"
                      value={globalSettings.maxCashbackPercentage}
                      onChange={(e) => setGlobalSettings(prev => ({ 
                        ...prev, 
                        maxCashbackPercentage: parseFloat(e.target.value) || 0 
                      }))}
                    />
                    <div className="flex items-center px-3 border rounded-md bg-muted">
                      <span className="text-sm font-medium">%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button onClick={handleSaveGlobalSettings} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
          {/* Active Promotions List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Gift className="mr-2 h-5 w-5" />
                Your Promotions
              </CardTitle>
              <CardDescription>
                Manage your product-specific cashback promotions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {promotions.length > 0 ? (
                  promotions.map((promotion) => (
                    <div key={promotion.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {promotion.isActive ? (
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          ) : (
                            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">
                              {promotion.productName || 'Global Cashback'}
                            </h4>
                            <Badge variant={promotion.isActive ? "default" : "secondary"}>
                              {promotion.cashbackPercentage}% Cashback
                            </Badge>
                            {!promotion.isActive && (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span>Started: {new Date(promotion.startDate).toLocaleDateString()}</span>
                            {promotion.endDate && (
                              <span className="ml-4">
                                Ends: {new Date(promotion.endDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Used {promotion.totalUsed} times • Cost: {promotion.totalCost.toFixed(2)} TAIC
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={promotion.isActive}
                          onCheckedChange={() => togglePromotionStatus(promotion.id)}
                        />
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gift className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No promotions yet</p>
                    <p className="text-sm">Create your first cashback promotion to attract customers</p>
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Promotion
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tips and Best Practices */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-800">
                <AlertCircle className="mr-2 h-5 w-5" />
                Cashback Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent className="text-blue-700">
              <ul className="space-y-2 text-sm">
                <li>• Higher cashback rates (3-5%) work well for new product launches</li>
                <li>• Consider seasonal promotions during holidays and special events</li>
                <li>• Monitor your cashback costs to maintain healthy profit margins</li>
                <li>• Use time-limited promotions to create urgency</li>
                <li>• Test different cashback rates to find the optimal conversion rate</li>
              </ul>
            </CardContent>
          </Card>
        </>
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
