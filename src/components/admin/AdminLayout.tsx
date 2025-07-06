'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, ListChecks, Settings, PackagePlus, PackageSearch, LayoutDashboard, Boxes, Users, Shield, LogOut, DollarSign, Wallet, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/admin/audit-log', label: 'Audit Log', icon: Shield },
  { href: '/admin/categories', label: 'Manage Categories', icon: Boxes },
  { href: '/admin/cj-browse', label: 'Browse CJ Products', icon: PackageSearch },
  { href: '/admin/cj-manage', label: 'Manage Imported CJ Products', icon: ListChecks },
  // Financial Oversight Section
  { href: '/admin/merchants/financials', label: 'Merchant Financials', icon: DollarSign },
  { href: '/admin/treasury/overview', label: 'Treasury Overview', icon: Wallet },
  { href: '/admin/payouts/pending', label: 'Pending Payouts', icon: Clock },
  // Add more admin links here as needed
  // { href: '/admin/settings', label: 'Settings', icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const { logout } = useAdminAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-card p-4 border-r shadow-md flex flex-col">
        <div className="mb-8 text-center">
          <Link href="/admin" className="text-2xl font-bold font-headline text-primary">
            Admin Portal
          </Link>
        </div>
        <nav className="space-y-2 flex-1">
          {adminNavItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
          <div className="pt-4">
            <Link
              href="/"
              className={cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Home className="h-5 w-5" />
              <span>Back to Main Site</span>
            </Link>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6 lg:p-8 bg-muted/20">
        {children}
      </main>
    </div>
  );
}
