'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Mail, Clock, Users, ArrowRight, Home } from 'lucide-react';

export default function PioneerSuccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <div className="mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Application Submitted
            </Badge>
          </div>

          {/* Success Message */}
          <h1 className="text-4xl font-headline font-bold mb-4">
            Thank You for Applying!
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Your TAIC Pioneer Program application has been successfully submitted. 
            We're excited to review your application and welcome you to our community.
          </p>

          {/* What Happens Next */}
          <Card className="text-left mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                What Happens Next?
              </CardTitle>
              <CardDescription>
                Here's what you can expect in the coming days
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-blue-600">1</span>
                </div>
                <div>
                  <h3 className="font-semibold">Email Confirmation</h3>
                  <p className="text-sm text-muted-foreground">
                    You'll receive a confirmation email within the next few minutes with your application details.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-blue-600">2</span>
                </div>
                <div>
                  <h3 className="font-semibold">Application Review</h3>
                  <p className="text-sm text-muted-foreground">
                    Our team will carefully review your application over the next 3-5 business days.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-blue-600">3</span>
                </div>
                <div>
                  <h3 className="font-semibold">Decision Notification</h3>
                  <p className="text-sm text-muted-foreground">
                    You'll receive an email with our decision and next steps if accepted.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-green-600">4</span>
                </div>
                <div>
                  <h3 className="font-semibold">Welcome & Onboarding</h3>
                  <p className="text-sm text-muted-foreground">
                    If accepted, you'll receive onboarding materials and access to our Pioneer community.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="text-left mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Questions or Concerns?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                If you have any questions about your application or the Pioneer Program, 
                don't hesitate to reach out to our team.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" size="sm" asChild>
                  <a href="mailto:pioneers@taic.com">
                    <Mail className="w-4 h-4 mr-2" />
                    Email Support
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="/pioneer/faq">
                    <Users className="w-4 h-4 mr-2" />
                    View FAQ
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => router.push('/')} variant="outline">
              <Home className="w-4 h-4 mr-2" />
              Return Home
            </Button>
            <Button onClick={() => router.push('/pioneer/program')}>
              Learn More About Pioneer Program
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Additional Note */}
          <div className="mt-12 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Pro Tip:</strong> While you wait for your application review, 
              consider joining our community Discord and following us on social media 
              to stay updated with the latest TAIC developments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
