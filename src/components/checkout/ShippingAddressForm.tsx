
'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

interface ShippingAddressFormProps {
  onAddressSubmitted: (addressData: Record<string, string>) => void;
  isDigitalOrder?: boolean; // If true, only collect email
}

export function ShippingAddressForm({ onAddressSubmitted, isDigitalOrder = false }: ShippingAddressFormProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    streetAddress: '',
    apartment: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
    email: '',
    phone: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Basic validation can be added here if needed
    onAddressSubmitted(formData);
  };

  return (
    <Card className="w-full border-0 shadow-none">
      <CardHeader className="text-center px-0 sm:px-6">
        <MapPin className="mx-auto h-10 w-10 text-primary mb-3" />
        <CardTitle className="text-2xl font-headline">
          {isDigitalOrder ? 'Confirm Your Email' : 'Shipping Information'}
        </CardTitle>
        <CardDescription>
          {isDigitalOrder 
            ? 'Please provide your email address to receive your digital goods.' 
            : 'Please provide your shipping address to complete your order.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} required className="text-base" />
          </div>

          {!isDigitalOrder && (
            <>
              <div className="space-y-1">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" type="text" placeholder="John Doe" value={formData.fullName} onChange={handleChange} required className="text-base" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="streetAddress">Street Address</Label>
                <Input id="streetAddress" type="text" placeholder="123 Main St" value={formData.streetAddress} onChange={handleChange} required className="text-base" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="apartment">Apartment, suite, etc. (Optional)</Label>
                <Input id="apartment" type="text" placeholder="Apt 4B" value={formData.apartment} onChange={handleChange} className="text-base" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" type="text" placeholder="Anytown" value={formData.city} onChange={handleChange} required className="text-base" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="stateProvince">State / Province</Label>
                  <Input id="stateProvince" type="text" placeholder="CA" value={formData.stateProvince} onChange={handleChange} required className="text-base" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" type="text" placeholder="90210" value={formData.postalCode} onChange={handleChange} required className="text-base" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" type="text" placeholder="United States" value={formData.country} onChange={handleChange} required className="text-base" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input id="phone" type="tel" placeholder="(555) 123-4567" value={formData.phone} onChange={handleChange} className="text-base" />
              </div>
            </>
          )}
          <Button type="submit" className="w-full text-lg py-3 font-semibold">
            {isDigitalOrder ? 'Confirm Email & Complete Order' : 'Submit Shipping & Complete Order'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
