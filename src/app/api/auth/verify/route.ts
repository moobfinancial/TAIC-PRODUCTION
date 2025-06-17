import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';

interface VerifyRequest {
  walletAddress: string;
  signature: string;
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, signature }: VerifyRequest = await req.json();

    if (!walletAddress || !signature) {
      return NextResponse.json({ message: 'Wallet address and signature are required' }, { status: 400 });
    }

    // Find the user by their wallet address
    const userResult = await pool.query(
      'SELECT id, wallet_address, auth_nonce, username, email, role, taic_balance FROM users WHERE wallet_address = $1',
      [walletAddress.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];
    const storedNonce = user.auth_nonce;

    if (!storedNonce) {
      return NextResponse.json({ message: 'No nonce found for user. Please request a challenge first.' }, { status: 403 });
    }

    // 2. Construct the expected signed message
    const message = `Logging in to TAIC: ${storedNonce}`;

    // 3. Use ethers.verifyMessage(message, signature) to get the signer's address
    let recoveredAddress: string | null = null;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (error) {
      console.error('Error verifying signature:', error);
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    // 4. If recovered address matches walletAddress
    if (recoveredAddress && recoveredAddress.toLowerCase() === walletAddress.toLowerCase()) {
      // 5. Clear/update auth_nonce in the database
      await pool.query('UPDATE users SET auth_nonce = NULL WHERE id = $1', [user.id]);

      // 6. Generate a JWT
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('JWT_SECRET is not defined');
        return NextResponse.json({ message: 'Internal server error: JWT configuration missing' }, { status: 500 });
      }

      const token = jwt.sign(
        {
          userId: user.id,
          walletAddress: user.wallet_address,
          role: user.role,
        },
        jwtSecret,
        { expiresIn: '7d' } // Token expires in 7 days
      );

      // 7. Return token and user details
      return NextResponse.json({
        token,
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          username: user.username,
          email: user.email,
          role: user.role,
          taicBalance: user.taic_balance,
        },
      });
    } else {
      // Signature does not match
      return NextResponse.json({ message: 'Signature verification failed' }, { status: 401 });
    }
  } catch (error) {
    console.error('Verify error:', error);
    // Check if error is an object and has a message property
    const message = (error instanceof Error && error.message) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
