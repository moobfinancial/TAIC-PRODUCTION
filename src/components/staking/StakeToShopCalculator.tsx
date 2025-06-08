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

interface StakedData {
  stakedTaicBalance: number;
  // stakedWishlistGoals: StakedWishlistGoal[]; // Example, if you fetch this
}

export function StakeToShopCalculator() {
  const { user, isAuthenticated, isLoading: authLoading, token } = useAuth(); // Updated import
  const { toast } = useToast();

  const [isLoadingStakeData, setIsLoadingStakeData] = useState(true);
  const [stakeData, setStakeData] = useState<StakedData | null>(null);
  const [errorStakeData, setErrorStakeData] = useState<string | null>(null);

  const [wishlistValue, setWishlistValue] = useState<number>(1000); // Example default
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
      // TODO: Replace with actual API call to fetch staking data
      console.log('StakeToShopCalculator: Would fetch staking data with token:', token);
      // Example: fetchUserStakingData(token).then(setStakeData).catch(setErrorStakeData).finally(() => setIsLoadingStakeData(false));
      setTimeout(() => { // Simulate API call
        setStakeData({ stakedTaicBalance: 0 }); // Simulate empty response for now
        setStakeAmount(0); // Set current stake amount from fetched data
        setIsLoadingStakeData(false);
      }, 1000);
    } else if (!isAuthenticated && !authLoading) {
      setStakeData(null);
      setStakeAmount(0);
      setIsLoadingStakeData(false);
      // setErrorStakeData("Please log in to manage staking.");
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
    // TODO: Implement actual API call to stake TAIC tokens
    console.log(`Staking ${additionalStake} TAIC for user ${user?.id} with token ${token}`);
    toast({ title: "Staking (Simulated)", description: `Simulating staking of ${additionalStake} TAIC. In a real app, this would call an API.`});
    // Example: await stakeTokens(token, additionalStake);
    // After successful API call, refresh stakeData and user's taicBalance
    // For now, just a placeholder:
    // setStakeAmount(prev => prev + additionalStake);
    // updateUser({ ...user, taicBalance: availableTaicBalance - additionalStake }); // This needs to be an API call now
    setAdditionalStake(0);
    // Need to re-fetch user balance and stake data from APIs.
    alert("Staking functionality is simulated. API call would be made here.");
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
              disabled={!isAuthenticated || additionalStake <= 0 || additionalStake > availableTaicBalance || authLoading || isLoadingStakeData}
              className="w-full py-3 text-base"
            >
              Stake {additionalStake > 0 ? additionalStake.toLocaleString() : ''} TAIC (Simulated)
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
