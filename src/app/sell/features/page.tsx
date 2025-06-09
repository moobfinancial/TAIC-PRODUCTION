import Link from 'next/link';
import { Metadata } from 'next';
// Consider importing an icon library if you want more specific icons
// import { IconName } from 'react-icons/fa'; // Example

export const metadata: Metadata = {
  title: 'Merchant Tools & Features | TAIC',
  description: 'Explore the powerful suite of tools TAIC offers merchants: intuitive dashboard, advanced product management, insightful analytics, and TAIC coin cashback configuration.',
};

interface Feature {
  id: number;
  title: string;
  description: string;
  icon?: string; // Placeholder for icon class or component
  detailsLink?: string; // Optional link to more detailed documentation
}

export default function MerchantFeaturesPage() {
  const features: Feature[] = [
    {
      id: 1,
      title: 'Intuitive Merchant Dashboard',
      description: 'Get a comprehensive overview of your sales, orders, and performance at a glance. Our user-friendly dashboard makes managing your store effortless.',
      icon: '📊', // Example: Chart icon
    },
    {
      id: 2,
      title: 'Advanced Product Management',
      description: 'Easily list, edit, and organize your products. Utilize bulk upload features, inventory tracking, and variant management to keep your catalog up-to-date.',
      icon: '📦', // Example: Box icon
    },
    {
      id: 3,
      title: 'Powerful Sales Analytics',
      description: 'Gain valuable insights into your sales trends, customer behavior, and top-performing products. Make data-driven decisions to grow your business.',
      icon: '📈', // Example: Growth chart icon
    },
    {
      id: 4,
      title: 'TAIC Coin Cashback Configuration',
      description: 'Seamlessly set up and manage TAIC coin cashback offers for your products. Attract more customers and incentivize purchases with our unique crypto rewards system.',
      icon: '💎', // Example: Gem icon
    },
    {
      id: 5,
      title: 'AI-Powered Listing Optimization',
      description: 'Leverage AI suggestions to improve your product titles, descriptions, and tagging for better visibility and conversion rates. (Coming Soon!)',
      icon: '🤖', // Example: Robot icon
    },
    {
      id: 6,
      title: 'Secure & Transparent Payouts',
      description: 'Experience hassle-free payouts with clear schedules and multiple payment options, including direct TAIC coin transfers.',
      icon: '💳', // Example: Credit card icon
    },
     {
      id: 7,
      title: 'Marketing & Promotion Tools',
      description: 'Access tools to create promotional campaigns, offer discounts, and feature your products to a wider audience within the TAIC marketplace. (Future Enhancement)',
      icon: '📢', // Example: Megaphone icon
    }
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <header className="text-center mb-16">
        <h1 className="text-4xl font-bold text-purple-600 mb-4">Powerful Tools to Fuel Your Growth</h1>
        <p className="text-xl text-muted-foreground">
          Discover the suite of features designed to help you manage, optimize, and expand your business on TAIC.
        </p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((feature) => (
          <div key={feature.id} className="bg-white p-6 shadow-xl rounded-lg flex flex-col">
            <div className="text-4xl mb-4 text-purple-600">{feature.icon || '⚙️'}</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{feature.title}</h2>
            <p className="text-gray-700 leading-relaxed flex-grow">{feature.description}</p>
            {feature.detailsLink && (
              <Link href={feature.detailsLink} className="mt-4 text-purple-600 hover:text-purple-800 font-medium self-start">
                Learn more &rarr;
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Link href="/merchant/register" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 mr-4">
          Unlock These Features - Register Now
        </Link>
        <Link href="/sell" 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          &larr; Back to Sell on TAIC
        </Link>
      </div>
    </div>
  );
}
