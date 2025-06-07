export const firebaseLoader = ({ src, width, quality }: { src: string; width: number; quality?: number }) => {
  // If the image is from Firebase Storage, use our API route
  if (src.includes('firebasestorage.googleapis.com') || 
      src.includes('storage.cloud.google.com') || 
      src.includes('taic-3c401.firebasestorage.app')) {
    
    // Extract the path from the URL
    const url = new URL(src);
    const path = url.pathname.split('/o/')[1];
    
    if (!path) return src; // Fallback to direct URL if we can't extract path
    
    // Use our API route to serve the image
    return `/api/image?path=${encodeURIComponent(path)}&w=${width}&q=${quality || 75}`;
  }
  
  // For other images, use the default Next.js loader
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`;
};
