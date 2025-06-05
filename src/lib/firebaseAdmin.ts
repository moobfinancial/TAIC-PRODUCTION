import * as admin from 'firebase-admin';

const initializeFirebaseAdmin = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const base64SdkConfig = process.env.FIREBASE_ADMIN_SDK_CONFIG_BASE64;
  const storageBucketUrl = process.env.FIREBASE_STORAGE_BUCKET_URL; // e.g., 'your-project-id.appspot.com'

  if (!base64SdkConfig) {
    throw new Error('FIREBASE_ADMIN_SDK_CONFIG_BASE64 environment variable is not set.');
  }
  if (!storageBucketUrl) {
    // While storageBucket is often derived or part of SDK config, explicitly requiring it here for clarity
    // if we intend to use it directly for constructing public URLs, etc.
    // Or, it can be fetched from admin.app().options.storageBucket if initialized with a service account that has it.
    console.warn('FIREBASE_STORAGE_BUCKET_URL environment variable is not set. Storage operations might need it explicitly.');
  }

  try {
    const sdkConfigJson = Buffer.from(base64SdkConfig, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(sdkConfigJson);

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucketUrl || undefined, // Initialize with storageBucket if provided
    });
  } catch (error: any) {
    console.error('Failed to parse FIREBASE_ADMIN_SDK_CONFIG_BASE64 or initialize Firebase Admin:', error.message);
    throw new Error('Firebase Admin SDK initialization failed: ' + error.message);
  }
};

// Initialize and export the admin app instance
const firebaseAdminApp = initializeFirebaseAdmin();
const adminAuth = admin.auth; // Export auth service
const adminStorage = admin.storage; // Export storage service
const adminDb = admin.firestore; // Export firestore service (though not used in this subtask)


export { firebaseAdminApp, adminAuth, adminStorage, adminDb };

// Example usage for storage:
// import { adminStorage } from '@/lib/firebaseAdmin';
// const bucket = adminStorage().bucket();
// await bucket.upload(...);
// const file = bucket.file('path/to/your/file.jpg');
// const [publicUrl] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' }); // For public URL (long expiry)
// Or simply: file.publicUrl() if object is public
// Or construct public URL: `https://storage.googleapis.com/${bucket.name}/${filePath}` if ACLs allow
