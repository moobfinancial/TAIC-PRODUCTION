import crypto from 'crypto';

const RATE_LIMIT_TOKEN_PLACEHOLDER = 'SUPPLIER_RATE_LIMITED_DO_NOT_USE'; // Renamed

interface SupplierAccessTokenResponse { // Renamed
  code: number;
  result: boolean;
  message: string;
  data: {
    accessToken: string;
    accessTokenExpiryDate?: string;
    expireIn?: number;
    refreshToken?: string;
    refreshTokenExpiryDate?: string;
    createDate?: string;
    openId?: number;
  } | null;
  requestId: string;
  success: boolean;
}

interface SupplierTokenCache { // Renamed
  token: string;
  expiresAt: number;
}

// Define a unique symbol or string for our global cache
const GLOBAL_SUPPLIER_AUTH_CACHE_KEY = Symbol.for('GLOBAL_SUPPLIER_AUTH_CACHE'); // Renamed

interface GlobalSupplierAuthCache { // Renamed
  tokenCache: SupplierTokenCache | null;
  isFetchingToken: boolean;
  currentTokenPromise: Promise<string> | null;
}

// Initialize the global cache if it doesn't exist
if (!(global as any)[GLOBAL_SUPPLIER_AUTH_CACHE_KEY]) {
  (global as any)[GLOBAL_SUPPLIER_AUTH_CACHE_KEY] = {
    tokenCache: null,
    isFetchingToken: false,
    currentTokenPromise: null,
  };
}

// Helper function to get the cache from global
function getGlobalCache(): GlobalSupplierAuthCache { // Renamed
  return (global as any)[GLOBAL_SUPPLIER_AUTH_CACHE_KEY];
}

/**
 * Calculate MD5 hash of a string
 */
export function calculateMd5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Get a valid Supplier access token (currently CJ Dropshipping)
 * This will either return a cached token or fetch a new one if needed
 */
