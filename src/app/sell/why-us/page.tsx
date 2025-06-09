import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Why Sell With TAIC? | Grow Your Business With Us',
  description: 'Discover the compelling reasons to sell on TAIC: reach new customers, utilize advanced AI tools, benefit from TAIC coin advantages, and enjoy competitive fees.',
};

export default function WhySellWithTaicPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-purple-600 mb-4">Why Sell With TAIC?</h1>
        <p className="text-xl text-muted-foreground">
          Unlock unparalleled opportunities and advantages for your business.
        </p>
      </header>

      <section className="mb-8 p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">1. Access New Customer Segments</h2>
        <p className="text-gray-700 leading-relaxed">
          Tap into a vibrant and growing community of shoppers interested in innovative products and the benefits of cryptocurrency. 
          TAIC attracts a diverse global audience, giving your products the visibility they deserve.
        </p>
      </section>

      <section className="mb-8 p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">2. AI-Powered Merchant Tools</h2>
        <p className="text-gray-700 leading-relaxed">
          Leverage our cutting-edge AI tools to optimize your listings, understand market trends, and gain insights into customer behavior. 
          Our platform provides you with the intelligence to make smarter business decisions and enhance your sales.
        </p>
        {/* Optional: Link to a more detailed features page if it exists */}
        {/* <Link href="/sell/features" className="text-purple-600 hover:text-purple-800 font-medium">Explore our AI Tools &rarr;</Link> */}
      </section>

      <section className="mb-8 p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">3. The TAIC Coin Advantage</h2>
        <p className="text-gray-700 leading-relaxed">
          Benefit from our unique TAIC coin ecosystem. Offer cashback to customers, potentially reducing your effective fees, and participate in a novel rewards system 
          that encourages customer loyalty and repeat purchases.
        </p>
         {/* Optional: Link to a more detailed coin benefits page if it exists */}
        {/* <Link href="/sell/coin-benefits" className="text-purple-600 hover:text-purple-800 font-medium">Learn about TAIC Coin for Merchants &rarr;</Link> */}
      </section>

      <section className="mb-8 p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">4. Competitive & Transparent Fees</h2>
        <p className="text-gray-700 leading-relaxed">
          We offer a clear and competitive fee structure designed to help your business maximize profitability. 
          No hidden charges, just straightforward pricing that lets you plan effectively.
        </p>
        {/* Optional: Link to a more detailed fees page if it exists */}
        {/* <Link href="/sell/fees" className="text-purple-600 hover:text-purple-800 font-medium">See our Fee Structure &rarr;</Link> */}
      </section>
      
      <section className="mb-8 p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">5. Dedicated Support & Community</h2>
        <p className="text-gray-700 leading-relaxed">
          Join a supportive community of sellers and get access to our dedicated merchant support team. We're here to help you succeed every step of the way.
        </p>
      </section>

      <div className="mt-12 text-center">
        <Link href="/merchant/register" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 mr-4">
          Register Your Store
        </Link>
        <Link href="/sell" 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          &larr; Back to Sell on TAIC
        </Link>
      </div>
    </div>
  );
}
