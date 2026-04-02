// import * as admin from 'firebase-admin';
// import * as path from 'path';
// import * as dotenv from 'dotenv';

// dotenv.config();

// // Initialize Firebase Admin SDK
// if (!admin.apps.length) {
//     const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

//     if (!serviceAccountPath) {
//         throw new Error(
//             'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. ' +
//             'Please set it to the path of your Firebase service account JSON file.'
//         );
//     }

//     const resolvedPath = path.resolve(serviceAccountPath);

//     // eslint-disable-next-line @typescript-eslint/no-var-requires
//     const serviceAccount = require(resolvedPath);

//     admin.initializeApp({
//         credential: admin.credential.cert(serviceAccount),
//         storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
//     });
// }

// const db = admin.firestore();
// const storage = admin.storage().bucket();
// const auth = admin.auth();

// // Configure Firestore settings
// db.settings({ ignoreUndefinedProperties: true });

// export { db, storage, auth, admin };


import * as admin from 'firebase-admin';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

function serviceAccountFromEnv() {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64;
    if (b64) {
        const raw = Buffer.from(b64, 'base64').toString('utf8');
        return JSON.parse(raw);
    }

    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawJson) {
        const parsed = JSON.parse(rawJson);
        // Render/env sometimes turns newline chars into literal "\n"
        if (parsed?.private_key && typeof parsed.private_key === 'string') {
            parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        return parsed;
    }

    return null;
}

if (!admin.apps.length) {
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    if (!storageBucket) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable is not set.');
    }

    const fromEnv = serviceAccountFromEnv();
    let serviceAccount: any;

    if (fromEnv) {
        serviceAccount = fromEnv;
    } else {
        const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (!serviceAccountPath) {
            throw new Error(
                'Firebase service account not provided. Set either FIREBASE_SERVICE_ACCOUNT_JSON_B64, FIREBASE_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS.'
            );
        }

        const resolvedPath = path.resolve(serviceAccountPath);

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        serviceAccount = require(resolvedPath);
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),

        // 🔥 IMPORTANT
        storageBucket,
    });
}

const db = admin.firestore();

// ✅ rename here
const bucket = admin.storage().bucket();

const auth = admin.auth();

db.settings({ ignoreUndefinedProperties: true });

export { db, bucket, auth, admin };