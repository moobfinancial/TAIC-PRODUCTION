import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TAIC Coin Benefits for Merchants | Supercharge Your Sales',
  description: 'Learn how leveraging TAIC coin as a merchant can lower your fees, attract incentivized buyers, and provide unique advantages for your business on our platform.',
};

interface Benefit {
  id: number;
  title: string;
  description: string;
  icon: string; // Placeholder for icon
}

export default function TaicCoinForMerchantsPage() {
  const benefits: Benefit[] = [
    {
      id: 1,
      title: 'Lower Transaction Fees',
      description: 'Experience significantly reduced transaction fees when you opt-in to receive payments or pay platform fees using TAIC coin. Keep more of your earnings.',
      icon: '💰',
    },
    {
      id: 2,
      title: 'Attract Incentivized Buyers',
      description: 'Customers earn TAIC coin cashback on purchases, making your products more attractive. Tap into a community of buyers motivated by these rewards.',
      icon: '🛍️',
    },
    {
      id: 3,
      title: 'Participate in Exclusive Promotions',
      description: 'Gain access to special promotional campaigns and marketing opportunities available only to merchants who embrace the TAIC coin ecosystem.',
      icon: '📢',
    },
    {
      id: 4,
      title: 'Faster Payouts',
      description: 'Opting for payouts in TAIC coin can lead to faster settlement times, giving you quicker access to your funds compared to traditional banking methods.',
      icon: '⚡',
    },
    {
      id: 5,
      title: 'Enhanced Store Visibility',
      description: 'Merchants actively participating in the TAIC coin economy may receive preferential placement or highlighting within the marketplace, boosting visibility. (Feature under consideration)',
      icon: '🌟',
    },
    {
      id: 6,
      title: 'Future-Proof Your Business',
      description: 'Position your business at the forefront of e-commerce innovation by integrating with a cryptocurrency designed for real-world utility and rewards.',
      icon: '🚀',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="text-center mb-16">
        <h1 className="text-4xl font-bold text-purple-600 mb-4">Unlock the Power of TAIC Coin for Your Business</h1>
        <p className="text-xl text-muted-foreground">
          Discover how TAIC coin offers tangible benefits to merchants on our platform.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {benefits.map((benefit) => (
          <div key={benefit.id} className="p-6 bg-white shadow-xl rounded-lg">
            <div className="text-3xl mb-3">{benefit.icon}</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{benefit.title}</h2>
            <p className="text-gray-700 leading-relaxed">{benefit.description}</p>
          </div>
        ))}
      </div>
      
      <section className="p-8 bg-purple-50 rounded-lg text-center mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Easy Integration & Management</h2>
        <p className="text-gray-700 leading-relaxed mb-6">
          Your merchant dashboard provides simple tools to manage your TAIC coin preferences, track earnings, and configure cashback options. 
          We make it easy to leverage these benefits without needing to be a crypto expert.
        </p>
        <Link href="/sell/how-it-works#step-7" className="text-purple-600 hover:text-purple-800 font-medium">
          Learn how to set it up &rarr;
        </Link>
      </section>

      <div className="text-center">
        <Link href="/merchant/register" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 mr-4">
          Start Benefiting - Register Now
        </Link>
        <Link href="/sell" 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          &larr; Back to Sell on TAIC
        </Link>
      </div>
    </div>
  );
}
