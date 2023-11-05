import React, { useEffect, useState } from 'react';
import {
  auth,
  onAuthStateChanged,
} from '../firebase/firebase';

const Profile = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <div>
      {user ? (
        <div>
          <h2>Welcome, {user.email}!</h2>
          <button className="SignOut" onClick={() => auth.signOut()}>Sign Out</button>
        </div>
      ) : (
        <h1>Please log in.</h1>
      )}
    </div>
  );
};

export default Profile;