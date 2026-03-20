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

if (!admin.apps.length) {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!serviceAccountPath) {
        throw new Error(
            'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.'
        );
    }

    const resolvedPath = path.resolve(serviceAccountPath);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(resolvedPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),

        // 🔥 IMPORTANT
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
}

const db = admin.firestore();

// ✅ rename here
const bucket = admin.storage().bucket();

const auth = admin.auth();

db.settings({ ignoreUndefinedProperties: true });

export { db, bucket, auth, admin };