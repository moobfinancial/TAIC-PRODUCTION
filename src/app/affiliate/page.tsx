import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Gem, DollarSign, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AffiliatePage() {
  const SIMULATED_CONVERSION_RATE = 0.10; // 1 TAIC = $0.10 USD

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8">
      <header className="text-center space-y-4">
        <Users className="mx-auto h-16 w-16 text-primary" />
        <h1 className="text-4xl font-headline font-bold tracking-tight sm:text-5xl">TAIC Affiliate Program</h1>
        <p className="text-xl text-muted-foreground">
          Understand how our simulated affiliate model works and visualize potential Demo TAIC earnings.
        </p>
      </header>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center gap-2">
            <Zap className="h-6 w-6 text-accent" /> How It Works (Simulated)
          </CardTitle>
          <CardDescription>
            This is a demonstration of an affiliate commission model using Demo TAIC. All transactions and earnings are purely illustrative.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-lg">
          <p>
            In the TAIC Showcase, we simulate an affiliate program where users can earn Demo TAIC. This helps illustrate how a real-world digital currency could be integrated into commission-based systems.
          </p>
          <ul className="list-disc list-inside space-y-2 pl-4 text-muted-foreground">
            <li>Refer new users or promote products (simulated actions).</li>
            <li>Earn a percentage of sales or fixed amounts in Demo TAIC.</li>
            <li>Watch your Demo TAIC balance grow in your dashboard.</li>
          </ul>
          <p>
            This system is designed to showcase the potential of TAIC for various e-commerce applications.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-500" /> Simulated TAIC to Fiat Conversion
          </CardTitle>
          <CardDescription>
            Visualizing the potential (illustrative) value of your Demo TAIC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg">
            To provide a tangible understanding, we can simulate the conversion of Demo TAIC to a familiar fiat currency like USD. This is purely for illustrative purposes and does not represent real monetary value.
          </p>
          <div className="p-6 bg-secondary/50 rounded-lg text-center">
            <p className="text-xl font-semibold">
              Current Simulated Rate: <Gem className="inline h-5 w-5 text-primary align-middle" /> 1 TAIC = ${SIMULATED_CONVERSION_RATE.toFixed(2)} USD
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
            <div className="p-4 border rounded-lg">
              <p className="text-3xl font-bold text-primary flex items-center justify-center">
                <Gem className="h-7 w-7 mr-2"/> 100 <span className="text-xl ml-1">TAIC</span>
              </p>
              <TrendingUp className="h-6 w-6 text-muted-foreground my-2 mx-auto"/>
              <p className="text-3xl font-bold text-green-600">
                ${(100 * SIMULATED_CONVERSION_RATE).toFixed(2)} <span className="text-xl ml-1">USD</span>
              </p>
              <p className="text-sm text-muted-foreground">(Simulated Value)</p>
            </div>
             <div className="p-4 border rounded-lg">
              <p className="text-3xl font-bold text-primary flex items-center justify-center">
                <Gem className="h-7 w-7 mr-2"/> 5,000 <span className="text-xl ml-1">TAIC</span>
              </p>
              <TrendingUp className="h-6 w-6 text-muted-foreground my-2 mx-auto"/>
              <p className="text-3xl font-bold text-green-600">
                ${(5000 * SIMULATED_CONVERSION_RATE).toFixed(2)} <span className="text-xl ml-1">USD</span>
              </p>
              <p className="text-sm text-muted-foreground">(Simulated Value)</p>
            </div>
          </div>
          <p className="text-muted-foreground text-sm italic">
            Note: This conversion is for demonstration only. Demo TAIC has no real-world monetary value.
          </p>
        </CardContent>
      </Card>
      
      <div className="text-center mt-12">
        <Button size="lg" asChild>
          <Link href="/products">Explore Products Now</Link>
        </Button>
      </div>
    </div>
  );
}
