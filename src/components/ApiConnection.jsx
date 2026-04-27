import React, { useState } from 'react';
import { Link2, CheckCircle2, XCircle } from 'lucide-react';

const ApiConnection = ({ onConnect, isConnected, currentUrl }) => {
  const [url, setUrl] = useState(currentUrl || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      onConnect(url.trim());
    }
  };

  return (
    <div className="connection-card glass-panel animate-fade-in">
      <div className="connection-header">
        <Link2 className="connection-icon" size={24} />
        <h2 style={{ fontSize: '1.25rem' }}>Connect to Backend</h2>
      </div>
      
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>
        Paste your active Google Colab Gradio URL (.gradio.live) to establish a connection.
      </p>

      <form onSubmit={handleSubmit} className="connection-form">
        <input
          type="url"
          className="input-premium"
          placeholder="https://xxxx-xxxx.gradio.live"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary">
          Connect
        </button>
      </form>

      <div style={{ marginTop: '12px' }}>
        {isConnected ? (
          <div className="status-badge connected">
            <CheckCircle2 size={16} />
            <span>Connected API</span>
          </div>
        ) : (
          <div className="status-badge disconnected">
            <XCircle size={16} />
            <span>Disconnected</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiConnection;
