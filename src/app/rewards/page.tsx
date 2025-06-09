import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TAIC Rewards Program | Earn More with Every Purchase',
  description: 'Discover the TAIC cashback and rewards program. Learn how to earn TAIC coins, enhance rewards through staking, and climb loyalty tiers for exclusive benefits.',
};

interface LoyaltyTier {
  name: string;
  icon: string;
  description: string;
  benefits: string[];
  requirement: string;
}

export default function RewardsProgramPage() {
  const loyaltyTiers: LoyaltyTier[] = [
    {
      name: 'Bronze Member',
      icon: '🥉',
      description: 'Start earning TAIC coin cashback on all eligible purchases as soon as you join.',
      benefits: ['Standard TAIC coin cashback rate', 'Access to member-only deals'],
      requirement: 'Just sign up!',
    },
    {
      name: 'Silver Member',
      icon: '🥈',
      description: 'Unlock enhanced cashback rates and early access to sales by staking TAIC coins or reaching a spending threshold.',
      benefits: ['Increased TAIC coin cashback', 'Early access to sales events', 'Bonus TAIC coin on select promotions'],
      requirement: 'Stake 1,000 TAIC or spend $500',
    },
    {
      name: 'Gold Member',
      icon: '🥇',
      description: 'Enjoy premium benefits, the highest cashback rates, and dedicated support as a Gold tier member.',
      benefits: ['Highest TAIC coin cashback rates', 'Priority customer support', 'Exclusive Gold-tier promotions', 'Birthday rewards'],
      requirement: 'Stake 5,000 TAIC or spend $2,000',
    },
    // Add more tiers if planned, e.g., Platinum, Diamond
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <header className="text-center mb-16">
        <h1 className="text-4xl font-bold text-purple-600 mb-4">TAIC Cashback & Rewards Program</h1>
        <p className="text-xl text-muted-foreground">
          Get the most out of your shopping. Earn rewards, unlock benefits, and enjoy an enhanced experience.
        </p>
      </header>

      <section className="mb-12 p-8 bg-purple-50 rounded-lg">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">How to Earn TAIC Coin Cashback</h2>
        <div className="text-gray-700 leading-relaxed space-y-4 md:text-lg">
          <p>
            <span className="font-semibold">1. Shop:</span> Simply browse our marketplace and purchase products from participating merchants. Look for the TAIC cashback badge!
          </p>
          <p>
            <span className="font-semibold">2. Earn:</span> For every eligible purchase, a percentage of your spending is automatically credited to your account as TAIC coins. The more you shop, the more you earn.
          </p>
          <p>
            <span className="font-semibold">3. Use Your Coins:</span> Your earned TAIC coins can be used for discounts on future purchases, staked to earn even more rewards, or potentially traded (subject to exchange listings).
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-3xl font-semibold text-gray-800 mb-8 text-center">Enhance Your Rewards with Staking</h2>
        <div className="p-8 bg-white shadow-xl rounded-lg">
          <p className="text-gray-700 leading-relaxed md:text-lg mb-4">
            Want to boost your earning potential? By <Link href="/staking" className="text-purple-600 hover:text-purple-800 font-medium">staking your TAIC coins</Link>, 
            you not only contribute to the network's security but also unlock higher cashback rates and other exclusive benefits within our loyalty tiers.
          </p>
          <div className="text-center">
            <Link href="/staking" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg text-md transition duration-300">
              Learn More About Staking TAIC
            </Link>
          </div>
        </div>
      </section>
      
      <section className="mb-12">
        <h2 className="text-3xl font-semibold text-gray-800 mb-8 text-center">Our Loyalty Tiers</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loyaltyTiers.map((tier) => (
            <div key={tier.name} className="p-6 bg-white shadow-xl rounded-lg flex flex-col items-center text-center border-t-4 border-purple-500">
              <div className="text-5xl mb-4">{tier.icon}</div>
              <h3 className="text-2xl font-semibold text-purple-700 mb-3">{tier.name}</h3>
              <p className="text-gray-600 mb-2 text-sm">Requirement: {tier.requirement}</p>
              <p className="text-gray-700 leading-relaxed mb-4 flex-grow">{tier.description}</p>
              <ul className="list-none text-gray-600 space-y-1 text-sm">
                {tier.benefits.map((benefit, index) => (
                  <li key={index}>✓ {benefit}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 text-center">
        <Link href="/products" 
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 mr-4">
          Start Shopping & Earning
        </Link>
        <Link href="/auth/register" 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          Join the Program
        </Link>
      </div>
    </div>
  );
}
