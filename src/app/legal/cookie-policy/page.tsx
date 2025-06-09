import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy | TAIC Platform',
  description: 'Learn about how TAIC uses cookies to operate and improve your experience on our platform.',
};

const Section = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section className="mb-6 md:mb-8" id={id}>
    <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">{title}</h2>
    <div className="prose prose-md dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-3">
      {children}
    </div>
  </section>
);

export default function CookiePolicyPage() {
  const lastUpdatedDate = "June 9, 2025"; // Dynamically update or replace

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white text-center">TAIC Platform Cookie Policy</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mt-2">Last Updated: {lastUpdatedDate}</p>
      </header>

      <Section title="1. What Are Cookies?" id="what-are-cookies">
        <p>Cookies are small text files that are stored on your computer or mobile device when you visit a website. They are widely used to make websites work, or work more efficiently, as well as to provide information to the owners of the site. Cookies help us to operate our platform, remember your preferences, and understand how you interact with our services.</p>
      </Section>

      <Section title="2. How We Use Cookies" id="how-we-use-cookies">
        <p>We use cookies for a variety of reasons detailed below. Importantly, in most cases, there are no industry standard options for disabling cookies without completely disabling the functionality and features they add to this site. It is recommended that you leave on all cookies if you are not sure whether you need them or not, in case they are used to provide a service that you use.</p>
        <p>Specifically, we use cookies to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Make our platform work effectively.</li>
          <li>Understand how you use our site and which pages are most popular.</li>
          <li>Improve your overall experience by remembering your preferences.</li>
          <li>Show you relevant information, and potentially advertising, based on your interests.</li>
        </ul>
      </Section>

      <Section title="3. Types of Cookies We Use" id="types-of-cookies">
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Strictly Necessary Cookies</h3>
        <p>These cookies are essential for you to browse the TAIC platform and use its features, such as accessing secure areas of the site (like your account dashboard) and making purchases. Without these cookies, services you have asked for cannot be provided. These cookies cannot be disabled through our cookie management tool as they are crucial for the site's operation.</p>
        
        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Performance & Analytics Cookies</h3>
        <p>These cookies collect information about how you use our website, for instance, which pages you go to most often, and if you get error messages from web pages. These cookies don’t collect information that identifies you. All information these cookies collect is aggregated and therefore anonymous. It is only used to improve how our website works. Examples include cookies from services like Google Analytics.</p>

        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Functional Cookies</h3>
        <p>These cookies allow our website to remember choices you make (such as your user name, language, or the region you are in) and provide enhanced, more personal features. For instance, they can be used to remember your currency preference or login details for future visits. The information these cookies collect may be anonymized, and they cannot track your browsing activity on other websites.</p>

        <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">Marketing & Targeting Cookies</h3>
        <p>These cookies are used to deliver adverts more relevant to you and your interests. They are also used to limit the number of times you see an advertisement as well as help measure the effectiveness of the advertising campaign. They are usually placed by advertising networks with the website operator’s permission. They remember that you have visited a website and this information is shared with other organizations such as advertisers. Quite often targeting or advertising cookies will be linked to site functionality provided by the other organization.</p>
      </Section>

      <Section title="4. Managing Your Cookie Preferences" id="managing-cookies">
        <p>You have the right to decide whether to accept or reject cookies (except for Strictly Necessary cookies). You can exercise your cookie preferences through our Cookie Consent Management tool, which can typically be accessed via a "Cookie Settings" button or link in the website footer or a persistent banner.</p>
        <p>Within this tool, you can opt-in or opt-out of the different categories of non-essential cookies. Please note that blocking some types of cookies may impact your experience on the site and the services we are able to offer.</p>
        <p>Additionally, most web browsers allow some control of most cookies through the browser settings. To find out more about cookies, including how to see what cookies have been set and how to manage and delete them, visit <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">www.allaboutcookies.org</a>.</p>
        <p><em>[Placeholder: Link/Button to Cookie Consent Management Tool - e.g., &lt;button onClick={() => openCookieConsentTool()}&gt;Manage Cookie Settings&lt;/button&gt; - This will require JavaScript integration with a consent management platform/script.]</em></p>
      </Section>

      <Section title="5. Third-Party Cookies" id="third-party-cookies">
        <p>In some special cases, we also use cookies provided by trusted third parties. The following section details which third-party cookies you might encounter through this site.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Google Analytics:</strong> This site uses Google Analytics which is one of the most widespread and trusted analytics solutions on the web for helping us to understand how you use the site and ways that we can improve your experience. These cookies may track things such as how long you spend on the site and the pages that you visit so we can continue to produce engaging content. For more information on Google Analytics cookies, see the official <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">Google Analytics cookie page</a>.</li>
          <li><strong>Payment Processors:</strong> If you make payments on our platform, our third-party payment processors (e.g., Stripe) may set cookies to securely process your transactions and prevent fraud. Please refer to their respective privacy and cookie policies for more details.</li>
          <li><strong>Social Media Platforms:</strong> We may include social media buttons and/or plugins on this site that allow you to connect with your social network in various ways. For these to work, social media sites (e.g., Facebook, X, Instagram) may set cookies through our site which may be used to enhance your profile on their site or contribute to the data they hold for various purposes outlined in their respective privacy policies.</li>
          {/* Add other third-party services as applicable, e.g., advertising partners, live chat tools */} 
        </ul>
        <p>We do not have control over these third-party cookies. We encourage you to review the privacy policies of these third-party services to understand their cookie practices.</p>
      </Section>

      <Section title="6. Changes to This Cookie Policy" id="changes-policy">
        <p>We may update this Cookie Policy from time to time in order to reflect, for example, changes to the cookies we use or for other operational, legal, or regulatory reasons. Please therefore re-visit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.</p>
        <p>The date at the top of this Cookie Policy indicates when it was last updated.</p>
      </Section>

      <Section title="7. Contact Us" id="contact-us">
        <p>If you have any questions about our use of cookies or this Cookie Policy, please contact us:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>By email: <a href="mailto:privacy@taic.com" className="text-primary-600 dark:text-primary-400 hover:underline">privacy@taic.com</a> (Replace with actual contact email)</li>
          <li>Through our <Link href="/contact" className="text-primary-600 dark:text-primary-400 hover:underline">Contact Us</Link> page.</li>
        </ul>
      </Section>

    </div>
  );
}
