import { AlertTriangle, Info, X } from 'lucide-react';
import { useState } from 'react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (inputValue?: string) => void;
    type?: 'delete' | 'confirm' | 'warning';
    title: string;
    message: string;
    warningText?: string;
    cancelText?: string;
    confirmText?: string;
    showInput?: boolean;
    inputPlaceholder?: string;
    isLoading?: boolean;
}

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    type = 'confirm',
    title,
    message,
    warningText,
    cancelText = '取消',
    confirmText = '确认',
    showInput = false,
    inputPlaceholder = '',
    isLoading = false,
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    const [inputValue, setInputValue] = useState('');

    const getIcon = () => {
        switch (type) {
            case 'delete':
                return <AlertTriangle className="w-4 h-4" style={{ color: 'var(--state-error)' }} />;
            case 'warning':
                return <AlertTriangle className="w-4 h-4" style={{ color: 'var(--state-warning)' }} />;
            default:
                return <Info className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />;
        }
    };

    const getIconBg = () => {
        switch (type) {
            case 'delete':
                return 'rgba(208,72,72,0.1)';
            case 'warning':
                return 'rgba(212,147,13,0.1)';
            default:
                return 'var(--color-primary-light)';
        }
    };

    const getConfirmBtnStyle = () => {
        switch (type) {
            case 'delete':
                return { backgroundColor: 'var(--state-error)', color: 'var(--color-text-inverse)' };
            default:
                return { backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' };
        }
    };

    const getWarningBoxStyle = () => {
        switch (type) {
            case 'delete':
                return { backgroundColor: '#FEF2F2', borderLeft: '3px solid var(--state-error)', color: 'var(--state-error)' };
            case 'warning':
                return { backgroundColor: 'var(--tag-hr)', borderLeft: '3px solid var(--state-warning)', color: 'var(--state-warning)' };
            default:
                return { backgroundColor: 'var(--color-primary-light)', borderLeft: '3px solid var(--color-primary)', color: 'var(--color-primary)' };
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={onClose}
        >
            <div 
                className="w-full max-w-md"
                style={{ 
                    backgroundColor: 'var(--color-bg-secondary)', 
                    borderRadius: 'var(--radius-lg)', 
                    boxShadow: 'var(--shadow-float)' 
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 pt-6 pb-3 flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                        <div 
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full"
                            style={{ backgroundColor: getIconBg() }}
                        >
                            {getIcon()}
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                        <h4 
                            className="text-base font-semibold leading-tight"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            {title}
                        </h4>
                        <button
                            onClick={onClose}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]"
                            style={{ color: 'var(--color-text-tertiary)' }}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="px-6 pb-2">
                    <p 
                        className="text-sm leading-relaxed"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        {message}
                    </p>
                </div>

                {warningText && (
                    <div 
                        className="mx-6 mb-4 px-4 py-3 rounded-lg"
                        style={getWarningBoxStyle()}
                    >
                        <p className="text-xs leading-relaxed">{warningText}</p>
                    </div>
                )}

                {showInput && (
                    <div className="mx-6 mb-4">
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={inputPlaceholder}
                            className="w-full px-3 py-2 text-sm resize-none"
                            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', outline: 'none', borderRadius: '4px', minHeight: '80px' }}
                            rows={3}
                        />
                    </div>
                )}

                <div className="px-6 pb-5 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="inline-flex items-center justify-center px-4 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]"
                        style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary)', opacity: isLoading ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm(inputValue);
                            onClose();
                        }}
                        disabled={isLoading}
                        className="inline-flex items-center justify-center px-4 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-150 hover:opacity-90"
                        style={{ ...getConfirmBtnStyle(), opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}