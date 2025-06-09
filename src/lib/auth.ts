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

// New JWT verification utility
import jwt from 'jsonwebtoken'; // Ensure this import is at the top if not already

export interface AuthResult { // Renamed from subtask's AuthResult to avoid conflict if any local type exists
  valid: boolean;
  userId?: number | string; // Or just number if your DB IDs are numbers
  error?: string;
  status?: number;
}

export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization header missing or malformed', status: 401 };
  }
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  if (!token) {
    return { valid: false, error: 'Token not found', status: 401 };
  }
  try {
    // Ensure JWT_SECRET is available in this scope.
    // It's better to access it via a config module (like settings.JWT_SECRET)
    // For now, directly using process.env.JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error("JWT_SECRET is not defined in environment variables.");
        return { valid: false, error: 'JWT secret not configured on server.', status: 500 };
    }
    const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload;

    // Ensure your JWT payload contains userId (or sub, etc.)
    // The user ID from our JWTs is numeric (from database SERIAL)
    const userIdFromToken = decoded.userId || decoded.sub;
    if (!userIdFromToken) {
      return { valid: false, error: 'Invalid token: userId missing', status: 401 };
    }

    // Ensure userId is a number if your DB IDs are numbers
    const numericUserId = Number(userIdFromToken);
    if (isNaN(numericUserId)) {
        return { valid: false, error: 'Invalid token: userId is not a valid number', status: 401 };
    }

    return { valid: true, userId: numericUserId };
  } catch (error: any) {
    let errorMessage = 'Invalid or expired token';
    let errorStatus = 401;
    if (error.name === 'TokenExpiredError') {
        errorMessage = 'Token expired';
        errorStatus = 401; // Or 403 if preferred for expired
    } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Invalid token signature';
    } else {
        console.error("Unexpected JWT verification error:", error);
        errorMessage = 'Token verification failed due to an unexpected error.';
        errorStatus = 500; // Internal server error for unexpected issues
    }
    return { valid: false, error: errorMessage, status: errorStatus };
  }
}
