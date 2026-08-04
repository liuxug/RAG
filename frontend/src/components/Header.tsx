import { useState, useEffect, useRef } from 'react';
import { Search, Download, ChevronDown, Shield, ShieldAlert, Loader2, Trash2, X, FileText, Clock } from 'lucide-react';
import { User, DownloadRecord } from '../types';
import { api } from '../utils/api';

interface HeaderProps {
    title?: string;
    user?: User | null;
    showBackButton?: boolean;
    onBack?: () => void;
    healthStatus?: 'healthy' | 'unhealthy' | 'loading';
    onNavigate?: (nav: string) => void;
}

export default function Header({ title = 'RAG 文档问答系统', user, showBackButton = false, onBack, healthStatus, onNavigate }: HeaderProps) {
    const username = user?.username || '用户';
    const initial = username.charAt(0).toUpperCase();
    const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
    const [downloadHistory, setDownloadHistory] = useState<DownloadRecord[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDownloadDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (showDownloadDropdown) {
            loadDownloadHistory();
        }
    }, [showDownloadDropdown]);

    const loadDownloadHistory = async () => {
        try {
            const response = await api.getDownloadHistory();
            setDownloadHistory(response.history);
        } catch (error) {
            console.error('Failed to load download history:', error);
        }
    };

    const clearHistory = async () => {
        try {
            await api.clearDownloadHistory();
            setDownloadHistory([]);
        } catch (error) {
            console.error('Failed to clear download history:', error);
        }
    };

    const deleteRecord = async (recordId: string) => {
        try {
            await api.deleteDownloadRecord(recordId);
            setDownloadHistory(prev => prev.filter(r => r.id !== recordId));
        } catch (error) {
            console.error('Failed to delete download record:', error);
        }
    };

    const handleSearch = () => {
        onNavigate?.('search');
    };

    const formatDateTime = (dateTime: string): string => {
        if (!dateTime) return '';
        try {
            const date = new Date(dateTime);
            return date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateTime;
        }
    };

    const getHealthIcon = () => {
        switch (healthStatus) {
            case 'healthy':
                return <Shield className="w-4 h-4 text-green-500" />;
            case 'unhealthy':
                return <ShieldAlert className="w-4 h-4 text-red-500" />;
            case 'loading':
                return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            default:
                return null;
        }
    };

    const getHealthText = () => {
        switch (healthStatus) {
            case 'healthy':
                return '服务正常';
            case 'unhealthy':
                return '服务异常';
            case 'loading':
                return '检查中...';
            default:
                return '';
        }
    };

    if (healthStatus !== undefined) {
        return (
            <header className="bg-white shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center">
                            <Search className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                            <p className="text-sm text-gray-500">智能文档问答系统</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {getHealthIcon()}
                        <span className={`text-sm font-medium ${healthStatus === 'healthy' ? 'text-green-600' : healthStatus === 'unhealthy' ? 'text-red-600' : 'text-blue-600'}`}>
                            {getHealthText()}
                        </span>
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header className="h-[56px] shrink-0 flex items-center justify-between px-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 min-w-0">
                {showBackButton && onBack && (
                    <button onClick={onBack} className="flex items-center gap-1 text-[13px] whitespace-nowrap transition-colors duration-150 hover:underline" style={{ color: 'var(--color-text-tertiary)' }}>
                        <ChevronDown className="w-[14px] h-[14px] shrink-0" />
                        <span>{title}</span>
                    </button>
                )}
                {!showBackButton && (
                    <span className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{title}</span>
                )}
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <button 
                    onClick={handleSearch}
                    className="flex items-center justify-center w-9 h-9 transition-colors duration-150 hover:bg-[var(--color-bg-hover)]" 
                    style={{ color: 'var(--color-text-secondary)' }}
                    title="搜索文档"
                >
                    <Search className="w-[18px] h-[18px]" />
                </button>
                <div className="relative">
                    <button 
                        onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                        className="flex items-center justify-center w-9 h-9 transition-colors duration-150 hover:bg-[var(--color-bg-hover)]" 
                        style={{ color: 'var(--color-text-secondary)' }}
                        title="下载历史"
                    >
                        <Download className="w-[18px] h-[18px]" />
                    </button>
                    {showDownloadDropdown && (
                        <div ref={dropdownRef} className="absolute right-0 top-full mt-2 w-[320px] z-50" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderBottomColor: 'var(--color-border-light)' }}>
                                <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>下载历史</span>
                                {downloadHistory.length > 0 && (
                                    <button onClick={clearHistory} className="inline-flex items-center gap-1 text-[11px] transition-colors duration-150" style={{ color: 'var(--color-text-tertiary)' }}>
                                        <Trash2 className="w-3 h-3" />
                                        <span>清空</span>
                                    </button>
                                )}
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                {downloadHistory.length > 0 ? (
                                    downloadHistory.map((record) => (
                                        <div 
                                            key={record.id}
                                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--color-bg-hover)]"
                                        >
                                            <div className="w-7 h-7 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--tag-tech)', color: 'var(--tag-tech-text)' }}>
                                                <FileText className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{record.document_name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{record.document_type}</span>
                                                    <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                                        <Clock className="w-3 h-3" />
                                                        {formatDateTime(record.download_time)}
                                                    </span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => deleteRecord(record.id)}
                                                className="shrink-0 p-1 transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]" 
                                                style={{ color: 'var(--color-text-tertiary)' }}
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
                                        <Download className="w-8 h-8 mb-2" />
                                        <span className="text-[12px]">暂无下载记录</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <button className="flex items-center gap-2 pl-3 transition-colors duration-150" style={{ borderLeft: '1px solid var(--color-border)' }}>
                    <div className="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                        <span>{initial}</span>
                    </div>
                    <ChevronDown className="w-[14px] h-[14px]" style={{ color: 'var(--color-text-tertiary)' }} />
                </button>
            </div>
        </header>
    );
}