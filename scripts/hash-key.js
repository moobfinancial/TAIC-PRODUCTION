// Simple script to hash an API key using the same sha256 function
const crypto = require('crypto');

// The API key to hash (from .env.local)
const apiKey = 'supersecretadminkey';

// SHA256 hash function (similar to src/lib/cryptoUtils.ts)
// Node.js doesn't have crypto.subtle by default, so we'll use the built-in crypto module
function nodeSha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Print the hashed key
console.log(`API Key: ${apiKey}`);
console.log(`SHA256 Hash (Node.js): ${nodeSha256(apiKey)}`);
