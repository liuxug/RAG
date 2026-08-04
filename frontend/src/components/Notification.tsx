import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { Notification as NotificationType } from '../types';

interface NotificationProps {
    notifications: NotificationType[];
    onRemove: (id: string) => void;
}

const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
};

const colors = {
    success: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-600',
        text: 'text-green-800',
    },
    error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-600',
        text: 'text-red-800',
    },
    info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-600',
        text: 'text-blue-800',
    },
    warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        icon: 'text-yellow-600',
        text: 'text-yellow-800',
    },
};

export default function Notification({ notifications, onRemove }: NotificationProps) {
    useEffect(() => {
        notifications.forEach((notification) => {
            const timer = setTimeout(() => {
                onRemove(notification.id);
            }, 5000);
            return () => clearTimeout(timer);
        });
    }, [notifications, onRemove]);

    return (
        <div className="fixed top-4 right-4 z-50 space-y-3">
            {notifications.map((notification) => {
                const Icon = icons[notification.type];
                const color = colors[notification.type];
                
                return (
                    <div
                        key={notification.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${color.bg} ${color.border} animate-slideIn`}
                    >
                        <Icon className={`w-5 h-5 ${color.icon} flex-shrink-0`} />
                        <p className={`text-sm font-medium ${color.text} flex-1`}>
                            {notification.message}
                        </p>
                        <button
                            onClick={() => onRemove(notification.id)}
                            className="p-1 hover:bg-white/50 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
