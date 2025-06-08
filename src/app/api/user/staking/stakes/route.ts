import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

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

export async function GET(request: NextRequest) {
  const userPayload = await verifyAuth(request);
  if (!userPayload || !userPayload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = userPayload.userId;

  let client;
  try {
    client = await pool.connect();

    const stakesQuery = `
      SELECT
        id,
        user_id AS "userId",
        amount_staked AS "amountStaked",
        stake_date AS "stakeDate",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM user_stakes
      WHERE user_id = $1 AND status = 'active'
      ORDER BY stake_date DESC;
    `;
    const result = await client.query(stakesQuery, [userId]);

    const activeStakes = result.rows.map(stake => ({
      ...stake,
      stakeDate: new Date(stake.stakeDate).toISOString(),
      createdAt: new Date(stake.createdAt).toISOString(),
      updatedAt: new Date(stake.updatedAt).toISOString(),
      amountStaked: parseFloat(stake.amountStaked) // Ensure numeric type
    }));

    return NextResponse.json(activeStakes);

  } catch (error) {
    console.error('Error fetching active stakes:', error);
    return NextResponse.json({ error: 'Failed to fetch active stakes' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
