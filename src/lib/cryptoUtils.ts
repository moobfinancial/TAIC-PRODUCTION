// Using a more compatible approach for SHA-256 hashing
import { createHash } from 'crypto';

export async function sha256(input: string): Promise<string> {
  // Use Node.js crypto module for hashing
  return createHash('sha256').update(input).digest('hex');
}

// Fallback for Edge Runtime (though not recommended for production with Node.js crypto)
export async function sha256Edge(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    // Browser or Edge Runtime with Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback to Node.js crypto if available
  if (typeof require !== 'undefined') {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(input).digest('hex');
  }
  
  throw new Error('No compatible crypto implementation found');
}
