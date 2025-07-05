'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Globe, 
  Target, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Star,
  Crown,
  Gem,
  Trophy,
  Award,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Pioneer Program Tier Definitions
const PIONEER_TIERS = [
  {
    id: 'Tier 1: Visionary Partner',
    name: 'Tier 1: Visionary Partner',
    title: 'Visionary Partner',
    icon: Crown,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Founding merchants and established businesses',
    benefits: [
      'Significant TAIC token allocation (10,000-50,000)',
      'Reduced transaction fees (0.5%)',
      'Priority customer support',
      'Co-marketing opportunities',
      'Early access to new features'
    ],
    requirements: [
      'Registered business with proven track record',
      'Minimum product listing commitment',
      'Active TAIC Coin usage',
      'Brand alignment with TAIC values'
    ]
  },
  {
    id: 'Tier 2: Strategic Influencer',
    name: 'Tier 2: Strategic Influencer', 
    title: 'Strategic Influencer',
    icon: Star,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Content creators and community builders',
    benefits: [
      'Performance-based token rewards (500-5,000 per campaign)',
      'Exclusive content creation opportunities',
      'Direct communication with TAIC team',
      'Access to beta features',
      'Revenue sharing on successful campaigns'
    ],
    requirements: [
      'Established social media presence (10K+ followers)',
      'Content creation commitment',
      'Community engagement track record',
      'Alignment with TAIC messaging'
    ]
  },
  {
    id: 'Tier 3: Early Champion',
    name: 'Tier 3: Early Champion',
    title: 'Early Champion',
    icon: Trophy,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Active community members and advocates',
    benefits: [
      'Regular token rewards for contributions',
      'Community leadership opportunities',
      'Access to exclusive events',
      'Direct feedback channel to development team',
      'Recognition in community highlights'
    ],
    requirements: [
      'Active participation in TAIC community',
      'Regular content sharing and engagement',
      'Demonstrated knowledge of platform',
      'Positive community reputation'
    ]
  },
  {
    id: 'Tier 4: Community Advocate',
    name: 'Tier 4: Community Advocate',
    title: 'Community Advocate',
    icon: Award,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Engaged supporters and early adopters',
    benefits: [
      'Monthly token rewards for activity',
      'Access to community forums',
      'Early notifications of updates',
      'Participation in community votes',
      'Special community badge'
    ],
    requirements: [
      'Regular platform usage',
      'Community participation',
      'Referral activity',
      'Positive engagement metrics'
    ]
  },
  {
    id: 'Tier 5: Platform Pioneer',
    name: 'Tier 5: Platform Pioneer',
    title: 'Platform Pioneer',
    icon: Gem,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    description: 'Early supporters and whitelist members',
    benefits: [
      'Priority notifications for major announcements',
      'Potential airdrop eligibility',
      'Exclusive newsletter access',
      'Early bird access to features',
      'Community recognition'
    ],
    requirements: [
      'Early platform signup',
      'Basic community participation',
      'Newsletter subscription',
      'Social media following'
    ]
  }
];

// Country list for selection
const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands',
  'Australia', 'New Zealand', 'Japan', 'South Korea', 'Singapore', 'Hong Kong', 'India', 'Brazil',
  'Mexico', 'Argentina', 'Chile', 'Colombia', 'South Africa', 'Nigeria', 'Kenya', 'Egypt',
  'United Arab Emirates', 'Saudi Arabia', 'Israel', 'Turkey', 'Russia', 'Ukraine', 'Poland',
  'Czech Republic', 'Austria', 'Switzerland', 'Belgium', 'Denmark', 'Sweden', 'Norway', 'Finland',
  'Portugal', 'Greece', 'Ireland', 'Other'
];

