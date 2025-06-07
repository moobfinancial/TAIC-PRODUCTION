const { initializeApp } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": "taic-3c401",
  "private_key_id": "078d71883b42240731d62bb5906db9d0e35eade6e",
  "private_key": process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  "client_email": "firebase-adminsdk-fbsvc@taic-3c401.iam.gserviceaccount.com",
  "client_id": "116368878030790950971",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40taic-3c401.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

const app = initializeApp({
  credential: require('firebase-admin').credential.cert(serviceAccount),
  storageBucket: 'taic-3c401.appspot.com'
});

const bucket = getStorage().bucket();

// Deploy the rules
async function deployRules() {
  try {
    // Set CORS configuration
    await bucket.setMetadata({
      cors: [{
        origin: ['*'],
        method: ['GET', 'HEAD', 'DELETE'],
        responseHeader: [
          'Content-Type',
          'Content-Length',
          'Content-Encoding',
          'Content-Disposition',
          'Cache-Control'
        ],
        maxAgeSeconds: 3600
      }]
    });
    
    console.log('Successfully set CORS configuration for bucket');
  } catch (error) {
    console.error('Error setting CORS configuration:', error);
    process.exit(1);
  }
}

deployRules();
