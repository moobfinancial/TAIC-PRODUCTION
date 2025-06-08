import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-jwt-secret';

interface UserPayload {
  userId: number;
}

async function verifyAuth(request: NextRequest): Promise<UserPayload | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

const StakeInputSchema = z.object({
  amount: z.number().positive("Amount must be a positive number."),
});

export async function POST(request: NextRequest) {
  const userPayload = await verifyAuth(request);
  if (!userPayload || !userPayload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = userPayload.userId;

  let validatedData;
  try {
    const body = await request.json();
    validatedData = StakeInputSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { amount } = validatedData;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query('SELECT taic_balance FROM users WHERE id = $1 FOR UPDATE;', [userId]);
    if (userResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const currentBalance = parseFloat(userResult.rows[0].taic_balance);

    if (currentBalance < amount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Insufficient TAIC balance' }, { status: 400 });
    }

    const newBalanceResult = await client.query(
      'UPDATE users SET taic_balance = taic_balance - $1 WHERE id = $2 RETURNING taic_balance;',
      [amount, userId]
    );
    const newBalance = parseFloat(newBalanceResult.rows[0].taic_balance);

    const stakeInsertResult = await client.query(
      `INSERT INTO user_stakes (user_id, amount_staked, status)
       VALUES ($1, $2, 'active')
       RETURNING id;`,
      [userId, amount]
    );
    const newStakeId = stakeInsertResult.rows[0].id;

    await client.query('COMMIT');

    // Fetch total staked amount for the response
    const totalStakedResult = await client.query(
        `SELECT COALESCE(SUM(amount_staked), 0) AS "totalStaked"
         FROM user_stakes
         WHERE user_id = $1 AND status = 'active';`,
        [userId]
    );
    const totalStaked = parseFloat(totalStakedResult.rows[0].totalStaked);

    return NextResponse.json({
      message: 'Stake successful',
      stakeId: newStakeId,
      newBalance: newBalance, // Current TAIC balance after staking
      totalStaked: totalStaked // Total amount actively staked by user
    }, { status: 201 });

  } catch (error: any) {
    await client.query('ROLLBACK').catch(rbError => console.error('Rollback error:', rbError));
    console.error('Error staking TAIC:', error);
    return NextResponse.json({ error: 'Failed to stake TAIC', details: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
