'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BarChart3, Gem, ShoppingBag, CalendarClock, TrendingUp, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Updated import
import { SIMULATED_APY } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
// Assuming StakedWishlistGoal might be defined in types, if not, it might need to be.
// For now, we'll assume staked balance and goals need to be fetched or are placeholders.

interface StakeToShopCalculatorProps {
  initialTargetValue?: number;
  context?: string; // e.g., 'stakingPage', 'wishlistPage'
}

interface StakedData {
  stakedTaicBalance: number;
  // stakedWishlistGoals: StakedWishlistGoal[]; // Example, if you fetch this
}

export function StakeToShopCalculator({ initialTargetValue, context }: StakeToShopCalculatorProps) {
  const { user, isAuthenticated, isLoading: authLoading, token, refreshUser } = useAuth(); // Added refreshUser
  const { toast } = useToast();

  const [isSubmittingStake, setIsSubmittingStake] = useState(false); // Specific loading for stake action
  const [isLoadingStakeData, setIsLoadingStakeData] = useState(true);
  const [stakeData, setStakeData] = useState<StakedData | null>(null);
  const [errorStakeData, setErrorStakeData] = useState<string | null>(null);

  const [wishlistValue, setWishlistValue] = useState<number>(initialTargetValue && initialTargetValue > 0 ? initialTargetValue : 1000);
  const [stakeAmount, setStakeAmount] = useState<number>(0); // User's current general stake, fetched
  const [additionalStake, setAdditionalStake] = useState<number>(0); // For new staking simulation

  // This will be the user's current TAIC balance from AuthContext
  const availableTaicBalance = useMemo(() => user?.taicBalance || 0, [user]);

  useEffect(() => {
    if (authLoading) {
      setIsLoadingStakeData(true);
      return;
    }
    if (isAuthenticated && token) {
      setIsLoadingStakeData(true);
      setErrorStakeData(null);
      fetch(`/api/user/staking/summary`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      .then(async (response) => {
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch staking summary: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        setStakeData({ stakedTaicBalance: data.totalStaked || 0 });
        setStakeAmount(data.totalStaked || 0);
      })
      .catch(err => {
        setErrorStakeData(err.message || 'Could not load staking data.');
        setStakeData(null); // Clear data on error
        setStakeAmount(0);
      })
      .finally(() => {
        setIsLoadingStakeData(false);
      });
    } else if (!isAuthenticated && !authLoading) {
      setStakeData(null);
      setStakeAmount(0);
      setIsLoadingStakeData(false);
      setErrorStakeData(null); // Not an error if not logged in, clear previous errors
    }
  }, [isAuthenticated, token, authLoading]);

  // Update additionalStake slider if availableTaicBalance changes (e.g. after login)
  useEffect(() => {
    if (additionalStake > availableTaicBalance) {
      setAdditionalStake(availableTaicBalance);
    }
  }, [availableTaicBalance, additionalStake]);


  const totalEffectiveStake = stakeAmount + additionalStake;
  const dailyYieldRate = SIMULATED_APY / 365;
  const dailyYield = totalEffectiveStake * dailyYieldRate;
  const daysToReachWishlist = wishlistValue > 0 && dailyYield > 0 ? Math.ceil(wishlistValue / dailyYield) : Infinity;

  const handleStake = async () => {
    if (!isAuthenticated || !token) {
      toast({ title: "Not Authenticated", description: "Please connect your wallet to stake.", variant: "destructive" });
      return;
    }
    if (additionalStake <= 0) {
      toast({ title: "No Amount to Stake", description: "Please enter an amount to stake.", variant: "destructive" });
      return;
    }
    if (additionalStake > availableTaicBalance) {
      toast({ title: "Insufficient Balance", description: `You only have ${availableTaicBalance.toLocaleString()} TAIC available to stake.`, variant: "destructive" });
      return;
    }

    setIsSubmittingStake(true);
    try {
      const response = await fetch('/api/user/staking/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: additionalStake }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Staking failed: ${response.statusText}`);
      }

      toast({
        title: "Stake Successful!",
        description: `New Balance: ${result.newBalance.toLocaleString()} TAIC, Total Staked: ${result.totalStaked.toLocaleString()} TAIC`
      });

      await refreshUser(); // Refresh user context (taicBalance)
      setStakeAmount(result.totalStaked); // Update displayed total stake
      if(stakeData) setStakeData({ ...stakeData, stakedTaicBalance: result.totalStaked }); // Update stakeData if used elsewhere
      setAdditionalStake(0);

    } catch (error: any) {
      toast({ title: "Staking Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmittingStake(false);
    }
  };

  if (authLoading || isLoadingStakeData) {
    return (
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-headline">
            <BarChart3 className="mr-3 h-7 w-7 text-primary" />
            TAIC Stake-to-Shop Yield Calculator
          </CardTitle>
          <CardDescription>Estimate yields and time to reach your wishlist goals by staking TAIC.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Loader2 className="mx-auto h-12 w-12 text-muted-foreground animate-spin mb-4" />
          <p className="text-muted-foreground">Loading staking data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl font-headline">
          <BarChart3 className="mr-3 h-7 w-7 text-primary" />
          TAIC Stake-to-Shop Yield Calculator
        </CardTitle>
        <CardDescription>Estimate yields and time to reach your wishlist goals by staking TAIC.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isAuthenticated ? (
          <div className="text-center p-6 bg-muted/30 rounded-md">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500 mb-3" />
            <p className="font-medium text-lg">Please Connect Your Wallet</p>
            <p className="text-sm text-muted-foreground">Connect your wallet to use the staking calculator and manage your stakes.</p>
          </div>
        ) : errorStakeData ? (
           <div className="text-center p-6 bg-destructive/10 rounded-md">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
            <p className="font-medium text-lg text-destructive">Error Loading Staking Data</p>
            <p className="text-sm text-destructive/80">{errorStakeData}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <div>
                <Label htmlFor="wishlistValue" className="flex items-center mb-1">
                  <ShoppingBag className="mr-2 h-4 w-4 text-muted-foreground" />
                  Target Wishlist Value (TAIC)
                </Label>
                <Input
                  id="wishlistValue"
                  type="number"
                  value={wishlistValue}
                  onChange={(e) => setWishlistValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="e.g., 1000"
                  className="text-lg"
                />
              </div>
              <div>
                <Label htmlFor="currentStake" className="flex items-center mb-1">
                  <Gem className="mr-2 h-4 w-4 text-muted-foreground" />
                  Your Current General Stake (TAIC)
                </Label>
                <Input
                  id="currentStake"
                  type="number"
                  value={stakeAmount} // This is from fetched stakeData
                  readOnly
                  className="text-lg bg-muted/50 font-semibold"
                />
                 <p className="text-xs text-muted-foreground mt-1">This is your current general staked TAIC. Add more below.</p>
              </div>
            </div>

            <div>
              <Label htmlFor="additionalStake" className="flex items-center mb-1">
                <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
                Additional TAIC to Stake (Max: {availableTaicBalance.toLocaleString()})
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="additionalStake"
                  min={0}
                  max={availableTaicBalance > 0 ? availableTaicBalance : 0} // Ensure max is not negative
                  step={Math.max(1, Math.floor(availableTaicBalance / 100))}
                  value={[additionalStake]}
                  onValueChange={(value) => setAdditionalStake(value[0])}
                  className="flex-grow"
                  disabled={!isAuthenticated || availableTaicBalance === 0}
                />
                <Input
                  type="number"
                  value={additionalStake}
                  onChange={(e) => {
                      const val = Math.max(0, Math.min(availableTaicBalance, parseFloat(e.target.value) || 0));
                      setAdditionalStake(val);
                  }}
                  className="w-32 text-lg"
                  disabled={!isAuthenticated || availableTaicBalance === 0}
                />
              </div>
              {availableTaicBalance === 0 && isAuthenticated && (
                <p className="text-xs text-amber-600 mt-1">Your available TAIC balance is 0. You need TAIC to stake.</p>
              )}
            </div>

            <Card className="bg-muted/30 p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">Total Effective Stake:</span>
                  <span className="font-bold text-xl text-primary flex items-center">
                    <Gem className="mr-1.5 h-5 w-5" /> {totalEffectiveStake.toLocaleString()} TAIC
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">Simulated Daily Yield (APY: {SIMULATED_APY * 100}%):</span>
                  <span className="font-semibold text-lg text-green-600">~{dailyYield.toFixed(2)} TAIC</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground flex items-center">
                    <CalendarClock className="mr-1.5 h-4 w-4" />
                    Days to Reach Wishlist Value:
                  </span>
                  <span className="font-semibold text-lg text-indigo-600">
                    {isFinite(daysToReachWishlist) ? `${daysToReachWishlist} days` : (wishlistValue > 0 ? 'Never (stake more or reduce wishlist)' : 'N/A')}
                  </span>
                </div>
              </div>
            </Card>

            <Button
              onClick={handleStake}
              disabled={!isAuthenticated || additionalStake <= 0 || additionalStake > availableTaicBalance || authLoading || isLoadingStakeData || isSubmittingStake}
              className="w-full py-3 text-base"
            >
              {isSubmittingStake ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Stake {additionalStake > 0 ? additionalStake.toLocaleString() : ''} TAIC
            </Button>

            <div className="text-xs text-muted-foreground p-3 bg-background rounded-md border flex items-start">
              <Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>
                This calculator provides simulated estimates based on a {SIMULATED_APY * 100}% APY. Actual rewards may vary. Staking involves risks.
                Your TAIC balance: {user?.taicBalance?.toLocaleString() ?? 'N/A'} TAIC.
                Staked TAIC functionality will interact with backend services.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
