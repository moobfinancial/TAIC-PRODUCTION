// Script to verify if a password matches a stored hash
const bcrypt = require('bcryptjs');

async function verifyPassword(password, storedHash) {
  try {
    const isMatch = await bcrypt.compare(password, storedHash);
    console.log(`Password match result: ${isMatch ? 'MATCH' : 'NO MATCH'}`);
    return isMatch;
  } catch (error) {
    console.error('Error comparing password:', error);
    return false;
  }
}

// The password and hash to verify
const password = 'supersecretadminkey';
const storedHash = '$2b$10$Ift38jT1ohWqRrOZw1uVWutCLZKRkvUx3q6N85WeyUXgryEQPgABe';

verifyPassword(password, storedHash);
