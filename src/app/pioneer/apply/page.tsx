'use client';

import React from 'react';
import { PioneerApplicationForm } from '@/components/pioneer/PioneerApplicationForm';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Users, Zap, Shield } from 'lucide-react';

export default function PioneerApplicationPage() {
  const router = useRouter();

  const handleSuccess = () => {
    // Redirect to success page or dashboard
    router.push('/pioneer/success');
  };

  const handleCancel = () => {
    // Redirect back to home or pioneer program info
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            Pioneer Program
          </Badge>
          <h1 className="text-4xl md:text-5xl font-headline font-bold mb-4">
            Join the TAIC Pioneer Program
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Become an early advocate for the future of decentralized commerce. 
            Help shape TAIC's ecosystem while earning exclusive rewards and recognition.
          </p>
          
          {/* Key Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-12">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Exclusive Rewards</h3>
                <p className="text-sm text-muted-foreground">
                  Earn TAIC tokens and exclusive benefits
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Community Access</h3>
                <p className="text-sm text-muted-foreground">
                  Join our exclusive Pioneer community
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <Zap className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Early Access</h3>
                <p className="text-sm text-muted-foreground">
                  Get first access to new features
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <Shield className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Recognition</h3>
                <p className="text-sm text-muted-foreground">
                  Build your reputation in the ecosystem
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Application Form */}
        <div className="max-w-4xl mx-auto">
          <PioneerApplicationForm
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            className="bg-white rounded-lg shadow-lg p-8"
          />
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>
            Questions about the Pioneer Program? 
            <a href="mailto:pioneers@taic.com" className="text-primary hover:underline ml-1">
              Contact our team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
