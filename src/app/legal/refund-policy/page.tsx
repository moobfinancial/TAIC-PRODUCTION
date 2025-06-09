import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Refund & Returns Policy | TAIC Platform',
  description: 'Understand the process and conditions for refunds and returns on products purchased through the TAIC e-commerce platform.',
};

const Section = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section className="mb-6 md:mb-8" id={id}>
    <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">{title}</h2>
    <div className="prose prose-md dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-3">
      {children}
    </div>
  </section>
);

export default function RefundPolicyPage() {
  const lastUpdatedDate = "June 9, 2025";

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white text-center">TAIC Platform - Refund & Returns Policy</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mt-2">Last Updated: {lastUpdatedDate}</p>
      </header>

      <Section title="1. Overview" id="overview">
        <p>At TAIC, we want you to have a satisfying shopping experience. This Refund & Returns Policy outlines the general guidelines and processes for returning items and requesting refunds for products purchased through the TAIC Platform. Please note that individual merchants on our platform may have their own specific return policies, which should also be reviewed before making a purchase.</p>
        <p>This policy applies to all transactions made on the TAIC Platform. By making a purchase, you agree to this policy and the specific return policy of the merchant from whom you are buying.</p>
      </Section>

      <Section title="2. Eligibility for Refunds & Returns" id="eligibility">
        <p>To be eligible for a return and/or refund, generally the following conditions must be met:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>The item must be unused, in the same condition that you received it, and in its original packaging (unless the item was received damaged or defective).</li>
          <li>A request for a return/refund must be initiated within the timeframe specified by the merchant's return policy (e.g., 14 days, 30 days from receipt). If no merchant policy is specified, a default of 14 days from receipt may apply for eligible items.</li>
          <li>Proof of purchase (e.g., order confirmation, receipt) is required.</li>
          <li>The item must be eligible for return (see "Non-Returnable Items" below and the merchant's specific policy).</li>
        </ul>
      </Section>

      <Section title="3. Non-Returnable Items" id="non-returnable">
        <p>Certain types of items are generally exempt from being returned. These may include, but are not limited to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Perishable goods (e.g., food, flowers).</li>
          <li>Digital products or services that have been accessed or downloaded.</li>
          <li>Custom-made or personalized items.</li>
          <li>Intimate or sanitary goods, health and personal care items.</li>
          <li>Gift cards.</li>
          <li>Items sold as "final sale" or clearance (clearly indicated by the merchant).</li>
        </ul>
        <p>Always check the merchant's specific listing and policy for details on non-returnable items.</p>
      </Section>

      <Section title="4. Process for Requesting a Refund/Return" id="process">
        <p>To initiate a refund or return, please follow these steps:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>Contact the Merchant:</strong> The first step is usually to contact the merchant directly through the TAIC Platform's messaging system. Explain the issue and why you are requesting a return/refund. Provide your order number and any relevant details (e.g., photos if the item is damaged).</li>
          <li><strong>Follow Merchant Instructions:</strong> The merchant will guide you through their specific return process, which may include providing a return shipping address or label.</li>
          <li><strong>Ship the Item (if applicable):</strong> If a return is approved and required, package the item securely and ship it according to the merchant's instructions. It is recommended to use a trackable shipping service.</li>
          <li><strong>Await Confirmation:</strong> Once the merchant receives and inspects the returned item, they will notify you of the approval or rejection of your refund.</li>
        </ol>
      </Section>

      <Section title="5. Refund Processing" id="refund-processing">
        <p>If your refund is approved, it will be processed, and a credit will automatically be applied to your original method of payment within a certain number of days, depending on your card issuer's or payment processor's policies.</p>
        <p><strong>Late or Missing Refunds:</strong> If you haven’t received a refund yet, first check your bank account again. Then contact your credit card company; it may take some time before your refund is officially posted. Next, contact your bank. There is often some processing time before a refund is posted. If you’ve done all of this and you still have not received your refund, please <Link href="/contact" className="text-primary-600 dark:text-primary-400 hover:underline">contact TAIC support</Link> for assistance in liaising with the merchant.</p>
      </Section>

      <Section title="6. Shipping Returns" id="shipping-returns">
        <p>You will generally be responsible for paying for your own shipping costs for returning your item, unless the item was received damaged, defective, or incorrect due to merchant error. Shipping costs are non-refundable. If you receive a refund, the cost of return shipping (if covered by the merchant) might be deducted from your refund.</p>
        <p>If you are shipping an item over a certain value (e.g., $75), you should consider using a trackable shipping service or purchasing shipping insurance. Neither TAIC nor the merchant can guarantee that they will receive your returned item if it is not tracked.</p>
      </Section>

      <Section title="7. Damaged or Incorrect Items" id="damaged-items">
        <p>If you receive an item that is damaged, defective, or not what you ordered, please contact the merchant immediately (within 48 hours of receipt if possible) with photographic evidence. The merchant will work with you to resolve the issue, which may involve a replacement, repair, or full refund including any shipping costs.</p>
      </Section>

      <Section title="8. TAIC Coin Refunds" id="taic-coin-refunds">
        <p>If your original purchase was made using TAIC Coin, any approved refunds will typically be issued in TAIC Coin back to your TAIC platform wallet. The amount refunded will be based on the TAIC Coin value at the time of the original transaction or current market value, as determined by TAIC or merchant policy. Be aware of potential fluctuations in TAIC Coin value as outlined in our <Link href="/legal/risk-disclosure" className="text-primary-600 dark:text-primary-400 hover:underline">Risk Disclosure</Link>.</p>
      </Section>

      <Section title="9. Merchant's Own Policies" id="merchant-policies">
        <p>Merchants on TAIC are encouraged to have clear and fair refund and return policies. These policies are displayed on their store page and/or product listings. In cases where a merchant's policy differs from this general TAIC policy, the merchant's policy may take precedence for their specific products, provided it meets minimum legal standards and TAIC platform requirements.</p>
        <p>It is your responsibility as a buyer to review the individual merchant's refund and return policy before making a purchase.</p>
      </Section>

      <Section title="10. Dispute Resolution" id="dispute-resolution">
        <p>If you are unable to resolve a refund or return issue directly with a merchant, you may be able to open a dispute through the TAIC <Link href="/trust-and-safety#dispute-resolution" className="text-primary-600 dark:text-primary-400 hover:underline">Dispute Resolution Process</Link>. TAIC will review the case based on the information provided by both parties and this policy.</p>
      </Section>

      <Section title="11. Contact Us" id="contact-us">
        <p>If you have any questions about this Refund & Returns Policy, or if you need assistance with a return or refund that cannot be resolved with the merchant, please <Link href="/contact" className="text-primary-600 dark:text-primary-400 hover:underline">contact TAIC Customer Support</Link>.</p>
      </Section>

    </div>
  );
}
