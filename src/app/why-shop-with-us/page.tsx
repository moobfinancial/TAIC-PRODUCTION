import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Why Shop With TAIC? | Unbeatable Benefits & Rewards',
  description: 'Discover the advantages of shopping on TAIC: earn TAIC coin cashback, use our AI Shopping Assistant, try products with Virtual Try-On, and access a global marketplace.',
};

interface ShoppingBenefit {
  id: number;
  title: string;
  description: string;
  icon: string; // Placeholder for icon
  learnMoreLink?: string;
}

export default function WhyShopWithTaicPage() {
  const benefits: ShoppingBenefit[] = [
    {
      id: 1,
      title: 'Earn TAIC Coin Cashback on Every Purchase',
      description: 'Get rewarded for shopping! Earn valuable TAIC coins with every eligible purchase, which you can use for future discounts, stake for more rewards, or trade.',
      icon: '🎁',
      learnMoreLink: '/rewards', // Link to the more detailed /rewards page
    },
    {
      id: 2,
      title: 'AI-Powered Shopping Assistant',
      description: 'Find the perfect products with ease using our intelligent AI Shopping Assistant. Get personalized recommendations, compare items, and discover new trends effortlessly.',
      icon: '🤖',
      learnMoreLink: '/ai-assistant', // Link to the AI assistant tool page
    },
    {
      id: 3,
      title: 'Virtual Try-On for Select Products',
      description: 'Experience products like never before with our Virtual Try-On feature. See how items look on you before you buy, reducing returns and increasing satisfaction. (Coming Soon for more categories!)',
      icon: '👗', // Example icon for apparel
    },
    {
      id: 4,
      title: 'Access a Global Marketplace',
      description: 'Explore a diverse range of products from sellers around the world. Discover unique items and enjoy a vast selection all in one place.',
      icon: '🌍',
    },
    {
      id: 5,
      title: 'Secure & Transparent Transactions',
      description: 'Shop with confidence knowing your transactions are secure. We prioritize your privacy and data protection, offering a safe and reliable shopping environment.',
      icon: '🛡️',
      learnMoreLink: '/trust', // Link to Trust & Safety Center
    },
     {
      id: 6,
      title: 'Seamless & User-Friendly Experience',
      description: 'Enjoy a smooth and intuitive shopping journey from browsing to checkout. Our platform is designed with you in mind for maximum convenience.',
      icon: '👍',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="text-center mb-16">
        <h1 className="text-4xl font-bold text-purple-600 mb-4">Why You'll Love Shopping With TAIC</h1>
        <p className="text-xl text-muted-foreground">
          Experience a revolutionary way to shop, packed with benefits and rewards.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {benefits.map((benefit) => (
          <div key={benefit.id} className="p-6 bg-white shadow-xl rounded-lg flex flex-col">
            <div className="text-3xl mb-3">{benefit.icon}</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{benefit.title}</h2>
            <p className="text-gray-700 leading-relaxed flex-grow">{benefit.description}</p>
            {benefit.learnMoreLink && (
              <Link href={benefit.learnMoreLink} className="mt-4 text-purple-600 hover:text-purple-800 font-medium self-start">
                Learn more &rarr;
              </Link>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-12 text-center">
        <Link href="/products" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 mr-4">
          Start Shopping & Earning Rewards
        </Link>
        <Link href="/auth/register" 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          Create Your Account
        </Link>
      </div>
    </div>
  );
}
