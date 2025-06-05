
import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar'; // Re-using main navbar for now
import { Footer } from '@/components/layout/Footer'; // Re-using main footer

export const metadata: Metadata = {
  title: 'TAIC Merchant Center',
  description: 'Manage your store on TAIC Showcase.',
};

export default function MerchantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* We might want a dedicated merchant navbar later, or conditional rendering in main Navbar */}
      {/* <Navbar />  Re-evaluate if needed. For now, let RootLayout handle Navbar */}
      <main className="flex-grow container py-8">
        {children}
      </main>
      {/* <Footer /> Re-evaluate if needed. For now, let RootLayout handle Footer */}
    </div>
  );
}
