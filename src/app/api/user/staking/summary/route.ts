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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    return decoded;
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

    const summaryQuery = `
      SELECT COALESCE(SUM(amount_staked), 0) AS "totalStaked"
      FROM user_stakes
      WHERE user_id = $1 AND status = 'active';
    `;
    const result = await client.query(summaryQuery, [userId]);

    const totalStaked = parseFloat(result.rows[0].totalStaked);

    return NextResponse.json({ totalStaked });

  } catch (error) {
    console.error('Error fetching staking summary:', error);
    return NextResponse.json({ error: 'Failed to fetch staking summary' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
