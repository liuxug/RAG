import React from 'react';

interface ButtonLoadingProps {
  type?: 'primary' | 'ghost' | 'icon';
  size?: 'sm' | 'md';
  className?: string;
}

const ButtonLoading: React.FC<ButtonLoadingProps> = ({
  type = 'primary',
  size = 'md',
  className = '',
}) => {
  const spinnerSize = size === 'sm' ? 14 : type === 'icon' ? 16 : 18;
  const borderWidth = type === 'icon' ? '2px' : '2.5px';
  
  const getSpinnerColor = () => {
    if (type === 'primary') return 'white';
    return 'var(--color-primary)';
  };

  const getContainerStyle = () => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.7,
      cursor: 'not-allowed',
      pointerEvents: 'none',
    };

    switch (type) {
      case 'primary':
        return {
          ...baseStyle,
          height: size === 'sm' ? '32px' : '40px',
          padding: `0 var(--space-xl)`,
          backgroundColor: 'var(--color-primary)',
          borderRadius: 'var(--radius-md)',
        };
      case 'ghost':
        return {
          ...baseStyle,
          height: size === 'sm' ? '32px' : '40px',
          padding: `0 var(--space-xl)`,
          backgroundColor: 'transparent',
          border: `1.5px solid var(--color-primary)`,
          borderRadius: 'var(--radius-md)',
        };
      case 'icon':
        return {
          ...baseStyle,
          width: size === 'sm' ? '28px' : '36px',
          height: size === 'sm' ? '28px' : '36px',
          backgroundColor: 'transparent',
          border: `1.5px solid var(--color-primary)`,
          borderRadius: '50%',
        };
      default:
        return baseStyle;
    }
  };

  return (
    <div style={getContainerStyle()} className={className}>
      <div
        style={{
          width: `${spinnerSize}px`,
          height: `${spinnerSize}px`,
          borderRadius: '50%',
          border: `${borderWidth} solid transparent`,
          borderTopColor: getSpinnerColor(),
          borderRightColor: getSpinnerColor(),
          animation: 'spin-cw 0.8s linear infinite',
        }}
      />
    </div>
  );
};

export default ButtonLoading;
