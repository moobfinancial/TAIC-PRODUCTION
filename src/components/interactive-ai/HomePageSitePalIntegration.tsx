"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Play, 
  Sparkles, 
  Crown, 
  ShoppingBag, 
  Rocket,
  ArrowRight,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import HomePageSitePalCanvas from './HomePageSitePalCanvas';

interface HomePageSitePalIntegrationProps {
  className?: string;
}

export default function HomePageSitePalIntegration({ className }: HomePageSitePalIntegrationProps) {
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();

  const handleStartPresentation = () => {
    console.log('[HomePageIntegration] Starting AI presentation');
    
    // Track presentation start
    trackEvent('homepage_ai_presentation_start', {
      user_authenticated: isAuthenticated,
      user_id: user?.id || null
    });

    setIsCanvasOpen(true);
  };

  const handleCloseCanvas = () => {
    console.log('[HomePageIntegration] Closing AI presentation');
    
    // Track presentation close
    trackEvent('homepage_ai_presentation_close', {
      user_authenticated: isAuthenticated,
      user_id: user?.id || null
    });

    setIsCanvasOpen(false);
  };

  return (
    <>
      {/* Main Integration Card */}
      <Card className={cn(
        "relative overflow-hidden bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5",
        "border-2 border-primary/20 hover:border-primary/40 transition-all duration-300",
        "group cursor-pointer transform hover:scale-[1.02]",
        className
      )}>
        <CardContent className="p-8">
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <div className="w-20 h-20 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center mx-auto shadow-lg">
                <Bot className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Badge className="bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                  AI LIVE
                </Badge>
              </div>
            </div>
            
            <h2 className="text-3xl font-headline font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Meet Your AI Guide
            </h2>
            
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed">
              Experience TAIC's revolutionary AI-powered crypto commerce platform through an interactive presentation. 
              Discover the Pioneer Program, explore products, and learn how to earn crypto rewards.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <Crown className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-sm">Pioneer Program</h3>
              <p className="text-xs text-muted-foreground">
                Exclusive benefits and token allocations for early adopters
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-sm">AI Shopping</h3>
              <p className="text-xs text-muted-foreground">
                Discover products with AI assistance and earn crypto cashback
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Rocket className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-sm">Get Started</h3>
              <p className="text-xs text-muted-foreground">
                Connect your wallet or create an account in minutes
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center">
            <Button
              onClick={handleStartPresentation}
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              <Play className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
              Start AI Presentation
              <ArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <p className="text-xs text-muted-foreground mt-3">
              Interactive • Personalized • No signup required
            </p>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-4 right-4 opacity-20">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          </div>
          
          <div className="absolute bottom-4 left-4 opacity-20">
            <Star className="h-6 w-6 text-accent animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
        </CardContent>

        {/* Hover Effect Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </Card>

      {/* SitePal Canvas Modal */}
      <HomePageSitePalCanvas
        isOpen={isCanvasOpen}
        onClose={handleCloseCanvas}
      />
    </>
  );
}
