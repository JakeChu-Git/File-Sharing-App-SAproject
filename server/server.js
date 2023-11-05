const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

const app = express();
app.use(cors());

app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({limit: '10mb', extended: true}));

const options = {
  key: fs.readFileSync('../localhost+2-key.pem'),
  cert: fs.readFileSync('../localhost+2.pem')
};

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({ // Max 100 requests per 15 minutes
  windowMs: 900000,
  max: 100
});
app.use(limiter);

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const AWS = require('aws-sdk');

// Set up AWS Key Management System
AWS.config.update({
  // config details
});

const kms = new AWS.KMS();

app.post('/upload', async (req, res) => {
  const idToken = req.get('Authorization').split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { file, fileName } = req.body;
    const base64Data = file.split(';base64,').pop();
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // Use AWS KMS to generate a key
    const params = {
      KeyId: 'alias/SA',
      KeySpec: 'AES_256'
    };

    kms.generateDataKey(params, async (err, data) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Error generating encryption key');
      }

      // Use the data key to encrypt the file
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', data.Plaintext, iv);
      let encryptedFile = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Store the file data and details in the database
      const fileRef = db.collection('files').doc();
      await fileRef.set({
        userId,
        fileName: fileName,
        fileData: encryptedFile.toString('base64'),
        encryptedSymmetricKey: data.CiphertextBlob.toString('base64'), //  Re-encrypt the data key before storing
        iv: iv.toString('hex'),
        authTag: authTag,
        sharedWith: [],
      });

      res.json({
        message: 'File uploaded and encrypted successfully!',
        fileName: fileName,
      });
    });

  } catch (error) {
    console.error(error);
    res.status(401).send('Unauthorized');
  }
});

app.post('/decrypt', async (req, res) => {
  const idToken = req.get('Authorization').split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { filePath } = req.body;

    const fileRef = db.collection('files')
      .where('fileName', '==', filePath)
      .where('userId', '==', userId)
      .get();

    const fileRefShared = db.collection('files')
      .where('fileName', '==', filePath)
      .where('sharedWith', 'array-contains', userId)
      .get();

    // Wait for both database queries to complete
    const [fileSnapshot, fileSharedSnapshot] = await Promise.all([fileRef, fileRefShared]);
    let fileDoc = null;

    if (!fileSnapshot.empty) {
      fileDoc = fileSnapshot.docs[0];
    } else if (!fileSharedSnapshot.empty) {
      fileDoc = fileSharedSnapshot.docs[0];
    } else {
      return res.status(403).send('Forbidden');
    }

    const fileData = fileDoc.data();
    const { fileData: encryptedFileBase64, encryptedSymmetricKey, iv, authTag: storedAuthTag } = fileData;

    const encryptedKeyBuffer = Buffer.from(encryptedSymmetricKey, 'base64');
    kms.decrypt({ CiphertextBlob: encryptedKeyBuffer }, (err, data) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Error decrypting encryption key');
      }

      // Decrypt the file using the decrypted data key
      const keyBuffer = data.Plaintext;
      const ivBuffer = Buffer.from(iv, 'hex');
      const authTagBuffer = Buffer.from(storedAuthTag, 'hex');
      const encryptedFile = Buffer.from(encryptedFileBase64, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      try {
        let decryptedFile = Buffer.concat([decipher.update(encryptedFile), decipher.final()]);
        res.json({
          message: 'File decrypted successfully!',
          file: [...decryptedFile],
        });
      } catch (decryptionError) {
        console.error(decryptionError);
        return res.status(500).send('Decryption failed, the file may have been tampered with.');
      }
    });
  } catch (error) {
    console.error(error);
    res.status(401).send('Unauthorized');
  }
});


app.post('/share', async (req, res) => {
  const idToken = req.get('Authorization').split('Bearer ')[1];
  try {
    const { email, fileName } = req.body;
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Find the user to share with by email
    const sharedWithUserRef = await admin.auth().getUserByEmail(email);
    const sharedWithUserId = sharedWithUserRef.uid;

    // Find the file and update the sharedWith array
    const fileRef = db.collection('files').where('fileName', '==', fileName).where('userId', '==', decodedToken.uid);
    const fileSnapshot = await fileRef.get();

    if (!fileSnapshot.empty) {
      const fileDoc = fileSnapshot.docs[0];
      const sharedWith = fileDoc.data().sharedWith || [];
      if (!sharedWith.includes(sharedWithUserId)) {
        await fileDoc.ref.update({
          sharedWith: [...sharedWith, sharedWithUserId]
        });
        res.json({ message: 'File shared successfully.' });
      } else {
        res.status(400).json({ message: 'File already shared with this user.' });
      }
    } else {
      res.status(404).send('File not found.');
    }
  } catch (error) {
    console.error(error);
    res.status(401).send('Unauthorized');
  }
});

app.get('/files', async (req, res) => {
  const idToken = req.get('Authorization').split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const filesRef = db.collection('files').where('userId', '==', userId);
    const filesSnapshot = await filesRef.get();

    const files = [];
    filesSnapshot.forEach(doc => {
      let fileData = doc.data();
      files.push({
        fileName: fileData.fileName,
        fileType: fileData.fileType
      });
    });

    res.json({ files });
  } catch (error) {
    console.error(error);
    res.status(401).send('Unauthorized');
  }
});

app.get('/sharedWithMe', async (req, res) => {
  const idToken = req.get('Authorization').split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Query for files where the sharedWith array contains the user ID
    const filesRef = db.collection('files').where('sharedWith', 'array-contains', userId);
    const filesSnapshot = await filesRef.get();

    const sharedFiles = [];
    filesSnapshot.forEach(doc => {
      const file = doc.data();
      sharedFiles.push({
        fileName: (file.fileName + " (shared)"),
        fileType: file.fileType,
      });
    });

    res.json({ files: sharedFiles });
  } catch (error) {
    console.error(error);
    res.status(401).send('Unauthorized');
  }
});

https.createServer(options, app).listen(3001, () => {
  console.log('HTTPS Server running on port 3001');
});