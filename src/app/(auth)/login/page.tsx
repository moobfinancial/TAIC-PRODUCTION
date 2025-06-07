
'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Gem } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); // Password not used for demo
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard'); // Redirect if already logged in
    }
  }, [user, loading, router]);

  if (loading || user) { // Prevent rendering form if loading or user exists (and redirect is pending)
    return null;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast({
        title: 'Login Failed',
        description: 'Please enter a username.',
        variant: 'destructive',
      });
      return;
    }
    login(username);
    toast({
      title: 'Login Successful!',
      description: `Welcome back, ${username}!`,
    });
    // The useEffect above will handle the redirect to dashboard after login sets the user
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <Gem className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-headline">Welcome Back!</CardTitle>
          <CardDescription>Log in to your TAIC account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
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
                placeholder="Enter your password (demo)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-base"
              />
            </div>
            <Button type="submit" className="w-full text-lg py-6 font-semibold">
              Login
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Button variant="link" asChild className="p-0 h-auto">
              <Link href="/register">Register here</Link>
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
