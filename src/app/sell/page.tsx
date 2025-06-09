import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sell on TAIC | Unlock Your Business Potential',
  description: 'Join TAIC marketplace to reach new customers, leverage AI tools, and benefit from the TAIC coin ecosystem. Learn how to start selling today.',
};

export default function SellOnTaicPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-purple-600 mb-4">Sell on TAIC</h1>
        <p className="text-xl text-muted-foreground">
          Empower your business and reach a global audience with the TAIC marketplace.
        </p>
      </header>

      <section className="mb-10 p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-3">Why Choose TAIC?</h2>
        <p className="mb-4">
          Discover the unique advantages of selling on our platform, from innovative AI tools 
          to our rewarding TAIC coin ecosystem. We're dedicated to helping your business thrive.
        </p>
        {/* Placeholder for /sell/why-us link */}
        <Link href="/sell/why-us" className="text-purple-600 hover:text-purple-800 font-medium">
          Learn more about Why Sell With TAIC &rarr;
        </Link>
      </section>

      <section className="mb-10 p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-3">Getting Started is Easy</h2>
        <p className="mb-4">
          Our straightforward process will guide you from registration to your first sale. 
          Find out how simple it is to list your products and start growing.
        </p>
        {/* Placeholder for /sell/how-it-works link */}
        <Link href="/sell/how-it-works" className="text-purple-600 hover:text-purple-800 font-medium">
          See How It Works &rarr;
        </Link>
      </section>
      
      <section className="mb-10 p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-3">Powerful Tools for Sellers</h2>
        <p className="mb-4">
          Explore our suite of merchant tools designed to optimize your listings, manage inventory, 
          understand your sales analytics, and configure TAIC coin benefits.
        </p>
        {/* Placeholder for /sell/features link */}
        <Link href="/sell/features" className="text-purple-600 hover:text-purple-800 font-medium">
          Explore Merchant Tools & Features &rarr;
        </Link>
      </section>

      <section className="mb-10 p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-3">Transparent Fees & Payouts</h2>
        <p className="mb-4">
          We believe in clear and fair pricing. Understand our fee structure and how you get paid.
        </p>
        {/* Placeholder for /sell/fees link */}
        <Link href="/sell/fees" className="text-purple-600 hover:text-purple-800 font-medium">
          View Fees & Payouts &rarr;
        </Link>
      </section>

      <section className="p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-3">Leverage the TAIC Coin</h2>
        <p className="mb-4">
          Learn how the TAIC coin can reduce your fees, incentivize customers, and provide unique
          advantages for your business on our platform.
        </p>
        {/* Placeholder for /sell/coin-benefits link */}
        <Link href="/sell/coin-benefits" className="text-purple-600 hover:text-purple-800 font-medium">
          Understand TAIC Coin Benefits for Merchants &rarr;
        </Link>
      </section>

      <div className="mt-12 text-center">
        <Link href="/merchant/register" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          Ready to Start Selling? Register Now
        </Link>
      </div>
    </div>
  );
}
