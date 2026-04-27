import React, { useState, useEffect } from 'react';
import { Client } from '@gradio/client';
import ApiConnection from './components/ApiConnection';
import AudioUploader from './components/AudioUploader';
import TranscriptDisplay from './components/TranscriptDisplay';
import ProcessingStatus from './components/ProcessingStatus';
import './App.css';

function App() {
  const [apiUrl, setApiUrl] = useState('');
  const [client, setClient] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState({ raw: '', clean: '' });
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  // Handle connection
  const handleConnect = async (url) => {
    setIsProcessing(true);
    setError('');
    setStatusMessage('');
    try {
      // Connect to the Gradio API
      const app = await Client.connect(url);
      setClient(app);
      setApiUrl(url);
    } catch (err) {
      console.error("Connection failed:", err);
      setError("Failed to connect to the provided URL. Ensure it is a valid active Gradio space.");
      setClient(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file upload and API processing
  const handleUpload = async (file) => {
    if (!client) {
      setError("Please connect to the Gradio API first.");
      return;
    }

    setIsProcessing(true);
    setError('');
    setResults({ raw: '', clean: '' });
    setStatusMessage('Status: Preparing upload...');

    try {
      // 1. Upload the file manually to get progress
      const rootUrl = client.config?.root || '';
      const apiPrefix = client.api_prefix || '';
      const uploadUrl = `${rootUrl}${apiPrefix}/upload`;

      const uploadedFileArray = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadUrl, true);
        
        // Add authorization if token exists
        if (client.options?.token) {
          xhr.setRequestHeader("Authorization", `Bearer ${client.options.token}`);
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setStatusMessage(`Status: Uploading audio... ${percent}%`);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const res = JSON.parse(xhr.responseText);
              resolve(res);
            } catch (err) {
              reject(new Error("Invalid upload response format"));
            }
          } else {
            reject(new Error(`Upload failed with HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Upload network error"));

        const formData = new FormData();
        formData.append("files", file);
        xhr.send(formData);
      });

      if (!uploadedFileArray || !uploadedFileArray.length) {
        throw new Error("No file returned from server upload.");
      }

      setStatusMessage('Status: Upload complete. Initializing AI...');

      // 2. Pass the uploaded file reference to Gradio
      // By using an object with the meta type, Gradio skips re-uploading
      const fileData = {
        path: uploadedFileArray[0],
        orig_name: file.name,
        size: file.size,
        meta: { _type: "gradio.FileData" }
      };

      const submission = client.submit("process_audio", [fileData]);

      for await (const msg of submission) {
        if (msg.type === "data") {
          if (msg.data && msg.data.length >= 3) {
            setResults({
              raw: msg.data[0],
              clean: msg.data[1]
            });
            setStatusMessage(msg.data[2]);
          }
        } else if (msg.type === "status") {
          if (msg.stage === "complete") {
            setIsProcessing(false);
          } else if (msg.stage === "error") {
            console.error("Gradio API error:", msg);
            setError(`Error processing audio: ${msg.message || "Unknown API error"}`);
            setIsProcessing(false);
          }
        }
      }

    } catch (err) {
      console.error("Processing failed:", err);
      setError(`Error starting processing: ${err.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      {/* Hero Section */}
      <header className="hero-section">
        <div className="container animate-fade-in">
          <h1 className="hero-title text-gradient">PH Stutter Smoother</h1>
          <p className="hero-subtitle">
            AI-powered transcription that cleans stutters, false starts, and filler words from Tagalog, Bisaya, and English speech.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container main-content">
        {error && (
          <div className="glass-panel animate-fade-in" style={{ padding: '16px', borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.1)' }}>
            <p style={{ color: 'var(--text-primary)', margin: 0 }}>{error}</p>
          </div>
        )}

        <ApiConnection 
          onConnect={handleConnect} 
          isConnected={!!client} 
          currentUrl={apiUrl} 
        />

        {client && !isProcessing && (
          <AudioUploader 
            onUpload={handleUpload} 
            isProcessing={isProcessing} 
          />
        )}

        {/* Dynamic Processing Status Card */}
        {client && isProcessing && statusMessage && (
          <ProcessingStatus statusMessage={statusMessage} />
        )}

        {/* Show results only if we have them */}
        {(results.raw || results.clean) && (
          <TranscriptDisplay 
            rawText={results.raw} 
            cleanText={results.clean} 
          />
        )}
      </main>

      {/* Loading Overlay (Only for initial connection) */}
      {isProcessing && !results.raw && !statusMessage && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div className="loading-text text-gradient">
            {client ? "AI is processing audio... This may take a moment." : "Connecting to API..."}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>© {new Date().getFullYear()} PH Stutter Smoother.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
