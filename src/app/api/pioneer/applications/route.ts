import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// Interface for JWT payload
interface UserPayload {
  userId: string;
  email?: string;
  walletAddress?: string;
  role: string;
  iat: number;
  exp: number;
}

// Interface for the Pioneer Application Form data (matches PioneerApplicationForm.tsx)
interface PioneerApplicationFormData {
  full_name: string;
  email: string;
  telegram_handle?: string;
  discord_id?: string;
  country_of_residence?: string;
  applying_for_tier: string;
  interest_reason: string;
  contribution_proposal: string;
  relevant_experience?: string;
  primary_social_profile_link?: string;
  follower_subscriber_count?: string;
  audience_demographics_description?: string;
  engagement_statistics_overview?: string;
  secondary_social_profile_links?: string;
  previous_programs_experience?: string;
  taic_compatible_wallet_address?: string;
  agreed_to_terms: boolean;
  agreed_to_token_vesting: boolean;
}

// Interface for FastAPI backend request (matches actual database schema)
interface FastAPIApplicationRequest {
  full_name: string;
  email: string;
  telegram_handle?: string;
  discord_id?: string;
  country_of_residence?: string;
  applying_for_tier: string;
  application_text: string; // Combined interest_reason + contribution_proposal
  reason_for_interest?: string; // Maps to interest_reason from form
  relevant_experience?: string; // Maps to relevant_experience from form
  social_media_links?: any; // JSONB object containing all social media data
  agreed_to_terms: boolean;
  agreed_to_token_vesting: boolean;
}

// Interface for FastAPI response (matches actual database schema)
interface FastAPIApplicationResponse {
  id: number;
  user_id?: string;
  full_name: string;
  email: string;
  telegram_handle?: string;
  discord_id?: string;
  country_of_residence?: string;
  applying_for_tier: string;
  application_text: string;
  reason_for_interest?: string;
  relevant_experience?: string;
  social_media_links?: any;
  application_status: string;
  submitted_at: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const FASTAPI_BACKEND_URL = process.env.FASTAPI_BACKEND_URL || 'http://127.0.0.1:8000';

// Helper function to verify JWT token (optional authentication)
async function verifyAuth(request: NextRequest): Promise<UserPayload | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null; // No authentication provided - this is allowed for Pioneer applications
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    return null;
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null; // Invalid token - proceed without authentication
  }
}

// Transform frontend form data to FastAPI backend format (matching database schema)
function transformToFastAPIFormat(formData: PioneerApplicationFormData): FastAPIApplicationRequest {
  // Combine interest_reason and contribution_proposal into application_text
  const applicationText = `Interest Reason:\n${formData.interest_reason}\n\nContribution Proposal:\n${formData.contribution_proposal}`;

  // Create social media links JSONB object
  const socialMediaLinks: any = {};
  if (formData.primary_social_profile_link) {
    socialMediaLinks.primary_profile = formData.primary_social_profile_link;
  }
  if (formData.secondary_social_profile_links) {
    socialMediaLinks.secondary_profiles = formData.secondary_social_profile_links;
  }
  if (formData.follower_subscriber_count) {
    socialMediaLinks.follower_count = formData.follower_subscriber_count;
  }
  if (formData.audience_demographics_description) {
    socialMediaLinks.audience_demographics = formData.audience_demographics_description;
  }
  if (formData.engagement_statistics_overview) {
    socialMediaLinks.engagement_stats = formData.engagement_statistics_overview;
  }

  return {
    full_name: formData.full_name,
    email: formData.email,
    telegram_handle: formData.telegram_handle || undefined,
    discord_id: formData.discord_id || undefined,
    country_of_residence: formData.country_of_residence || undefined,
    applying_for_tier: formData.applying_for_tier,
    application_text: applicationText,
    reason_for_interest: formData.interest_reason,
    relevant_experience: formData.relevant_experience || formData.previous_programs_experience || undefined,
    social_media_links: Object.keys(socialMediaLinks).length > 0 ? socialMediaLinks : undefined,
    agreed_to_terms: formData.agreed_to_terms,
    agreed_to_token_vesting: formData.agreed_to_token_vesting
  };
}

