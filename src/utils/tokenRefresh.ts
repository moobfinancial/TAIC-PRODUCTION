/**
 * Utility functions for handling JWT token refresh
 */

/**
 * Checks if a JWT token is expired or will expire soon
 * @param token The JWT token to check
 * @param bufferSeconds Time buffer in seconds before actual expiration (default: 60)
 * @returns boolean indicating if token is expired or will expire soon
 */
export function isTokenExpiredOrExpiringSoon(token: string, bufferSeconds = 60): boolean {
  if (!token) return true;
  
  try {
    // Decode the JWT token (without verification)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const { exp } = JSON.parse(jsonPayload);
    
    if (!exp) return true;
    
    // Check if token is expired or will expire soon
    // exp is in seconds, Date.now() is in milliseconds
    return exp * 1000 < Date.now() + bufferSeconds * 1000;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // If we can't decode the token, assume it's expired
  }
}

/**
 * Refreshes the JWT token
 * @param currentToken The current JWT token
 * @returns A promise that resolves to the new token or null if refresh failed
 */
export async function refreshToken(currentToken: string): Promise<string | null> {
  if (!currentToken) return null;
  
  try {
    const response = await fetch('/api/merchant/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}
