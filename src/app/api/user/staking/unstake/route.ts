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

const UnstakeInputSchema = z.object({
  stakeId: z.number().int().positive("Stake ID must be a positive integer."),
});

export async function POST(request: NextRequest) {
  const userPayload = await verifyAuth(request);
  if (!userPayload || !userPayload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const currentUserId = userPayload.userId;

  let validatedData;
  try {
    const body = await request.json();
    validatedData = UnstakeInputSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { stakeId } = validatedData;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const stakeResult = await client.query(
      `SELECT user_id, amount_staked
       FROM user_stakes
       WHERE id = $1 AND status = 'active' FOR UPDATE;`,
      [stakeId]
    );

    if (stakeResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Active stake not found or already unstaked.' }, { status: 404 });
    }

    const stake = stakeResult.rows[0];
    if (stake.user_id !== currentUserId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Forbidden: Stake does not belong to this user.' }, { status: 403 });
    }

    const amountToUnstake = parseFloat(stake.amount_staked);

    await client.query(
      `UPDATE user_stakes
       SET status = 'unstaked', unstake_date = NOW(), updated_at = NOW()
       WHERE id = $1;`,
      [stakeId]
    );

    const newBalanceResult = await client.query(
      'UPDATE users SET taic_balance = taic_balance + $1 WHERE id = $2 RETURNING taic_balance;',
      [amountToUnstake, currentUserId]
    );
    const newBalance = parseFloat(newBalanceResult.rows[0].taic_balance);

    await client.query('COMMIT');

    // Fetch total staked amount for the response
    const totalStakedResult = await client.query(
        `SELECT COALESCE(SUM(amount_staked), 0) AS "totalStaked"
         FROM user_stakes
         WHERE user_id = $1 AND status = 'active';`,
        [currentUserId]
    );
    const totalStaked = parseFloat(totalStakedResult.rows[0].totalStaked);

    return NextResponse.json({
      message: 'Unstake successful',
      unstakedAmount: amountToUnstake,
      newBalance: newBalance, // Current TAIC balance after unstaking
      totalStaked: totalStaked // Total amount actively staked by user
    }, { status: 200 });

  } catch (error: any) {
    await client.query('ROLLBACK').catch(rbError => console.error('Rollback error:', rbError));
    console.error('Error unstaking TAIC:', error);
    return NextResponse.json({ error: 'Failed to unstake TAIC', details: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
