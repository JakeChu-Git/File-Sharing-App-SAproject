# SafeShare

SafeShare is a secure file sharing web application developed for COMP6841. It allows users to securely upload and share files with other registered users of the app, ensuring data confidentiality, integrity, and availability.

## Features

- User registration and authentication using email and password
- Secure file upload and download
- File encryption using AES-256 before storage in the Firestore database
- Key Management System (KMS) using AWS for secure key storage and rotation
- Galois/Counter Mode (GCM) for AES to ensure data integrity
- Rate and payload size limiting to protect against Denial of Service (DoS) attacks
- HTTPS connection to protect data in transit

## Tech Stack

- Backend: NodeJS, ExpressJS, Firebase (Authentication and Cloud Storage), AWS KMS
- Frontend: React, CSS

## Getting Started

To run the SafeShare app locally, you'll need a Firebase account, an AWS account, and a locally-trusted development certificate (e.g., mkcert).

1. Clone the repository
2. Install the required dependencies using `npm install`
3. Set up your Firebase and AWS credentials
4. Generate a locally-trusted development certificate
5. In the project directory, run:
   - `npm run start:https`: Runs the app in development mode. Open `https://localhost:3000` to view it in your browser.
   - `npm start`: In `./server`, runs the server on port 3001.

## Security Considerations

SafeShare was developed with a security-first mindset, prioritizing security features and potential vulnerabilities. The following measures were taken to ensure the confidentiality, integrity, and availability of user data:

- AES-256 encryption of file data before storage
- AWS KMS for secure key storage and rotation
- Galois/Counter Mode (GCM) for AES to provide data integrity checks
- Rate and payload size limiting to protect against DoS attacks
- Firebase tokens for enforcing authenticated access at each endpoint
- HTTPS connection to protect data in transit
