import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Merchant Agreement | TAIC Platform',
  description: 'Understand the terms and conditions for selling products and services on the TAIC e-commerce platform.',
};

const Section = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section className="mb-6 md:mb-8" id={id}>
    <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">{title}</h2>
    <div className="prose prose-md dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-3">
      {children}
    </div>
  </section>
);

export default function MerchantAgreementPage() {
  const lastUpdatedDate = "June 9, 2025";
  // Note: Replace [Your Company Legal Name] with your actual company legal name.
  const companyLegalName = "[Your Company Legal Name]"; 
  const jurisdiction = "the State of Florida, USA";

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white text-center">TAIC Platform - Merchant Agreement</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mt-2">Last Updated: {lastUpdatedDate}</p>
      </header>

      <Section title="Preamble" id="preamble">
        <p>This Merchant Agreement (&quot;Agreement&quot;) is a legally binding contract between you, the merchant (&quot;you,&quot; &quot;your,&quot; or &quot;Merchant&quot;), and {companyLegalName}, the owner and operator of the TAIC platform (&quot;TAIC,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). This Agreement governs your use of the TAIC platform to list, market, and sell your products (&quot;Products&quot;).</p>
        <p>By completing the registration process and becoming a Merchant on our platform, you acknowledge that you have read, understood, and agree to be bound by all terms and conditions of this Agreement, our general <Link href="/legal/terms-of-service" className="text-primary-600 dark:text-primary-400 hover:underline">Terms of Service</Link>, <Link href="/legal/privacy-policy" className="text-primary-600 dark:text-primary-400 hover:underline">Privacy Policy</Link>, and all other policies referenced herein.</p>
      </Section>

      <Section title="1. Account Registration & Onboarding" id="account-registration">
        <p><strong>1.1. Eligibility:</strong> To become a Merchant, you must be a legally registered business or an individual of at least 18 years of age, with the authority to enter into this Agreement.</p>
        <p><strong>1.2. Verification:</strong> You agree to provide accurate and complete information during our registration and Know Your Customer (KYC)/Anti-Money Laundering (AML) verification process. You authorize us to verify this information as required. We reserve the right to reject any application at our sole discretion.</p>
        <p><strong>1.3. Account Security:</strong> You are fully responsible for all activities that occur under your Merchant account and for maintaining the confidentiality of your account credentials. You must enable Two-Factor Authentication (2FA) on your account. You agree to immediately notify TAIC of any unauthorized use of your account.</p>
      </Section>

      <Section title="2. Your Responsibilities as a Merchant" id="merchant-responsibilities">
        <p><strong>2.1. Product Listings:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>You are solely responsible for all information, photos, and content related to your Product listings. You warrant that all listing information is accurate, current, and not misleading.</li>
          <li>You agree to only list Products that you are legally authorized to sell. You will not list any items that fall under our Prohibited Items & Services Policy, as detailed in our <Link href="/trust-and-safety" className="text-primary-600 dark:text-primary-400 hover:underline">Trust & Safety Center</Link>.</li>
          <li>You grant TAIC a non-exclusive, worldwide, royalty-free license to use, display, and reproduce your Product listings, images, and trademarks for the operation and promotion of the TAIC platform.</li>
        </ul>
        <p><strong>2.2. Order Fulfillment & Shipping:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>You are responsible for fulfilling all customer orders accurately and in a timely manner.</li>
          <li>You agree to package Products securely to prevent damage during transit.</li>
          <li>You must provide customers with accurate shipping information, including tracking numbers, and adhere to the estimated delivery times you specify. All shipping practices must comply with our <Link href="/legal/refund-policy" className="text-primary-600 dark:text-primary-400 hover:underline">Shipping & Returns Policy</Link>.</li>
        </ul>
        <p><strong>2.3. Customer Service:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>You will provide a high level of customer service and respond to customer inquiries promptly and professionally.</li>
          <li>You are responsible for handling returns, refunds, and exchanges in accordance with your stated policies and our platform&apos;s <Link href="/legal/refund-policy" className="text-primary-600 dark:text-primary-400 hover:underline">Shipping & Returns Policy</Link>.</li>
        </ul>
        <p><strong>2.4. Compliance with Laws:</strong> You agree to comply with all applicable laws and regulations regarding your business operations, including but not limited to product safety, marketing, and taxation.</p>
      </Section>

      <Section title="3. Fees, Payments, and Payouts" id="fees-payments-payouts">
        <p><strong>3.1. Platform Fees:</strong> You agree to pay all applicable fees as set forth on our <Link href="/legal/fee-schedule" className="text-primary-600 dark:text-primary-400 hover:underline">&quot;Fees & Payouts&quot; schedule</Link>, which is incorporated into this Agreement by reference. These fees may include, but are not limited to, transaction fees and payment processing fees. We reserve the right to modify our fees with at least thirty (30) days&apos; prior notice.</p>
        <p><strong>3.2. Payment Processing:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>TAIC provides payment processing services through third-party partners (e.g., Stripe for fiat currency) and its own system for TAIC Coin transactions.</li>
          <li>Fiat Currency: Transaction fees for fiat payments will be deducted from the total sale amount before payout.</li>
          <li>TAIC Coin: Transaction fees for payments made with TAIC Coin may differ from fiat fees, as outlined in our fee schedule.</li>
        </ul>
        <p><strong>3.3. Payouts:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Payouts for completed sales will be made to your designated bank account or cryptocurrency wallet according to the schedule specified on our <Link href="/legal/fee-schedule" className="text-primary-600 dark:text-primary-400 hover:underline">&quot;Fees & Payouts&quot; page</Link>.</li>
          <li>Payouts may be subject to holds for reasons including, but not limited to, resolving customer disputes, investigating potential fraud, or as required by law.</li>
          <li>You are responsible for any currency conversion fees or network transaction (gas) fees associated with your payouts.</li>
        </ul>
        <p><strong>3.4. Taxes:</strong> You are solely responsible for determining, collecting, reporting, and remitting all applicable taxes, duties, and other governmental charges arising from your sales on the TAIC platform.</p>
      </Section>

      <Section title="4. TAIC Coin & Cashback Program" id="taic-coin-cashback">
        <p><strong>4.1. Accepting TAIC Coin:</strong> By enabling TAIC Coin as a payment method, you agree to accept it as valid payment for your Products. The value of TAIC Coin against fiat currency will be determined at the time of the transaction. Your use and acceptance of TAIC Coin are subject to the terms in our <Link href="/legal/risk-disclosure" className="text-primary-600 dark:text-primary-400 hover:underline">TAIC Coin Risk Disclosure</Link>.</p>
        <p><strong>4.2. Merchant-Configurable Cashback:</strong> The TAIC platform allows you to offer additional cashback rewards in TAIC Coin to customers. You are responsible for configuring and funding these merchant-specific promotions through your dashboard.</p>
      </Section>

      <Section title="5. Data, Privacy, and Intellectual Property" id="data-privacy-ip">
        <p><strong>5.1. Data Usage:</strong> We will provide you with access to certain data regarding your sales and customers to help you manage your store. You agree to use this customer data only for the purpose of fulfilling orders and providing customer service for transactions made on the TAIC platform. You will not use it for unsolicited marketing or share it with third parties, in accordance with our <Link href="/legal/privacy-policy" className="text-primary-600 dark:text-primary-400 hover:underline">Privacy Policy</Link>.</p>
        <p><strong>5.2. Intellectual Property:</strong> You retain all ownership rights to your logos, trademarks, and the content you create for your Product listings. As stated in section 2.1.c, you grant us a license to use this content for platform operations.</p>
      </Section>

      <Section title="6. Disputes, Termination, and Suspension" id="disputes-termination-suspension">
        <p><strong>6.1. Customer Disputes:</strong> You agree to work in good faith to resolve any disputes with customers. If a resolution cannot be reached, you agree to participate in TAIC&apos;s dispute resolution process as outlined in our <Link href="/trust-and-safety" className="text-primary-600 dark:text-primary-400 hover:underline">Trust & Safety Center</Link>.</p>
        <p><strong>6.2. Termination by You:</strong> You may terminate this Agreement at any time by closing your Merchant account through your dashboard. Termination will not absolve you of any outstanding obligations, including fulfilling pending orders or resolving customer disputes.</p>
        <p><strong>6.3. Termination or Suspension by TAIC:</strong> We reserve the right to suspend or terminate your Merchant account and this Agreement at our discretion if you:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Breach any terms of this Agreement or related policies.</li>
          <li>Receive an excessive volume of customer complaints or poor reviews.</li>
          <li>Engage in fraudulent, illegal, or harmful activity.</li>
          <li>Pose a risk to the integrity and safety of the TAIC platform.</li>
        </ul>
      </Section>

      <Section title="7. Disclaimers and Limitation of Liability" id="disclaimers-liability">
        <p><strong>7.1. Disclaimer:</strong> The TAIC platform is provided &quot;as is&quot; and &quot;as available.&quot; We do not guarantee that the platform will be uninterrupted or error-free.</p>
        <p><strong>7.2. Limitation of Liability:</strong> To the fullest extent permitted by law, TAIC and {companyLegalName} shall not be liable for any lost profits, or any indirect, special, incidental, or consequential damages arising out of or in connection with this Agreement or your use of the platform. Our total liability to you under this Agreement will not exceed the total fees paid by you to TAIC in the twelve (12) months preceding the claim.</p>
      </Section>

      <Section title="8. General Provisions" id="general-provisions">
        <p><strong>8.1. Governing Law:</strong> This Agreement shall be governed by and construed in accordance with the laws of {jurisdiction}, without regard to its conflict of law principles.</p>
        <p><strong>8.2. Modifications:</strong> We may amend this Agreement from time to time by posting the revised version on our website. We will provide you with at least thirty (30) days&apos; notice of any material changes. Your continued use of the platform after the effective date of the changes constitutes your acceptance of the amended Agreement.</p>
        <p><strong>8.3. Entire Agreement:</strong> This Agreement, along with all policies incorporated by reference, constitutes the entire agreement between you and TAIC and supersedes all prior agreements.</p>
      </Section>

    </div>
  );
}
