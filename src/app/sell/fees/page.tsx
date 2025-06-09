import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fees & Payouts | TAIC Merchant Services',
  description: 'Understand the transparent fee structure and payout schedules for merchants selling on the TAIC marketplace. No hidden costs, clear terms.',
};

interface FeeTier {
  name: string;
  rate: string;
  description: string;
  benefits?: string[];
}

export default function FeesAndPayoutsPage() {
  const feeTiers: FeeTier[] = [
    {
      name: 'Standard Tier',
      rate: '5% per sale + Payment Processor Fee (e.g., 0.5% for TAIC coin)',
      description: 'Our competitive standard rate for all product categories. Includes access to all basic merchant tools.',
      benefits: [
        'Access to all core merchant tools',
        'Standard support',
        'Payouts processed within 3-5 business days',
      ],
    },
    {
      name: 'Premium Tier (Volume Sellers)',
      rate: 'Contact Us for Custom Rates',
      description: 'For high-volume sellers, we offer customized rates and dedicated support. Get in touch to discuss your needs.',
      benefits: [
        'Potentially lower transaction fees',
        'Dedicated account manager',
        'Faster payout processing',
        'Early access to new features',
      ],
    },
    // Add more tiers if applicable, e.g., based on TAIC coin staking
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="text-center mb-16">
        <h1 className="text-4xl font-bold text-purple-600 mb-4">Transparent Fees & Reliable Payouts</h1>
        <p className="text-xl text-muted-foreground">
          We believe in straightforward pricing to help you succeed.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">Our Fee Structure</h2>
        <div className="space-y-8">
          {feeTiers.map((tier) => (
            <div key={tier.name} className="p-6 bg-white shadow-xl rounded-lg border border-gray-200">
              <h3 className="text-2xl font-semibold text-purple-700 mb-3">{tier.name}</h3>
              <p className="text-xl font-bold text-gray-700 mb-2">{tier.rate}</p>
              <p className="text-gray-600 mb-4">{tier.description}</p>
              {tier.benefits && tier.benefits.length > 0 && (
                <>
                  <h4 className="font-semibold text-gray-700 mb-1">Key Benefits:</h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    {tier.benefits.map((benefit, index) => (
                      <li key={index}>{benefit}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-gray-500 text-center">
          Note: Payment processor fees may vary based on the chosen payment method. Using TAIC coin for transactions typically incurs the lowest processing fees. 
          All fees are subject to change with prior notice as per our Merchant Agreement.
        </p>
      </section>

      <section className="mb-12 p-8 bg-purple-50 rounded-lg">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">Payout Information</h2>
        <div className="text-gray-700 leading-relaxed space-y-4">
          <p>
            <strong>Payout Schedule:</strong> We process payouts on a [Daily/Weekly/Bi-Weekly - specify] basis. 
            Funds from eligible sales will be available for payout after a standard holding period of [X days - e.g., 7 days] to account for potential returns or disputes.
          </p>
          <p>
            <strong>Payout Methods:</strong> Merchants can receive payouts via direct bank transfer (ACH/Wire), PayPal, or directly in TAIC coin to their connected wallet. 
            Receiving payouts in TAIC coin is often the fastest method and may come with additional benefits.
          </p>
          <p>
            <strong>Minimum Payout Amount:</strong> A minimum balance of [$Y - e.g., $25] is required to initiate a payout.
          </p>
          <p>
            You can manage your payout preferences and view your payout history directly from your merchant dashboard.
          </p>
        </div>
      </section>
      
      <section className="text-center">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Have Questions?</h2>
        <p className="text-gray-700 mb-6">
          Our support team is here to help with any queries regarding fees and payouts.
        </p>
        <Link href="/contact" className="text-purple-600 hover:text-purple-800 font-medium text-lg">
          Contact Support &rarr;
        </Link>
      </section>

      <div className="mt-16 text-center">
        <Link href="/merchant/register" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 mr-4">
          Start Selling with Clear Terms
        </Link>
        <Link href="/sell" 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          &larr; Back to Sell on TAIC
        </Link>
      </div>
    </div>
  );
}
