import bcrypt from 'bcryptjs';

/**
 * Hash a password using bcrypt
 * @param password The plain text password to hash
 * @returns The hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare a plain text password with a hashed password
 * @param password The plain text password to check
 * @param hashedPassword The hashed password to compare against
 * @returns True if the password matches, false otherwise
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
