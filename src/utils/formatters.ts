/**
 * Utility functions for formatting data
 */

/**
 * Shortens a wallet address for display purposes
 * @param address The wallet address to shorten
 * @param prefixChars Number of characters to show at the beginning (not including '0x')
 * @param suffixChars Number of characters to show at the end
 * @returns Shortened address string (e.g., "0x1234...abcd")
 */
export function shortenAddress(address?: string, prefixChars = 4, suffixChars = 4): string {
  if (!address) return "";
  if (address.length <= prefixChars + suffixChars + 2) return address;
  
  const prefix = address.substring(0, prefixChars + 2); // 0x + chars
  const suffix = address.substring(address.length - suffixChars);
  return `${prefix}...${suffix}`;
}

/**
 * Returns a display name for a user based on available properties
 * @param user User object with optional displayName, username, email, walletAddress
 * @returns A user-friendly display name
 */
export function getUserDisplayName(user: {
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  walletAddress?: string | null;
}): string {
  if (!user) return 'User';
  
  // Check if displayName is a wallet address (0x followed by 40 hex chars)
  const isWalletAddress = (str?: string | null) => {
    return str && /^0x[a-fA-F0-9]{40}$/.test(str);
  };
  
  if (user.displayName && user.displayName.trim() !== '') {
    // If displayName is a wallet address, truncate it
    if (isWalletAddress(user.displayName)) {
      return shortenAddress(user.displayName);
    }
    return user.displayName;
  } else if (user.username && user.username.trim() !== '') {
    // If username is a wallet address, truncate it
    if (isWalletAddress(user.username)) {
      return shortenAddress(user.username);
    }
    return user.username;
  } else if (user.email && user.email.trim() !== '') {
    return user.email;
  } else if (user.walletAddress) {
    return shortenAddress(user.walletAddress);
  }
  
  return 'User';
}
