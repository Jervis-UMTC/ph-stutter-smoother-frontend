import React, { useEffect, useState } from 'react';
import { UploadCloud, Server, Activity, Cpu, CheckCircle } from 'lucide-react';

const ProcessingStatus = ({ statusMessage }) => {
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (!statusMessage) return;
    
    const lowerStatus = statusMessage.toLowerCase();
    if (lowerStatus.includes('complete')) {
      setCurrentStep(5);
    } else if (lowerStatus.includes('processing') || lowerStatus.includes('chunk')) {
      setCurrentStep(4);
    } else if (lowerStatus.includes('analyzing')) {
      setCurrentStep(3);
    } else if (lowerStatus.includes('starting') || lowerStatus.includes('waiting') || lowerStatus.includes('initializing')) {
      setCurrentStep(2);
    } else if (lowerStatus.includes('uploading')) {
      setCurrentStep(1);
    }
  }, [statusMessage]);

  const steps = [
    { id: 1, label: 'Uploading to Cloud', icon: UploadCloud },
    { id: 2, label: 'Initializing AI', icon: Server },
    { id: 3, label: 'Analyzing Audio', icon: Activity },
    { id: 4, label: 'Transcription', icon: Cpu },
    { id: 5, label: 'Finalizing', icon: CheckCircle }
  ];

  // Helper to remove emojis from the backend string
  const cleanStatus = statusMessage 
    ? statusMessage.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()
    : 'Status: Waiting for initialization...';

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '32px 24px', marginBottom: '24px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '32px', textAlign: 'center', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
        Processing Speech Audio
      </h3>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
        {/* Background Line */}
        <div style={{ position: 'absolute', top: '24px', left: '10%', right: '10%', height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 0 }}></div>
        
        {/* Active Line Progress */}
        <div style={{ 
          position: 'absolute', 
          top: '24px', 
          left: '10%', 
          width: `${(currentStep - 1) * 25}%`, 
          height: '2px', 
          background: 'var(--accent-cyan)', 
          zIndex: 0,
          transition: 'width 0.5s ease-in-out'
        }}></div>
        
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep >= step.id;
          const isCurrent = currentStep === step.id;
          
          return (
            <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, width: '20%', position: 'relative' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                background: isActive ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                border: `2px solid ${isActive ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: '12px',
                boxShadow: isCurrent ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none',
                transition: 'all 0.3s ease'
              }}>
                <Icon size={24} color={isActive ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.3)'} />
              </div>
              <span style={{ 
                fontSize: '0.85rem', 
                color: isActive ? 'var(--text-primary)' : 'rgba(255,255,255,0.5)', 
                textAlign: 'center', 
                fontWeight: isActive ? '500' : 'normal',
                transition: 'color 0.3s ease'
              }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Terminal View */}
      <div style={{ 
        background: '#0d1117', 
        borderRadius: '8px', 
        padding: '16px 20px', 
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          background: currentStep === 5 ? '#10b981' : 'var(--accent-cyan)', 
          animation: currentStep !== 5 ? 'pulse-opacity 1.5s infinite ease-in-out' : 'none' 
        }}></div>
        <span style={{ color: currentStep === 5 ? '#10b981' : 'var(--accent-cyan)', fontSize: '0.9rem', wordBreak: 'break-word' }}>
          {cleanStatus}
        </span>
      </div>
    </div>
  );
};

export default ProcessingStatus;