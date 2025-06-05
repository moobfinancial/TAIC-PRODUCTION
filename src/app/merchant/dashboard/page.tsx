
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, Package, ShoppingBag, DollarSign, Settings, BarChart3, LogOut, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Placeholder for merchant data - in a real app, this would come from auth context
const MOCK_MERCHANT_NAME = "Demo Merchant Store";

export default function MerchantDashboardPage() {
  const router = useRouter();

  // Simulate logout
  const handleLogout = () => {
    // In a real app, clear merchant auth state
    console.log('Simulated Merchant Logout');
    router.push('/merchant/login');
  };

  const dashboardSections = [
    { title: "Manage Products", description: "View, add, edit, or remove your product listings.", icon: <Package className="h-8 w-8 text-primary" />, href: "/merchant/products", cta: "Go to Products" },
    { title: "View Orders", description: "Track incoming orders and manage their status.", icon: <ShoppingBag className="h-8 w-8 text-primary" />, href: "/merchant/orders", cta: "View Orders" },
    { title: "Financials & Payouts", description: "Review sales, commissions, and request payouts.", icon: <DollarSign className="h-8 w-8 text-primary" />, href: "/merchant/financials", cta: "View Financials" },
    { title: "Cashback & Promotions", description: "Configure cashback rewards and other promotions.", icon: <BarChart3 className="h-8 w-8 text-primary" />, href: "/merchant/promotions", cta: "Manage Promotions" },
    { title: "Account Settings", description: "Update your store profile and payout information.", icon: <Settings className="h-8 w-8 text-primary" />, href: "/merchant/settings", cta: "Edit Settings" },
  ];

  return (
    <div className="space-y-12">
      <header className="border-b pb-6 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
                <h1 className="text-3xl sm:text-4xl font-headline font-bold tracking-tight">Merchant Dashboard</h1>
                <p className="text-lg text-muted-foreground mt-1">Welcome back, {MOCK_MERCHANT_NAME}!</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
                 <Button asChild size="lg">
                    <Link href="/merchant/products/new">
                        <PlusCircle className="mr-2 h-5 w-5" /> Add New Product
                    </Link>
                 </Button>
                <Button onClick={handleLogout} variant="outline" size="lg">
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
            </div>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardSections.map((section) => (
          <Card key={section.title} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
            <CardHeader className="items-center text-center">
              {section.icon}
              <CardTitle className="mt-4 font-headline text-xl">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow text-center">
              <CardDescription>{section.description}</CardDescription>
            </CardContent>
            <CardFooter className="p-4 pt-0 text-center">
              <Button asChild className="w-full max-w-xs mx-auto" variant="outline">
                {/* For now, links might go to placeholder pages or just # */}
                <Link href={section.href || "#"}>
                  {section.cta}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card className="mt-12 shadow-lg">
        <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-2">
                <LayoutDashboard className="h-7 w-7 text-primary"/> Quick Overview
            </CardTitle>
            <CardDescription>A snapshot of your store's performance (simulated data).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-secondary/30 rounded-lg">
                <p className="text-3xl font-bold text-primary">125</p>
                <p className="text-sm text-muted-foreground">Total Sales (Demo TAIC)</p>
            </div>
             <div className="p-4 bg-secondary/30 rounded-lg">
                <p className="text-3xl font-bold text-primary">5</p>
                <p className="text-sm text-muted-foreground">New Orders Today</p>
            </div>
             <div className="p-4 bg-secondary/30 rounded-lg">
                <p className="text-3xl font-bold text-primary">250 TAIC</p>
                <p className="text-sm text-muted-foreground">Pending Payout</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
