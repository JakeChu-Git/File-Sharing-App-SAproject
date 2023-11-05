import React, { useState, useEffect } from 'react';
import { auth } from './firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import SignUp from './UserAuth/SignUp';
import Login from './UserAuth/Login';
import Profile from './UserAuth/Profile';
import ShareForm from './UserAuth/ShareForm';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [file, setFile] = useState(null);
  const [symmetricKey, setSymmetricKey] = useState(null);
  const [iv, setIv] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (user) {
      fetchFileList();
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setFileList([]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchFileList = async () => {
    const user = auth.currentUser;
    const idToken = await user.getIdToken();

    // Fetch the list of files from the server
    const response = await fetch('https://localhost:3001/files', {
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });

    const data = await response.json();
    if (response.status === 200) {
    } else {
      console.error('Failed to fetch file list:', data);
    }

    // Fetch files shared with the current user
    const sharedFilesResponse = await fetch('https://localhost:3001/sharedWithMe', {
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });

    const sharedFilesData = await sharedFilesResponse.json();
    if (sharedFilesResponse.status === 200) {
      setFileList([...data.files, ...sharedFilesData.files]);
    } else {
      setNotification({ type: 'error', message: `Failed to fetch files: ${data.error || data.message}` });
    }
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleFileUpload = async () => {
    if (file) {
      const base64 = await toBase64(file);

      const user = auth.currentUser;
      const idToken = await user.getIdToken();

      // Send base64 string to the server
      const response = await fetch('https://localhost:3001/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ file: base64, fileName: file.name }),
      });

      const data = await response.json();
      if (response.status === 200) {
        setNotification({ type: 'success', message: 'File uploaded successfully' });
      } else {
        setNotification({ type: 'error', message: `Failed to upload file: ${data.error || data.message}` });
      }

      setSymmetricKey(data.symmetricKey);
      setIv(data.iv);
    }
  };

  const handleFileDownload = async (fileName, fileType) => {
    const user = auth.currentUser;
    const idToken = await user.getIdToken();

    // Send file name, symmetric key, and iv to the server for decryption
    const response = await fetch('https://localhost:3001/decrypt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        filePath: fileName,
        symmetricKey,
        iv,
      }),
    });

    const data = await response.json();

    // Convert array back to buffer
    const fileBuffer = new Uint8Array(data.file);

    const blob = new Blob([fileBuffer], { type: fileType });

    // Create a link element for downloading
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
  };

  const handleShare = async (email, fileName) => {
    const user = auth.currentUser;
    const idToken = await user.getIdToken();

    // Send email and file name to the server to share with another user
    const response = await fetch('https://localhost:3001/share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ email, fileName }),
    });

    const data = await response.json();
    if (response.status === 200) {
      setNotification({ type: 'success', message: 'File shared successfully' });
    } else {
      setNotification({ type: 'error', message: `Failed to share file: ${data.error || data.message}` });
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  // Clear notification after 3 seconds
  useEffect(() => {
    const timer = notification && setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [notification]);

return (
  <div className='App'>
      {notification && (
        <div className={`Notification ${notification.type}`}>
          {notification.message}
          <button className="close" onClick={() => setNotification(null)}>X</button>
        </div>
      )}
    <h1>SafeShare</h1>
    {user ? (
      <>
        <div>
          <Profile />
        </div>
        <div className="UploadSection">
          <input className="FileInput" type="file" onChange={handleFileChange} />
          <button className="UploadButton" onClick={handleFileUpload}>Upload</button>
        </div>
        <ShareForm className="ShareForm" onShare={handleShare} />
        <b className="FileListTitle">File List:</b>
        <div className="FileList">
          {fileList.length > 0 ? (
            fileList.map((file) => (
              <div className="FileItem" key={file.fileName}>
                {file.fileName}
                <button className="DownloadButton" onClick={() => handleFileDownload(file.fileName, file.fileType)}>
                  Download
                </button>
              </div>
            ))
          ) : (
            <p className="NoFiles">No Files Stored...</p>
          )}
        </div>
      </>
    ) : (
      <>
        <Login/>
        <SignUp/>
        <p>This is a secure file sharing app I made for my Something Awesome Project.</p>
      </>
    )}
  </div>
);
}

export default App;