export async function getSupplierAccessToken(): Promise<string> { // Renamed
  const callId = crypto.randomBytes(4).toString('hex');
    const globalCache = getGlobalCache();
  console.log(`[Supplier Auth - ${callId}] getSupplierAccessToken called. Current globalCache: ${globalCache.tokenCache ? JSON.stringify(globalCache.tokenCache) : 'null'}, isFetchingToken: ${globalCache.isFetchingToken}`);
  const now = Date.now();

  // Check for active rate limit cache first
  if (globalCache.tokenCache && globalCache.tokenCache.token === RATE_LIMIT_TOKEN_PLACEHOLDER && globalCache.tokenCache.expiresAt > now) {
    console.warn(`[Supplier Auth - ${callId}] Currently rate limited by Supplier. Active cooldown until ${new Date(globalCache.tokenCache.expiresAt).toISOString()}. Throwing cached rate limit error.`);
    throw new Error('Supplier Authentication Rate Limited: Too much request. Please wait before trying again (cached response).'); // Generic message
  }

  // Check for valid, usable token in cache (and not the rate limit placeholder)
  if (globalCache.tokenCache && globalCache.tokenCache.token && globalCache.tokenCache.token !== RATE_LIMIT_TOKEN_PLACEHOLDER && globalCache.tokenCache.expiresAt > now) {
    console.log(`[Supplier Auth - ${callId}] Using cached access token`);
    return globalCache.tokenCache.token;
  }

  if (globalCache.isFetchingToken && globalCache.currentTokenPromise) {
    console.log(`[Supplier Auth - ${callId}] Another request is already fetching the token, awaiting its completion.`);
    return globalCache.currentTokenPromise;
  }

  console.log(`[Supplier Auth - ${callId}] Initiating new token fetch process.`);
  globalCache.isFetchingToken = true;
  globalCache.currentTokenPromise = (async (): Promise<string> => { // IIFE starts here
    try {
      console.log(`[Supplier Auth - ${callId}] Fetching new access token (lock acquired)`);
      // These ENV vars are still CJ specific as this is the current supplier
      const email = process.env.CJ_EMAIL;
      const password = process.env.CJ_PASSWORD;

      if (!email || !password) {
        throw new Error('SUPPLIER_EMAIL and SUPPLIER_API_KEY (using CJ_EMAIL/CJ_PASSWORD env vars) must be set.');
      }

      const apiKey = password;
      // This URL is specific to CJ, if supplier changes, this needs to be configurable
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

      const data: SupplierAccessTokenResponse = await response.json(); // Use renamed interface
      console.log(`[Supplier Auth - ${callId}] Response from API:`, data);

      // Handle specific error codes first (these codes are CJ specific)
      if (data.code === 1600200) { // Rate limit detected
        const rateLimitErrorMsg = `Supplier Authentication Rate Limited: ${data.message || 'Too many requests'}. Please wait before trying again.`;
        globalCache.tokenCache = {
          token: RATE_LIMIT_TOKEN_PLACEHOLDER,
          expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes from now
        };
        console.warn(`[Supplier Auth - ${callId}] Rate limit hit (Code: ${data.code}). Caching rate limit placeholder for 5 minutes. Expires At: ${new Date(globalCache.tokenCache.expiresAt).toISOString()}`);
        throw new Error(rateLimitErrorMsg);
      }

      if (data.code === 1600005) { // Invalid credentials / API Key
        const authFailedErrorMsg = `Supplier Authentication Failed: ${data.message || 'Invalid API Key or Email'}. Please verify SUPPLIER_EMAIL and SUPPLIER_API_KEY (using CJ_EMAIL/CJ_PASSWORD env vars). (Code: ${data.code})`;
        globalCache.tokenCache = null;
        throw new Error(authFailedErrorMsg);
      }

      if (data.result && data.data?.accessToken) {
        console.log(`[Supplier Auth - ${callId}] Successfully authenticated with Email and API Key.`);
        const tokenFetchTime = Date.now();
        let expiresAt: number;

        if (data.data.accessTokenExpiryDate) {
            try {
                const apiExpiryTime = new Date(data.data.accessTokenExpiryDate).getTime();
                if (isNaN(apiExpiryTime) || apiExpiryTime <= tokenFetchTime) {
                    console.warn(`[Supplier Auth - ${callId}] API's accessTokenExpiryDate (${data.data.accessTokenExpiryDate}) is invalid or in the past. Defaulting cache expiry to 1 hour from now.`);
                    expiresAt = tokenFetchTime + (60 * 60 * 1000);
                } else {
                    const remainingLifetimeMs = apiExpiryTime - tokenFetchTime;
                    let bufferMs = Math.max(remainingLifetimeMs * 0.1, 1 * 60 * 60 * 1000);
                    bufferMs = Math.max(bufferMs, 5 * 60 * 1000);
                    bufferMs = Math.min(bufferMs, 24 * 60 * 60 * 1000);

                    if (bufferMs >= remainingLifetimeMs * 0.9 && remainingLifetimeMs > 0) {
                        bufferMs = remainingLifetimeMs * 0.5;
                    }
                    if (bufferMs <= 0 && remainingLifetimeMs > 0) bufferMs = remainingLifetimeMs * 0.1;
                    else if (bufferMs <=0) bufferMs = 1 * 60 * 1000;

                    expiresAt = apiExpiryTime - bufferMs;
                    console.log(`[Supplier Auth - ${callId}] Using accessTokenExpiryDate. API Expiry: ${new Date(apiExpiryTime).toISOString()}, Cache Expiry: ${new Date(expiresAt).toISOString()}`);
                }
            } catch (dateError) {
                console.error(`[Supplier Auth - ${callId}] Error parsing accessTokenExpiryDate. Defaulting cache expiry to 1 hour from now.`, dateError);
                expiresAt = tokenFetchTime + (60 * 60 * 1000);
            }
        } else if (data.data.expireIn && typeof data.data.expireIn === 'number' && data.data.expireIn > 0) {
            const expiresInMs = data.data.expireIn * 1000;
            console.log(`[Supplier Auth - ${callId}] Using expireIn from API response: ${data.data.expireIn}s. Calculating cache expiry.`);
            let bufferMs = Math.max(expiresInMs * 0.1, 1 * 60 * 60 * 1000);
            bufferMs = Math.max(bufferMs, 5 * 60 * 1000);
            bufferMs = Math.min(bufferMs, 24 * 60 * 60 * 1000);

            if (bufferMs >= expiresInMs * 0.9 && expiresInMs > 0) {
                bufferMs = expiresInMs * 0.5;
            }
            if (bufferMs <= 0 && expiresInMs > 0) bufferMs = expiresInMs * 0.1;
            else if (bufferMs <=0) bufferMs = 1 * 60 * 1000;

            expiresAt = tokenFetchTime + expiresInMs - bufferMs;
            console.log(`[Supplier Auth - ${callId}] Using expireIn. Original Duration: ${expiresInMs}ms, Cache Expiry: ${new Date(expiresAt).toISOString()}`);
        } else {
            console.warn(`[Supplier Auth - ${callId}] No valid expiry information in Supplier API response. Defaulting cache expiry to 1 hour from now.`);
            expiresAt = tokenFetchTime + (60 * 60 * 1000);
        }

        if (expiresAt <= tokenFetchTime) {
            console.warn(`[Supplier Auth - ${callId}] Calculated expiresAt (${new Date(expiresAt).toISOString()}) is not in the future. Overriding to 15 minutes from fetch time.`);
            expiresAt = tokenFetchTime + (15 * 60 * 1000);
        }

        globalCache.tokenCache = {
          token: data.data.accessToken,
          expiresAt,
        };
        console.log(`[Supplier Auth - ${callId}] Token cached. Final Expires At: ${new Date(expiresAt).toISOString()}`);
        return data.data.accessToken;
      }

      const fallbackErrorMsg = `Supplier Authentication failed: ${data.message || 'Unknown API error response.'} (Code: ${data.code})`;
      console.error(`[Supplier Auth - ${callId}] Fallback error: ${fallbackErrorMsg}`, data);
      if (globalCache.tokenCache?.token !== RATE_LIMIT_TOKEN_PLACEHOLDER) {
          globalCache.tokenCache = null;
      }
      throw new Error(fallbackErrorMsg);
    } catch (error: any) {
      console.error(`[Supplier Auth - ${callId}] Error during token acquisition attempt:`, error.message);
      throw error;
    } finally {
      getGlobalCache().isFetchingToken = false;
    }
  })();

  return globalCache.currentTokenPromise;
}
