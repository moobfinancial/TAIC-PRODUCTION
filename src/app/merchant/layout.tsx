
import type { Metadata } from 'next';
import { MerchantAuthWrapper } from '@/components/merchant/MerchantAuthWrapper';

export const metadata: Metadata = {
  title: 'TAIC Merchant Center',
  description: 'Manage your store on TAIC.',
};

export default function MerchantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Merchant-specific navbar could be added here if needed, or rely on RootLayout's Navbar */}
      <main className="flex-grow container py-8">
        <MerchantAuthWrapper>
          {children}
        </MerchantAuthWrapper>
      </main>
      {/* Merchant-specific footer could be added here */}
    </div>
  );
}
