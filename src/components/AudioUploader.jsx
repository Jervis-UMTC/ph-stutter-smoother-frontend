import React, { useCallback, useState, useRef } from 'react';
import { UploadCloud, FileAudio, X } from 'lucide-react';

const AudioUploader = ({ onUpload, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  }, []);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };

  const handleFile = (file) => {
    // Check if it's an audio file
    if (file.type.startsWith('audio/')) {
      setSelectedFile(file);
    } else {
      alert('Please upload a valid audio file (mp3, wav, m4a, etc).');
    }
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = () => {
    if (selectedFile && !isProcessing) {
      onUpload(selectedFile);
    }
  };

  return (
    <div className="connection-card glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Upload Speech Audio</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
        Supported format: English, Tagalog, and Bisaya mixtures.
      </p>

      <div 
        className={`uploader-container ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !selectedFile && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="file-input"
          accept="audio/*"
          onChange={handleChange}
          disabled={!!selectedFile || isProcessing}
          style={{ display: 'none' }}
        />
        
        {!selectedFile ? (
          <div className="uploader-content">
            <UploadCloud className="upload-icon animate-pulse-glow" style={{ borderRadius: '50%' }} />
            <div className="upload-text">Click or drag audio file here</div>
            <div className="upload-hint">MP3, WAV, M4A (No Size Limit)</div>
          </div>
        ) : (
          <div className="selected-file" onClick={(e) => e.stopPropagation()}>
            <FileAudio size={24} color="var(--accent-cyan)" />
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedFile.name}
            </span>
            <button className="remove-file-btn" onClick={removeFile} disabled={isProcessing}>
              <X size={20} />
            </button>
          </div>
        )}
      </div>

      {selectedFile && (
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="btn-primary" 
            onClick={handleSubmit} 
            disabled={isProcessing}
            style={{ width: '100%' }}
          >
            {isProcessing ? 'Processing AI...' : 'Smooth Stutters'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AudioUploader;
