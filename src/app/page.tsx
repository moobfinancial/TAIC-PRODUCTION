"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowRight,
  Bot,
  Coins,
  Gift,
  LogIn,
  ShoppingBag,
  Store,
  Star,
  Info,
  Send,
  MessageSquare
} from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import HomePageSitePalIntegration from '@/components/interactive-ai/HomePageSitePalIntegration';
import { InteractiveAIMADialog } from '@/components/ai/InteractiveAIMADialog';

export default function HomePage() {
  const [isAmaDialogOpen, setIsAmaDialogOpen] = useState(false);

  // Features array for the features section
  const features = [
    {
      title: "AI-Powered Shopping",
      description: "Experience personalized product recommendations and intelligent search powered by advanced AI technology.",
      icon: <Bot className="h-12 w-12 text-primary" />,
      href: "/products",
      cta: "Explore Products"
    },
    {
      title: "Merchant Tools",
      description: "Comprehensive suite of tools for merchants to manage inventory, process orders, and grow their business.",
      icon: <Store className="h-12 w-12 text-primary" />,
      href: "/merchant/register",
      cta: "Start Selling"
    },
    {
      title: "Crypto Rewards",
      description: "Earn TAIC Coin rewards on every purchase and transaction. Real crypto value for real shopping.",
      icon: <Coins className="h-12 w-12 text-primary" />,
      href: "/tokenomics",
      cta: "Learn More"
    }
  ];

  return (
    <div className="flex flex-col items-center">
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 text-center">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-4xl font-headline font-bold tracking-tighter sm:text-5xl xl:text-6xl/none bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                  TAIC: AI-Powered Crypto Commerce
                </h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl mx-auto">
                  TAIC is an AI-powered, multi-vendor crypto-commerce marketplace revolutionizing how you shop and do business online. Designed for savvy shoppers, innovative merchants, influential community builders, and forward-thinking investors. Discover a seamless platform where you can shop unique products using TAIC Coin, earn crypto cashback rewards on your purchases, and build your own e-commerce venture.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row justify-center">
                <Button
                  asChild
                  size="lg"
                  className="font-semibold"
                  onClick={() => trackEvent('cta_click', { section: 'hero', button_text: 'Explore Products', link_url: '/products' })}
                >
                  <Link href="/products">
                    Explore Products <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  onClick={() => trackEvent('cta_click', { section: 'hero', button_text: 'Get Started', link_url: '/register' })}
                >
                  <Link href="/register">
                    Get Started
                  </Link>
                </Button>
              </div>
            </div>
            <HomePageSitePalIntegration className="mx-auto sm:w-full lg:order-last" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-5xl">
                Discover Our Features
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Experience the future of commerce with our comprehensive platform designed for modern digital transactions.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
            {features.map((feature, index) => (
              <Card key={index} className="flex flex-col items-center text-center p-6 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="text-base mb-4">
                    {feature.description}
                  </CardDescription>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                    onClick={() => trackEvent('feature_cta_click', { feature_title: feature.title, link_url: feature.href })}
                  >
                    <Link href={feature.href}>
                      {feature.cta} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Crypto & Rewards Highlights */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-5xl">
                  Earn Real Crypto Rewards
                </h2>
                <p className="max-w-[600px] text-muted-foreground md:text-xl">
                  Every purchase earns you TAIC Coin - real cryptocurrency with real value.
                  Build your crypto portfolio while shopping for the products you love.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Button
                  asChild
                  size="lg"
                  onClick={() => trackEvent('cta_click', { section: 'crypto_rewards', button_text: 'Learn About TAIC Coin', link_url: '/tokenomics' })}
                >
                  <Link href="/tokenomics">
                    Learn About TAIC Coin <Coins className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  onClick={() => trackEvent('cta_click', { section: 'crypto_rewards', button_text: 'Start Shopping', link_url: '/products' })}
                >
                  <Link href="/products">
                    Start Shopping <ShoppingBag className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <Card className="w-full max-w-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-6 w-6 text-primary" />
                    Reward Example
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Purchase Amount:</span>
                      <span className="font-semibold">$100.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cashback Rate:</span>
                      <span className="font-semibold">5%</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span>TAIC Coin Earned:</span>
                      <span className="font-bold text-primary">5.00 TAIC</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Pioneer Program Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-5xl">
                Join the Pioneer Program
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Be among the first to shape the future of AI-powered commerce. Exclusive benefits await early adopters.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-2 lg:gap-12">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Star className="h-6 w-6 text-yellow-500" />
                  Founding Merchants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base mb-4">
                  Established businesses ready to lead the AI commerce revolution with significant token allocations and reduced fees.
                </CardDescription>
                <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                  <li>• 10,000-50,000 TAIC token allocation</li>
                  <li>• 0.5% transaction fees</li>
                  <li>• Priority customer support</li>
                  <li>• Co-marketing opportunities</li>
                </ul>
                <Button
                  asChild
                  className="w-full"
                  onClick={() => trackEvent('pioneer_cta_click', { tier: 'founding_merchants' })}
                >
                  <Link href="/pioneer/apply">
                    Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Star className="h-6 w-6 text-blue-500" />
                  Strategic Influencers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base mb-4">
                  Content creators and influencers who will help spread awareness and drive adoption of the TAIC platform.
                </CardDescription>
                <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                  <li>• 5,000-25,000 TAIC token allocation</li>
                  <li>• Revenue sharing opportunities</li>
                  <li>• Exclusive content creation tools</li>
                  <li>• Early access to features</li>
                </ul>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                  onClick={() => trackEvent('pioneer_cta_click', { tier: 'strategic_influencers' })}
                >
                  <Link href="/pioneer/apply">
                    Learn More <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Interactive AI AMA Section */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-5xl">
                Ask Our AI Anything
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Have questions about TAIC? Our AI assistant is here to help with instant, personalized answers.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => {
                setIsAmaDialogOpen(true);
                trackEvent('ama_dialog_open', { source: 'homepage_section' });
              }}
              className="font-semibold"
            >
              <MessageSquare className="mr-2 h-5 w-5" />
              Start AI Conversation
            </Button>
          </div>
        </div>
      </section>

      {/* Community Engagement Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-5xl">
                Join Our Community
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Connect with fellow innovators, merchants, and crypto enthusiasts building the future of commerce.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button
                asChild
                size="lg"
                onClick={() => trackEvent('community_cta_click', { platform: 'discord' })}
              >
                <Link href="https://discord.gg/taic" target="_blank" rel="noopener noreferrer">
                  Join Discord <Send className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                onClick={() => trackEvent('community_cta_click', { platform: 'newsletter' })}
              >
                <Link href="/newsletter">
                  Subscribe to Newsletter
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-5xl">
                Ready to Get Started?
              </h2>
              <p className="max-w-[600px] text-muted-foreground md:text-xl">
                Join thousands of users already experiencing the future of AI-powered commerce.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button
                asChild
                size="lg"
                className="font-semibold"
                onClick={() => trackEvent('final_cta_click', { button_text: 'Create Account', link_url: '/register' })}
              >
                <Link href="/register">
                  Create Account <LogIn className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                onClick={() => trackEvent('final_cta_click', { button_text: 'Learn More', link_url: '/about' })}
              >
                <Link href="/about">
                  Learn More <Info className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive AI AMA Dialog */}
      <InteractiveAIMADialog
        open={isAmaDialogOpen}
        onOpenChange={setIsAmaDialogOpen}
      />
    </div>
  );
}


