/**
 * Helper functions for API requests and error handling
 */

import { toast } from '@/hooks/use-toast';

/**
 * Standard error response structure from API
 */
export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

/**
 * Handles API errors consistently across the application
 * @param error The error object from fetch or try/catch
 * @param defaultMessage Default message to show if error doesn't have a specific message
 * @param showToast Whether to show a toast notification (default: true)
 * @returns The error message
 */
export function handleApiError(error: any, defaultMessage = 'An error occurred', showToast = true): string {
  console.error('API Error:', error);
  
  let errorMessage = defaultMessage;
  
  // Try to extract error message from various error formats
  if (error instanceof Response) {
    errorMessage = `Error: ${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    errorMessage = error.message || defaultMessage;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object') {
    // Handle structured API error responses
    if (error.error || error.message) {
      errorMessage = error.error || error.message;
    } else if (error.details && typeof error.details === 'string') {
      errorMessage = error.details;
    }
  }
  
  // Show toast notification if requested
  if (showToast) {
    toast({
      title: 'Error',
      description: errorMessage,
      variant: 'destructive',
    });
  }
  
  return errorMessage;
}

/**
 * Formats API request options with authentication token
 * @param token JWT token for authentication
 * @param options Additional fetch options
 * @returns Formatted request options with auth header
 */
export function withAuth(token: string | null, options: RequestInit = {}): RequestInit {
  if (!token) {
    return options;
  }
  
  return {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  };
}

/**
 * Parses API response and handles common error cases
 * @param response Fetch API response
 * @returns Promise that resolves to parsed JSON data or rejects with error
 */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Try to parse error response
    try {
      const errorData = await response.json();
      throw errorData;
    } catch (e) {
      // If parsing fails, throw response object
      throw response;
    }
  }
  
  return response.json() as Promise<T>;
}
