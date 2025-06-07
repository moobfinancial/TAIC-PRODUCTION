import React from 'react';
import Image, { ImageProps } from 'next/image';
import { firebaseLoader } from '@/lib/imageLoader';

interface FirebaseImageProps extends Omit<ImageProps, 'loader'> {
  priority?: boolean;
  unoptimized?: boolean;
}

const FirebaseImage: React.FC<FirebaseImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  unoptimized = false,
  ...props
}) => {
  // If the image is from Firebase Storage, use our custom loader
  const isFirebaseImage = 
    typeof src === 'string' && 
    (src.includes('firebasestorage.googleapis.com') || 
     src.includes('storage.cloud.google.com') ||
     src.includes('taic-3c401.firebasestorage.app'));

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loader={isFirebaseImage ? firebaseLoader : undefined}
      unoptimized={unoptimized || isFirebaseImage}
      priority={priority}
    />
  );
};

export default FirebaseImage;
