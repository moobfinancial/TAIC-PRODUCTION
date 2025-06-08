
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useWishlist } from '@/hooks/useWishlist'; // Assuming useWishlist is self-contained or will be updated separately
// Update useAuth import path
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Heart, Gem, ShoppingBag, Info, Target, PlusCircle, Clock, PartyPopper, ThumbsUp, ShieldAlert } from 'lucide-react'; // Added ShieldAlert
// StakedWishlistGoal might need to be sourced differently if not on user object
import type { WishlistItem, StakedWishlistGoal as StakedWishlistGoalType } from '@/lib/types';
import { StakeToShopCalculator } from '@/components/staking/StakeToShopCalculator';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { SIMULATED_APY } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { translateText, containsChineseCharacters } from '@/lib/translationUtils';

// Helper function to format time remaining
const formatTimeRemaining = (maturityDateISO: string): string => {
  const now = new Date().getTime();
  const maturityTime = new Date(maturityDateISO).getTime();
  const diff = maturityTime - now;

  if (diff <= 0) {
    return "Goal Achieved!";
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  let remainingString = "";
  if (days > 0) remainingString += `${days}d `;
  if (hours > 0) remainingString += `${hours}h `;
  if (minutes > 0 && days === 0) remainingString += `${minutes}m `;
  if (remainingString === "") remainingString = "Less than a minute";
  
  return remainingString.trim() + " left";
};

export default function WishlistPage() {
  const { wishlistItems, removeFromWishlist, getWishlistTotalValue, getWishlistItemCount, clearWishlist } = useWishlist();
  // Use new auth context values. updateUser is removed.
  const { user, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();
  
  const currentWishlistTotal = useMemo(() => getWishlistTotalValue(), [getWishlistTotalValue]);

  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalPrincipal, setNewGoalPrincipal] = useState<number | string>('');
  const [processedWishlistItems, setProcessedWishlistItems] = useState<WishlistItem[]>([]);
  // Local state for staked goals, as they are no longer on the main user auth object
  const [localStakedGoals, setLocalStakedGoals] = useState<StakedWishlistGoalType[]>([]);

  // For time remaining display update
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prevTick => prevTick + 1);
    }, 60000); // Update time remaining every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const processItems = async () => {
      if (wishlistItems && wishlistItems.length > 0) {
        const processedItems = await Promise.all(
          wishlistItems.map(async (item) => {
            let nameToProcess = item.name;
            const cjPrefix = "Imported from CJ: ";
            const prefixIndex = nameToProcess.indexOf(cjPrefix);

            if (prefixIndex !== -1) {
              // If "Imported from CJ: " is present, take the part before it as the primary name.
              // This handles cases like "Name Imported from CJ: Name" or "Name Imported from CJ: Description"
              nameToProcess = nameToProcess.substring(0, prefixIndex).trim();
            }
            // If the name still seems to be a duplicate (e.g. Name Name after prefix removal), 
            // and it's long, consider if it's structured like "ActualName Description"
            // For now, we assume the text before "Imported from CJ:" (or the whole string if no prefix) is the target for translation.

            let finalName = nameToProcess;
            if (containsChineseCharacters(nameToProcess)) {
              finalName = await translateText(nameToProcess);
            }
            return { ...item, name: finalName };
          })
        );
        setProcessedWishlistItems(processedItems);
      } else {
        setProcessedWishlistItems([]);
      }
    };

    processItems();
  }, [wishlistItems]);

  const handleClearWishlist = () => {
    if (getWishlistItemCount() > 0) {
      clearWishlist();
    } else {
      toast({ title: "Wishlist is already empty", variant: "default"});
    }
  };

  const handleCreateStakedGoal = async () => {
    if (!isAuthenticated || !user) {
      toast({ title: "Login Required", description: "Please connect your wallet to create a staked goal.", variant: "destructive" });
      return;
    }
    if (!newGoalName.trim()) {
      toast({ title: "Goal Name Required", variant: "destructive" });
      return;
    }
    const principal = parseFloat(String(newGoalPrincipal));
    if (isNaN(principal) || principal <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a positive amount to dedicate.", variant: "destructive" });
      return;
    }
    if (principal > (user.taicBalance || 0)) {
      toast({ title: "Insufficient TAIC Balance", description: `You only have ${user.taicBalance || 0} TAIC to dedicate.`, variant: "destructive" });
      return;
    }
    if (currentWishlistTotal <= 0) {
        toast({ title: "No Wishlist Value", description: "Your current wishlist is empty or has no value. Add items to create a staked goal for it.", variant: "destructive" });
        return;
    }

    // TODO: API Call to backend to create staked goal, update balances
    // POST /api/staking/goals { name, principal, targetValue (currentWishlistTotal) }
    // This API would debit user.taicBalance and create/update staking records.
    // On success, it might return the new goal or updated user staking info.
    // AuthContext user might need refresh for taicBalance.

    console.log(`Simulating creation of staked goal "${newGoalName}" with principal ${principal} for user ${user.id}`);

    // For UI feedback (simulation only, not durable):
    const targetValue = currentWishlistTotal;
    const startDate = new Date();
    let estimatedMaturityDate = new Date();
    const amountToEarnViaRewards = targetValue - principal;
    if (amountToEarnViaRewards <= 0) { 
        estimatedMaturityDate = startDate;
    } else {
        const annualRewardsFromPrincipal = principal * SIMULATED_APY;
        const monthlyRewardsFromPrincipal = annualRewardsFromPrincipal / 12;
        if (monthlyRewardsFromPrincipal > 0) {
            const monthsToGoal = amountToEarnViaRewards / monthlyRewardsFromPrincipal;
            estimatedMaturityDate.setMonth(startDate.getMonth() + Math.ceil(monthsToGoal));
        } else {
            // Cannot estimate if no rewards from principal, effectively infinite time
            // This case should be handled by UI or prevented if APY is zero and principal < target
            console.warn("Cannot estimate maturity date with zero monthly rewards from principal.");
        }
    }
    const newGoalSimulated: StakedWishlistGoalType = {
      id: Date.now().toString(), name: newGoalName, targetValue, principalStakedForGoal: principal,
      startDate: startDate.toISOString(), estimatedMaturityDate: estimatedMaturityDate.toISOString(),
    };
    setLocalStakedGoals(prev => [...prev, newGoalSimulated]);
    // user.taicBalance will be stale in AuthContext.

    toast({ title: "Staked Goal Action (Simulated)", description: `Goal "${newGoalName}" for ${targetValue} TAIC would be created. Backend integration needed.` });
    setNewGoalName('');
    setNewGoalPrincipal('');
  };

  if (authIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  // If not authenticated, show a generic empty wishlist/goals state or login prompt
  if (!isAuthenticated) {
    return (
      <div className="text-center py-20">
        <Heart className="mx-auto h-24 w-24 text-muted-foreground mb-6" />
        <h1 className="text-3xl font-headline font-semibold mb-4">Your Wishlist & Goals</h1>
        <p className="text-muted-foreground mb-8">Connect your wallet to manage your wishlist and staked goals.</p>
        {/* WalletConnectButton in Navbar is the primary way */}
        <Button asChild size="lg" variant="outline">
          <Link href="/">Explore Products</Link>
        </Button>
      </div>
    );
  }

  // User is authenticated, but might have empty wishlist and no local (simulated) goals
  if (processedWishlistItems.length === 0 && localStakedGoals.length === 0) {
    return (
      <div className="text-center py-20">
        <Heart className="mx-auto h-24 w-24 text-muted-foreground mb-6" />
        <h1 className="text-3xl font-headline font-semibold mb-4">Your Wishlist & Goals are Empty</h1>
        <p className="text-muted-foreground mb-8">Add products to your wishlist to start "Stake-to-Shop" goals!</p>
        <Button asChild size="lg">
          <Link href="/products">Explore Products</Link>
        </Button>
      </div>
    );
  }
  // Render content for authenticated user
  return (
    <div className="space-y-12">
      {/* Header remains the same, uses getWishlistItemCount for original count if needed */}
      <header className="text-center space-y-2">
        <Heart className="mx-auto h-16 w-16 text-primary" />
        <h1 className="text-4xl font-headline font-bold tracking-tight sm:text-5xl">My Wishlist</h1>
        {getWishlistItemCount() > 0 && (
            <p className="text-lg text-muted-foreground">
            Current Wishlist Total Value: 
            <span className="font-semibold text-primary ml-1 flex items-center justify-center">
                <Gem className="mr-1 h-5 w-5" />{currentWishlistTotal.toLocaleString()} TAIC
            </span>
            </p>
        )}
      </header>
      
      {getWishlistItemCount() > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
            {processedWishlistItems.map((item: WishlistItem) => (
                <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg shadow bg-card">
                <Image 
                    src={item.imageUrl} 
                    alt={item.name} 
                    width={100} 
                    height={100} 
                    className="rounded-md aspect-square object-cover"
                    data-ai-hint={item.dataAiHint}
                />
                <div className="flex-grow">
                    <Link href={`/products/${item.id}`} className="hover:underline">
                    <h2 className="text-lg font-semibold font-headline">{item.name}</h2>
                    </Link>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                    <p className="text-md font-semibold text-primary flex items-center mt-1">
                    <Gem className="mr-1 h-4 w-4" /> {item.price.toLocaleString()} TAIC
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeFromWishlist(item.id)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="h-5 w-5" />
                    <span className="sr-only">Remove from wishlist</span>
                </Button>
                </div>
            ))}
            </div>

            <div className="lg:col-span-1 space-y-6 p-6 border rounded-lg shadow bg-card h-fit sticky top-24">
            <h2 className="text-2xl font-headline font-semibold border-b pb-3">Wishlist Summary</h2>
            <div className="space-y-3">
                <div className="flex justify-between text-md">
                <span>Total Items</span>
                <span className="font-semibold">{getWishlistItemCount()}</span>
                </div>
                <div className="border-t pt-3 mt-3 flex justify-between text-xl font-bold text-primary">
                <span>Total Value</span>
                <span className="flex items-center"><Gem className="mr-1 h-5 w-5" /> {currentWishlistTotal.toLocaleString()} TAIC</span>
                </div>
            </div>
            {/* "Go to Staking" button removed as staking action for wishlist is now on this page */}
            <Button variant="outline" onClick={handleClearWishlist} className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50">
                Clear Current Wishlist
            </Button>
            <Button variant="outline" className="w-full" asChild>
                <Link href="/products">Continue Shopping</Link>
            </Button>
            </div>
        </div>
      )}
      
      {/* Staked goal creation section - only if authenticated */}
      {isAuthenticated && user && (
        <section id="create-staked-goal" className="py-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Stake for Current Wishlist</h2>
            {currentWishlistTotal > 0 ? (
                <Card className="max-w-2xl mx-auto shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-semibold text-purple-700 flex items-center gap-2">
                            <Target className="h-7 w-7" /> Create Goal for Current Wishlist
                        </CardTitle>
                        <CardDescription>
                            Dedicate TAIC from your balance to work towards acquiring the items in your current wishlist.
                            Your current wishlist total is <Gem className="inline h-4 w-4 text-primary/70"/> {currentWishlistTotal.toLocaleString()} TAIC.
                            Your available TAIC balance: <Gem className="inline h-4 w-4 text-primary/70"/> {(user.taicBalance || 0).toLocaleString()} TAIC.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="newGoalName" className="text-base">Goal Name</Label>
                            <Input 
                                id="newGoalName" 
                                type="text" 
                                placeholder="e.g., My Awesome Gadgets Fund" 
                                value={newGoalName} 
                                onChange={(e) => setNewGoalName(e.target.value)}
                                className="text-base"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newGoalPrincipal" className="text-base">Amount to Dedicate (from TAIC Balance)</Label>
                            <Input 
                                id="newGoalPrincipal" 
                                type="number" 
                                placeholder={`Max ${(user.taicBalance || 0).toLocaleString()} TAIC`}
                                value={newGoalPrincipal} 
                                onChange={(e) => setNewGoalPrincipal(e.target.value)}
                                className="text-base"
                                max={(user.taicBalance || 0)}
                            />
                        </div>
                        <Button onClick={handleCreateStakedGoal} className="w-full font-semibold" disabled={!newGoalName || !newGoalPrincipal}>
                            <PlusCircle className="mr-2 h-5 w-5" /> Create & Stake Goal (Simulated)
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card className="text-center py-10 shadow-md">
                    <CardContent>
                        <Info className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-lg text-muted-foreground">Add items to your wishlist to create a staked goal for them.</p>
                    </CardContent>
                </Card>
            )}
        </section>
      )}

      {/* Display localStakedGoals for authenticated users */}
      {isAuthenticated && localStakedGoals.length > 0 && (
          <section id="my-staked-goals" className="py-8">
             <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-10 text-center">My Staked Wishlist Goals (Simulated)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {localStakedGoals.map(goal => {
                        const startDate = new Date(goal.startDate);
                        const maturityDate = new Date(goal.estimatedMaturityDate);
                        const isMature = new Date() >= maturityDate;
                        
                        let progress = 0;
                        if (maturityDate.getTime() > startDate.getTime()) {
                            progress = isMature ? 100 : Math.min(100, ((new Date().getTime() - startDate.getTime()) / (maturityDate.getTime() - startDate.getTime())) * 100);
                        } else if (maturityDate.getTime() <= startDate.getTime()) {
                            progress = 100;
                        }
                        
                        return (
                            <Card key={goal.id} className={cn("shadow-lg", isMature && progress >= 100 && "border-green-500 bg-green-50/50")}>
                                <CardHeader>
                                    <CardTitle className={cn("text-xl font-semibold flex items-center justify-between", isMature && progress >=100 ? "text-green-700" : "text-purple-700")}>
                                        <span>{goal.name}</span>
                                        {isMature && progress >= 100 && <PartyPopper className="h-6 w-6 text-green-600"/>}
                                    </CardTitle>
                                    <CardDescription>Target: <Gem className="inline h-4 w-4 text-primary/70"/> {goal.targetValue.toLocaleString()} TAIC</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-sm">Principal Staked: <Gem className="inline h-4 w-4 text-primary/70"/> {goal.principalStakedForGoal.toLocaleString()} TAIC</p>
                                    <p className="text-xs text-muted-foreground">Started: {startDate.toLocaleDateString()}</p>
                                    <p className="text-xs text-muted-foreground">Est. Maturity: {maturityDate.toLocaleDateString()}</p>
                                    
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>Progress</span>
                                            <span className={cn(isMature && progress >= 100 ? "text-green-600 font-semibold" : "text-muted-foreground")}>
                                                {isMature && progress >= 100 ? "Goal Achieved!" : `${Math.round(progress)}%`}
                                            </span>
                                        </div>
                                        <Progress value={progress} className={cn(isMature && progress >= 100 && "[&>div]:bg-green-500")} />
                                    </div>
                                    {!(isMature && progress >= 100) && (
                                        <p className="text-xs text-blue-600 flex items-center gap-1"><Clock className="h-3 w-3"/> Time Remaining: {formatTimeRemaining(goal.estimatedMaturityDate)}</p>
                                    )}
                                     {isMature && progress >= 100 && (
                                        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 mt-2" onClick={() => toast({title: "Goal Achieved!", description: `Congratulations on reaching your goal: ${goal.name}!`})}>
                                            <ThumbsUp className="mr-2 h-4 w-4"/> Claim/View (Simulated)
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
          </section>
      )}

      {/* Calculator section - only if authenticated */}
      {isAuthenticated && user && (
         <section id="wishlist-calculator-section" className="py-8">
             <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Wishlist Goal Estimator</h2>
            <StakeToShopCalculator 
                initialTargetValue={currentWishlistTotal > 0 ? currentWishlistTotal : undefined} 
                context="wishlistPage" 
            />
            <p className="text-center text-sm text-muted-foreground mt-4">
                <Info className="inline h-4 w-4 mr-1" />
                This calculator helps estimate the time to achieve your current wishlist total (or any target value) based on your total staked TAIC and the simulated APY.
            </p>
        </section>
      )}
    </div>
  );
}

