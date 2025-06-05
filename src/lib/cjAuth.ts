import crypto from 'crypto';

const RATE_LIMIT_TOKEN_PLACEHOLDER = 'CJ_RATE_LIMITED_DO_NOT_USE';

interface CjAccessTokenResponse {
  code: number;
  result: boolean;
  message: string;
  data: {
    accessToken: string;
    accessTokenExpiryDate?: string; // e.g., "2025-06-18T22:23:16+08:00"
    expireIn?: number;             // Expiry time in seconds, can be used as fallback
    refreshToken?: string;
    refreshTokenExpiryDate?: string;
    createDate?: string;
    openId?: number;
  } | null;
  requestId: string;
  success: boolean;
}

interface CjTokenCache {
  token: string;
  expiresAt: number; // Timestamp in milliseconds
}

// Define a unique symbol or string for our global cache
const GLOBAL_CJ_AUTH_CACHE_KEY = Symbol.for('GLOBAL_CJ_AUTH_CACHE');

interface GlobalCjAuthCache {
  tokenCache: CjTokenCache | null;
  isFetchingToken: boolean;
  currentTokenPromise: Promise<string> | null;
}

// Initialize the global cache if it doesn't exist
if (!(global as any)[GLOBAL_CJ_AUTH_CACHE_KEY]) {
  (global as any)[GLOBAL_CJ_AUTH_CACHE_KEY] = {
    tokenCache: null,
    isFetchingToken: false,
    currentTokenPromise: null,
  };
}

// Helper function to get the cache from global
function getGlobalCache(): GlobalCjAuthCache {
  return (global as any)[GLOBAL_CJ_AUTH_CACHE_KEY];
}

/**
 * Calculate MD5 hash of a string
 */
export function calculateMd5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Get a valid CJ Dropshipping access token
 * This will either return a cached token or fetch a new one if needed
 */
