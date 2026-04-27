import React, { useState } from 'react';
import { FileText, Sparkles, Copy, Check } from 'lucide-react';

const TranscriptDisplay = ({ rawText, cleanText }) => {
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedClean, setCopiedClean] = useState(false);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'raw') {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } else {
      setCopiedClean(true);
      setTimeout(() => setCopiedClean(false), 2000);
    }
  };

  if (!rawText && !cleanText) return null;

  return (
    <div className="results-container animate-fade-in" style={{ animationDelay: '0.2s' }}>
      {/* Raw Output Card */}
      <div className="transcript-card glass-panel">
        <div className="transcript-header">
          <div className="transcript-title">
            <FileText className="icon-raw" size={24} />
            <span>Raw Whisper Output</span>
          </div>
          <button 
            className="copy-btn" 
            onClick={() => handleCopy(rawText, 'raw')}
            title="Copy to clipboard"
          >
            {copiedRaw ? <Check size={18} color="var(--success)" /> : <Copy size={18} />}
          </button>
        </div>
        <div className="transcript-content" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {rawText || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No transcription detected.</span>}
        </div>
      </div>

      {/* Clean Output Card */}
      <div className="transcript-card glass-panel" style={{ border: '1px solid rgba(6, 182, 212, 0.3)' }}>
        <div className="transcript-header">
          <div className="transcript-title text-gradient">
            <Sparkles className="icon-clean" size={24} />
            <span>Gemma Smoothed Output</span>
          </div>
          <button 
            className="copy-btn" 
            onClick={() => handleCopy(cleanText, 'clean')}
            title="Copy to clipboard"
          >
            {copiedClean ? <Check size={18} color="var(--success)" /> : <Copy size={18} />}
          </button>
        </div>
        <div className="transcript-content" style={{ background: 'rgba(6, 182, 212, 0.05)', maxHeight: '500px', overflowY: 'auto' }}>
          {cleanText || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>AI output will appear here.</span>}
        </div>
      </div>
    </div>
  );
};

export default TranscriptDisplay;
