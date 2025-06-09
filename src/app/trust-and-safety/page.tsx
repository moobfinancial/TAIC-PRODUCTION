import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Trust & Safety Center | TAIC',
  description: 'Learn about our commitment to creating a secure and reliable platform for customers and merchants.',
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10 md:mb-12">
    <h2 className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-4 pb-2 border-b border-gray-300 dark:border-gray-700">{title}</h2>
    <div className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
      {children}
    </div>
  </section>
);

export default function TrustAndSafetyPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="text-center mb-10 md:mb-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">Trust & Safety Center</h1>
      </header>

      <div className="bg-primary-50 dark:bg-primary-900/30 p-6 md:p-8 rounded-lg mb-10 md:mb-12 shadow">
        <h2 className="text-2xl md:text-3xl font-semibold text-primary-700 dark:text-primary-300 mb-3 text-center">Our Commitment to Trust & Safety</h2>
        <p className="text-lg text-primary-600 dark:text-primary-200 text-center max-w-3xl mx-auto">
          At TAIC, trust is the foundation of our marketplace. We are committed to creating a secure and reliable platform where both customers and merchants can interact with confidence. This Trust & Safety Center outlines the policies, tools, and systems we have in place to protect our community.
        </p>
      </div>

      <Section title="Account Security">
        <h3 className="text-xl font-semibold mt-4 mb-2">Protecting Your Account</h3>
        <p>Your account security is a shared responsibility. We urge you to follow these best practices:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use a strong, unique password for your TAIC account that you don't use for any other service.</li>
          <li>Be cautious of phishing attempts. TAIC will never ask for your password or private keys via email or unsolicited messages. Always access TAIC through the official website.</li>
          <li>Regularly review your account activity for any suspicious logins or actions.</li>
          <li>Keep your device's operating system and browser updated.</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-2">Two-Factor Authentication (2FA)</h3>
        <p>We strongly recommend enabling Two-Factor Authentication (2FA) for an extra layer of security on your account. 2FA requires you to provide a second form of verification (e.g., a code from an authenticator app) in addition to your password when logging in. You can enable 2FA in your account security settings.</p>

        <h3 className="text-xl font-semibold mt-6 mb-2">Secure Wallet Integration</h3>
        <p>When you connect your cryptocurrency wallet (e.g., MetaMask, Fantom Wallet) to TAIC for transactions, we do so securely. TAIC never has access to your private keys or full control over your wallet. All transactions must be authorized by you directly within your wallet application. This ensures that you remain in control of your funds.</p>
      </Section>

      <Section title="Safe Shopping & Selling">
        <h3 className="text-xl font-semibold mt-4 mb-2">Prohibited Items & Services</h3>
        <p>To maintain a safe and legal marketplace, TAIC prohibits the sale of certain items and services. This includes, but is not limited to, illegal goods, counterfeit products, weapons, hazardous materials, and adult content. A comprehensive list of prohibited items can be found in our Merchant Agreement and platform policies. Listings violating these policies will be removed, and accounts may be suspended.</p>

        <h3 className="text-xl font-semibold mt-6 mb-2">Seller Verification (KYC/AML)</h3>
        <p>All merchants undergo a Know Your Customer (KYC) and Anti-Money Laundering (AML) verification process before they can sell on TAIC. This helps us confirm the identity and legitimacy of our sellers, prevent fraud, and comply with regulatory requirements. This process contributes to a more trustworthy environment for everyone.</p>

        <h3 className="text-xl font-semibold mt-6 mb-2">Community Code of Conduct</h3>
        <p>We expect all users – shoppers and merchants alike – to interact respectfully and honestly. Our Community Code of Conduct outlines guidelines for communication, reviews, and general behavior on the platform. Violations can lead to warnings, content removal, or account suspension. We strive to foster a positive and professional community.</p>
      </Section>

      <Section title="Dispute Resolution">
        <h3 className="text-xl font-semibold mt-4 mb-2">Buyer-Seller Protection</h3>
        <p>We understand that sometimes orders don't go as planned. TAIC provides a dispute resolution process to help address issues such as items not received, items significantly not as described, or unauthorized transactions. Our goal is to facilitate fair outcomes for both buyers and sellers.</p>

        <h3 className="text-xl font-semibold mt-6 mb-2">How to Open a Dispute</h3>
        <p>If you encounter an issue with an order, we first encourage you to communicate directly with the other party to try and resolve it amicably. If a resolution cannot be reached, you can open a formal dispute through your order history page. Provide all relevant information and evidence to support your claim. Detailed steps are available in our <Link href="/help-center" className='text-primary-600 dark:text-primary-400 hover:underline'>Help Center</Link>.</p>

        <h3 className="text-xl font-semibold mt-6 mb-2">Our Mediation Process</h3>
        <p>Once a dispute is opened, TAIC's support team may step in to mediate. We will review the information provided by both the buyer and the seller, and may request additional details. Our team will then make a fair and impartial decision based on our platform policies and the evidence presented. Our aim is to resolve disputes efficiently and equitably.</p>
      </Section>

      <Section title="Fraud & Scam Prevention">
        <h3 className="text-xl font-semibold mt-4 mb-2">How We Protect You</h3>
        <p>TAIC employs a variety of security measures, including AI-powered monitoring systems, to detect and prevent fraudulent activity on our platform. We continuously work to identify suspicious patterns, unauthorized access attempts, and listings that violate our policies. We also collaborate with payment processors to ensure secure transactions.</p>

        <h3 className="text-xl font-semibold mt-6 mb-2">Common Scams to Avoid</h3>
        <p>Be vigilant against common online scams. Here are a few tips:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Never share your password or private keys.</strong> TAIC staff will never ask for them.</li>
          <li><strong>Keep transactions on the TAIC platform.</strong> Avoid requests from sellers or buyers to complete payments or communicate outside of TAIC. Transactions made off-platform are not covered by our protection policies.</li>
          <li><strong>Be wary of deals that seem too good to be true.</strong> If an offer is significantly below market value or pressures you into a quick decision, exercise caution.</li>
          <li><strong>Verify website URLs.</strong> Always ensure you are on the official TAIC website (taic.com or its official subdomains) before entering login information or making payments.</li>
        </ul>
      </Section>

      <Section title="Reporting a Problem">
        <h3 className="text-xl font-semibold mt-4 mb-2">How to Report a Violation</h3>
        <p>If you encounter a suspicious listing, a user violating our policies, a security concern, or any activity that seems inappropriate, please report it to us immediately. You can typically find reporting options on product pages, user profiles, or through our <Link href="/contact" className='text-primary-600 dark:text-primary-400 hover:underline'>Contact Us</Link> page. Your reports are valuable in helping us maintain a safe platform.</p>

        <h3 className="text-xl font-semibold mt-6 mb-2">What Happens Next</h3>
        <p>When we receive a report, our dedicated team will review it thoroughly. The actions we take will depend on the nature and severity of the violation and may include removing content, issuing warnings, or suspending/banning accounts. While we may not always be able to share the specific outcome of an investigation due to privacy reasons, please be assured that we take all reports seriously.</p>
      </Section>

      <div className="mt-12 text-center">
        <p className="text-gray-600 dark:text-gray-400">For any further questions or concerns, please visit our <Link href="/help-center" className='text-primary-600 dark:text-primary-400 hover:underline'>Help Center</Link> or <Link href="/contact" className='text-primary-600 dark:text-primary-400 hover:underline'>Contact Us</Link>.</p>
      </div>
    </div>
  );
}
