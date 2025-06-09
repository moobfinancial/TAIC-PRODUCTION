import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | TAIC',
  description: 'Get in touch with the TAIC team for support, inquiries, or feedback.',
};

export default function ContactUsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
      <div className="prose max-w-none">
        <p>This is the placeholder for the Contact Us page.</p>
        <p>Provide various ways for users to reach you, such as a contact form, email address, phone number (if applicable), and links to social media. Clearly state response times if possible.</p>
        {/* Add contact form, email, and other contact details here */}
      </div>
    </div>
  );
}
