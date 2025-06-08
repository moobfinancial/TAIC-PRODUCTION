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

  const { searchParams } = new URL(request.url);
  const imageType = searchParams.get('imageType') || null; // Get imageType from query params, default to null if not provided

  let client;
  try {
    client = await pool.connect();

    const imagesQuery = `
      SELECT
        id,
        image_url AS "imageUrl",
        image_type AS "imageType",
        description,
        created_at AS "createdAt"
      FROM user_gallery_images
      WHERE user_id = $1
        AND ($2::VARCHAR IS NULL OR image_type = $2)
      ORDER BY created_at DESC;
    `;
    // Parameters: userId, imageType (or null if no filter)
    const result = await client.query(imagesQuery, [userId, imageType]);
    
    const images = result.rows.map(img => ({
      ...img,
      createdAt: new Date(img.createdAt).toISOString(), // Ensure ISO format
    }));

    return NextResponse.json(images); // Return array directly as per common practice

  } catch (error) {
    console.error('Error fetching user gallery images:', error);
    return NextResponse.json({ error: 'Failed to fetch user gallery images' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
