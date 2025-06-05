
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Store, UserPlus } from 'lucide-react';

export default function MerchantRegisterPage() {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !email.trim() || !username.trim() || !password.trim()) {
      toast({
        title: 'Registration Failed',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    // Simulate registration
    console.log('Simulated Merchant Registration:', { businessName, email, username, password, businessDescription });
    toast({
      title: 'Merchant Registration Successful! (Simulated)',
      description: `Welcome, ${businessName}! Your merchant account is ready. Please login.`,
    });
    router.push('/merchant/login');
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <Store className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-headline">Become a TAIC Merchant</CardTitle>
          <CardDescription>Register your business to start selling on TAIC Showcase.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business/Store Name</Label>
              <Input
                id="businessName"
                type="text"
                placeholder="Your Awesome Store"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Contact Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@yourstore.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                    id="username"
                    type="text"
                    placeholder="yourstore_admin"
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
                    placeholder="Choose a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="text-base"
                />
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessDescription">Brief Business Description (Optional)</Label>
              <Textarea
                id="businessDescription"
                placeholder="Tell us about your business..."
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                className="text-base min-h-[100px]"
              />
            </div>
            <Button type="submit" className="w-full text-lg py-6 font-semibold">
              <UserPlus className="mr-2 h-5 w-5" /> Register My Business
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Already have a merchant account?{' '}
            <Button variant="link" asChild className="p-0 h-auto">
              <Link href="/merchant/login">Login here</Link>
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
