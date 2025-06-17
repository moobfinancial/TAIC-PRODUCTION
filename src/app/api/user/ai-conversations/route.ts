import { NextRequest, NextResponse } from 'next/server';
// import { Pool } from 'pg'; // Replaced with shared pool
import jwt from 'jsonwebtoken'; // For JWT verification
import { z } from 'zod'; // For POST request validation

import { pool } from '@/lib/db'; // Use the shared pool

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-jwt-secret'; // Ensure this is in .env

interface UserPayload {
  userId: number;
  // other fields from JWT if present
}

// Helper to verify JWT - in a real app, this would be a shared utility/middleware
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

    const conversationsQuery = `
      SELECT
        id,
        type,
        query,
        response,
        image_url_context AS "imageUrlContext",
        created_at AS "timestamp"
      FROM ai_conversations
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const result = await client.query(conversationsQuery, [userId]);

    // Ensure timestamp is in ISO format if not already
    const conversations = result.rows.map(convo => ({
      ...convo,
      timestamp: new Date(convo.timestamp).toISOString(),
    }));

    return NextResponse.json(conversations);

  } catch (error) {
    console.error('Error fetching AI conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch AI conversations' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Zod schema for POST request (Create AI Conversation)
const CreateConversationInputSchema = z.object({
  type: z.enum(['shopping_assistant', 'product_idea_generator']),
  query: z.string().min(1, "Query cannot be empty."),
  response: z.string().optional(), // Response can be optional initially or if error occurs
  imageUrlContext: z.string().url().optional().nullable(),
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
    validatedData = CreateConversationInputSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { type, query, response, imageUrlContext } = validatedData;

  let client;
  try {
    client = await pool.connect();

    const insertQuery = `
      INSERT INTO ai_conversations
        (user_id, type, query, response, image_url_context)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, type, query, response, image_url_context AS "imageUrlContext", created_at AS "timestamp";
    `;

    const result = await client.query(insertQuery, [
      userId,
      type,
      query,
      response || null, // Ensure response is null if undefined
      imageUrlContext || null, // Ensure imageUrlContext is null if undefined
    ]);

    const newConversation = result.rows[0];
    // Ensure timestamp is in ISO format
    newConversation.timestamp = new Date(newConversation.timestamp).toISOString();

    return NextResponse.json(newConversation, { status: 201 });

  } catch (error: any) {
    console.error('Error creating AI conversation:', error);
    // Check for specific DB errors if needed, e.g., foreign key violation if user_id is somehow invalid
    return NextResponse.json({ error: 'Failed to create AI conversation', details: error.message }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
