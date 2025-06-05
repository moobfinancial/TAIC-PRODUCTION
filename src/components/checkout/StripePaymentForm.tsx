'use client';

import React, { useState } from 'react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe, StripeError } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useCart } from '@/hooks/useCart'; // To get cart total

// Make sure to replace with your actual publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY');

interface StripePaymentFormProps {
  onPaymentSuccess: (paymentIntentId: string) => void;
  onPaymentError: (errorMsg: string) => void;
  onCancel: () => void;
  totalAmount: number; // TAIC amount, will be converted to cents
  currency?: string; // e.g. 'USD'
}

const CheckoutForm: React.FC<StripePaymentFormProps> = ({
  onPaymentSuccess,
  onPaymentError,
  onCancel,
  totalAmount,
  currency = 'USD', // Default to USD, backend expects this
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      const errorMsg = "Stripe.js has not loaded yet. Please wait a moment and try again.";
      setError(errorMsg);
      onPaymentError(errorMsg); // Call onPaymentError
      return;
    }
    setIsLoading(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError("Card details not found. Please ensure the card form is visible.");
      setIsLoading(false);
      return;
    }

    try {
      // 1. Create Payment Intent on the server
      const paymentApiUrl = process.env.NEXT_PUBLIC_PAYMENT_API_URL || 'http://localhost:5000';
      const response = await fetch(`${paymentApiUrl}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Amount should be in cents
        body: JSON.stringify({ amount: Math.round(totalAmount * 100), currency }),
      });

      const paymentIntentResult = await response.json();

      if (!response.ok || paymentIntentResult.error) {
        throw new Error(paymentIntentResult.error || 'Failed to create payment intent.');
      }

      const clientSecret = paymentIntentResult.clientSecret;

      // 2. Confirm the card payment
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          // billing_details: { name: 'Jenny Rosen' }, // Optional: Add billing details
        },
      });

      if (stripeError) {
        throw stripeError;
      }

      if (paymentIntent?.status === 'succeeded') {
        toast({ title: 'Payment Successful!', description: `Payment ID: ${paymentIntent.id}` });
        onPaymentSuccess(paymentIntent.id);
      } else {
        throw new Error(paymentIntent?.status || 'Payment failed with an unknown status.');
      }
    } catch (err) {
      let message = 'An unexpected error occurred.';
      // Check for StripeError-like object structure or standard Error
      if (err && typeof err === 'object' && (err as any).message) {
        message = (err as any).message;
      } else if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'string') {
        message = err;
      }
      setError(message);
      onPaymentError(message);
      toast({ title: 'Payment Failed', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="card-element" className="block text-sm font-medium text-gray-700 mb-1">
          Card Details
        </label>
        <CardElement
          id="card-element"
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
          className="p-3 border border-gray-300 rounded-md shadow-sm"
        />
      </div>
      {error && (
        <div className="text-red-600 text-sm" role="alert">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
         <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto order-last sm:order-first">
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || isLoading} className="w-full sm:w-auto">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
            </>
          ) : (
            `Pay ${totalAmount.toLocaleString()} ${currency.toUpperCase()}`
          )}
        </Button>
      </div>
    </form>
  );
};

const StripePaymentFormWrapper: React.FC<StripePaymentFormProps> = (props) => (
  <Elements stripe={stripePromise}>
    <CheckoutForm {...props} />
  </Elements>
);

export default StripePaymentFormWrapper;
