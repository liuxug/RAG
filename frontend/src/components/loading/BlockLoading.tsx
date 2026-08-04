import React from 'react';
import Spinner from './Spinner';

interface BlockLoadingProps {
  text?: string;
  className?: string;
}

const BlockLoading: React.FC<BlockLoadingProps> = ({ text = '数据加载中...', className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Spinner size="md" />
      <span
        className="mt-3 whitespace-nowrap"
        style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}
      >
        {text}
      </span>
    </div>
  );
};

export default BlockLoading;
