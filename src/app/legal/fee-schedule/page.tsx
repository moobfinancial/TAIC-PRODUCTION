import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Fees & Payouts Schedule | TAIC Platform',
  description: 'Understand the fee structure and payout schedule for merchants on the TAIC e-commerce platform.',
};

const Section = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section className="mb-6 md:mb-8" id={id}>
    <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">{title}</h2>
    <div className="prose prose-md dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-3">
      {children}
    </div>
  </section>
);

const FeeTable = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg shadow">
      <thead className="bg-gray-50 dark:bg-gray-800">
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function FeeSchedulePage() {
  const lastUpdatedDate = "June 9, 2025";
  const standardCommissionRate = "[e.g., 5%]";
  const taicCoinTransactionFee = "[e.g., 1%]";
  const payoutThreshold = "[e.g., $50 USD or equivalent in TAIC Coin]";
  const payoutFrequency = "[e.g., weekly, bi-weekly, monthly]";

  const feeHeaders = ["Fee Type", "Description", "Rate/Cost"];
  const feeRows = [
    ["Standard Commission Fee", "A percentage of the total sale price (including shipping, excluding taxes) for each item sold.", `${standardCommissionRate}`],
    ["TAIC Coin Transaction Fee", "A reduced fee for transactions completed using TAIC Coin.", `${taicCoinTransactionFee}`],
    ["Listing Fee (if applicable)", "Fee per product listing, or for specific categories/promotional listings.", "Currently $0 (may change with notice)"],
    ["Payment Processing Fee", "Standard fees charged by third-party payment processors (e.g., Stripe, PayPal) for fiat transactions. Passed through to merchant.", "Varies by processor (e.g., ~2.9% + $0.30)"],
    ["Currency Conversion Fee (if applicable)", "Fee for converting funds from one currency to another during payouts.", "Varies by processor"],
    ["Dispute/Chargeback Fee", "Fee applied if a chargeback is initiated by a customer and found in their favor.", "[e.g., $15-$25 per instance]"]
  ];

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white text-center">TAIC Platform - Fees & Payouts Schedule</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mt-2">Last Updated: {lastUpdatedDate}</p>
      </header>

      <Section title="1. Introduction" id="introduction">
        <p>This Fees & Payouts Schedule outlines the fees associated with selling on the TAIC Platform and the process for receiving payouts for your sales. This schedule is part of the <Link href="/legal/merchant-agreement" className="text-primary-600 dark:text-primary-400 hover:underline">Merchant Agreement</Link> and may be updated from time to time. We encourage you to review this page regularly.</p>
      </Section>

      <Section title="2. Schedule of Fees" id="fee-schedule">
        <p>The following fees apply to merchants selling on the TAIC Platform. All fees are subject to change with prior notice as outlined in the Merchant Agreement.</p>
        <FeeTable headers={feeHeaders} rows={feeRows} />
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">* All fees are exclusive of any applicable taxes (e.g., VAT, GST) which merchants are responsible for.</p>
      </Section>

      <Section title="3. Payouts" id="payouts">
        <p><strong>Payout Method:</strong> Payouts will be made to your designated bank account or TAIC Coin wallet, as specified in your merchant dashboard. You are responsible for providing accurate payout information.</p>
        <p><strong>Payout Currency:</strong> Payouts for fiat currency sales will typically be made in your local currency or USD, subject to available payment processor capabilities. Payouts for TAIC Coin sales will be made in TAIC Coin.</p>
        <p><strong>Payout Frequency:</strong> Payouts are processed on a {payoutFrequency} basis, provided your accrued earnings meet the minimum payout threshold.</p>
        <p><strong>Minimum Payout Threshold:</strong> A minimum balance of {payoutThreshold} is required before a payout can be processed. If your balance is below this threshold, it will be carried over to the next payout cycle.</p>
        <p><strong>Payout Processing Time:</strong> Once a payout is initiated, it may take 3-7 business days for funds to appear in your bank account, depending on your bank and location. TAIC Coin payouts are typically faster but subject to network confirmations.</p>
        <p><strong>Deductions:</strong> All applicable fees, refunds, chargebacks, and adjustments will be deducted from your gross sales before calculating your net payout.</p>
      </Section>

      <Section title="4. TAIC Coin Specifics" id="taic-coin-specifics">
        <p><strong>Reduced Fees:</strong> Merchants are encouraged to accept TAIC Coin by benefiting from lower transaction fees compared to standard fiat transactions.</p>
        <p><strong>Volatility:</strong> Please be aware of the potential volatility of TAIC Coin. The value of TAIC Coin payouts may fluctuate. Refer to our <Link href="/legal/risk-disclosure" className="text-primary-600 dark:text-primary-400 hover:underline">Risk Disclosure</Link> for more information.</p>
      </Section>

      <Section title="5. Taxes" id="taxes">
        <p>As a merchant, you are solely responsible for determining, collecting, reporting, and remitting all applicable local, state, federal, and international taxes (including sales tax, VAT, GST, income tax, etc.) associated with your sales on the TAIC Platform. TAIC does not provide tax advice.</p>
      </Section>

      <Section title="6. Changes to Fees and Payouts" id="changes">
        <p>TAIC reserves the right to change its fees and payout terms at any time. We will provide merchants with at least 30 days' notice of any material changes, typically via email and/or a notification on your merchant dashboard. Continued use of the platform after such changes constitutes acceptance of the new terms.</p>
      </Section>

      <Section title="7. Contact & Support" id="contact">
        <p>If you have any questions about this Fees & Payouts Schedule, please <Link href="/contact" className="text-primary-600 dark:text-primary-400 hover:underline">contact Merchant Support</Link> through your dashboard or our support channels.</p>
      </Section>

    </div>
  );
}
