import React from 'react';

interface DoubleRingProps {
  size?: number;
  className?: string;
}

const DoubleRing: React.FC<DoubleRingProps> = ({ size = 48, className = '' }) => {
  return (
    <div className={className} style={{ width: `${size}px`, height: `${size}px`, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: 'var(--color-primary)',
          borderRightColor: 'var(--color-primary)',
          animation: 'spin-cw 1s linear infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: size * 0.167,
          borderRadius: '50%',
          border: '2.5px solid transparent',
          borderBottomColor: 'var(--color-primary-light)',
          borderLeftColor: 'var(--color-primary-light)',
          animation: 'spin-ccw 0.8s linear infinite',
        }}
      />
    </div>
  );
};

export default DoubleRing;
