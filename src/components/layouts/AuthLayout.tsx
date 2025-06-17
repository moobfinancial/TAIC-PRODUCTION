'use client';

import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-secondary/10 p-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-headline font-bold tracking-tight text-primary sm:text-5xl">{title}</h1>
        {description && (
          <p className="mt-3 text-lg text-muted-foreground max-w-xl">
            {description}
          </p>
        )}
      </header>
      <main className="w-full flex justify-center">
        {children}
      </main>
      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TAIC. All rights reserved.</p>
        <p className="mt-1">
          <a href="/privacy-policy" className="hover:underline">Privacy Policy</a> &middot; <a href="/terms-of-service" className="hover:underline">Terms of Service</a>
        </p>
      </footer>
    </div>
  );
}
