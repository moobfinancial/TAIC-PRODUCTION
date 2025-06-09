
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Store, UserPlus, Loader2 } from 'lucide-react';

export default function MerchantRegisterPage() {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Basic validation
    if (!businessName.trim() || !email.trim() || !username.trim() || !password.trim()) {
      toast({
        title: 'Registration Failed',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if agreed to terms
    if (!agreedToTerms) {
      toast({
        title: 'Registration Failed',
        description: 'You must agree to the Merchant Agreement to register.',
        variant: 'destructive',
      });
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      toast({
        title: 'Registration Failed',
        description: 'Passwords do not match.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/merchant/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
          businessName,
          businessDescription,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      toast({
        title: 'Registration Successful',
        description: `Welcome, ${businessName}! Your merchant account is ready. Please login.`,
      });
      
      router.push('/merchant/login?registered=true');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      toast({
        title: 'Registration Failed',
        description: err instanceof Error ? err.message : 'Registration failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input 
                  id="businessName" 
                  placeholder="Your Business Name" 
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input 
                  id="username" 
                  placeholder="Choose a username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="your@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Create a secure password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                placeholder="Confirm your password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessDescription">Business Description</Label>
              <Textarea 
                id="businessDescription" 
                placeholder="Tell customers about your business..." 
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                rows={3}
                disabled={isLoading}
              />
            </div>
            <div className="items-top flex space-x-2 py-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                disabled={isLoading}
                aria-required="true"
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="terms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I have read and agree to the{' '}
                  <Link href="/legal/merchant-agreement" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    Merchant Agreement
                  </Link>
                  . *
                </label>
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" /> Register as Merchant
                </>
              )}
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
