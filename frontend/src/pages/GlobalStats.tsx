import { useState, useEffect, useRef, useCallback } from 'react';
import { 
    BarChart3, FileText, Users, MessageSquare, Search, Clock, Target, TrendingUp, TrendingDown,
    Download, Bell, Settings, ChevronDown, ChevronRight, Cpu, Circle, CheckCircle, X, Calendar
} from 'lucide-react';
import { User } from '../types';
import { api } from '../utils/api';

interface GlobalStatsProps {
    user?: User | null;
}

interface KPIMetrics {
    total_documents: number;
    total_users: number;
    ai_conversations: number;
    search_count: number;
    avg_response_time: number;
    document_coverage: number;
}

interface UploadTrendItem {
    month: string;
    count: number;
}

interface DocumentTypeItem {
    type: string;
    count: number;
    percentage: number;
    color: string;
}

interface UserActivityItem {
    role: string;
    count: number;
    percentage: number;
    color: string;
}

interface HotKeywordItem {
    rank: number;
    keyword: string;
    count: number;
    percentage: number;
}

interface ActivityItem {
    id: string;
    user_name: string;
    user_avatar: string;
    action: string;
    target: string;
    target_color: string;
    time_ago: string;
}

interface GlobalStatsResponse {
    kpi_metrics: KPIMetrics;
    upload_trend: UploadTrendItem[];
    document_types: DocumentTypeItem[];
    user_activity: UserActivityItem[];
    hot_keywords: HotKeywordItem[];
    recent_activity: ActivityItem[];
}

const timeRangeOptions = [
    { value: '7d', label: '最近 7 天' },
    { value: '30d', label: '最近 30 天' },
    { value: '90d', label: '最近 90 天' },
    { value: '1y', label: '最近 1 年' },
    { value: 'custom', label: '自定义时间' },
];

