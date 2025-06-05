
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Gem, TrendingUp, PlusCircle, Calculator, Landmark } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SIMULATED_APY } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface StakeToShopCalculatorProps {
  initialTargetValue?: number;
  context?: 'stakingPage' | 'wishlistPage';
}

export function StakeToShopCalculator({ initialTargetValue = 0, context = 'stakingPage' }: StakeToShopCalculatorProps) {
  const { user } = useAuth();
  const [targetValueForCalc, setTargetValueForCalc] = useState<number | string>('');
  const [additionalStakeForCalc, setAdditionalStakeForCalc] = useState<number | string>('');
  const [estimatedTime, setEstimatedTime] = useState<string>('');

  useEffect(() => {
    setTargetValueForCalc(initialTargetValue > 0 ? initialTargetValue : '');
  }, [initialTargetValue]);

  const actualCurrentGeneralStake = useMemo(() => user?.stakedTaicBalance || 0, [user?.stakedTaicBalance]);

  useEffect(() => {
    const targetValue = parseFloat(String(targetValueForCalc));
    const additionalPrincipal = parseFloat(String(additionalStakeForCalc)) || 0;

    if (!user && context === 'stakingPage') {
        setEstimatedTime('Login to use the calculator with your balances.');
        return;
    }
    if (isNaN(targetValue) || targetValue <= 0) {
      setEstimatedTime('Enter a target value to calculate.');
      return;
    }

    const principalForCalc = context === 'stakingPage' ? additionalPrincipal : actualCurrentGeneralStake + additionalPrincipal;
    
    if (principalForCalc <= 0 && context === 'stakingPage') {
        setEstimatedTime('Enter an amount to dedicate to this goal.');
        return;
    }
     if (principalForCalc < 0) {
        setEstimatedTime("Staked amount for calculation can't be negative.");
        return;
    }


    // For the wishlist page, we consider the user's *entire* staked balance + any additional hypothetical stake.
    // For the staking page (when creating a new goal), the `additionalPrincipal` is the *new* principal for *that specific goal*.
    // The rewards calculation for a *new specific goal* should only be based on the principal dedicated *to that goal*.
    // General staking APY is separate. This calculator estimates time to *earn the difference* via dedicated staking.

    let amountToEarn = targetValue - (context === 'stakingPage' ? 0 : principalForCalc); 
    // If on staking page, we are calculating how long to earn the full targetValue with new principal.
    // If on wishlist page, we check if current stake + additional already covers it.
    
    if (context === 'wishlistPage' && targetValue <= principalForCalc) {
      setEstimatedTime('Goal already reached or exceeded with current/additional stake!');
      return;
    }
     if (context === 'stakingPage') { // For new goal on staking page
        amountToEarn = targetValue; // We need to earn the full target with the new dedicated principal.
        if (principalForCalc <=0) {
             setEstimatedTime('Enter an amount to dedicate to this goal.');
             return;
        }
    }


    const annualRewardsFromPrincipal = principalForCalc * SIMULATED_APY;
    const monthlyRewardsFromPrincipal = annualRewardsFromPrincipal / 12;

    if (monthlyRewardsFromPrincipal <= 0) {
      setEstimatedTime(context === 'stakingPage' ? 'Stake some TAIC for this goal to estimate.' : 'Stake some TAIC (or add to calculation) to start earning rewards.');
      return;
    }
    
    const monthsToGoal = amountToEarn / monthlyRewardsFromPrincipal;

    if (monthsToGoal > 0 && monthsToGoal !== Infinity) {
      if (monthsToGoal < 1) {
        setEstimatedTime('Less than 1 month to reach your goal!');
      } else if (monthsToGoal > 1200) { // Cap at 100 years
        setEstimatedTime('Over 100 years. Consider dedicating more or a smaller goal!');
      } else {
        const years = Math.floor(monthsToGoal / 12);
        const remainingMonths = Math.ceil(monthsToGoal % 12);
        let timeString = '';
        if (years > 0) timeString += `${years} year${years > 1 ? 's' : ''}`;
        if (remainingMonths > 0) {
          if (timeString) timeString += ', ';
          timeString += `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
        }
        setEstimatedTime(`Approximately ${timeString || '0 months'} to reach your goal with this dedicated stake.`);
      }
    } else if (context === 'stakingPage' && targetValue <=0) {
        setEstimatedTime('Enter a valid target value.');
    }
     else if (amountToEarn <= 0 && context === 'stakingPage'){
        setEstimatedTime('This specific stake would achieve the goal instantly (or already has).');
    }
    else {
      setEstimatedTime('Calculation resulted in an invalid timeframe. Check inputs.');
    }

  }, [targetValueForCalc, actualCurrentGeneralStake, additionalStakeForCalc, user, context]);

  return (
    <Card className="max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-center text-purple-700 flex items-center justify-center gap-2">
          <Calculator className="h-7 w-7" /> {context === 'stakingPage' ? 'New Goal Time Estimator' : 'Wishlist Goal Estimator'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <Label htmlFor="targetValueForCalc" className="text-base flex items-center gap-1">
            <Gem className="h-4 w-4 text-primary" /> Target {context === 'stakingPage' ? 'Goal' : 'Wishlist'} Value (Demo TAIC)
          </Label>
          <Input
            id="targetValueForCalc"
            type="number"
            placeholder="e.g., 10000"
            value={targetValueForCalc}
            onChange={(e) => setTargetValueForCalc(e.target.value)}
            className="text-base"
            disabled={context === 'stakingPage' && initialTargetValue > 0}
          />
          {context === 'wishlistPage' && !user && <p className="text-xs text-muted-foreground mt-1">Add items to your <a href="/wishlist" className="underline hover:text-primary">wishlist</a>, or enter a target value.</p>}
        </div>

        {context === 'wishlistPage' && (
          <>
            <div className="space-y-2">
              <Label className="text-base flex items-center gap-1"><TrendingUp className="h-4 w-4 text-green-600" />Your Current Total Staked TAIC</Label>
              <p className={cn("font-semibold text-green-600 flex items-center gap-1 text-lg p-2 bg-green-50 border border-green-200 rounded-md", !user && "text-muted-foreground bg-gray-50 border-gray-200")}>
                <Landmark className="h-5 w-5" /> {user ? actualCurrentGeneralStake.toLocaleString() : 'Login to see'} TAIC
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalStakeForCalcWishlist" className="text-base flex items-center gap-1"><PlusCircle className="h-4 w-4 text-blue-600" />Additional TAIC for Calculation (Optional)</Label>
              <Input
                id="additionalStakeForCalcWishlist"
                type="number"
                placeholder="e.g., 500 (for projection only)"
                value={additionalStakeForCalc}
                onChange={(e) => setAdditionalStakeForCalc(e.target.value)}
                className="text-base"
                disabled={!user}
              />
            </div>
          </>
        )}

        {context === 'stakingPage' && (
             <div className="space-y-2">
              <Label htmlFor="principalForNewGoal" className="text-base flex items-center gap-1"><PlusCircle className="h-4 w-4 text-blue-600" />Principal for this New Goal</Label>
              <Input
                id="principalForNewGoal"
                type="number"
                placeholder="e.g., 1000 TAIC"
                value={additionalStakeForCalc} // Using this state for the principal of the new goal
                onChange={(e) => setAdditionalStakeForCalc(e.target.value)}
                className="text-base"
                disabled={!user}
              />
            </div>
        )}

        <div className="text-center p-4 bg-indigo-50 rounded-md">
          <p className="text-sm text-indigo-700">
            Estimated Current Rate (APY): <strong className="font-semibold">{(SIMULATED_APY * 100).toFixed(0)}%</strong> (Simulated)
          </p>
        </div>
        {estimatedTime && (
          <div className="text-center p-4 bg-green-50 rounded-md border border-green-200">
            <p className="text-lg font-semibold text-green-700">Estimated Time to Earn Difference:</p>
            <p className="text-xl font-bold text-green-600">{estimatedTime}</p>
          </div>
        )}
        {!user && context === 'wishlistPage' && <p className="text-sm text-muted-foreground text-center mt-4">Please <a href="/login" className="underline hover:text-primary">login</a> to use the calculator with your balances.</p>}
      </CardContent>
    </Card>
  );
}
