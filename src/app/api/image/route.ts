import { NextResponse } from 'next/server';
import { storage } from '@/lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imagePath = searchParams.get('path');

  if (!imagePath) {
    return NextResponse.json(
      { error: 'Image path is required' },
      { status: 400 }
    );
  }

  try {
    // Create a reference to the file
    const imageRef = ref(storage, imagePath);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(imageRef);
    
    // Fetch the image data
    const response = await fetch(downloadURL);
    
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }
    
    // Get the image data as a buffer
    const buffer = await response.arrayBuffer();
    
    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Return the image data with the correct content type
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
