import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Shopping Assistant | TAIC',
  description: 'Chat with our AI to find products, get recommendations, and more.',
};

export default function AiShoppingNowLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
