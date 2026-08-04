import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 20,
  md: 32,
  lg: 48,
};

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const pxSize = sizeMap[size];
  
  return (
    <div
      className={`spinner-conic ${className}`}
      style={{ width: `${pxSize}px`, height: `${pxSize}px` }}
    />
  );
};

export default Spinner;
