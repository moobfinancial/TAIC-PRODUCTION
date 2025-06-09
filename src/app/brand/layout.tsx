import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brand Assets - TAIC',
  description: 'Download TAIC brand assets and guidelines for Trusted AI Commerce.',
};

export default function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>; // Or <div>{children}</div> if a wrapper is needed for styling
}