export async function POST(request: NextRequest) {
  console.log('[Pioneer Applications API] Received POST request');
  
  try {
    // Parse request body
    const formData: PioneerApplicationFormData = await request.json();
    console.log('[Pioneer Applications API] Form data received:', {
      email: formData.email,
      full_name: formData.full_name,
      applying_for_tier: formData.applying_for_tier
    });

    // Validate required fields
    if (!formData.full_name || !formData.email || !formData.applying_for_tier) {
      console.error('[Pioneer Applications API] Missing required fields');
      return NextResponse.json(
        { 
          message: 'Missing required fields: full_name, email, and applying_for_tier are required',
          error: 'VALIDATION_ERROR'
        }, 
        { status: 400 }
      );
    }

    if (!formData.agreed_to_terms || !formData.agreed_to_token_vesting) {
      console.error('[Pioneer Applications API] Terms agreement required');
      return NextResponse.json(
        { 
          message: 'Agreement to terms and conditions and token vesting schedule is required',
          error: 'TERMS_AGREEMENT_REQUIRED'
        }, 
        { status: 400 }
      );
    }

    // Verify authentication (optional - Pioneer applications can be submitted by guests)
    const userPayload = await verifyAuth(request);
    const authenticatedUserId = userPayload?.userId || null;
    
    if (authenticatedUserId) {
      console.log('[Pioneer Applications API] Authenticated user:', authenticatedUserId);
    } else {
      console.log('[Pioneer Applications API] Guest application submission');
    }

    // Transform form data to FastAPI format
    const fastApiPayload = transformToFastAPIFormat(formData);
    
    // Construct FastAPI backend URL
    const fastApiUrl = `${FASTAPI_BACKEND_URL}/api/pioneer-program/apply`;
    console.log('[Pioneer Applications API] Proxying to FastAPI:', fastApiUrl);

    // Make request to FastAPI backend
    const fastApiResponse = await fetch(fastApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: FastAPI endpoint uses get_optional_current_user_id dependency
        // which extracts user_id from JWT if provided, but doesn't require authentication
        ...(userPayload && { 'Authorization': `Bearer ${request.headers.get('Authorization')?.split(' ')[1]}` })
      },
      body: JSON.stringify(fastApiPayload),
      // Add timeout for server-to-server request
      signal: AbortSignal.timeout(30000) // 30 seconds timeout
    });

    console.log('[Pioneer Applications API] FastAPI response status:', fastApiResponse.status);

    // Handle FastAPI response
    if (!fastApiResponse.ok) {
      let errorMessage = 'Application submission failed';
      let errorDetails = '';
      
      try {
        const errorData = await fastApiResponse.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
        errorDetails = JSON.stringify(errorData);
        console.error('[Pioneer Applications API] FastAPI error response:', errorData);
      } catch (parseError) {
        // If error response is not JSON, use status text
        errorMessage = fastApiResponse.statusText || errorMessage;
        console.error('[Pioneer Applications API] Non-JSON error response:', fastApiResponse.statusText);
      }

      // Map specific FastAPI error codes to appropriate HTTP status codes
      let statusCode = fastApiResponse.status;
      if (fastApiResponse.status === 409) {
        // Duplicate email conflict
        errorMessage = 'An application with this email address has already been submitted.';
      } else if (fastApiResponse.status === 422) {
        // Validation error
        errorMessage = 'Invalid application data. Please check all fields and try again.';
      }

      return NextResponse.json(
        { 
          message: errorMessage,
          error: 'BACKEND_ERROR',
          details: errorDetails
        }, 
        { status: statusCode }
      );
    }

    // Parse successful response
    const responseData: FastAPIApplicationResponse = await fastApiResponse.json();
    console.log('[Pioneer Applications API] Application submitted successfully:', {
      id: responseData.id,
      email: responseData.email,
      status: responseData.application_status
    });

    // Return success response to frontend
    return NextResponse.json(
      {
        success: true,
        message: 'Pioneer Program application submitted successfully',
        application: {
          id: responseData.id,
          email: responseData.email,
          full_name: responseData.full_name,
          applying_for_tier: responseData.applying_for_tier,
          application_status: responseData.application_status,
          submitted_at: responseData.submitted_at
        }
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('[Pioneer Applications API] Unexpected error:', error);

    // Handle specific error types
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { 
          message: 'Request timeout. The application submission took too long. Please try again.',
          error: 'TIMEOUT_ERROR'
        }, 
        { status: 504 }
      );
    }

    if (error.cause && typeof error.cause === 'object' && 'code' in error.cause) {
      const errorCode = (error.cause as { code: string }).code;
      if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND') {
        return NextResponse.json(
          { 
            message: 'Backend service is currently unavailable. Please try again later.',
            error: 'SERVICE_UNAVAILABLE'
          }, 
          { status: 503 }
        );
      }
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json(
        { 
          message: 'Invalid request format. Please check your application data.',
          error: 'INVALID_JSON'
        }, 
        { status: 400 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { 
        message: 'An unexpected error occurred while submitting your application. Please try again.',
        error: 'INTERNAL_ERROR',
        details: error.message || 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// Handle unsupported HTTP methods
export async function GET() {
  return NextResponse.json(
    { message: 'Method not allowed. Use POST to submit Pioneer Program applications.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { message: 'Method not allowed. Use POST to submit Pioneer Program applications.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { message: 'Method not allowed. Use POST to submit Pioneer Program applications.' },
    { status: 405 }
  );
}
