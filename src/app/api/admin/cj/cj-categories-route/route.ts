import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Intentionally throw an error
  throw new Error("FORCED SERVER ERROR IN CJ CATEGORIES ROUTE");

  // Unreachable code, just to keep structure similar
  const adminApiKey = request.headers.get('X-Admin-API-Key');
  if (adminApiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized: Invalid Admin API Key from minimal route' }, { status: 401 });
  }
  return NextResponse.json({ message: 'CJ Categories API Endpoint - Minimal Test OK' });
}
}