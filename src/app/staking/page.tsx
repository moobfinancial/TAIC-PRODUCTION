
'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { ShoppingBag, BotIcon, Sparkles, Gift, TrendingUp, Gem, PiggyBank, Landmark, MinusCircle, PlusCircle, Target, Clock, PartyPopper, ThumbsUp, Info, Calculator, ShieldAlert, Loader2 } from 'lucide-react'; // Added ShieldAlert, Loader2
// Update useAuth import path
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link'; // Import Link for login prompt
import { SIMULATED_APY } from '@/lib/constants';
import { StakeToShopCalculator } from '@/components/staking/StakeToShopCalculator';

const Placeholder = ({ children }: { children: React.ReactNode }) => (
  <span className="text-red-500 font-medium">{children}</span>
);

export default function StakingPage() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  // Use new auth context values. updateUser is removed.
  const { user, isAuthenticated, isLoading: authIsLoading, token, refreshUser } = useAuth();
  const { toast } = useToast();

  // State for general stake/unstake inputs
  const [stakeInputAmount, setStakeInputAmount] = useState<number | string>('');
  // const [unstakeInputAmount, setUnstakeInputAmount] = useState<number | string>(''); // For general unstake by amount - not used with individual stakes

  // State for staking summary
  const [totalStaked, setTotalStaked] = useState<number>(0);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // State for active stakes list
  interface UserStake {
    id: number;
    userId: number;
    amountStaked: number;
    stakeDate: string; // ISO string
    status: 'active' | 'unstaked';
    createdAt: string;
    updatedAt: string;
  }
  const [activeStakes, setActiveStakes] = useState<UserStake[]>([]);
  const [isLoadingActiveStakes, setIsLoadingActiveStakes] = useState(true);
  const [activeStakesError, setActiveStakesError] = useState<string | null>(null);
  const [unstakingStakeId, setUnstakingStakeId] = useState<number | null>(null);
  const [isStakeActionLoading, setIsStakeActionLoading] = useState(false);


  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const fetchStakingSummary = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setIsLoadingSummary(false);
      setTotalStaked(0);
      return;
    }
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      const response = await fetch('/api/user/staking/summary', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch staking summary');
      const data = await response.json();
      setTotalStaked(data.totalStaked || 0);
    } catch (err: any) {
      setSummaryError(err.message);
      toast({ title: "Error fetching staking summary", description: err.message, variant: "destructive" });
    } finally {
      setIsLoadingSummary(false);
    }
  }, [isAuthenticated, token, toast]);

  const fetchActiveStakes = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setIsLoadingActiveStakes(false);
      setActiveStakes([]);
      return;
    }
    setIsLoadingActiveStakes(true);
    setActiveStakesError(null);
    try {
      const response = await fetch('/api/user/staking/stakes', { // New API endpoint
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch active stakes');
      const data: UserStake[] = await response.json();
      setActiveStakes(data || []);
    } catch (err: any) {
      setActiveStakesError(err.message);
      toast({ title: "Error fetching active stakes", description: err.message, variant: "destructive" });
    } finally {
      setIsLoadingActiveStakes(false);
    }
  }, [isAuthenticated, token, toast]);

  useEffect(() => {
    if (!authIsLoading) {
      fetchStakingSummary();
      fetchActiveStakes();
    }
  }, [authIsLoading, isAuthenticated, fetchStakingSummary, fetchActiveStakes]);


  const handleStake = async () => {
    if (!isAuthenticated || !user || !token) {
      toast({ title: "Login Required", description: "Please connect your wallet to stake TAIC.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(String(stakeInputAmount));
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a positive amount to stake.", variant: "destructive" });
      return;
    }
    if (amount > (user.taicBalance || 0)) {
      toast({ title: "Insufficient Balance", description: `You only have ${(user.taicBalance || 0).toLocaleString()} TAIC available.`, variant: "destructive" });
      return;
    }

    setIsStakeActionLoading(true);
    try {
      const response = await fetch('/api/user/staking/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Staking failed');

      toast({ title: "Stake Successful!", description: `New Balance: ${result.newBalance.toLocaleString()} TAIC, Total Staked: ${result.totalStaked.toLocaleString()} TAIC` });
      await refreshUser();
      fetchStakingSummary(); // Re-fetch summary
      fetchActiveStakes();  // Re-fetch active stakes list
      setStakeInputAmount('');
    } catch (err: any) {
      toast({ title: "Staking Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsStakeActionLoading(false);
    }
  };

  const handleUnstakeSingle = async (stakeId: number) => {
    if (!isAuthenticated || !user || !token) {
      toast({ title: "Login Required", description: "Please connect your wallet to unstake.", variant: "destructive" });
      return;
    }
    setUnstakingStakeId(stakeId);
    try {
      const response = await fetch('/api/user/staking/unstake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ stakeId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unstaking failed');

      toast({ title: "Unstake Successful!", description: `Unstaked ${result.unstakedAmount.toLocaleString()} TAIC. New Balance: ${result.newBalance.toLocaleString()}, Total Staked: ${result.totalStaked.toLocaleString()} TAIC` });
      await refreshUser();
      fetchStakingSummary();
      fetchActiveStakes();
    } catch (err: any) {
      toast({ title: "Unstaking Failed", description: err.message, variant: "destructive" });
    } finally {
      setUnstakingStakeId(null);
    }
  };

  const benefits = [
    { 
      icon: <ShoppingBag className="h-6 w-6 text-purple-600" />, 
      title: 'E-commerce Discounts', 
      description: 'Conceptually receive a percentage discount (e.g., stake <Placeholder>[Y Demo TAIC]</Placeholder> for a <Placeholder>[Z]%</Placeholder> discount) on simulated purchases made on the TALKAI247 e-commerce platform.' 
    },
    { 
      icon: <BotIcon className="h-6 w-6 text-purple-600" />, 
      title: 'Reduced AI Service Fees', 
      description: 'Simulate preferential rates or discounts on premium AI voice service subscriptions offered by TALKAI247.' 
    },
    { 
      icon: <Sparkles className="h-6 w-6 text-purple-600" />, 
      title: 'Early Access', 
      description: 'Imagine gaining early access to new illustrative merchant listings, exclusive product drops, or beta features of the AI assistant.' 
    },
    { 
      icon: <Gift className="h-6 w-6 text-purple-600" />, 
      title: '"Stake-to-Shop" for Wishlist', 
      description: 'A key feature! "Stake" Demo TAIC towards specific items on your e-commerce wishlist. Simulated rewards (e.g., additional Demo TAIC or "platform credits") accumulate, showing progress towards "paying off" the item.' 
    },
  ];

  return (
    <>
      <header className="bg-gradient-to-r from-purple-500 to-blue-500 text-white py-16 text-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">TAIC Staking Program</h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-6 opacity-90">
            Earn Rewards with Purpose (MVP Simulation)
          </p>
          <p className="text-md max-w-2xl mx-auto opacity-80">
            Discover how staking Demo TAIC tokens in our MVP simulation can unlock tangible benefits and enhance your experience on the TALKAI247 platform.
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <main>
          <section id="core-principle" className="py-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4 text-center">Our Staking Philosophy: Utility First</h2>
            <p className="text-lg text-gray-600 mb-10 text-center max-w-2xl mx-auto">
              The TAIC staking program, especially for this MVP simulation, is centered around providing <strong>utility-driven rewards</strong>. Instead of focusing solely on high Annual Percentage Yields (APYs) from new token emissions, we believe in rewarding your loyalty and participation with benefits that have real, practical value within the TALKAI247 ecosystem. This approach is designed for long-term sustainability and aims to create a more engaging and beneficial experience for our users.
            </p>
            <div className="text-center mb-8">
              <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs font-medium inline-block">All Staking Interactions are Simulated with Demo TAIC</span>
            </div>
          </section>
          
          <section id="staking-benefits" className="py-12 bg-gray-50 rounded-xl">
            <h2 className="text-4xl font-bold text-gray-800 mb-4 text-center">Staking Benefits</h2>
            <p className="text-lg text-gray-600 mb-10 text-center max-w-2xl mx-auto">By "staking" your Demo TAIC tokens, you can experience how you might unlock the following conceptual benefits:</p>
            <Card className="shadow-xl">
              <CardContent className="p-6 grid md:grid-cols-2 gap-8">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-4 p-4 rounded-lg hover:bg-purple-50 transition-colors duration-200">
                    <div className="flex-shrink-0 mt-1">
                      {benefit.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-purple-700 mb-2">{benefit.title}</h3>
                      <p className="text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: benefit.description.replace(/<Placeholder>\[(.*?)\]<\/Placeholder>/g, '<span class="text-red-500 font-medium">[$1]</span>') }}></p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
          
          <section id="stake-to-shop-explained" className="py-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-10 text-center">Understanding "Stake-to-Shop" (Simulated)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch mb-8">
                <Card className="text-center flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 hover:transform hover:-translate-y-1">
                    <CardContent className="p-6">
                        <div className="text-5xl mb-4 text-purple-500">❤️</div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">1. Discover & Wishlist</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            Browse the illustrative product catalog. Find items you love (e.g., headphones, smart devices) and add them to your personal wishlist on the TAIC platform.
                        </p>
                    </CardContent>
                    <div className="px-6 pb-6 mt-auto">
                        <Image src="https://placehold.co/200x100.png" data-ai-hint="wishlist interface" alt="Wishlist Interface Mockup" width={200} height={100} className="w-full max-w-[200px] mx-auto rounded-md opacity-80" />
                    </div>
                </Card>

                <Card className="text-center flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 hover:transform hover:-translate-y-1">
                    <CardContent className="p-6">
                        <div className="text-5xl mb-4 text-purple-500">🎯</div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">2. Choose Item & Stake Demo TAIC</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            From your user dashboard, select an item from your wishlist. Decide to "Stake-to-Shop" for it and allocate a specific amount of your **Demo TAIC** tokens towards this goal.
                        </p>
                    </CardContent>
                    <div className="px-6 pb-6 mt-auto">
                         <Image src="https://placehold.co/200x100.png" data-ai-hint="staking allocation" alt="Staking Allocation UI Mockup" width={200} height={100} className="w-full max-w-[200px] mx-auto rounded-md opacity-80" />
                    </div>
                </Card>

                 <Card className="text-center flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 hover:transform hover:-translate-y-1">
                    <CardContent className="p-6">
                        <div className="text-5xl mb-4 text-purple-500">📈</div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">3. Accumulate Simulated Rewards</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            Based on your staked Demo TAIC and conceptual platform activity, you&apos;ll see simulated rewards (like bonus Demo TAIC or "platform credits") accrue over time, specifically for your chosen wishlisted item.
                        </p>
                    </CardContent>
                    <div className="px-6 pb-6 mt-auto">
                        <div className="w-full max-w-[220px] mx-auto">
                            <p className="text-xs text-gray-700 mb-1">Progress for "Smart Headphones":</p>
                            <div className="bg-gray-300 rounded-full p-0.5 shadow-inner">
                                <div style={{ width: '60%' }} className="bg-gradient-to-r from-purple-400 to-purple-600 h-5 rounded-full text-center text-white text-xs leading-5 transition-width duration-500 ease-in-out">
                                    60% Funded
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">(Demo TAIC + Simulated Rewards)</p>
                        </div>
                    </div>
                </Card>

                <Card className="text-center flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300 hover:transform hover:-translate-y-1">
                    <CardContent className="p-6">
                        <div className="text-5xl mb-4 text-purple-500">🎁</div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">4. Track Progress & "Redeem" Item</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            Visually track how your staked Demo TAIC and accumulated simulated rewards contribute towards the item's total "cost." Once covered, you can "redeem" it. In the simulation, the item is then considered "purchased."
                        </p>
                    </CardContent>
                    <div className="px-6 pb-6 mt-auto">
                        <Image src="https://placehold.co/200x100.png" data-ai-hint="item redeemed" alt="Item Redeemed UI Mockup" width={200} height={100} className="w-full max-w-[200px] mx-auto rounded-md opacity-80" />
                    </div>
                </Card>
            </div>
             <div className="text-center mt-8 p-4 bg-indigo-100 rounded-lg">
                <p className="text-md text-indigo-700 font-medium">
                    This "Stake-to-Shop" feature provides a clear and engaging goal for staking your Demo TAIC, directly linking your participation to acquiring desired products within the TAIC ecosystem!
                </p>
            </div>
          </section>

          <section id="staking-summary-management" className="py-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-purple-700 flex items-center gap-2">
                  <PiggyBank className="h-7 w-7" /> Your General Staking Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-lg">
                <div>
                  <Label className="text-muted-foreground">Available TAIC Balance</Label>
                  <p className="font-semibold text-primary flex items-center gap-1">
                    <Gem className="h-5 w-5" />
                    {isAuthenticated && user ? `${(user.taicBalance || 0).toLocaleString()} TAIC` : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Currently Staked TAIC (General)</Label>
                  <p className="font-semibold text-green-600 flex items-center gap-1">
                    <Landmark className="h-5 w-5" />
                    {isLoadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : `${totalStaked.toLocaleString()} TAIC`}
                  </p>
                  {summaryError && <p className="text-xs text-destructive">{summaryError}</p>}
                </div>
                <div>
                  <Label className="text-muted-foreground">Estimated Current Rate (APY)</Label>
                  <p className="font-semibold">{(SIMULATED_APY * 100).toFixed(0)}% (Simulated)</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-purple-700 flex items-center gap-2">
                  <TrendingUp className="h-7 w-7" /> Manage Your General Stake
                </CardTitle>
                <CardDescription>This TAIC is staked generally and can contribute to wishlist goals or earn other conceptual benefits.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="stakeAmount" className="text-base">Amount to Stake</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="stakeAmount" // Renamed from stakeAmount to stakeInputAmount for clarity
                      type="number" 
                      placeholder="e.g., 100" 
                      value={stakeInputAmount}
                      onChange={(e) => setStakeInputAmount(e.target.value)}
                      className="text-base flex-grow"
                      disabled={!isAuthenticated || authIsLoading || isStakeActionLoading}
                    />
                    <Button onClick={handleStake} disabled={!isAuthenticated || authIsLoading || isStakeActionLoading || !stakeInputAmount} className="font-semibold">
                      {isStakeActionLoading && !authIsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-5 w-5"/>}
                      Stake
                    </Button>
                  </div>
                </div>
                {/* General Unstake by amount is removed in favor of unstaking specific stakes from the list below */}
                {/* If general unstake by amount is still desired, its handleUnstake would need to pick a stake or use a different API */}

                 { (!isAuthenticated && !authIsLoading) &&
                   <div className="text-center p-4 border-t mt-4">
                     <ShieldAlert className="mx-auto h-10 w-10 text-amber-500 mb-2" />
                     <p className="text-sm text-muted-foreground">
                       Please <Link href="/?action=connectWallet" className="underline hover:text-primary font-medium">connect your wallet</Link> to manage your stake.
                     </p>
                   </div>
                 }
                 { authIsLoading && <p className="text-sm text-muted-foreground text-center">Loading user data...</p>}
              </CardContent>
            </Card>
          </section>

          <section id="stake-to-shop-calculator-section" className="py-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-10 text-center">Generic Goal Time Estimator</h2>
            <StakeToShopCalculator /> {/* Removed context prop as it's now fetched */}
            <p className="text-center text-sm text-muted-foreground mt-4">
                <Info className="inline h-4 w-4 mr-1" />
                Use this calculator to estimate the time to achieve any financial goal based on your total staked TAIC and the simulated APY.
            </p>
          </section>

          {/* Active Stakes List Section */}
          {isAuthenticated && (
            <section id="active-stakes-list" className="py-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 text-center">Your Active Stakes</h2>
              {isLoadingActiveStakes && <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
              {activeStakesError && <p className="text-center text-destructive">{activeStakesError}</p>}
              {!isLoadingActiveStakes && !activeStakesError && activeStakes.length === 0 && (
                <p className="text-center text-muted-foreground">You have no active stakes.</p>
              )}
              {!isLoadingActiveStakes && !activeStakesError && activeStakes.length > 0 && (
                <Card className="shadow-xl">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stake ID</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Staked</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stake Date</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {activeStakes.map(stake => (
                            <tr key={stake.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stake.id}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stake.amountStaked.toLocaleString()} TAIC</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(stake.stakeDate).toLocaleDateString()}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <Button
                                  variant="link"
                                  className="text-red-600 hover:text-red-800 p-0 h-auto"
                                  onClick={() => handleUnstakeSingle(stake.id)}
                                  disabled={unstakingStakeId === stake.id}
                                >
                                  {unstakingStakeId === stake.id ? <Loader2 className="h-4 w-4 animate-spin"/> : "Unstake"}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          <section id="reward-sourcing" className="py-12 bg-gray-50 rounded-xl">
            <h2 className="text-4xl font-bold text-gray-800 mb-4 text-center">Reward Sourcing & APY Philosophy</h2>
            <p className="text-lg text-gray-600 mb-10 text-center max-w-2xl mx-auto">Our approach to rewards is built on transparency and long-term sustainability.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 hover:transform hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-purple-700">Conceptual Reward Sources (for Live Version)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-gray-600 space-y-2 text-sm">
                    <li><strong>Bootstrap Rewards (Initial Phase):</strong> The "Staking Rewards Pool" (funded from the initial TAIC token allocation - <Placeholder>[15]%</Placeholder> of total supply) will provide the initial Demo TAIC (and later, live TAIC) to kickstart benefits for early stakers.</li>
                    <li><strong>Platform Revenue (Long-Term):</strong> The primary source for funding benefits and any future direct yield will be a share of actual platform revenue. This includes revenue from:
                      <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                        <li>AI service subscriptions.</li>
                        <li>E-commerce transaction fees/commissions (from the integrated dropshipping/affiliate model).</li>
                        <li>Potential service fees for the integrated purchasing process.</li>
                      </ul>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 hover:transform hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-purple-700">APY Philosophy (If Direct Yield is Offered Post-MVP)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-gray-600 space-y-2 text-sm">
                    <li><strong>Dynamic & Variable:</strong> Any direct TAIC yield (APY) would directly reflect the platform's revenue performance.</li>
                    <li><strong>No Unsustainable Promises:</strong> TALKAI247 will avoid promising unsustainably high, fixed APYs that rely on continuous new token emissions.</li>
                    <li><strong>Focus on "Real Yield":</strong> Rewards would be backed by genuine economic activity of the platform.</li>
                    <li><strong>Transparency:</strong> Clear communication on how APY is calculated and funded would be paramount.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>

          <section id="how-to-participate" className="py-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4 text-center">How to Participate in Staking (MVP Simulation)</h2>
            <p className="text-lg text-gray-600 mb-10 text-center max-w-2xl mx-auto">Interacting with the TAIC staking program in this MVP simulation is designed to be straightforward.</p>
            <Card className="max-w-xl mx-auto text-center shadow-lg hover:shadow-xl transition-shadow duration-300 hover:transform hover:-translate-y-1">
              <CardContent className="p-6">
                <p className="text-gray-700 mb-4">
                  Within the TALKAI247 platform MVP, you&apos;ll typically find staking options in your <strong>User Dashboard</strong> and on the <strong>Wishlist Page</strong>. Here, you can:
                </p>
                <ul className="list-none space-y-2 text-gray-600 mb-6">
                  <li className="flex items-center justify-center"><span className="text-green-500 mr-2">✔</span> View your Demo TAIC balance.</li>
                  <li className="flex items-center justify-center"><span className="text-green-500 mr-2">✔</span> Perform general Staking/Unstaking.</li>
                  <li className="flex items-center justify-center"><span className="text-green-500 mr-2">✔</span> Access the "Stake-to-Shop" feature on your wishlist page to create and track goals for your wishlist.</li>
                  <li className="flex items-center justify-center"><span className="text-green-500 mr-2">✔</span> See conceptual staking tiers and the benefits they might unlock.</li>
                </ul>
                <p className="text-sm text-gray-500">
                  Remember, all actions are simulated and use Demo TAIC tokens to help you understand the potential of the live platform.
                </p>
              </CardContent>
            </Card>
          </section>

          <section id="management-security" className="py-12 bg-gray-50 rounded-xl">
            <h2 className="text-4xl font-bold text-gray-800 mb-4 text-center">Management & Security (Our Commitment)</h2>
            <p className="text-lg text-gray-600 mb-10 text-center max-w-2xl mx-auto">While this MVP is a simulation, our approach to the live platform prioritizes security and responsible management.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 hover:transform hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-purple-700">Centralized Management by TALKAI247</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">The staking program, reward logic, and revenue allocation will be managed by TALKAI247 to ensure stability, agility, and strategic alignment with the platform's growth.</p>
                </CardContent>
              </Card>
              <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 hover:transform hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-purple-700">Smart Contracts & Audits (For Live Version)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">For the live TAIC token and staking functionalities, secure and independently audited smart contracts will be utilized to handle token deposits, track staked amounts, and manage the distribution of rewards, ensuring transparency and reliability.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section id="mvp-disclaimer" className="py-12">
            <Card className="border-l-4 border-blue-500 bg-blue-50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold !text-blue-700">Important MVP Simulation Notice</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-700 leading-relaxed">
                  Please remember that all features described on this page related to TAIC staking, Demo TAIC token usage, rewards, APY, and benefits are part of an <strong>MVP simulation</strong>.
                  No real financial transactions occur, no real cryptocurrency is staked or earned, and no actual products are purchased or shipped.
                  This showcase is designed to illustrate the potential functionalities and user experience of the future live TALKAI247 platform and TAIC token.
                </p>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>

      <footer className="bg-gray-800 text-white mt-12">
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">© {currentYear} TALKAI247. All rights reserved.</p>
          <p className="mt-4 text-xs text-gray-500 max-w-3xl mx-auto">
            This webpage describes the TAIC Staking Program for MVP simulation purposes. All token interactions are with Demo TAIC.
          </p>
        </div>
      </footer>
    </>
  );
}

