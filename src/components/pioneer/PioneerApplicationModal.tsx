'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PioneerApplicationForm } from './PioneerApplicationForm';
import { X, Crown, Star, Users, Store, Megaphone, List, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pioneer Program tier mapping for pre-population
export const PIONEER_TIER_MAPPING = {
  'Founding Merchants': 'Tier 1: Founding Merchant',
  'Strategic Influencers': 'Tier 2: Strategic Influencer', 
  'Community Champions': 'Tier 3: Early Community Champion',
  'General Interest': 'Tier 4: General Interest Whitelist',
  'Program Benefits': '', // No specific tier
  'How to Apply': '' // No specific tier
} as const;

// Tier descriptions for the modal header
const TIER_DESCRIPTIONS = {
  'Founding Merchants': {
    icon: Store,
    color: 'bg-gradient-to-r from-purple-600 to-purple-800',
    description: 'Exclusive early access for merchants and business owners ready to revolutionize their commerce with AI.',
    benefits: ['Priority platform access', 'Reduced transaction fees', 'Dedicated merchant support', 'Early feature previews']
  },
  'Strategic Influencers': {
    icon: Megaphone,
    color: 'bg-gradient-to-r from-blue-600 to-blue-800',
    description: 'For content creators and influencers who want to shape the future of AI-powered commerce.',
    benefits: ['Exclusive content opportunities', 'Revenue sharing programs', 'Brand partnership access', 'Community leadership roles']
  },
  'Community Champions': {
    icon: Users,
    color: 'bg-gradient-to-r from-green-600 to-green-800',
    description: 'Community builders and advocates who will help grow the TAIC ecosystem.',
    benefits: ['Community governance participation', 'Event hosting opportunities', 'Referral rewards', 'Beta testing access']
  },
  'General Interest': {
    icon: List,
    color: 'bg-gradient-to-r from-gray-600 to-gray-800',
    description: 'Join our whitelist to stay informed about TAIC developments and future opportunities.',
    benefits: ['Early notifications', 'Educational content access', 'Future program priority', 'Community updates']
  }
} as const;

interface PioneerApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTier?: string;
  onSuccess?: (applicationId: number) => void;
  className?: string;
}

export function PioneerApplicationModal({
  isOpen,
  onClose,
  selectedTier,
  onSuccess,
  className
}: PioneerApplicationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Get tier information for display
  const tierKey = selectedTier as keyof typeof TIER_DESCRIPTIONS;
  const tierInfo = tierKey ? TIER_DESCRIPTIONS[tierKey] : null;
  const mappedTier = selectedTier ? PIONEER_TIER_MAPPING[selectedTier as keyof typeof PIONEER_TIER_MAPPING] : '';

  const handleFormSuccess = useCallback(() => {
    console.log('[PioneerApplicationModal] Form submission successful');
    setIsSubmitting(false);
    setSubmitError(null);
    
    // Call success callback if provided
    if (onSuccess) {
      onSuccess(Date.now()); // Temporary ID, will be replaced with actual application ID
    }
    
    // Close modal after brief delay to show success state
    setTimeout(() => {
      onClose();
    }, 1500);
  }, [onSuccess, onClose]);

  const handleFormCancel = useCallback(() => {
    console.log('[PioneerApplicationModal] Form cancelled');
    setSubmitError(null);
    onClose();
  }, [onClose]);

  const handleFormError = useCallback((error: string) => {
    console.error('[PioneerApplicationModal] Form submission error:', error);
    setIsSubmitting(false);
    setSubmitError(error);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "max-w-5xl max-h-[90vh] overflow-hidden flex flex-col",
          className
        )}
        data-testid="pioneer-application-modal"
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {tierInfo && (
                <div className={cn(
                  "p-2 rounded-lg text-white",
                  tierInfo.color
                )}>
                  <tierInfo.icon className="w-6 h-6" />
                </div>
              )}
              <div>
                <DialogTitle className="text-2xl font-bold">
                  {selectedTier ? `Apply for ${selectedTier}` : 'Pioneer Program Application'}
                </DialogTitle>
                <DialogDescription className="text-base mt-1">
                  {tierInfo?.description || 'Join the TAIC Pioneer Program and be part of the AI commerce revolution.'}
                </DialogDescription>
              </div>
            </div>
            <Badge variant="secondary" className="ml-4">
              Pioneer Program
            </Badge>
          </div>

          {/* Tier Benefits */}
          {tierInfo && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">
                Key Benefits
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {tierInfo.benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {submitError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}
        </DialogHeader>

        {/* Form Container - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <PioneerApplicationForm
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            className="p-0" // Remove default padding since we're in a modal
            initialTier={mappedTier}
            onError={handleFormError}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PioneerApplicationModal;
