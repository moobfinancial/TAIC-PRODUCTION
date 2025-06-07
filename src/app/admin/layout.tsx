'use client';

import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Toaster } from '@/components/ui/toaster';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <AdminLayout>
        {children}
        <Toaster />
      </AdminLayout>
    </AdminAuthProvider>
  );
}
