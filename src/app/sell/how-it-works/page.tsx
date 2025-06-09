import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works: Selling on TAIC',
  description: 'A step-by-step guide for merchants on how to register, list products, manage sales, and get paid on the TAIC marketplace.',
};

export default function HowItWorksPage() {
  const steps = [
    {
      id: 1,
      title: 'Register Your Account',
      description: 'Quickly sign up as a merchant. Provide your basic business information to create your seller profile. It only takes a few minutes!',
      icon: '📝', // Placeholder icon
    },
    {
      id: 2,
      title: 'Complete Verification (KYC)',
      description: 'To ensure a secure and trustworthy marketplace for everyone, complete our straightforward Know Your Customer (KYC) process.',
      icon: '🛡️', // Placeholder icon
    },
    {
      id: 3,
      title: 'Set Up Your Storefront',
      description: 'Customize your merchant profile, add your store logo, and tell customers about your brand. Make your storefront unique and appealing.',
      icon: '🏪', // Placeholder icon
    },
    {
      id: 4,
      title: 'List Your Products',
      description: 'Easily add your products with detailed descriptions, high-quality images, and pricing. Our intuitive tools make product listing a breeze.',
      icon: '🛍️', // Placeholder icon
    },
    {
      id: 5,
      title: 'Manage Orders & Shipping',
      description: 'Receive notifications for new orders, manage your inventory, and handle shipping efficiently through your merchant dashboard.',
      icon: '🚚', // Placeholder icon
    },
    {
      id: 6,
      title: 'Receive Payments Securely',
      description: 'Get paid for your sales through our secure payment system. We offer transparent payout schedules and support for various payment methods, including TAIC coin.',
      icon: '💰', // Placeholder icon
    },
    {
      id: 7,
      title: 'Leverage TAIC Coin Benefits',
      description: 'Explore how to use TAIC coin to reduce fees, offer customer cashback, and participate in our unique rewards ecosystem to boost your sales.',
      icon: '💎', // Placeholder icon
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="text-center mb-16">
        <h1 className="text-4xl font-bold text-purple-600 mb-4">Getting Started on TAIC: A Simple Guide</h1>
        <p className="text-xl text-muted-foreground">
          Follow these easy steps to start selling and growing your business with us.
        </p>
      </header>

      <div className="space-y-12">
        {steps.map((step) => (
          <section key={step.id} className="flex items-start p-6 bg-white shadow-xl rounded-lg">
            <div className="text-4xl mr-6 mt-1">{step.icon}</div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">{`${step.id}. ${step.title}`}</h2>
              <p className="text-gray-700 leading-relaxed">{step.description}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Link href="/merchant/register" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 mr-4">
          Ready to Begin? Register Now
        </Link>
        <Link href="/sell" 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          &larr; Back to Sell on TAIC
        </Link>
      </div>
    </div>
  );
}
