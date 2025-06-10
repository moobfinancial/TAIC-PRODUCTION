import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

interface AuthSession {
  user?: {
    id: string;
    email?: string;
    name?: string;
    // Add other user properties as needed
  };
  error?: string; // Added for conveying errors
}

/**
 * Get the current authenticated user from the request cookies
 * This is a server-side function that can be used in API routes
 */
export async function getAuth(/* request?: NextRequest */): Promise<AuthSession> {
  // The `request` parameter isn't strictly necessary if solely relying on `cookies()` from `next/headers`,
  // as it derives context implicitly. It might be kept for future use or if other request properties are needed.
  try {
    const cookieStore = await cookies(); // Call once.
    const sessionToken = cookieStore.get('session-token')?.value;

    if (sessionToken) {
      // MOCK IMPLEMENTATION: Replace with actual session validation and user retrieval
      // This part should ideally involve verifying the sessionToken (e.g., against a DB or a JWT secret)
      // and then fetching the actual user details.
      // Example: const user = await validateSessionAndGetUser(sessionToken);
      // if (!user) return { error: "Invalid session" };
      // return { user };

      return {
        user: {
          id: 'mock-user-id-from-token', // Should be dynamic based on token
          email: 'user@example.com',    // Should be dynamic
          name: 'Mock User'             // Should be dynamic
        }
      };
    }
    return {}; // No session token found
  } catch (error: any) {
    console.error('[Auth] Error in getAuth:', error.message, error.stack);
    // Check for common Next.js errors when `cookies()` is misused
    // Error messages can vary slightly between Next.js versions.
    const errorMessage = error.message || '';
    if (errorMessage.includes('cookies() was called outside a Server Component') || 
        errorMessage.includes('Invariant: cookies() expects to have current pathname') ||
        errorMessage.includes('Dynamic server usage') ||
        errorMessage.includes('next/headers') // General catch for next/headers issues
        ) {
      return { error: 'Auth context not available or cookies used in unsupported environment.' };
    }
    // For other errors, return a generic error message
    return { error: 'Failed to retrieve authentication session.' };
  }
}

/**
 * Get the current user ID from the request
 * This is a convenience function that extracts just the user ID
 */
export async function getUserId(/* request?: NextRequest */): Promise<string | null> {
  const session = await getAuth(/* request */);
  // Check for error or no user before accessing user.id
  if (session.error || !session.user) {
    if (session.error) {
      console.log(`[Auth] getUserId: Denying access due to auth error: ${session.error}`);
    }
    return null;
  }
  return session.user.id;
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
