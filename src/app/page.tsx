"use client"; // Required for useState

import Link from 'next/link';
import { useState } from 'react'; // Import useState
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ShoppingBag, Lightbulb, Bot, Star, Store, Search, Info, Coins, Gift, LogIn, Send, MessageSquare } from 'lucide-react'; // Added new icons
import Image from 'next/image';
import { InteractiveAIMADialog } from '@/components/ai/InteractiveAIMADialog'; // Import the dialog
import { trackEvent } from '@/lib/analytics'; // Import trackEvent

export default function HomePage() {
  const [isAmaDialogOpen, setIsAmaDialogOpen] = useState(false); // State for dialog

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

      {/* Crypto & Rewards Highlights Section */}
      <section className="w-full py-12 md:py-16 bg-muted">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {/* TAIC Coin Utility */}
            <div className="flex flex-col items-center">
              <Coins className="h-10 w-10 text-primary mb-3" />
              <h3 className="text-xl font-semibold mb-2">TAIC Coin: Powering Your Experience</h3>
              <p className="text-sm text-muted-foreground">
                Use TAIC Coin for seamless transactions, access exclusive features, and participate in platform governance.
              </p>
              {/* Optional CTA: <Button variant="link" asChild className="mt-2"><Link href="/tokenomics">Learn More</Link></Button> */}
            </div>

            {/* Earn Crypto Rewards */}
            <div className="flex flex-col items-center">
              <Gift className="h-10 w-10 text-primary mb-3" />
              <h3 className="text-xl font-semibold mb-2">Shop & Earn Cashback</h3>
              <p className="text-sm text-muted-foreground">
                Get rewarded with TAIC Coin cashback on your purchases. The more you shop, the more you earn!
              </p>
              {/* Optional CTA: <Button variant="link" asChild className="mt-2"><Link href="/rewards">Discover Rewards</Link></Button> */}
            </div>

            {/* Flexible Access */}
            <div className="flex flex-col items-center">
              <LogIn className="h-10 w-10 text-primary mb-3" />
              <h3 className="text-xl font-semibold mb-2">Connect Your Way</h3>
              <p className="text-sm text-muted-foreground">
                Sign up or log in easily with your crypto wallet or traditional email and password.
              </p>
              {/* Visual cues could be added here later e.g. mini-buttons or icons for WalletConnect/Email */}
            </div>
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
        <div className="container px-4 md:px-6 text-center">
          <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-8">
            Ask Our AI About TAIC Coin
          </h2>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed text-center mb-8">
            Have questions about TAIC Coin, our platform, or the Pioneer Program? Get instant answers from our interactive AI assistant! Experience our cutting-edge voice and avatar technology.
          </p>
          <Button
            size="lg"
            className="font-semibold"
            onClick={() => {
              setIsAmaDialogOpen(true);
              trackEvent('cta_click', { section: 'ama_ai_promo', button_text: 'Launch Interactive AI AMA' });
            }}
          >
            Launch Interactive AI AMA <Bot className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      <InteractiveAIMADialog
        open={isAmaDialogOpen}
        onOpenChange={setIsAmaDialogOpen}
      />

      {/* Influencer & Community Engagement Section */}
      <section className="w-full py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-12">
            Join Our Community & Partner With Us
          </h2>
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Left Column: Community Channels */}
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-semibold mb-3">Connect on Socials</h3>
                <p className="text-muted-foreground mb-4">
                  Stay updated with the latest news, announcements, and discussions by joining our official community channels.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href="#telegram-link">
                      <Send className="mr-2 h-5 w-5" /> Join our Telegram
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href="#discord-link">
                      <MessageSquare className="mr-2 h-5 w-5" /> Join our Discord
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column: Influencer & Contributor */}
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-semibold mb-3">Partner & Contribute</h3>
                <p className="text-muted-foreground mb-2">
                  Are you an influencer, content creator, or potential partner? We're looking for passionate individuals and organizations to collaborate with.
                </p>
                <div className="h-20 bg-muted rounded-md flex items-center justify-center text-sm text-muted-foreground my-4 p-4 text-center">
                  Future Influencer/Partner Showcase Area
                </div>
                <p className="text-muted-foreground mb-4">
                  Learn how you can contribute to the TAIC ecosystem, apply for the Pioneer Program, or explore partnership opportunities.
                </p>
                <Button asChild>
                  <Link href="#pioneer-program-landing-page">
                    Learn More About Contributing <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 bg-secondary">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-12">
            Join the TAIC Revolution: Pre-Sale & Pioneer Program
          </h2>
          <p className="mx-auto max-w-[800px] text-muted-foreground md:text-xl/relaxed text-center mb-10">
            Be part of the TAIC ecosystem from the ground up! Our TAIC Coin pre-sale is coming soon, offering early access to the utility token that powers our platform. Alongside, we're launching the TAIC Pioneer Program for dedicated individuals and businesses looking to shape the future of AI-driven crypto commerce.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Tier 1: Founding Merchants */}
            <Card className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="font-headline text-xl">Tier 1: Founding Merchants</CardTitle>
                <CardDescription>For innovative businesses ready to establish their presence on TAIC. Early onboarding, premium support, and exclusive benefits.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>Priority product placement</li>
                  <li>Reduced transaction fees for 1 year</li>
                  <li>Significant TAIC Coin allocation</li>
                </ul>
              </CardContent>
            </Card>

            {/* Tier 2: Strategic Influencers */}
            <Card className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="font-headline text-xl">Tier 2: Strategic Influencers</CardTitle>
                <CardDescription>For content creators and community leaders passionate about AI and crypto. Amplify TAIC's message and grow with us.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>Co-marketing opportunities</li>
                  <li>Token rewards for content creation</li>
                  <li>Early access to new features</li>
                </ul>
              </CardContent>
            </Card>

            {/* Tier 3: Early Champions */}
            <Card className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="font-headline text-xl">Tier 3: Early Champions</CardTitle>
                <CardDescription>For enthusiastic early adopters who believe in TAIC's vision. Help us build a vibrant community.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>Exclusive community badges</li>
                  <li>Bonus TAIC Coin rewards</li>
                  <li>Direct feedback channels</li>
                </ul>
              </CardContent>
            </Card>

            {/* Tier 4: Whitelist Members */}
            <Card className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="font-headline text-xl">Tier 4: Whitelist Members</CardTitle>
                <CardDescription>For individuals interested in future TAIC Coin offerings and platform updates. Secure your spot for upcoming announcements.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>Priority notification for public sale</li>
                  <li>Access to community updates</li>
                  <li>Potential for future airdrops</li>
                </ul>
              </CardContent>
            </Card>
          </div>
          <div className="text-center">
            <Button
              asChild
              size="lg"
              className="font-semibold"
              onClick={() => trackEvent('cta_click', { section: 'pioneer_program_promo', button_text: 'Learn More & Apply to Pioneer Program', link_url: '#pioneer-program-landing-page' })}
            >
              <Link href="#pioneer-program-landing-page">
                Learn More & Apply to Pioneer Program <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-headline font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-12">
            What's Next?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* CTA 1: Join the Pioneer Program */}
            <Card className="flex flex-col items-center text-center p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <Star className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-2xl font-headline font-semibold mb-2">Become a TAIC Pioneer</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Help shape our ecosystem. Apply for exclusive benefits and token allocations.
              </p>
              <Button asChild className="mt-auto">
                <Link href="#pioneer-program-landing-page">Apply Now <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </Card>

            {/* CTA 2: Become a Merchant */}
            <Card className="flex flex-col items-center text-center p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <Store className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-2xl font-headline font-semibold mb-2">Sell on TAIC</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Set up your store on our AI-powered marketplace and reach a global audience.
              </p>
              <Button
                asChild
                className="mt-auto"
                onClick={() => trackEvent('cta_click', { section: 'main_ctas', button_text: 'Start Selling', link_url: '/merchant/register' })}
              >
                <Link href="/merchant/register">Start Selling <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </Card>

            {/* CTA 3: Shop the Marketplace */}
            <Card className="flex flex-col items-center text-center p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <ShoppingBag className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-2xl font-headline font-semibold mb-2">Explore & Shop</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Discover unique products, experience AI-driven shopping, and earn crypto rewards.
              </p>
              <Button asChild className="mt-auto">
                <Link href="/products">Go Shopping <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </Card>

            {/* CTA 4: Learn About TAIC Coin */}
            <Card className="flex flex-col items-center text-center p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <Info className="h-12 w-12 text-primary mb-4" /> {/* Using Info icon as a placeholder for Coin icon */}
              <h3 className="text-2xl font-headline font-semibold mb-2">Discover TAIC Coin</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Learn about the utility, tokenomics, and staking benefits of our native cryptocurrency.
              </p>
              <Button asChild className="mt-auto">
                <Link href="/tokenomics">Learn More <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </Card>
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
              Join TAIC <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
