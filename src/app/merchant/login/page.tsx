
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Store } from 'lucide-react';

export default function MerchantLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast({
        title: 'Login Failed',
        description: 'Please enter username and password.',
        variant: 'destructive',
      });
      return;
    }
    // Simulate login
    console.log('Simulated Merchant Login:', { username, password });
    toast({
      title: 'Merchant Login Successful! (Simulated)',
      description: `Welcome back, ${username}! Redirecting to your dashboard...`,
    });
    // In a real app, you'd set merchant auth state here
    router.push('/merchant/dashboard');
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <Store className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-headline">Merchant Login</CardTitle>
          <CardDescription>Access your TAIC Showcase Merchant Dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your merchant username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <Button type="submit" className="w-full text-lg py-6 font-semibold">
              <LogIn className="mr-2 h-5 w-5" /> Login to Merchant Dashboard
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have a merchant account?{' '}
            <Button variant="link" asChild className="p-0 h-auto">
              <Link href="/merchant/register">Register here</Link>
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
