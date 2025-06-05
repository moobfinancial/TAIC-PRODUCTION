import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebaseAdmin'; // Assuming firebaseAdmin.ts exports initialized admin.storage()
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null; // Optional: associate with user

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

    // Determine upload path
    // For now, using a generic path. Ideally, include userId if available and verified.
    const filePath = `user_uploads/${userId || 'anonymous'}/${uniqueFilename}`;

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

    return NextResponse.json({
      message: 'File uploaded successfully.',
      imageUrl: publicUrl,
      filePath: filePath // For reference
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error uploading image:', error);
    // Check for specific Firebase errors if needed
    if (error.code === 'storage/unauthorized') {
        return NextResponse.json({ error: 'Permission denied. Check Firebase Storage rules.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error uploading file.', details: error.message }, { status: 500 });
  }
}
