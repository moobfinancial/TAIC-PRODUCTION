import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Help Center | TAIC',
  description: 'Find answers to common questions and get support for the TAIC platform.',
};

const FAQItem = ({ question, children }: { question: string; children: React.ReactNode }) => (
  <details className="mb-4 group">
    <summary className="flex items-center justify-between p-4 font-medium list-none bg-gray-100 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
      {question}
      <span className="ml-2 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 group-open:rotate-90">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </span>
    </summary>
    <div className="p-4 bg-white dark:bg-gray-900 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg">
      <div className="prose prose-sm sm:prose dark:prose-invert max-w-none">
        {children}
      </div>
    </div>
  </details>
);

export default function HelpCenterPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="text-center mb-10 md:mb-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">Help Center</h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Welcome to the TAIC Help Center. Find answers to your questions below.
        </p>
        <div className="mt-8 max-w-md mx-auto">
          <input 
            type="search" 
            placeholder="Search for help... (Search functionality coming soon)" 
            className="w-full px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 shadow-sm"
          />
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-8 md:gap-12">
        {/* Support for Shoppers */}
        <section>
          <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-gray-800 dark:text-gray-100 border-b pb-3 border-gray-300 dark:border-gray-700">Support for Shoppers</h2>
          
          <h3 className="text-xl font-semibold mt-6 mb-4 text-gray-700 dark:text-gray-200">My Account</h3>
          <FAQItem question="How do I create a TAIC account?">
            <p>You can create a TAIC account by clicking the 'Sign Up' button, usually found in the top right corner of the page. You can sign up using your email address and a secure password, or by connecting a compatible cryptocurrency wallet like MetaMask or Fantom Wallet for a streamlined experience.</p>
          </FAQItem>
          <FAQItem question="How do I reset my password?">
            <p>If you've forgotten your password, click on the 'Login' button and then select the 'Forgot Password?' link. Enter the email address associated with your account, and we'll send you instructions on how to reset it.</p>
          </FAQItem>
          <FAQItem question="How can I update my profile information and shipping address?">
            <p>Once logged in, navigate to your 'My Account' or 'Profile' section. From there, you should find options to edit your personal details, including your name, email, and shipping addresses.</p>
          </FAQItem>
          <FAQItem question="How do I secure my account with Two-Factor Authentication (2FA)?">
            <p>We highly recommend enabling 2FA for enhanced security. Go to your 'Account Settings' or 'Security' section. You'll typically find an option to set up 2FA using an authenticator app (like Google Authenticator or Authy) or SMS verification.</p>
          </FAQItem>
          <FAQItem question="How can I view my order history?">
            <p>Your order history is available in your 'My Account' section, usually under a tab or link named 'Orders' or 'Order History'.</p>
          </FAQItem>
          <FAQItem question="How do I delete my account?">
            <p>To request account deletion, please contact our support team through the <Link href="/contact" className='text-primary-600 dark:text-primary-400 hover:underline'>Contact Us</Link> page. Please note that some information may be retained for legal or regulatory purposes.</p>
          </FAQItem>

          <h3 className="text-xl font-semibold mt-8 mb-4 text-gray-700 dark:text-gray-200">Payments & Orders</h3>
          <FAQItem question="What payment methods do you accept?">
            <p>TAIC accepts payments using our native TAIC Coin. We also support payments via major credit cards (Visa, MasterCard, American Express) through our secure payment processor.</p>
          </FAQItem>
          <FAQItem question="How do I place an order?">
            <p>Browse our platform, add desired items to your cart, and proceed to checkout. You'll be guided through selecting your shipping address and payment method to complete your purchase.</p>
          </FAQItem>
          <FAQItem question="How can I track my shipment?">
            <p>Once your order has shipped, you will receive a shipping confirmation email containing a tracking number and a link to the carrier's website. You can also find tracking information in your 'Order History' section.</p>
          </FAQItem>
          <FAQItem question="What is your return and refund policy?">
            <p>Please refer to our detailed <Link href="/legal/refund-policy" className='text-primary-600 dark:text-primary-400 hover:underline'>Refund & Returns Policy</Link> page for complete information on eligibility, processes, and timelines.</p>
          </FAQItem>
          <FAQItem question="How do I initiate a return?">
            <p>To initiate a return, please visit your 'Order History', select the relevant order, and follow the instructions for returns. If you need further assistance, consult our <Link href="/legal/refund-policy" className='text-primary-600 dark:text-primary-400 hover:underline'>Refund & Returns Policy</Link> or contact support.</p>
          </FAQItem>
          <FAQItem question="There's an issue with my order (wrong item, damaged). What do I do?">
            <p>We apologize for any inconvenience. Please contact our customer support team immediately via the <Link href="/contact" className='text-primary-600 dark:text-primary-400 hover:underline'>Contact Us</Link> page with your order number and details of the issue. We'll work to resolve it as quickly as possible.</p>
          </FAQItem>

          <h3 className="text-xl font-semibold mt-8 mb-4 text-gray-700 dark:text-gray-200">TAIC Coin & Rewards</h3>
          <FAQItem question="What is TAIC Coin?">
            <p>TAIC Coin is our platform's native cryptocurrency, built on the Fantom blockchain. It's designed to facilitate seamless transactions, reward shoppers with cashback, and power unique features within the TAIC ecosystem.</p>
          </FAQItem>
          <FAQItem question="How do I get TAIC Coin?">
            <p>You can earn TAIC Coin as cashback on eligible purchases. Depending on future platform features, you might also be able to purchase TAIC Coin directly or acquire it through promotional activities.</p>
          </FAQItem>
          <FAQItem question="How do I pay for an order using TAIC Coin?">
            <p>At checkout, if you have a sufficient TAIC Coin balance in your connected wallet, you will see an option to pay with TAIC Coin. Simply select this option and authorize the transaction through your wallet.</p>
          </FAQItem>
          <FAQItem question="Where can I see my TAIC Coin balance?">
            <p>Your TAIC Coin balance will be visible in your connected cryptocurrency wallet. Some areas of your TAIC account dashboard may also display your balance if your wallet is connected.</p>
          </FAQItem>
          <FAQItem question="What is the 'Stake to Shop' program?">
            <p>The 'Stake to Shop' program allows you to 'stake' (lock up) a certain amount of your TAIC Coin in a smart contract to earn additional rewards, potentially including enhanced cashback rates or exclusive benefits on the platform.</p>
          </FAQItem>
          <FAQItem question="How do I stake my TAIC Coin to get more rewards?">
            <p>Details on how to participate in the 'Stake to Shop' program, including minimum staking amounts and reward structures, will be available on our dedicated Staking page (coming soon).</p>
          </FAQItem>
          <FAQItem question="Are there any risks with holding TAIC Coin?">
            <p>Yes, like all cryptocurrencies, holding TAIC Coin involves risks, including market volatility and security risks. We strongly encourage you to read our full <Link href="/legal/risk-disclosure" className='text-primary-600 dark:text-primary-400 hover:underline'>TAIC Coin Risk Disclosure</Link> page before acquiring or using TAIC Coin.</p>
          </FAQItem>

          <h3 className="text-xl font-semibold mt-8 mb-4 text-gray-700 dark:text-gray-200">AI Features</h3>
          <FAQItem question="How does the AI Shopping Assistant work?">
            <p>Our AI Shopping Assistant helps you find products, get recommendations, and enhance your shopping experience by understanding your queries and preferences. You can interact with it through a chat interface on the site.</p>
          </FAQItem>
          <FAQItem question="How can I use the Virtual Try-On feature?">
            <p>For eligible apparel items, you'll see a 'Virtual Try-On' button. This feature allows you to upload a photo of yourself or use a model to see how the clothing might look on you before purchasing.</p>
          </FAQItem>
          <FAQItem question="Is my data safe when using AI features?">
            <p>We are committed to protecting your privacy. Data used by our AI features is handled in accordance with our <Link href="/legal/privacy-policy" className='text-primary-600 dark:text-primary-400 hover:underline'>Privacy Policy</Link>. We aim to anonymize or pseudonymize data where possible and use it only to improve your shopping experience.</p>
          </FAQItem>
        </section>

        {/* Support for Merchants */}
        <section>
          <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-gray-800 dark:text-gray-100 border-b pb-3 border-gray-300 dark:border-gray-700">Support for Merchants</h2>
          
          <h3 className="text-xl font-semibold mt-6 mb-4 text-gray-700 dark:text-gray-200">Getting Started</h3>
          <FAQItem question="How do I register as a merchant on TAIC?">
            <p>To become a merchant, look for the 'Sell on TAIC' or 'Merchant Registration' link, typically in the website footer or header. You'll need to fill out an application form and provide necessary business information.</p>
          </FAQItem>
          <FAQItem question="What information is required for the KYC/AML verification process?">
            <p>Our Know Your Customer (KYC) and Anti-Money Laundering (AML) process requires identity verification for the business owner(s) and information about your business entity. Specific document requirements will be outlined during the registration process. This is crucial for platform security and regulatory compliance.</p>
          </FAQItem>
          <FAQItem question="How do I set up my merchant profile and storefront?">
            <p>Once your registration is approved, you'll gain access to your Merchant Dashboard. From there, you can customize your storefront, add your logo, business description, policies, and other relevant information.</p>
          </FAQItem>
          <FAQItem question="What are the initial fees for setting up a store?">
            <p>For detailed information on any setup fees, subscription costs, or commission rates, please refer to our dedicated 'Fees' page (link to be added) or the terms outlined in your Merchant Agreement.</p>
          </FAQItem>

          <h3 className="text-xl font-semibold mt-8 mb-4 text-gray-700 dark:text-gray-200">Managing My Store</h3>
          <FAQItem question="How do I list a new product?">
            <p>In your Merchant Dashboard, navigate to the 'Products' section and select 'Add New Product'. You'll be prompted to enter details like product title, description, price, images, categories, and inventory levels.</p>
          </FAQItem>
          <FAQItem question="What are the guidelines for product photos and descriptions?">
            <p>We recommend high-quality, clear product photos from multiple angles. Descriptions should be accurate, detailed, and engaging. Specific guidelines on image dimensions and content policies can be found in the Merchant Handbook or support section of your dashboard.</p>
          </FAQItem>
          <FAQItem question="How do I manage my product inventory?">
            <p>Inventory levels can be managed through the 'Products' section of your Merchant Dashboard. You can update stock counts manually or, for some integrations, inventory may sync automatically.</p>
          </FAQItem>
          <FAQItem question="Can I use the AI tools to help write my product descriptions?">
            <p>Yes! TAIC offers AI-powered tools that can assist you in generating compelling and SEO-friendly product descriptions. Look for these tools within the product listing or editing interface in your Merchant Dashboard.</p>
          </FAQItem>
          <FAQItem question="How do I set up shipping options and rates?">
            <p>Shipping settings are typically configured in your Merchant Dashboard. You can define shipping zones, methods (e.g., standard, express), and calculate rates based on weight, price, or destination.</p>
          </FAQItem>

          <h3 className="text-xl font-semibold mt-8 mb-4 text-gray-700 dark:text-gray-200">Payments & Payouts</h3>
          <FAQItem question="How do I receive payments from sales?">
            <p>Payments from your sales (minus applicable fees and commissions) will be disbursed to your designated bank account or cryptocurrency wallet according to our payout schedule. You'll need to set up your payout details in the Merchant Dashboard.</p>
          </FAQItem>
          <FAQItem question="What is the payout schedule?">
            <p>Our standard payout schedule will be detailed in your Merchant Agreement and visible in your dashboard. Payouts are typically processed on a regular cycle (e.g., weekly, bi-weekly) after a holding period.</p>
          </FAQItem>
          <FAQItem question="How do I set up my store to accept TAIC Coin?">
            <p>To accept TAIC Coin, you'll need to connect a compatible Fantom wallet address in your Merchant Dashboard's payment settings. Sales made in TAIC Coin will be credited to this wallet.</p>
          </FAQItem>
          <FAQItem question="What are the transaction fees for fiat vs. TAIC Coin payments?">
            <p>Transaction fees may differ based on the payment method used by the customer. Generally, transactions in TAIC Coin aim to have lower fees. A detailed fee schedule is available on our 'Fees' page or in your Merchant Agreement.</p>
          </FAQItem>
          <FAQItem question="How do I view my financial reports and sales analytics?">
            <p>Your Merchant Dashboard includes a section for financial reporting and sales analytics. Here you can track your sales, revenue, fees, payouts, and gain insights into your store's performance.</p>
          </FAQItem>

          <h3 className="text-xl font-semibold mt-8 mb-4 text-gray-700 dark:text-gray-200">Merchant Tools & Policies</h3>
          <FAQItem question="How does the merchant-configurable cashback system work?">
            <p>As a merchant, you can choose to offer additional cashback in TAIC Coin on your products to incentivize sales. You can configure these cashback percentages within your Merchant Dashboard, subject to platform guidelines and your budget.</p>
          </FAQItem>
          <FAQItem question="What are TAIC's policies on prohibited items?">
            <p>TAIC maintains a strict list of prohibited items to ensure platform safety and legality. Please review our 'Prohibited Items Policy' in the Merchant Agreement or support documentation before listing products.</p>
          </FAQItem>
          <FAQItem question="How do I handle customer returns and disputes?">
            <p>You are expected to adhere to TAIC's platform-wide return policy and your own stated return policy if it offers more favorable terms. The Merchant Dashboard provides tools for managing return requests and communicating with customers. TAIC may mediate in disputes if necessary.</p>
          </FAQItem>
          <FAQItem question="How can I use the analytics dashboard to grow my business?">
            <p>Our analytics dashboard provides valuable data on your sales trends, top-performing products, customer demographics (aggregated and anonymized), and traffic sources. Use these insights to optimize your listings, marketing efforts, and inventory management.</p>
          </FAQItem>
        </section>
      </div>
    </div>
  );
}
