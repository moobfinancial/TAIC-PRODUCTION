
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Trash2, ShoppingCartIcon, Gem, MinusCircle, PlusCircle, Wallet, LogIn, CreditCard, CheckCircle, Loader2, MapPin } from 'lucide-react';
import type { Order, OrderItem } from '@/lib/types';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShippingAddressForm } from '@/components/checkout/ShippingAddressForm';
import StripePaymentFormWrapper from '@/components/checkout/StripePaymentForm'; // Import Stripe form
import { cn } from '@/lib/utils';
import { ethers } from 'ethers'; // Import ethers

// Expanded CheckoutStep for more granular crypto flow
type CheckoutStep =
  | 'initial' // Represents no dialog, or main page state
  | 'guestCheckoutOptions' // New: For guest user to see initial choices (login or crypto)
  | 'paymentSelection' // For logged-in user's payment choices
  | 'stripeRealForm'
  | 'cryptoConnectWallet'
  | 'cryptoWalletConnected'
  | 'cryptoInitiatePayment'
  | 'cryptoDisplayPaymentDetails'
  | 'cryptoAwaitTransactionHash'
  | 'cryptoSubmittingConfirmation'
  | 'cryptoPaymentComplete'
  | 'addressForm'
  | 'orderComplete'; // When order is fully done and no dialog needed

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart, getCartItemCount } = useCart();
  const { user, updateUser, userId } = useAuth(); // Assuming userId is available from useAuth for backend calls
  const { toast } = useToast();
  const router = useRouter();
  
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('initial');
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState<string | null>(null);
  const [cryptoPaymentDetails, setCryptoPaymentDetails] = useState<any | null>(null); // To store details from /initiate-crypto-payment
  const [cryptoTransactionHash, setCryptoTransactionHash] = useState<string>('');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null); // To store order ID for crypto flow
  const [isLoadingCrypto, setIsLoadingCrypto] = useState<boolean>(false);
  const [cryptoErrorMessage, setCryptoErrorMessage] = useState<string | null>(null);

  const completeOrderAndRedirect = () => {
    // Order completion logic is now mostly handled after address form for all payment types
    toast({ title: "Order Processed!", description: "Thank you for your purchase. Your order details are confirmed." });
    clearCart();
    router.push('/dashboard');
    setCheckoutStep('initial'); // Reset step
  };

  const handleTaicPayment = () => {
    if (!user) return; 
    const totalAmount = getCartTotal();
    if (user.taicBalance < totalAmount) {
        toast({ title: "Insufficient Balance", description: `You need ${totalAmount - user.taicBalance} more TAIC.`, variant: "destructive" });
        setCheckoutStep('paymentSelection'); // Go back to payment options
        return;
    }

    const orderItems: OrderItem[] = cartItems.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
    }));

    const newOrder: Order = {
        id: Date.now().toString(),
        items: orderItems,
        totalAmount,
        date: new Date().toISOString(),
    };

    const updatedUser = {
        ...user,
        taicBalance: user.taicBalance - totalAmount,
        orders: [...user.orders, newOrder],
    };
    updateUser(updatedUser);
    setCheckoutStep('addressForm'); // Proceed to address form after TAIC payment
  };

  const handleStripePaymentSuccess = (paymentIntentId: string) => {
    toast({
      title: "Stripe Payment Successful",
      description: `Payment ID: ${paymentIntentId}. Please provide your shipping details.`,
    });
    // In a real app, you might want to associate the paymentIntentId with the order here
    // For now, directly move to address form.
    // The backend webhook will finalize the order status.
    setCheckoutStep('addressForm');
  };

  const handleStripePaymentError = (errorMsg: string) => {
    toast({
      title: "Stripe Payment Failed",
      description: errorMsg,
      variant: "destructive",
    });
    setCheckoutStep('paymentSelection'); // Go back to payment options
  };

  const handleProceedToCheckout = () => {
    if (getCartItemCount() === 0) return;
    if (!user) {
      setCheckoutStep('guestCheckoutOptions'); // Use new step for guest options
    } else {
      const totalAmount = getCartTotal();
      if (user.taicBalance < totalAmount && user.paymentMethods?.length === 0) { // Simplified condition
        toast({ title: "Insufficient Balance", description: `You need ${totalAmount - user.taicBalance} more TAIC or add a payment method.`, variant: "destructive" });
        return;
      }
      setCheckoutStep('paymentSelection');
    }
  };

  const handleLoginRedirect = () => {
    setCheckoutStep('initial');
    router.push('/login?redirect=/cart');
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast({ title: "MetaMask not detected", description: "Please install MetaMask to use this payment method.", variant: "destructive" });
      setCheckoutStep('initial'); // Go back to main options
      return;
    }
    try {
      setIsLoadingCrypto(true);
      setCryptoErrorMessage(null);
      setCheckoutStep('cryptoConnectWallet');
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setCryptoWalletAddress(address);
      setCheckoutStep('cryptoWalletConnected');
      toast({ title: "Wallet Connected", description: `Address: ${address.substring(0,6)}...${address.substring(address.length-4)}`});
    } catch (error: any) {
      console.error("Failed to connect wallet:", error);
      toast({ title: "Wallet Connection Failed", description: error?.message || "Could not connect to your wallet.", variant: "destructive" });
      setCryptoErrorMessage(error?.message || "Could not connect to your wallet.");
      setCheckoutStep('cryptoConnectWallet'); // Stay on connect step or back to initial
    } finally {
      setIsLoadingCrypto(false);
    }
  };

  const handleInitiateCryptoPayment = async () => {
    if (!user && !cryptoWalletAddress) { // Require wallet connection for guest crypto checkout
        toast({ title: "Wallet Not Connected", description: "Please connect your crypto wallet first.", variant: "destructive" });
        setCheckoutStep('cryptoConnectWallet');
        return;
    }
    setIsLoadingCrypto(true);
    setCryptoErrorMessage(null);
    setCheckoutStep('cryptoInitiatePayment');

    // Use a guest user ID or a placeholder if user is not logged in for crypto
    const effectiveUserId = user ? userId : 'guest_crypto_user';
    if (!effectiveUserId) {
      toast({ title: "User ID Error", description: "Could not determine user ID for the transaction.", variant: "destructive" });
      setIsLoadingCrypto(false);
      setCheckoutStep('cryptoWalletConnected'); // Go back
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_PAYMENT_API_URL || 'http://localhost:5000'}/initiate-crypto-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: getCartTotal(), // Assuming getCartTotal() is in TAIC for this path
          currency: 'TAIC', // Hardcoding TAIC for this demo
          user_id: effectiveUserId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate crypto payment.');
      }
      setCryptoPaymentDetails(data.paymentDetails);
      setCurrentOrderId(data.orderId); // Store orderId
      setCheckoutStep('cryptoDisplayPaymentDetails');
      toast({ title: "Payment Initiated", description: "Please send the specified TAIC amount to the address shown." });
    } catch (error: any) {
      console.error("Crypto payment initiation failed:", error);
      setCryptoErrorMessage(error.message || "Failed to start crypto payment process.");
      toast({ title: "Initiation Failed", description: error.message, variant: "destructive" });
      setCheckoutStep('cryptoWalletConnected'); // Go back to previous step
    } finally {
      setIsLoadingCrypto(false);
    }
  };

  const handleConfirmCryptoPayment = async () => {
    if (!currentOrderId || !cryptoTransactionHash || !cryptoWalletAddress) {
      toast({ title: "Missing Information", description: "Order ID, transaction hash, or wallet address is missing.", variant: "destructive" });
      return;
    }
    setIsLoadingCrypto(true);
    setCryptoErrorMessage(null);
    setCheckoutStep('cryptoSubmittingConfirmation');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_PAYMENT_API_URL || 'http://localhost:5000'}/confirm-crypto-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: currentOrderId,
          transaction_hash: cryptoTransactionHash,
          wallet_address: cryptoWalletAddress,
          network: "SimulatedTAIC", // As per backend logic
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to confirm crypto payment.');
      }

      // Backend simulation directly confirms or fails.
      // If successful, move to address form. If not, show error.
      if (data.status === 'confirmed') {
        toast({ title: "Crypto Payment Confirmed (Simulated)", description: "Your simulated TAIC payment has been confirmed." });
        setCheckoutStep('addressForm'); // Proceed to address form
      } else {
        throw new Error(data.error || data.message || 'Simulated payment verification failed.');
      }
      // Reset crypto states for next time
      // setCryptoWalletAddress(null); // Keep wallet address for now
      setCryptoPaymentDetails(null);
      setCryptoTransactionHash('');
      // setCurrentOrderId(null); // Keep order ID as it's tied to the address form now

    } catch (error: any) {
      console.error("Crypto payment confirmation failed:", error);
      setCryptoErrorMessage(error.message || "Crypto payment confirmation failed.");
      toast({ title: "Confirmation Failed", description: error.message, variant: "destructive" });
      setCheckoutStep('cryptoDisplayPaymentDetails'); // Allow user to re-enter hash or cancel
    } finally {
      setIsLoadingCrypto(false);
    }
  };

  const handleAddressSubmitted = (addressData: Record<string, string>) => {
    // In a real app, save addressData to user profile or order
    console.log("Address Data:", addressData);
    
    // For all payment types (TAIC, Stripe, Crypto), order completion is now centralized here
    // The actual order creation/update logic for Stripe is on the backend via webhooks.
    // For TAIC, it happened in handleTaicPayment.
    // For Crypto (simulated), it's considered done after crypto confirmation.

    completeOrderAndRedirect(); // This now centralizes the final step post-address.
  };

  if (getCartItemCount() === 0 && checkoutStep !== 'orderComplete') {
    return (
      <div className="text-center py-20">
        <ShoppingCartIcon className="mx-auto h-24 w-24 text-muted-foreground mb-6" />
        <h1 className="text-3xl font-headline font-semibold mb-4">Your Cart is Empty</h1>
        <p className="text-muted-foreground mb-8">Looks like you haven&apos;t added any products yet.</p>
        <Button asChild size="lg">
          <Link href="/products">Start Shopping</Link>
        </Button>
      </div>
    );
  }
  
  const renderDialogContent = () => {
    switch (checkoutStep) {
      case 'paymentSelection': // For logged-in users (or users who just connected wallet for crypto)
        return (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Choose Payment Method</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>Select how you&apos;d like to complete your purchase. Total: <Gem className="inline h-4 w-4" /> {getCartTotal().toLocaleString()} TAIC</div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
              <AlertDialogCancel onClick={() => { setCheckoutStep('initial'); setCryptoWalletAddress(null);}} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
              {user && ( // Only show Stripe for logged-in users as per original logic
                <Button onClick={() => setCheckoutStep('stripeRealForm')} variant="outline" className="w-full sm:w-auto">
                  <CreditCard className="mr-2 h-4 w-4" /> Pay with Card (Stripe)
                </Button>
              )}
              {/* Allow TAIC payment if user is logged in OR if wallet is connected for guest crypto */}
              {(user || cryptoWalletAddress) && (
                <Button
                  onClick={user ? handleTaicPayment : handleInitiateCryptoPayment}
                  className="w-full sm:w-auto"
                  disabled={isLoadingCrypto}
                >
                  {isLoadingCrypto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gem className="mr-2 h-4 w-4" />}
                  {user ? "Pay with Demo TAIC" : "Pay with TAIC (Wallet)"}
                </Button>
              )}
            </AlertDialogFooter>
          </>
        );
      case 'stripeRealForm': // For logged-in users
        return (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Pay with Card</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>Enter your card details below. Amount: {getCartTotal().toLocaleString()} USD (TAIC equivalent)</div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4">
              <StripePaymentFormWrapper
                totalAmount={getCartTotal()}
                currency="USD"
                onPaymentSuccess={handleStripePaymentSuccess}
                onPaymentError={handleStripePaymentError}
                onCancel={() => setCheckoutStep('paymentSelection')}
              />
            </div>
            {/* Footer is handled by StripePaymentFormWrapper's buttons */}
          </>
        );

      // Crypto Payment Flow Steps (mostly for unauthenticated or users choosing crypto)
      case 'cryptoConnectWallet':
        return (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{isLoadingCrypto ? "Connecting Wallet..." : "Connect Crypto Wallet"}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="flex flex-col items-center justify-center py-4">
                  {isLoadingCrypto && <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />}
                  {!isLoadingCrypto && "Please connect your MetaMask wallet to proceed with TAIC payment."}
                  {cryptoErrorMessage && <div className="text-red-500 text-sm mt-2">{cryptoErrorMessage}</div>}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
              <AlertDialogCancel onClick={() => { setCheckoutStep('initial'); setCryptoErrorMessage(null); }} disabled={isLoadingCrypto}>Cancel</AlertDialogCancel>
              <Button onClick={connectWallet} disabled={isLoadingCrypto} className="w-full sm:w-auto">
                {isLoadingCrypto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
                Connect Wallet
              </Button>
            </AlertDialogFooter>
          </>
        );
      case 'cryptoWalletConnected': // User has connected, now show option to proceed
        return (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> Wallet Connected</AlertDialogTitle>
              {/* Use div instead of p if AlertDialogDescription renders a p tag */}
              <AlertDialogDescription asChild>
                <div>Your wallet is connected. You can now proceed to pay with TAIC.</div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4 p-3 bg-secondary rounded-md text-center">
              <div className="text-sm text-muted-foreground">Connected Address:</div>
              <div className="font-mono text-sm break-all">{cryptoWalletAddress}</div>
            </div>
            {cryptoErrorMessage && <div className="text-red-500 text-sm my-2 text-center">{cryptoErrorMessage}</div>}
            <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
              <AlertDialogCancel onClick={() => { setCheckoutStep('initial'); setCryptoWalletAddress(null); setCryptoErrorMessage(null); }}>Disconnect / Cancel</AlertDialogCancel>
              <Button onClick={handleInitiateCryptoPayment} disabled={isLoadingCrypto} className="w-full sm:w-auto">
                {isLoadingCrypto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Proceed to TAIC Payment
              </Button>
            </AlertDialogFooter>
          </>
        );
      case 'cryptoInitiatePayment': // Loading state while backend prepares payment details
         return (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Initiating TAIC Payment...</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                      Contacting server to get payment details. Please wait.
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
            </>
        );
      case 'cryptoDisplayPaymentDetails':
        if (!cryptoPaymentDetails) return <p>Error: Payment details not loaded.</p>;
        return (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete Your TAIC Payment</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>Send exactly <span className="font-bold text-primary">{cryptoPaymentDetails.expected_amount} {cryptoPaymentDetails.currency}</span> to the following address on the {cryptoPaymentDetails.network} network.</div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4 space-y-3">
              <div className="p-3 bg-muted rounded-md">
                <Label>Deposit Address (Simulated TAIC):</Label>
                <div className="font-mono text-sm break-all select-all">{cryptoPaymentDetails.deposit_address}</div>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <Label>Amount:</Label>
                <div className="font-bold text-lg">{cryptoPaymentDetails.expected_amount} {cryptoPaymentDetails.currency}</div>
              </div>
               <div className="p-3 bg-muted rounded-md">
                <Label>Network:</Label>
                <div className="font-bold text-lg">{cryptoPaymentDetails.network}</div>
              </div>
              <div className="pt-2 space-y-1">
                <Label htmlFor="txHash">Enter Transaction Hash (Simulated):</Label>
                <Input
                  id="txHash"
                  type="text"
                  placeholder="0xYourTransactionHash"
                  value={cryptoTransactionHash}
                  onChange={(e) => setCryptoTransactionHash(e.target.value)}
                  className="font-mono"
                />
                <div className="text-xs text-muted-foreground">After sending TAIC, paste the transaction hash here and confirm.</div>
              </div>
            </div>
            {cryptoErrorMessage && <div className="text-red-500 text-sm my-2 text-center">{cryptoErrorMessage}</div>}
            <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
              <AlertDialogCancel onClick={() => { setCheckoutStep('cryptoWalletConnected'); setCryptoPaymentDetails(null); setCryptoTransactionHash(''); setCryptoErrorMessage(null); }} disabled={isLoadingCrypto}>Back</AlertDialogCancel>
              <Button onClick={handleConfirmCryptoPayment} disabled={isLoadingCrypto || !cryptoTransactionHash} className="w-full sm:w-auto">
                {isLoadingCrypto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Payment (Simulated)
              </Button>
            </AlertDialogFooter>
          </>
        );
    case 'cryptoSubmittingConfirmation':
        return (
            <>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirming Payment...</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                      Submitting your transaction hash for simulated confirmation.
                  </div>
                </AlertDialogDescription>
            </AlertDialogHeader>
            </>
        );
      // No 'cryptoPaymentComplete' step explicitly defined here for dialog,
      // as success moves to 'addressForm' and failure shows error on 'cryptoDisplayPaymentDetails' or 'cryptoWalletConnected'

      case 'addressForm':
        return (
          <>
            {/* No AlertDialogHeader here, ShippingAddressForm provides its own */}
            <ShippingAddressForm onAddressSubmitted={handleAddressSubmitted} />
            <AlertDialogFooter className="pt-4">
              <AlertDialogCancel onClick={() => {
                // Determine where to go back to based on how user reached address form
                if (currentOrderId && cryptoWalletAddress) { // Came from crypto path
                    setCheckoutStep('cryptoDisplayPaymentDetails');
                } else if (user) { // Came from logged-in user path (Stripe or TAIC)
                    setCheckoutStep('paymentSelection');
                } else {
                    setCheckoutStep('initial');
                }
              }}>
                Back
              </AlertDialogCancel>
            </AlertDialogFooter>
          </>
        );
      case 'guestCheckoutOptions': // Renamed from 'default' essentially
        return (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Checkout Options</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>To proceed with your purchase, please connect a crypto wallet or login/register to use other payment methods (like Stripe or your TAIC balance).</div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
              <AlertDialogCancel onClick={() => setCheckoutStep('initial')} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
              <Button onClick={() => setCheckoutStep('cryptoConnectWallet')} variant="outline" className="w-full sm:w-auto">
                <Wallet className="mr-2 h-4 w-4" /> Connect Crypto Wallet for TAIC
              </Button>
              {!user && ( // Only show login/register if not logged in
                <Button onClick={handleLoginRedirect} className="w-full sm:w-auto">
                  <LogIn className="mr-2 h-4 w-4" /> Login or Register
                </Button>
              )}
            </AlertDialogFooter>
          </>
        );
      default: // Should ideally not be reached if all steps are handled, or make it same as guestCheckoutOptions
        return null;
    }
  };

  // Determine if the dialog should be open based on the current step
  const isDialogOpen = checkoutStep !== 'initial' && checkoutStep !== 'orderComplete';

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-headline font-bold tracking-tight text-center">Your Shopping Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {cartItems.map(item => (
            <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg shadow bg-card">
              <Image src={item.imageUrl} alt={item.name} width={100} height={100} className="rounded-md aspect-square object-cover" data-ai-hint={item.dataAiHint} />
              <div className="flex-grow">
                <h2 className="text-lg font-semibold font-headline">{item.name}</h2>
                <p className="text-sm text-muted-foreground">{item.category}</p>
                <p className="text-md font-semibold text-primary flex items-center mt-1">
                  <Gem className="mr-1 h-4 w-4" /> {item.price.toLocaleString()} TAIC
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <=1}>
                  <MinusCircle className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.id, parseInt(e.target.value, 10) || 1)}
                  className="w-16 h-9 text-center text-base"
                  min="1"
                />
                <Button variant="outline" size="icon" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="text-destructive hover:text-destructive/80">
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1 space-y-6 p-6 border rounded-lg shadow bg-card h-fit sticky top-24">
          <h2 className="text-2xl font-headline font-semibold border-b pb-3">Order Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-md">
              <span>Subtotal ({getCartItemCount()} items)</span>
              <span className="font-semibold flex items-center"><Gem className="mr-1 h-4 w-4 text-primary/70" /> {getCartTotal().toLocaleString()} TAIC</span>
            </div>
            <div className="flex justify-between text-md">
              <span>Shipping</span>
              <span className="font-semibold">Free</span>
            </div>
            <div className="border-t pt-3 mt-3 flex justify-between text-xl font-bold text-primary">
              <span>Total</span>
              <span className="flex items-center"><Gem className="mr-1 h-5 w-5" /> {getCartTotal().toLocaleString()} TAIC</span>
            </div>
          </div>
          <Button onClick={handleProceedToCheckout} className="w-full text-lg py-6 font-semibold" size="lg">
            Proceed to Checkout
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </div>

      <AlertDialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
            // More robust reset logic when dialog is closed externally
            setCheckoutStep('initial');
            setCryptoWalletAddress(null);
            setCryptoPaymentDetails(null);
            setCryptoTransactionHash('');
            setCurrentOrderId(null);
            setIsLoadingCrypto(false);
            setCryptoErrorMessage(null);
        }
      }}>
        <AlertDialogContent className={cn(
            checkoutStep === 'addressForm' && "max-w-xl md:max-w-2xl",
            checkoutStep === 'stripeRealForm' && "max-w-lg",
            (checkoutStep === 'cryptoDisplayPaymentDetails' || checkoutStep === 'cryptoConnectWallet' || checkoutStep === 'cryptoWalletConnected') && "max-w-md", // Adjust for crypto dialogs
             "max-w-lg")} // Default
        >
            {renderDialogContent()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
