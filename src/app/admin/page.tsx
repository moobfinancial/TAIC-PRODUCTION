// src/app/admin/page.tsx
'use client';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <LayoutDashboard className="mr-2 h-6 w-6" />
              Admin Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Welcome to the Admin Dashboard. Select an option from the sidebar to get started.</p>
            {/* Add more dashboard widgets or summaries here */}
          </CardContent>
        </Card>
        {/* You can add more cards or components for a richer dashboard */}
      </div>
    </AdminLayout>
  );
}
