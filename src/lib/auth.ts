import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

interface AuthSession {
  user?: {
    id: string;
    email?: string;
    name?: string;
    // Add other user properties as needed
  };
}

/**
 * Get the current authenticated user from the request cookies
 * This is a server-side function that can be used in API routes
 */
export async function getAuth(request?: NextRequest): Promise<AuthSession> {
  // In a real implementation, you would validate the session token
  // from the cookies or headers and fetch the user from your database
  
  try {
    // For API routes that use the NextRequest object
    if (request) {
      const cookieStore = cookies();
      const sessionToken = cookieStore.get('session-token')?.value;
      
      // In a real app, you would validate the token and fetch the user
      if (sessionToken) {
        // Mock implementation - replace with actual session validation
        return {
          user: {
            id: 'user-from-token',
            email: 'user@example.com',
            name: 'Test User'
          }
        };
      }
    }
    
    // For server components or when no request is provided
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session-token')?.value;
    
    if (sessionToken) {
      // Mock implementation - replace with actual session validation
      return {
        user: {
          id: 'user-from-token',
          email: 'user@example.com',
          name: 'Test User'
        }
      };
    }
    
    return {};
  } catch (error) {
    console.error('Error getting auth session:', error);
    return {};
  }
}

/**
 * Get the current user ID from the request
 * This is a convenience function that extracts just the user ID
 */
export async function getUserId(request?: NextRequest): Promise<string | null> {
  const session = await getAuth(request);
  return session.user?.id || null;
}
