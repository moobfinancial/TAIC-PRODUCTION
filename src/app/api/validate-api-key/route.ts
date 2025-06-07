import { NextResponse } from 'next/server';
import { validateAdminApiKey } from '@/lib/adminAuth';

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();
    
    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    const result = await validateAdminApiKey(apiKey);
    
    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      userId: result.userId,
      username: result.username
    });
  } catch (error) {
    console.error('Error validating API key:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Prevent caching of this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