export async function getCjAccessToken(): Promise<string> {
  const callId = crypto.randomBytes(4).toString('hex');
    const globalCache = getGlobalCache();
  console.log(`[CJ Auth - ${callId}] getCjAccessToken called. Current globalCache: ${globalCache.tokenCache ? JSON.stringify(globalCache.tokenCache) : 'null'}, isFetchingToken: ${globalCache.isFetchingToken}`);
  const now = Date.now();

  // Check for active rate limit cache first
  if (globalCache.tokenCache && globalCache.tokenCache.token === RATE_LIMIT_TOKEN_PLACEHOLDER && globalCache.tokenCache.expiresAt > now) {
    console.warn(`[CJ Auth - ${callId}] Currently rate limited by CJ. Active cooldown until ${new Date(globalCache.tokenCache.expiresAt).toISOString()}. Throwing cached rate limit error.`);
    throw new Error('CJ Authentication Rate Limited: Too much request, QPS limit is 1 time/300 seconds. Please wait before trying again (cached response).');
  }

  // Check for valid, usable token in cache (and not the rate limit placeholder)
  if (globalCache.tokenCache && globalCache.tokenCache.token && globalCache.tokenCache.token !== RATE_LIMIT_TOKEN_PLACEHOLDER && globalCache.tokenCache.expiresAt > now) {
    console.log(`[CJ Auth - ${callId}] Using cached access token`);
    return globalCache.tokenCache.token;
  }

  if (globalCache.isFetchingToken && globalCache.currentTokenPromise) {
    console.log(`[CJ Auth - ${callId}] Another request is already fetching the token, awaiting its completion.`);
    return globalCache.currentTokenPromise;
  }

  console.log(`[CJ Auth - ${callId}] Initiating new token fetch process.`);
  globalCache.isFetchingToken = true;
  globalCache.currentTokenPromise = (async (): Promise<string> => { // IIFE starts here
    try {
      console.log(`[CJ Auth - ${callId}] Fetching new access token (lock acquired)`);
      const email = process.env.CJ_EMAIL;
      const password = process.env.CJ_PASSWORD;

      if (!email || !password) {
        throw new Error('CJ_EMAIL and CJ_PASSWORD environment variables must be set. CJ_EMAIL should be your CJ account email, and CJ_PASSWORD should be your CJ API Key.');
      }

      const apiKey = password;
      const authUrl = 'https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken';

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: apiKey,
        }),
      });

      const data: CjAccessTokenResponse = await response.json();
      console.log(`[CJ Auth - ${callId}] Response from API:`, data);

      // Handle specific error codes first
      if (data.code === 1600200) { // Rate limit detected
        const rateLimitErrorMsg = `CJ Authentication Rate Limited: ${data.message || 'Too much request, QPS limit is 1 time/300 seconds'}. Please wait before trying again.`;
        globalCache.tokenCache = {
          token: RATE_LIMIT_TOKEN_PLACEHOLDER,
          expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes from now
        };
        console.warn(`[CJ Auth - ${callId}] Rate limit hit (Code: ${data.code}). Caching rate limit placeholder for 5 minutes. Expires At: ${new Date(globalCache.tokenCache.expiresAt).toISOString()}`);
        throw new Error(rateLimitErrorMsg);
      }

      if (data.code === 1600005) { // Invalid credentials / API Key
        const authFailedErrorMsg = `CJ Authentication Failed: ${data.message || 'Invalid API Key or Email'}. Please verify CJ_EMAIL and ensure CJ_PASSWORD in .env.local contains the correct API Key. (Code: ${data.code})`;
        globalCache.tokenCache = null; // Clear any potentially stale cache on auth failure
        throw new Error(authFailedErrorMsg);
      }

      // Proceed with success if token is present and no critical errors handled above
      if (data.result && data.data?.accessToken) {
        console.log(`[CJ Auth - ${callId}] Successfully authenticated with Email and API Key.`);
        const tokenFetchTime = Date.now();
        let expiresAt: number;

        if (data.data.accessTokenExpiryDate) {
            try {
                const apiExpiryTime = new Date(data.data.accessTokenExpiryDate).getTime();
                if (isNaN(apiExpiryTime) || apiExpiryTime <= tokenFetchTime) {
                    console.warn(`[CJ Auth - ${callId}] API's accessTokenExpiryDate (${data.data.accessTokenExpiryDate}) is invalid or in the past. Defaulting cache expiry to 1 hour from now.`);
                    expiresAt = tokenFetchTime + (60 * 60 * 1000); // 1 hour from now
                } else {
                    const remainingLifetimeMs = apiExpiryTime - tokenFetchTime;
                    let bufferMs = Math.max(remainingLifetimeMs * 0.1, 1 * 60 * 60 * 1000); // 10% or 1 hour
                    bufferMs = Math.max(bufferMs, 5 * 60 * 1000);   // Min 5 minutes buffer
                    bufferMs = Math.min(bufferMs, 24 * 60 * 60 * 1000); // Max 1 day buffer

                    if (bufferMs >= remainingLifetimeMs * 0.9 && remainingLifetimeMs > 0) {
                        bufferMs = remainingLifetimeMs * 0.5;
                    }
                    if (bufferMs <= 0 && remainingLifetimeMs > 0) bufferMs = remainingLifetimeMs * 0.1;
                    else if (bufferMs <=0) bufferMs = 1 * 60 * 1000;

                    expiresAt = apiExpiryTime - bufferMs;
                    console.log(`[CJ Auth - ${callId}] Using accessTokenExpiryDate. API Expiry: ${new Date(apiExpiryTime).toISOString()}, Cache Expiry: ${new Date(expiresAt).toISOString()}`);
                }
            } catch (dateError) {
                console.error(`[CJ Auth - ${callId}] Error parsing accessTokenExpiryDate. Defaulting cache expiry to 1 hour from now.`, dateError);
                expiresAt = tokenFetchTime + (60 * 60 * 1000); // 1 hour from now
            }
        } else if (data.data.expireIn && typeof data.data.expireIn === 'number' && data.data.expireIn > 0) {
            const expiresInMs = data.data.expireIn * 1000;
            console.log(`[CJ Auth - ${callId}] Using expireIn from API response: ${data.data.expireIn}s. Calculating cache expiry.`);
            let bufferMs = Math.max(expiresInMs * 0.1, 1 * 60 * 60 * 1000);
            bufferMs = Math.max(bufferMs, 5 * 60 * 1000);
            bufferMs = Math.min(bufferMs, 24 * 60 * 60 * 1000);

            if (bufferMs >= expiresInMs * 0.9 && expiresInMs > 0) {
                bufferMs = expiresInMs * 0.5;
            }
            if (bufferMs <= 0 && expiresInMs > 0) bufferMs = expiresInMs * 0.1;
            else if (bufferMs <=0) bufferMs = 1 * 60 * 1000;

            expiresAt = tokenFetchTime + expiresInMs - bufferMs;
            console.log(`[CJ Auth - ${callId}] Using expireIn. Original Duration: ${expiresInMs}ms, Cache Expiry: ${new Date(expiresAt).toISOString()}`);
        } else {
            console.warn(`[CJ Auth - ${callId}] No valid expiry information (accessTokenExpiryDate or expireIn) in CJ API response. Defaulting cache expiry to 1 hour from now.`);
            expiresAt = tokenFetchTime + (60 * 60 * 1000); // 1 hour from now
        }

        if (expiresAt <= tokenFetchTime) {
            console.warn(`[CJ Auth - ${callId}] Calculated expiresAt (${new Date(expiresAt).toISOString()}) is not in the future relative to fetch time (${new Date(tokenFetchTime).toISOString()}). Overriding to 15 minutes from fetch time.`);
            expiresAt = tokenFetchTime + (15 * 60 * 1000);
        }

        globalCache.tokenCache = {
          token: data.data.accessToken,
          expiresAt,
        };
        console.log(`[CJ Auth - ${callId}] Token cached. Final Expires At: ${new Date(expiresAt).toISOString()}`);
        return data.data.accessToken;
      }

      // Fallback for other errors if not successful and not caught by specific code checks above
      const fallbackErrorMsg = `CJ Authentication failed: ${data.message || 'Unknown API error response.'} (Code: ${data.code})`;
      console.error(`[CJ Auth - ${callId}] Fallback error: ${fallbackErrorMsg}`, data);
      // Clear cache on unknown errors to avoid re-using potentially problematic state, unless it was a rate limit (already handled)
      if (globalCache.tokenCache?.token !== RATE_LIMIT_TOKEN_PLACEHOLDER) {
          globalCache.tokenCache = null;
      }
      throw new Error(fallbackErrorMsg);
    } catch (error: any) { // try block ends here, catch starts
      console.error(`[CJ Auth - ${callId}] Error during token acquisition attempt:`, error.message);
      throw error; // Re-throw to ensure the promise rejects
    } finally { // catch block ends, finally starts
      getGlobalCache().isFetchingToken = false;
      // currentTokenPromise is not nullified here to allow other awaiters to get the result (resolved or rejected)
    }
  })(); // IIFE is invoked here

  return globalCache.currentTokenPromise;
}