export default function GlobalStats({ user }: GlobalStatsProps) {
    const [stats, setStats] = useState<GlobalStatsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const isFetchedRef = useRef(false);
    const fetchingRef = useRef(false);
    const datePickerRef = useRef<HTMLDivElement>(null);

    const username = user?.username || '用户';
    const initial = username.charAt(0).toUpperCase();

    const getTimeRangeLabel = () => {
        const option = timeRangeOptions.find(o => o.value === selectedTimeRange);
        if (selectedTimeRange === 'custom' && customStartDate && customEndDate) {
            return `${customStartDate} - ${customEndDate}`;
        }
        return option?.label || '最近 30 天';
    };

    const fetchStats = useCallback(async (params?: {
        time_range?: string;
        start_date?: string;
        end_date?: string;
    }) => {
        if (fetchingRef.current) {
            return;
        }
        fetchingRef.current = true;
        setIsLoading(true);
        try {
            const response = await api.getGlobalStats(params);
            setStats(response);
            isFetchedRef.current = true;
        } catch (error) {
            console.error('Failed to fetch global stats:', error);
        } finally {
            fetchingRef.current = false;
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isFetchedRef.current) {
            fetchStats();
        }
    }, [fetchStats]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setShowDatePicker(false);
            }
        };

        if (showDatePicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDatePicker]);

    const handleTimeRangeChange = (value: string) => {
        setSelectedTimeRange(value);
        setShowDatePicker(false);
        if (value === 'custom') {
            setShowDatePicker(true);
        } else {
            fetchStats({ time_range: value });
        }
    };

    const handleCustomDateSubmit = () => {
        if (customStartDate && customEndDate) {
            fetchStats({ start_date: customStartDate, end_date: customEndDate });
            setShowDatePicker(false);
        }
    };

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            let params: { time_range?: string; start_date?: string; end_date?: string } = {};
            if (selectedTimeRange === 'custom' && customStartDate && customEndDate) {
                params = { start_date: customStartDate, end_date: customEndDate };
            } else if (selectedTimeRange !== 'custom') {
                params = { time_range: selectedTimeRange };
            }
            
            const csvString = await api.exportStats(params);
            const cleanCsv = csvString.startsWith('"') && csvString.endsWith('"') 
                ? csvString.slice(1, -1).replace(/\\"/g, '"') 
                : csvString;
            const blob = new Blob([cleanCsv], { type: 'text/csv;charset=utf-8-sig' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `全局统计_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export stats:', error);
            alert('导出失败，请重试');
        } finally {
            setIsExporting(false);
        }
    };

    const formatNumber = (num: number): string => {
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + '万';
        }
        if (num >= 1000) {
            return num.toLocaleString();
        }
        return num.toString();
    };

    const getDonutGradient = (types: DocumentTypeItem[]): string => {
        let gradient = '';
        let currentDeg = 0;
        types.forEach((item, index) => {
            const deg = (item.percentage / 100) * 360;
            const startDeg = currentDeg;
            const endDeg = currentDeg + deg;
            gradient += `${item.color} ${startDeg}deg ${endDeg}deg${index < types.length - 1 ? ',' : ''}`;
            currentDeg = endDeg;
        });
        return gradient;
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                <p style={{ color: 'var(--color-text-secondary)' }}>加载失败，请刷新重试</p>
            </div>
        );
    }

    const maxUploadCount = Math.max(...stats.upload_trend.map(item => item.count), 1);

    return (
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
            <header className="h-[56px] shrink-0 flex items-center justify-between px-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>系统管理</span>
                    <ChevronRight className="w-[14px] h-[14px] shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>全局统计</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    {/* <button className="flex items-center justify-center w-9 h-9 transition-colors duration-150" style={{ color: 'var(--color-text-secondary)' }}>
                        <Bell className="w-[18px] h-[18px]" />
                    </button>
                    <button className="flex items-center justify-center w-9 h-9 transition-colors duration-150" style={{ color: 'var(--color-text-secondary)' }}>
                        <Settings className="w-[18px] h-[18px]" />
                    </button> */}
                    <button className="flex items-center gap-2 pl-3 transition-colors duration-150" style={{ borderLeft: '1px solid var(--color-border)' }}>
                        <div className="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                            <span>{initial}</span>
                        </div>
                        <ChevronDown className="w-[14px] h-[14px]" style={{ color: 'var(--color-text-tertiary)' }} />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="flex items-start justify-between mb-6">
                    <div className="min-w-0">
                        <h1 className="text-[24px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>全局统计</h1>
                        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>智识RAG文档问答中台运营数据概览</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                        <div ref={datePickerRef} className="relative">
                            <button 
                                onClick={() => setShowDatePicker(!showDatePicker)}
                                className="flex items-center gap-2 px-3 py-2 text-[13px] whitespace-nowrap" 
                                style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-secondary)' }}
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{getTimeRangeLabel()}</span>
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            
                            {showDatePicker && (
                                <div className="absolute top-full right-0 mt-2 w-72 z-50" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}>
                                    <div className="p-2">
                                        {timeRangeOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => handleTimeRangeChange(option.value)}
                                                className={`w-full flex items-center justify-between px-3 py-2 text-[13px] rounded-md transition-colors ${
                                                    selectedTimeRange === option.value 
                                                        ? 'bg-primary/10 text-primary' 
                                                        : 'text-text-secondary hover:bg-bg-tertiary'
                                                }`}
                                            >
                                                <span>{option.label}</span>
                                                {selectedTimeRange === option.value && (
                                                    <CheckCircle className="w-4 h-4" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {selectedTimeRange === 'custom' && (
                                        <div className="px-4 py-3 border-t" style={{ borderTopColor: 'var(--color-divider)' }}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Calendar className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                                                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>选择日期范围</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    value={customStartDate}
                                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                                    className="flex-1 px-2 py-1.5 text-xs"
                                                    style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }}
                                                />
                                                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>-</span>
                                                <input
                                                    type="date"
                                                    value={customEndDate}
                                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                                    className="flex-1 px-2 py-1.5 text-xs"
                                                    style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)' }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-end gap-2 mt-3">
                                                <button 
                                                    onClick={() => setShowDatePicker(false)}
                                                    className="px-3 py-1.5 text-xs"
                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                >
                                                    取消
                                                </button>
                                                <button 
                                                    onClick={handleCustomDateSubmit}
                                                    disabled={!customStartDate || !customEndDate}
                                                    className="px-3 py-1.5 text-xs font-medium"
                                                    style={{ backgroundColor: 'var(--color-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-inverse)', opacity: (!customStartDate || !customEndDate) ? 0.5 : 1 }}
                                                >
                                                    确定
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <button 
                            onClick={handleExport}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium whitespace-nowrap" 
                            style={{ backgroundColor: 'var(--color-primary)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-inverse)', opacity: isExporting ? 0.7 : 1 }}
                        >
                            <Download className="w-4 h-4" />
                            <span>{isExporting ? '导出中...' : '导出报表'}</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                    <div className="flex flex-col p-4" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center justify-center w-8 h-8" style={{ backgroundColor: 'var(--color-primary-light)', borderRadius: 'var(--radius-full)' }}>
                                <FileText className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                            </div>
                        </div>
                        <p className="text-[22px] font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(stats.kpi_metrics.total_documents)}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>总文档数</p>
                        <span className="inline-flex items-center gap-0.5 mt-2 text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--state-success)' }}>
                            <TrendingUp className="w-3 h-3" /> +12.5%
                        </span>
                    </div>
                    <div className="flex flex-col p-4" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center justify-center w-8 h-8" style={{ backgroundColor: 'var(--color-primary-light)', borderRadius: 'var(--radius-full)' }}>
                                <Users className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                            </div>
                        </div>
                        <p className="text-[22px] font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(stats.kpi_metrics.total_users)}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>总用户数</p>
                        <span className="inline-flex items-center gap-0.5 mt-2 text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--state-success)' }}>
                            <TrendingUp className="w-3 h-3" /> +8.3%
                        </span>
                    </div>
                    <div className="flex flex-col p-4" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center justify-center w-8 h-8" style={{ backgroundColor: 'var(--color-primary-light)', borderRadius: 'var(--radius-full)' }}>
                                <MessageSquare className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                            </div>
                        </div>
                        <p className="text-[22px] font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(stats.kpi_metrics.ai_conversations)}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>AI 对话次数</p>
                        <span className="inline-flex items-center gap-0.5 mt-2 text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--state-success)' }}>
                            <TrendingUp className="w-3 h-3" /> +23.1%
                        </span>
                    </div>
                    <div className="flex flex-col p-4" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center justify-center w-8 h-8" style={{ backgroundColor: 'var(--color-primary-light)', borderRadius: 'var(--radius-full)' }}>
                                <Search className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                            </div>
                        </div>
                        <p className="text-[22px] font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(stats.kpi_metrics.search_count)}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>检索次数</p>
                        <span className="inline-flex items-center gap-0.5 mt-2 text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--state-success)' }}>
                            <TrendingUp className="w-3 h-3" /> +15.7%
                        </span>
                    </div>
                    <div className="flex flex-col p-4" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center justify-center w-8 h-8" style={{ backgroundColor: 'var(--color-primary-light)', borderRadius: 'var(--radius-full)' }}>
                                <Clock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                            </div>
                        </div>
                        <p className="text-[22px] font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{stats.kpi_metrics.avg_response_time}s</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>平均响应时间</p>
                        <span className="inline-flex items-center gap-0.5 mt-2 text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--state-success)' }}>
                            <TrendingDown className="w-3 h-3" /> -18.4%
                        </span>
                    </div>
                    <div className="flex flex-col p-4" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center justify-center w-8 h-8" style={{ backgroundColor: 'var(--color-primary-light)', borderRadius: 'var(--radius-full)' }}>
                                <Target className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                            </div>
                        </div>
                        <p className="text-[22px] font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{stats.kpi_metrics.document_coverage}%</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>文档覆盖率</p>
                        <span className="inline-flex items-center gap-0.5 mt-2 text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--state-success)' }}>
                            <TrendingUp className="w-3 h-3" /> +2.1%
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
                    <div className="lg:col-span-7 p-5" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="flex items-baseline justify-between mb-5">
                            <div className="min-w-0">
                                <h2 className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>文档上传趋势</h2>
                                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>最近 12 个月</p>
                            </div>
                        </div>
                        <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '0', paddingBottom: '28px', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '0', top: '0', bottom: '28px', width: '36px', display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between' }}>
                                <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>0</span>
                                <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{Math.round(maxUploadCount * 0.25)}</span>
                                <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{Math.round(maxUploadCount * 0.5)}</span>
                                <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{maxUploadCount}</span>
                            </div>
                            <div style={{ position: 'absolute', left: '36px', right: '0', top: '0', bottom: '28px', display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between', pointerEvents: 'none' }}>
                                <div style={{ borderBottom: '1px solid var(--color-divider)', width: '100%' }}></div>
                                <div style={{ borderBottom: '1px solid var(--color-divider)', width: '100%' }}></div>
                                <div style={{ borderBottom: '1px solid var(--color-divider)', width: '100%' }}></div>
                                <div style={{ borderBottom: '1px solid var(--color-divider)', width: '100%' }}></div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0', flex: '1', marginLeft: '36px', height: '100%', paddingBottom: '0' }}>
                                {stats.upload_trend.map((item, index) => (
                                    <div key={index} style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                        <span className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{item.count}</span>
                                        <div 
                                            style={{ 
                                                width: '60%', 
                                                height: `${(item.count / maxUploadCount) * 100}%`, 
                                                backgroundColor: 'var(--color-primary)', 
                                                borderRadius: '3px 3px 0 0', 
                                                transition: 'opacity var(--transition-fast)', 
                                                opacity: index === stats.upload_trend.length - 1 ? 1 : 0.85 
                                            }} 
                                        ></div>
                                        <span className={`text-[10px] mt-2 whitespace-nowrap ${index === stats.upload_trend.length - 1 ? 'font-medium' : ''}`} style={{ color: index === stats.upload_trend.length - 1 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>{item.month}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-5 p-5" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="mb-5">
                            <h2 className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>文档类型分布</h2>
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>按文件类型</p>
                        </div>
                        <div className="flex items-center justify-center mb-4">
                            <div style={{ 
                                width: '180px', 
                                height: '180px', 
                                borderRadius: '50%', 
                                position: 'relative', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                background: `conic-gradient(${getDonutGradient(stats.document_types)})`
                            }}>
                                <div style={{ 
                                    width: '120px', 
                                    height: '120px', 
                                    borderRadius: '50%', 
                                    backgroundColor: 'var(--color-bg-secondary)', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    position: 'absolute' 
                                }}>
                                    <span className="text-[22px] font-bold" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(stats.kpi_metrics.total_documents)}</span>
                                    <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>文档总数</span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {stats.document_types.map((item, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: item.color, borderRadius: '2px' }}></span>
                                    <span className="text-xs truncate flex-1 min-w-0" style={{ color: 'var(--color-text-secondary)' }}>{item.type}</span>
                                    <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{item.percentage}%</span>
                                    <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
                    <div className="lg:col-span-5 p-5" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="mb-5">
                            <h2 className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>用户活跃度</h2>
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>按角色分组</p>
                        </div>
                        <div className="flex flex-col gap-4">
                            {stats.user_activity.map((item, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <span className="text-xs whitespace-nowrap w-24 text-right truncate" style={{ color: 'var(--color-text-secondary)' }}>{item.role}</span>
                                    <div className="flex-1 h-5 relative" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                        <div className="h-full" style={{ width: `${item.percentage}%`, backgroundColor: item.color, borderRadius: 'var(--radius-full)', minWidth: '8px' }}></div>
                                    </div>
                                    <span className="text-xs font-medium whitespace-nowrap w-8 text-right" style={{ color: 'var(--color-text-primary)' }}>{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-7 p-5" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="mb-5">
                            <h2 className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>热门检索关键词</h2>
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>最近 30 天 Top 8</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            {stats.hot_keywords.map((item) => (
                                <div key={item.rank} className="flex items-center gap-3">
                                    <span className="text-xs font-bold w-4 text-center shrink-0" style={{ color: 'var(--color-primary)' }}>{item.rank}</span>
                                    <span className="text-xs truncate min-w-0 w-32" style={{ color: 'var(--color-text-primary)' }}>{item.keyword}</span>
                                    <div className="flex-1 h-1.5" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                        <div className="h-full" style={{ width: `${item.percentage}%`, backgroundColor: 'var(--color-primary)', borderRadius: 'var(--radius-full)', opacity: 0.85 - (item.rank - 1) * 0.05 }}></div>
                                    </div>
                                    <span className="text-[10px] whitespace-nowrap w-12 text-right" style={{ color: 'var(--color-text-tertiary)' }}>{formatNumber(item.count)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-5" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="mb-4">
                            <h2 className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>系统运行状态</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                <div className="w-3 h-3" style={{ backgroundColor: '#2D9B6E', borderRadius: '50%' }}></div>
                                <div>
                                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>向量数据库</p>
                                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>正常运行</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                <div className="w-3 h-3" style={{ backgroundColor: '#2D9B6E', borderRadius: '50%' }}></div>
                                <div>
                                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>AI 服务</p>
                                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>正常运行</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                <div className="w-3 h-3" style={{ backgroundColor: '#2D9B6E', borderRadius: '50%' }}></div>
                                <div>
                                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>检索引擎</p>
                                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>正常运行</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                <div className="w-3 h-3" style={{ backgroundColor: '#2D9B6E', borderRadius: '50%' }}></div>
                                <div>
                                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>文件存储</p>
                                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>正常运行</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-5" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>最近活动</h2>
                            <a href="#" className="text-xs whitespace-nowrap shrink-0" style={{ color: 'var(--color-primary)' }}>查看全部</a>
                        </div>
                        <div className="flex flex-col gap-0">
                            {stats.recent_activity.map((item, index) => (
                                <div key={item.id} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className="w-7 h-7 shrink-0 flex items-center justify-center">
                                            {item.user_avatar === 'cpu' ? (
                                                <div style={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Cpu className="w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
                                                </div>
                                            ) : (
                                                <div className="text-[10px] font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)' }}>
                                                    {item.user_avatar}
                                                </div>
                                            )}
                                        </div>
                                        {index < stats.recent_activity.length - 1 && (
                                            <div className="w-px flex-1 mt-1.5" style={{ backgroundColor: 'var(--color-border-light)' }}></div>
                                        )}
                                    </div>
                                    <div className={index < stats.recent_activity.length - 1 ? 'pb-4 min-w-0' : 'min-w-0'}>
                                        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                                            <span className="font-medium">{item.user_name}</span> {item.action} <span style={{ color: item.target_color }}>{item.target}</span>
                                        </p>
                                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{item.time_ago}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}