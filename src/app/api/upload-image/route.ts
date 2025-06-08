import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebaseAdmin';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken'; // For JWT verification
import { Pool } from 'pg'; // For database interaction

// Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-jwt-secret';

interface UserPayload {
  userId: number;
}

// JWT Verification Helper
async function verifyAuth(request: NextRequest): Promise<UserPayload | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    console.error('JWT verification error in upload-image:', error);
    return null;
  }
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  const userPayload = await verifyAuth(request);
  if (!userPayload || !userPayload.userId) {
    return NextResponse.json({ error: 'Unauthorized. Valid token is required.' }, { status: 401 });
  }
  const authenticatedUserId = userPayload.userId;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    // Optional fields from form data
    const imageType = formData.get('imageType') as string | null;
    const description = formData.get('description') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}` }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large. Max size is ${MAX_FILE_SIZE / (1024*1024)}MB.` }, { status: 400 });
    }

    const fileExtension = file.name.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;

    // Determine upload path, now using authenticatedUserId
    const filePath = `user_uploads/${authenticatedUserId}/${uniqueFilename}`;

    const bucket = adminStorage().bucket(); // Get default bucket
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const gcsFile = bucket.file(filePath);

    await gcsFile.save(fileBuffer, {
      metadata: {
        contentType: file.type,
        // cacheControl: 'public, max-age=31536000', // Optional: set cache control
      },
      public: true, // Make the file publicly readable
    });

    // Option 1: Construct public URL (requires bucket to be public or file to have public ACL)
    // This is the standard GCS public URL format.
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // Option 2: Get a signed URL (useful if files are not public by default)
    // const [signedUrl] = await gcsFile.getSignedUrl({
    //   action: 'read',
    //   expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    // });
    // For simplicity with public: true, we use the direct public URL.

    // After successful upload, insert record into user_gallery_images
    let client;
    try {
      client = await pool.connect();
      const insertQuery = `
        INSERT INTO user_gallery_images (user_id, image_url, image_type, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id, image_url AS "imageUrl", image_type AS "imageType", description, created_at AS "createdAt";
      `;
      const result = await client.query(insertQuery, [
        authenticatedUserId,
        publicUrl,
        imageType || 'general_upload',
        description || null,
      ]);
      const newGalleryImageRecord = result.rows[0];

      return NextResponse.json({
        message: 'File uploaded and gallery record created successfully.',
        imageUrl: publicUrl,
        filePath: filePath, // For reference
        galleryImageId: newGalleryImageRecord.id,
        galleryImageRecord: newGalleryImageRecord
      }, { status: 200 });

    } catch (dbError: any) {
      console.error('Error inserting gallery image record:', dbError);
      // If DB insert fails, ideally we might want to delete the uploaded file from GCS to prevent orphans.
      // This part is complex and depends on retry strategy. For now, just return an error.
      return NextResponse.json({ error: 'File uploaded but failed to save gallery record.', details: dbError.message, uploadedImageUrl: publicUrl }, { status: 500 });
    } finally {
      if (client) client.release();
    }

  } catch (error: any) {
    console.error('Error uploading image (outer try-catch):', error);
    // Check for specific Firebase errors if needed
    if (error.code === 'storage/unauthorized') {
        return NextResponse.json({ error: 'Permission denied. Check Firebase Storage rules.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error uploading file.', details: error.message }, { status: 500 });
  }
}
