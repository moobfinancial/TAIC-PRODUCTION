
'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useMemo } from 'react';
import { ShoppingBag, BotIcon, Sparkles, Gift, TrendingUp, Gem, PiggyBank, Landmark, MinusCircle, PlusCircle, Target, Clock, PartyPopper, ThumbsUp, Info, Calculator } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SIMULATED_APY } from '@/lib/constants';
import { StakeToShopCalculator } from '@/components/staking/StakeToShopCalculator';

const Placeholder = ({ children }: { children: React.ReactNode }) => (
  <span className="text-red-500 font-medium">{children}</span>
);

export default function StakingPage() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [stakeAmount, setStakeAmount] = useState<number | string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<number | string>('');

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const handleStake = () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please login to stake TAIC.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(String(stakeAmount));
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a positive amount to stake.", variant: "destructive" });
      return;
    }
    if (amount > (user.taicBalance || 0)) {
      toast({ title: "Insufficient Balance", description: `You only have ${user.taicBalance || 0} TAIC available.`, variant: "destructive" });
      return;
    }

    updateUser({
      ...user,
      taicBalance: (user.taicBalance || 0) - amount,
      stakedTaicBalance: (user.stakedTaicBalance || 0) + amount,
    });
    toast({ title: "Stake Successful!", description: `${amount} TAIC staked.` });
    setStakeAmount('');
  };

  const handleUnstake = () => {
    if (!user) {
      toast({ title: "Login Required", description: "Please login to unstake TAIC.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(String(unstakeAmount));
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a positive amount to unstake.", variant: "destructive" });
      return;
    }
    if (amount > (user.stakedTaicBalance || 0)) {
      toast({ title: "Insufficient Staked Balance", description: `You only have ${user.stakedTaicBalance || 0} TAIC staked.`, variant: "destructive" });
      return;
    }
    updateUser({
      ...user,
      taicBalance: (user.taicBalance || 0) + amount,
      stakedTaicBalance: (user.stakedTaicBalance || 0) - amount,
    });
    toast({ title: "Unstake Successful!", description: `${amount} TAIC unstaked.` });
    setUnstakeAmount('');
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
                    <Gem className="h-5 w-5" /> {user && typeof user.taicBalance === 'number' ? user.taicBalance.toLocaleString() : (user ? '0' : 'N/A')} TAIC
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Currently Staked TAIC (General)</Label>
                  <p className="font-semibold text-green-600 flex items-center gap-1">
                    <Landmark className="h-5 w-5" /> {user && typeof user.stakedTaicBalance === 'number' ? user.stakedTaicBalance.toLocaleString() : (user ? '0' : 'N/A')} TAIC
                  </p>
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
                      id="stakeAmount" 
                      type="number" 
                      placeholder="e.g., 100" 
                      value={stakeAmount} 
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="text-base flex-grow"
                      disabled={!user}
                    />
                    <Button onClick={handleStake} disabled={!user || !stakeAmount} className="font-semibold">
                      <PlusCircle className="mr-2 h-5 w-5"/>Stake
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unstakeAmount" className="text-base">Amount to Unstake</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="unstakeAmount" 
                      type="number" 
                      placeholder="e.g., 50" 
                      value={unstakeAmount} 
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                      className="text-base flex-grow"
                      disabled={!user}
                    />
                    <Button onClick={handleUnstake} disabled={!user || !unstakeAmount} variant="outline" className="font-semibold">
                      <MinusCircle className="mr-2 h-5 w-5"/>Unstake
                    </Button>
                  </div>
                </div>
                 { !user && <p className="text-sm text-muted-foreground text-center">Please <a href="/login" className="underline hover:text-primary">login</a> to manage your stake.</p>}
              </CardContent>
            </Card>
          </section>

          <section id="stake-to-shop-calculator-section" className="py-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-10 text-center">Generic Goal Time Estimator</h2>
            <StakeToShopCalculator context="stakingPage" />
            <p className="text-center text-sm text-muted-foreground mt-4">
                <Info className="inline h-4 w-4 mr-1" />
                Use this calculator to estimate the time to achieve any financial goal based on a principal amount and the simulated APY.
            </p>
          </section>

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

