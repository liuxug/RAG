import { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    action?: {
        text: string;
        onClick: () => void;
    };
    duration?: number;
}

interface ToastProps {
    messages: ToastMessage[];
    onRemove: (id: string) => void;
}

export default function Toast({ messages, onRemove }: ToastProps) {
    return (
        <div className="fixed top-20 right-6 z-50 space-y-3">
            {messages.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, toast.duration || 4000);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--state-success)' }} />;
            case 'error':
                return <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--state-error)' }} />;
            default:
                return <Info className="w-3.5 h-3.5" style={{ color: 'var(--state-info)' }} />;
        }
    };

    const getIconBg = () => {
        switch (toast.type) {
            case 'success':
                return 'rgba(45,155,110,0.1)';
            case 'error':
                return 'rgba(208,72,72,0.1)';
            default:
                return 'var(--color-primary-light)';
        }
    };

    const getBorderColor = () => {
        switch (toast.type) {
            case 'success':
                return 'var(--state-success)';
            case 'error':
                return 'var(--state-error)';
            default:
                return 'var(--state-info)';
        }
    };

    const getActionColor = () => {
        switch (toast.type) {
            case 'success':
                return 'var(--state-success)';
            case 'error':
                return 'var(--state-error)';
            default:
                return 'var(--color-primary)';
        }
    };

    return (
        <div
            className="w-full rounded-lg flex items-start gap-3 p-4 shadow-lg animate-[fadeIn_0.3s_ease-out]"
            style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderLeft: `3px solid ${getBorderColor()}`,
                boxShadow: 'var(--shadow-lg)',
                maxWidth: '420px',
            }}
        >
            <div className="shrink-0 mt-0.5">
                <div
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full"
                    style={{ backgroundColor: getIconBg() }}
                >
                    {getIcon()}
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    {toast.title}
                </p>
                <p
                    className="text-xs mt-0.5 line-clamp-1"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    {toast.message}
                </p>
            </div>
            <div className="shrink-0 flex items-center gap-2 ml-2">
                {toast.action && (
                    <button
                        onClick={() => {
                            toast.action?.onClick();
                            onRemove(toast.id);
                        }}
                        className="text-xs font-medium whitespace-nowrap"
                        style={{ color: getActionColor() }}
                    >
                        {toast.action.text}
                    </button>
                )}
                <button
                    onClick={() => onRemove(toast.id)}
                    className="inline-flex items-center justify-center transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)] rounded"
                    style={{ color: 'var(--color-text-tertiary)' }}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}