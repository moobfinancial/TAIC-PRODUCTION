import { NextRequest, NextResponse } from 'next/server';
import { withMerchantAuth } from '@/lib/merchantAuth';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';

// Define the upload handler
async function uploadHandler(req: NextRequest, user: any) {
  try {
    // Parse the form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Get file extension and create a unique filename
    const fileExtension = path.extname(file.name);
    const fileName = `${uuidv4()}${fileExtension}`;
    
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
    await mkdir(uploadDir, { recursive: true });
    
    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Write the file to the uploads directory
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);
    
    // Return the URL to the uploaded file
    const fileUrl = `/uploads/products/${fileName}`;
    
    return NextResponse.json({ 
      success: true, 
      url: fileUrl,
      fileName: fileName
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// Export the POST handler with merchant authentication
export const POST = withMerchantAuth(uploadHandler);
