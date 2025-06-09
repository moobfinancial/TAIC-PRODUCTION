import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | TAIC Platform',
  description: 'Review the Terms of Service governing your use of the TAIC e-commerce platform.',
};

const Section = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section className="mb-6 md:mb-8" id={id}>
    <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">{title}</h2>
    <div className="prose prose-md dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-3">
      {children}
    </div>
  </section>
);

export default function TermsOfServicePage() {
  const lastUpdatedDate = "June 9, 2025";
  const jurisdiction = "[Your Jurisdiction, e.g., the State of Florida, USA]";

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white text-center">TAIC Platform - Terms of Service</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mt-2">Last Updated: {lastUpdatedDate}</p>
      </header>

      <Section title="1. Introduction & Agreement" id="introduction">
        <p>Welcome to TAIC, an e-commerce platform owned and operated by Talk Ai 247.com. These Terms of Service ("Terms") govern your access to and use of the TAIC website, services, and applications (collectively, the "Platform"). By creating an account or using our Platform, you agree to be bound by these Terms, our <Link href="/legal/privacy-policy" className="text-primary-600 dark:text-primary-400 hover:underline">Privacy Policy</Link>, and all other policies referenced herein.</p>
      </Section>

      <Section title="2. Account Registration & Responsibilities" id="account-registration">
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Eligibility:</h3>
        <p>You must be at least 18 years of age to create an account.</p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">User Accounts:</h3>
        <p>You are responsible for all activity that occurs under your account. You agree to maintain the security and confidentiality of your password and to implement Two-Factor Authentication (2FA) for enhanced security.</p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Merchant Accounts:</h3>
        <p>Merchants undergo a verification process, including Know Your Customer (KYC) and Anti-Money Laundering (AML) checks, before being approved to sell on the Platform. Merchants are responsible for the accuracy of their profile information and all content associated with their store.</p>
      </Section>

      <Section title="3. User Conduct and Prohibited Activities" id="user-conduct">
        <p>You agree not to engage in any of the following prohibited activities:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Violating any laws, regulations, or third-party rights.</li>
          <li>Using the Platform for any fraudulent or illegal purpose.</li>
          <li>Listing or selling items on our Prohibited Items & Services list (refer to <Link href="/trust-and-safety#safe-shopping" className="text-primary-600 dark:text-primary-400 hover:underline">Trust & Safety Center</Link> for details).</li>
          <li>Infringing upon the intellectual property rights of others.</li>
          <li>Harassing, abusing, or harming another person.</li>
        </ul>
      </Section>

      <Section title="4. Terms of Sale & Platform Role" id="terms-of-sale">
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Platform Only:</h3>
        <p>TAIC is a platform that allows merchants and users to connect. We are not a party to any transaction between a buyer and a seller. We do not manufacture, store, or inspect any of the items sold through our Platform.</p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Disputes:</h3>
        <p>TAIC provides a dispute resolution framework to help users resolve issues (see our <Link href="/trust-and-safety#dispute-resolution" className="text-primary-600 dark:text-primary-400 hover:underline">Dispute Resolution Process</Link>). However, the responsibility for a satisfactory transaction rests with the buyer and seller.</p>
      </Section>

      <Section title="5. Payments, Fees, and TAIC Coin" id="payments-fees">
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Fees:</h3>
        <p>Merchants agree to pay all applicable fees as outlined on our "Fees & Payouts" page (link to be added). TAIC reserves the right to change its fees with prior notice.</p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Payments:</h3>
        <p>The Platform supports payments via traditional fiat methods (e.g., credit card) and our native utility token, TAIC Coin.</p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">TAIC Coin:</h3>
        <p>TAIC Coin is a utility token for use on the Platform. Its use is subject to our <Link href="/legal/risk-disclosure" className="text-primary-600 dark:text-primary-400 hover:underline">TAIC Coin Risk Disclosure</Link>. TAIC makes no warranties regarding the financial value of TAIC Coin.</p>
      </Section>

      <Section title="6. Intellectual Property" id="intellectual-property">
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Our IP:</h3>
        <p>All content and technology on the Platform, including the TAIC and Talk Ai 247.com names and logos, are the exclusive property of Talk Ai 247.com.</p>
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Your Content:</h3>
        <p>You grant TAIC a non-exclusive, worldwide, royalty-free license to use, display, and reproduce the content you post on the Platform (such as product listings and reviews) for the purposes of operating and promoting the Platform.</p>
      </Section>

      <Section title="7. Termination" id="termination">
        <p>We may terminate or suspend your account at our discretion, without notice, for any violation of these Terms. You may terminate your account at any time by following the instructions in your account settings.</p>
      </Section>

      <Section title="8. Disclaimers and Limitation of Liability" id="disclaimers">
        <p>The Platform is provided "as is" without any warranties. TAIC and Talk Ai 247.com shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the Platform.</p>
      </Section>

      <Section title="9. Governing Law" id="governing-law">
        <p>These Terms shall be governed by the laws of {jurisdiction}.</p>
      </Section>

      <Section title="10. Contact Us" id="contact-us">
        <p>If you have any questions about these Terms of Service, please <Link href="/contact" className="text-primary-600 dark:text-primary-400 hover:underline">contact us</Link>.</p>
      </Section>

    </div>
  );
}
