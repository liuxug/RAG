import React from 'react';

interface PulseDotsProps {
  size?: number;
  gap?: number;
  className?: string;
}

const PulseDots: React.FC<PulseDotsProps> = ({ size = 10, gap = 8, className = '' }) => {
  return (
    <div className={`flex items-center ${className}`} style={{ gap: `${gap}px` }}>
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: 'var(--color-primary)',
          animation: 'bounce-dot 1.2s ease-in-out infinite',
          animationDelay: '0s',
        }}
      />
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: 'var(--color-primary)',
          animation: 'bounce-dot 1.2s ease-in-out infinite',
          animationDelay: '0.16s',
        }}
      />
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: 'var(--color-primary)',
          animation: 'bounce-dot 1.2s ease-in-out infinite',
          animationDelay: '0.32s',
        }}
      />
    </div>
  );
};

export default PulseDots;
