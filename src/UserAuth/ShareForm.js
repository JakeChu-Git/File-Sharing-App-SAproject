import React, { useState } from 'react';

const ShareForm = ({ onShare }) => {
    const [email, setEmail] = useState("");
    const [fileName, setFileName] = useState("");

    const handleSubmit = (event) => {
      event.preventDefault();
      onShare(email, fileName);
    };

    return (
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email to share"
          required
        />
        <input
          type="text"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="Enter file name to share"
          required
        />
        <button type="submit">Share</button>
      </form>
    );
}

export default ShareForm;