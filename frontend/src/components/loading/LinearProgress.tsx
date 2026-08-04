import React from 'react';

interface LinearProgressProps {
  progress?: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

const LinearProgress: React.FC<LinearProgressProps> = ({
  progress,
  label,
  showPercentage = true,
  className = '',
}) => {
  const isIndeterminate = progress === undefined;
  
  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)' }}>
            {label}
          </span>
          {showPercentage && progress !== undefined && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {progress}%
            </span>
          )}
        </div>
      )}
      <div className={`progress-track ${isIndeterminate ? 'progress-indeterminate' : ''}`}>
        {!isIndeterminate && (
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
    </div>
  );
};

export default LinearProgress;
