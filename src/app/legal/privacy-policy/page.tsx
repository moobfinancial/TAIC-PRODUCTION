import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | TAIC Platform',
  description: 'Learn how TAIC (owned by Talk Ai 247.com) collects, uses, discloses, and safeguards your information when you use our platform.',
};

const Section = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section className="mb-6 md:mb-8" id={id}>
    <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">{title}</h2>
    <div className="prose prose-md dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-3">
      {children}
    </div>
  </section>
);

export default function PrivacyPolicyPage() {
  const lastUpdatedDate = "June 9, 2025";
  const contactEmail = "[privacy@talkai247.com or similar]"; // Replace with actual DPO/Privacy contact email

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white text-center">TAIC Platform - Privacy Policy</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mt-2">Last Updated: {lastUpdatedDate}</p>
      </header>

      <Section title="1. Introduction" id="introduction">
        <p>Talk Ai 247.com ("we," "us," "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our TAIC Platform.</p>
      </Section>

      <Section title="2. Information We Collect" id="information-collected">
        <p>We may collect the following types of personal information:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Personal Identification Information:</strong> Name, email address, shipping address, phone number.</li>
          <li><strong>Merchant Verification Information:</strong> Business details and information required for KYC/AML compliance.</li>
          <li><strong>Financial Information:</strong> Credit card numbers (processed by our third-party payment gateways like Stripe) and cryptocurrency wallet addresses.</li>
          <li><strong>Transaction Information:</strong> Details about products you buy or sell, order details, payment methods, and cashback earned.</li>
          <li><strong>Technical Information:</strong> IP address, browser type, device information, operating system, and usage data collected via cookies and similar technologies.</li>
          <li><strong>Profile Information:</strong> Your username, password, purchase history, and product preferences.</li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information" id="how-we-use-information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Create and manage your account.</li>
          <li>Process your transactions and fulfill orders.</li>
          <li>Provide and personalize our services, including our AI Shopping Assistant.</li>
          <li>Communicate with you about your account, orders, and promotions.</li>
          <li>Prevent fraud, enhance security, and maintain the integrity of our Platform.</li>
          <li>Comply with legal and regulatory obligations.</li>
          <li>Analyze usage to improve our Platform and services.</li>
        </ul>
      </Section>

      <Section title="4. How We Share Your Information" id="how-we-share-information">
        <p>We do not sell your personal information. We may share it with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Merchants:</strong> To fulfill your orders.</li>
          <li><strong>Service Providers:</strong> Third parties that perform services for us, such as payment processors (e.g., Stripe), shipping carriers, and cloud hosting services.</li>
          <li><strong>Legal Authorities:</strong> If required by law, subpoena, or other legal process.</li>
          <li><strong>Business Transfers:</strong> In connection with a merger, sale of company assets, or acquisition.</li>
        </ul>
      </Section>

      <Section title="5. Data Security" id="data-security">
        <p>We implement a variety of security measures, including encryption and access controls, to protect the safety of your personal information. However, no electronic transmission or storage is 100% secure.</p>
      </Section>

      <Section title="6. Data Retention" id="data-retention">
        <p>We will retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy and to comply with our legal obligations.</p>
      </Section>

      <Section title="7. Your Data Protection Rights (e.g., GDPR)" id="data-protection-rights">
        <p>Depending on your location, you may have the following rights regarding your personal data:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>The right to access, update, or delete the information we have on you.</li>
          <li>The right of rectification.</li>
          <li>The right to object to processing.</li>
          <li>The right of restriction.</li>
          <li>The right to data portability.</li>
          <li>The right to withdraw consent.</li>
        </ul>
        <p>To exercise these rights, please contact us at <a href={`mailto:${contactEmail}`} className="text-primary-600 dark:text-primary-400 hover:underline">{contactEmail}</a>.</p>
      </Section>

      <Section title="8. Cookie Policy" id="cookie-policy">
        <p>We use cookies to help operate and improve the Platform. For more detailed information on the cookies we use, please see our full <Link href="/legal/cookie-policy" className="text-primary-600 dark:text-primary-400 hover:underline">Cookie Policy</Link>.</p>
      </Section>

      <Section title="9. Contact Us" id="contact-us">
        <p>If you have any questions about this Privacy Policy, please contact our Data Protection Officer at <a href={`mailto:${contactEmail}`} className="text-primary-600 dark:text-primary-400 hover:underline">{contactEmail}</a>.</p>
      </Section>

    </div>
  );
}
