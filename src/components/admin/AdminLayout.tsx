'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, Settings, PackagePlus, PackageSearch, LayoutDashboard, Boxes } from 'lucide-react'; // Added Boxes for Categories
import { cn } from '@/lib/utils';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/categories', label: 'Manage Categories', icon: Boxes },
  { href: '/admin/cj-browse', label: 'Browse CJ Products', icon: PackageSearch },
  { href: '/admin/cj-manage', label: 'Manage Imported CJ Products', icon: ListChecks },
  // Add more admin links here as needed
  // { href: '/admin/settings', label: 'Settings', icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-card p-4 border-r shadow-md">
        <div className="mb-8 text-center">
          <Link href="/admin/categories" className="text-2xl font-bold font-headline text-primary">
            Admin Portal
          </Link>
        </div>
        <nav className="space-y-2">
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
        <div className="mt-auto pt-8">
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
      </aside>
      <main className="flex-1 p-6 lg:p-8 bg-muted/20">
        {children}
      </main>
    </div>
  );
}
