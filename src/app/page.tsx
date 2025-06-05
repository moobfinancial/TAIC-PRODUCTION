import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ShoppingBag, Lightbulb, Bot } from 'lucide-react';
import Image from 'next/image';

export default function HomePage() {
  const features = [
    {
      title: 'Explore Products',
      description: 'Browse our innovative catalog priced in Demo TAIC.',
      href: '/products',
      icon: <ShoppingBag className="h-8 w-8 text-primary" />,
      cta: 'Shop Now',
    },
    {
      title: 'AI Shopping Assistant',
      description: 'Let our AI help you find the perfect product.',
      href: '/ai-assistant',
      icon: <Bot className="h-8 w-8 text-primary" />,
      cta: 'Ask AI',
    },
    {
      title: 'Generate Product Ideas',
      description: 'Unleash creativity with our AI Product Idea Generator.',
      href: '/ai-product-ideas',
      icon: <Lightbulb className="h-8 w-8 text-primary" />,
      cta: 'Invent Now',
    },
  ];

  return (
    <div className="flex flex-col items-center">
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 text-center">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-4xl font-headline font-bold tracking-tighter sm:text-5xl xl:text-6xl/none bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                  Welcome to TAIC Showcase
                </h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl mx-auto">
                  Experience the future of simulated digital currency transactions and AI-driven e-commerce. Explore, innovate, and transact with Demo TAIC.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row justify-center">
                <Button asChild size="lg" className="font-semibold">
                  <Link href="/products">
                    Explore Products <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/register">
                    Get Started
                  </Link>
                </Button>
              </div>
            </div>
            <Image
              src="https://placehold.co/600x400.png"
              data-ai-hint="futuristic commerce"
              width={600}
              height={400}
              alt="TAIC Showcase Hero"
              className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last"
            />
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 bg-secondary">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-12">
            Discover Our Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="items-center text-center">
                  {feature.icon}
                  <CardTitle className="mt-4 font-headline text-2xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow text-center">
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
                <div className="p-6 pt-0 text-center">
                  <Button asChild className="w-full max-w-xs mx-auto" variant="outline">
                    <Link href={feature.href}>
                      {feature.cta} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24">
        <div className="container text-center">
          <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Ready to Dive In?
          </h2>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed mt-4 mb-8">
            Create a demo account to start exploring with your initial Demo TAIC balance, or browse our offerings as a guest.
          </p>
          <Button asChild size="lg" className="font-semibold">
            <Link href="/register">
              Join TAIC Showcase <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