// Form validation schema
const applicationSchema = z.object({
  // Personal Information
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(255),
  email: z.string().email('Please enter a valid email address'),
  telegram_handle: z.string().optional(),
  discord_id: z.string().optional(),
  country_of_residence: z.string().optional(),
  
  // Tier Selection
  applying_for_tier: z.string().min(1, 'Please select a tier to apply for'),
  
  // Application Content
  interest_reason: z.string().min(50, 'Please provide at least 50 characters explaining your interest').max(2000),
  contribution_proposal: z.string().min(50, 'Please provide at least 50 characters describing your contribution').max(2000),
  relevant_experience: z.string().optional(),
  
  // Social Media & Audience
  primary_social_profile_link: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  follower_subscriber_count: z.string().optional(),
  audience_demographics_description: z.string().optional(),
  engagement_statistics_overview: z.string().optional(),
  secondary_social_profile_links: z.string().optional(),
  
  // Experience & Technical
  previous_programs_experience: z.string().optional(),
  taic_compatible_wallet_address: z.string().optional(),
  
  // Agreements
  agreed_to_terms: z.boolean().refine(val => val === true, 'You must agree to the terms and conditions'),
  agreed_to_token_vesting: z.boolean().refine(val => val === true, 'You must agree to the token vesting schedule')
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

// Multi-step form steps
const FORM_STEPS = [
  { id: 'personal', title: 'Personal Info', icon: User, description: 'Basic contact information' },
  { id: 'tier', title: 'Tier Selection', icon: Target, description: 'Choose your program tier' },
  { id: 'application', title: 'Application', icon: FileText, description: 'Tell us about yourself' },
  { id: 'social', title: 'Social & Audience', icon: Globe, description: 'Your online presence' },
  { id: 'review', title: 'Review & Submit', icon: CheckCircle, description: 'Final review' }
];

interface PioneerApplicationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
  className?: string;
  initialTier?: string;
}

export function PioneerApplicationForm({ onSuccess, onCancel, onError, className, initialTier }: PioneerApplicationFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>(initialTier || '');
  
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      full_name: user?.displayName || '',
      email: user?.email || '',
      telegram_handle: '',
      discord_id: '',
      country_of_residence: '',
      applying_for_tier: initialTier || '',
      interest_reason: '',
      contribution_proposal: '',
      relevant_experience: '',
      primary_social_profile_link: '',
      follower_subscriber_count: '',
      audience_demographics_description: '',
      engagement_statistics_overview: '',
      secondary_social_profile_links: '',
      previous_programs_experience: '',
      taic_compatible_wallet_address: '',
      agreed_to_terms: false,
      agreed_to_token_vesting: false
    }
  });

  // Auto-populate user data if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      form.setValue('full_name', user.displayName || '');
      form.setValue('email', user.email || '');
    }
  }, [isAuthenticated, user, form]);

  // Calculate progress
  const progress = ((currentStep + 1) / FORM_STEPS.length) * 100;

  // Get current tier details
  const currentTierDetails = PIONEER_TIERS.find(tier => tier.id === selectedTier);

  const nextStep = async () => {
    const currentStepId = FORM_STEPS[currentStep].id;
    let fieldsToValidate: (keyof ApplicationFormData)[] = [];
    
    // Define fields to validate for each step
    switch (currentStepId) {
      case 'personal':
        fieldsToValidate = ['full_name', 'email'];
        break;
      case 'tier':
        fieldsToValidate = ['applying_for_tier'];
        break;
      case 'application':
        fieldsToValidate = ['interest_reason', 'contribution_proposal'];
        break;
      case 'social':
        // Optional fields, no validation required
        break;
      case 'review':
        fieldsToValidate = ['agreed_to_terms', 'agreed_to_token_vesting'];
        break;
    }
    
    // Validate current step fields
    if (fieldsToValidate.length > 0) {
      const isValid = await form.trigger(fieldsToValidate);
      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields correctly.",
          variant: "destructive"
        });
        return;
      }
    }
    
    if (currentStep < FORM_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: ApplicationFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/pioneer/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isAuthenticated && { 'Authorization': `Bearer ${localStorage.getItem('taicToken')}` })
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Application submission failed (status: ${response.status})`);
      }

      const result = await response.json();

      toast({
        title: "Application Submitted Successfully!",
        description: "Thank you for applying to the TAIC Pioneer Program. We'll review your application and get back to you soon.",
      });

      // Reset form
      form.reset();
      setCurrentStep(0);
      setSelectedTier('');

      // Call success callback
      onSuccess?.();

    } catch (error: any) {
      console.error('Application submission error:', error);
      const errorMessage = error.message || "There was an error submitting your application. Please try again.";

      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive"
      });

      // Call error callback if provided
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-headline font-bold">TAIC Pioneer Program Application</h1>
          <Badge variant="outline" className="text-sm">
            Step {currentStep + 1} of {FORM_STEPS.length}
          </Badge>
        </div>

        <Progress value={progress} className="mb-4" />

        {/* Step indicators */}
        <div className="flex items-center justify-between">
          {FORM_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <div key={step.id} className="flex flex-col items-center space-y-2">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isCompleted && "border-green-500 bg-green-500 text-white",
                  !isActive && !isCompleted && "border-muted-foreground text-muted-foreground"
                )}>
                  <StepIcon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <p className={cn(
                    "text-sm font-medium",
                    isActive && "text-primary",
                    isCompleted && "text-green-600",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Personal Information */}
          {currentStep === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Please provide your basic contact information. If you're logged in, some fields may be pre-filled.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full legal name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your.email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="telegram_handle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telegram Handle</FormLabel>
                        <FormControl>
                          <Input placeholder="@username" {...field} />
                        </FormControl>
                        <FormDescription>Optional - for community communication</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="discord_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discord ID</FormLabel>
                        <FormControl>
                          <Input placeholder="username#1234" {...field} />
                        </FormControl>
                        <FormDescription>Optional - for community access</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country_of_residence"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country of Residence</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Optional - helps us understand our global reach</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Tier Selection */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Choose Your Pioneer Tier
                </CardTitle>
                <CardDescription>
                  Select the tier that best matches your background and intended contribution to the TAIC ecosystem.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="applying_for_tier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Tier *</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {PIONEER_TIERS.map((tier) => {
                            const TierIcon = tier.icon;
                            const isSelected = field.value === tier.id;

                            return (
                              <div
                                key={tier.id}
                                className={cn(
                                  "relative p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md",
                                  isSelected ? `${tier.borderColor} ${tier.bgColor}` : "border-muted hover:border-muted-foreground",
                                )}
                                onClick={() => {
                                  field.onChange(tier.id);
                                  setSelectedTier(tier.id);
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={cn("p-2 rounded-full", tier.bgColor)}>
                                    <TierIcon className={cn("w-6 h-6", tier.color)} />
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-lg">{tier.title}</h3>
                                    <p className="text-sm text-muted-foreground mb-3">{tier.description}</p>

                                    <div className="space-y-2">
                                      <div>
                                        <h4 className="font-medium text-sm text-green-700">Benefits:</h4>
                                        <ul className="text-xs text-muted-foreground space-y-1">
                                          {tier.benefits.slice(0, 3).map((benefit, index) => (
                                            <li key={index} className="flex items-start gap-1">
                                              <span className="text-green-500 mt-0.5">•</span>
                                              {benefit}
                                            </li>
                                          ))}
                                          {tier.benefits.length > 3 && (
                                            <li className="text-xs text-muted-foreground italic">
                                              +{tier.benefits.length - 3} more benefits...
                                            </li>
                                          )}
                                        </ul>
                                      </div>

                                      <div>
                                        <h4 className="font-medium text-sm text-blue-700">Requirements:</h4>
                                        <ul className="text-xs text-muted-foreground space-y-1">
                                          {tier.requirements.slice(0, 2).map((requirement, index) => (
                                            <li key={index} className="flex items-start gap-1">
                                              <span className="text-blue-500 mt-0.5">•</span>
                                              {requirement}
                                            </li>
                                          ))}
                                          {tier.requirements.length > 2 && (
                                            <li className="text-xs text-muted-foreground italic">
                                              +{tier.requirements.length - 2} more requirements...
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    </div>
                                  </div>

                                  {isSelected && (
                                    <div className="absolute top-2 right-2">
                                      <CheckCircle className="w-5 h-5 text-green-600" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Selected Tier Details */}
                {currentTierDetails && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Selected: {currentTierDetails.title}</strong>
                      <br />
                      {currentTierDetails.description}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Application Content */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Your Application
                </CardTitle>
                <CardDescription>
                  Tell us about your interest in TAIC and how you plan to contribute to our ecosystem.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="interest_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Why are you interested in the TAIC Pioneer Program? *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your interest in TAIC, what excites you about our platform, and why you want to be part of the Pioneer Program..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum 50 characters. Tell us what draws you to TAIC and our mission.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contribution_proposal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How do you plan to contribute to the TAIC ecosystem? *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe specific ways you plan to contribute - content creation, community building, merchant partnerships, technical contributions, etc..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum 50 characters. Be specific about your planned contributions and deliverables.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="relevant_experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relevant Experience</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Share any relevant experience in crypto, e-commerce, content creation, community building, or related fields..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional - but helps us understand your background and expertise.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 4: Social Media & Audience */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Social Media & Online Presence
                </CardTitle>
                <CardDescription>
                  Help us understand your online presence and audience. All fields in this section are optional.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="primary_social_profile_link"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Social Media Profile</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="https://twitter.com/yourusername"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Your main social media profile (Twitter, LinkedIn, etc.)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="follower_subscriber_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Follower/Subscriber Count</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., 10K, 50K, 100K+"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Approximate total across all platforms</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="secondary_social_profile_links"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Social Media Links</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="List any additional social media profiles, websites, or online presence (one per line)..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Include YouTube, Instagram, TikTok, personal website, blog, etc.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="audience_demographics_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Audience Demographics</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your audience - age groups, interests, geographic distribution, etc..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Help us understand who follows you</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="engagement_statistics_overview"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Engagement Statistics</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Share typical engagement rates, views, interactions, or other relevant metrics..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Any metrics that show audience engagement</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="previous_programs_experience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Previous Ambassador/Partner Programs</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="List any previous ambassador, affiliate, or partnership programs you've participated in..."
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Experience with similar programs</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taic_compatible_wallet_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TAIC-Compatible Wallet Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="0x... (Ethereum/Polygon compatible)"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>For receiving TAIC tokens (can be added later)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Review & Submit */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Review & Submit Application
                </CardTitle>
                <CardDescription>
                  Please review your application details and agree to the terms before submitting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Application Summary */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold">Application Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Name:</span> {form.watch('full_name')}
                    </div>
                    <div>
                      <span className="font-medium">Email:</span> {form.watch('email')}
                    </div>
                    <div>
                      <span className="font-medium">Tier:</span> {PIONEER_TIERS.find(t => t.id === form.watch('applying_for_tier'))?.title || 'Not selected'}
                    </div>
                    <div>
                      <span className="font-medium">Country:</span> {form.watch('country_of_residence') || 'Not specified'}
                    </div>
                  </div>

                  {form.watch('interest_reason') && (
                    <div>
                      <span className="font-medium">Interest Reason:</span>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                        {form.watch('interest_reason')}
                      </p>
                    </div>
                  )}

                  {form.watch('contribution_proposal') && (
                    <div>
                      <span className="font-medium">Contribution Proposal:</span>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                        {form.watch('contribution_proposal')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Terms and Agreements */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="agreed_to_terms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I agree to the TAIC Pioneer Program Terms and Conditions *
                          </FormLabel>
                          <FormDescription>
                            By checking this box, you agree to abide by the program guidelines,
                            contribution requirements, and community standards.
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="agreed_to_token_vesting"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I agree to the Token Vesting Schedule *
                          </FormLabel>
                          <FormDescription>
                            Token rewards will be subject to vesting schedules as defined in the program terms.
                            This ensures long-term commitment to the TAIC ecosystem.
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Important Notice */}
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Important:</strong> Applications are reviewed manually by our team.
                    You will receive an email confirmation upon submission and updates on your application status.
                    The review process typically takes 3-5 business days.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6">
            <div>
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}

              {currentStep < FORM_STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Application
                      <CheckCircle className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
