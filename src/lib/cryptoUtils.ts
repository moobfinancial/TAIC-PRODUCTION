// Using Web Crypto API which is supported in both Node.js and Edge Runtime
export async function sha256(input: string): Promise<string> {
  // Convert the input string to an ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  
  // Use the Web Crypto API to create a SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert the hash to a hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}
