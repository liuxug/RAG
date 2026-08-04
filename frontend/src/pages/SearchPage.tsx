import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, MessageSquare, FileText, FileSpreadsheet, FileCode, Image, TrendingUp, ChevronDown, ArrowUpDown, X, History, Sparkles, Trash2, Clock, Search } from 'lucide-react';
import { api } from '../utils/api';
import { SearchResult as SearchResultType, RelatedDocument, SearchHistoryItem, HotSearchItem, DownloadRecord, User } from '../types';
import debounce from 'lodash.debounce';

interface SearchPageProps {
    onNavigate: (page: string, data?: any) => void;
    user?: User | null;
}

export default function SearchPage({ onNavigate, user }: SearchPageProps) {
    const userPermissions = user?.permissions || [];
    const hasPermission = (perm: string): boolean => userPermissions.includes(perm);
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<SearchResultType[]>([]);
    const [activeFilter, setActiveFilter] = useState('全部');
    const [isSearching, setIsSearching] = useState(false);
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const [hotSearches, setHotSearches] = useState<HotSearchItem[]>([]);
    const [relatedDocs, setRelatedDocs] = useState<RelatedDocument[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
    const [downloadHistory, setDownloadHistory] = useState<DownloadRecord[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const sidebarFetched = useRef(false);

    const activeFilterRef = useRef(activeFilter);
    useEffect(() => {
        activeFilterRef.current = activeFilter;
    }, [activeFilter]);

    const debouncedSearchRef = useRef<((query: string) => void) & { cancel: () => void } | null>(null);
    
    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setResults([]);
            setTotalResults(0);
            setRelatedDocs([]);
            return;
        }
        setIsSearching(true);
        try {
            const [searchResponse, relatedResponse] = await Promise.all([
                api.search(query, activeFilterRef.current),
                api.getRelatedDocuments(query)
            ]);
            
            setResults(searchResponse.results);
            setTotalResults(searchResponse.total);
            setRelatedDocs(relatedResponse.related || []);
        } catch (error) {
            console.error('Search failed:', error);
            setResults([]);
            setTotalResults(0);
            setRelatedDocs([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    useEffect(() => {
        debouncedSearchRef.current = debounce(handleSearch, 500);
        return () => {
            if (debouncedSearchRef.current) {
                debouncedSearchRef.current.cancel();
            }
        };
    }, [handleSearch]);

    useEffect(() => {
        if (debouncedSearchRef.current) {
            debouncedSearchRef.current(searchQuery);
        }
        return () => {
            if (debouncedSearchRef.current) {
                debouncedSearchRef.current.cancel();
            }
        };
    }, [searchQuery]);

    useEffect(() => {
        const fetchSidebarData = async () => {
            if (sidebarFetched.current) return;
            sidebarFetched.current = true;
            try {
                const [historyResponse, hotResponse] = await Promise.all([
                    api.getSearchHistory(10),
                    api.getHotSearches(10)
                ]);
                setSearchHistory(historyResponse.history);
                setHotSearches(hotResponse.hot_searches);
            } catch (error) {
                console.error('Failed to fetch sidebar data:', error);
                sidebarFetched.current = false;
            }
        };
        fetchSidebarData();
    }, []);

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

    useEffect(() => {
        if (activeFilter !== '全部' && searchQuery && debouncedSearchRef.current) {
            debouncedSearchRef.current(searchQuery);
        }
    }, [activeFilter, searchQuery]);

    const handleFilterChange = (filter: string) => {
        setActiveFilter(filter);
    };

    const handleSearchHistoryClick = (query: string) => {
        setSearchQuery(query);
    };

    const handleHotSearchClick = (query: string) => {
        setSearchQuery(query);
    };

    const handleRelatedDocClick = (doc: RelatedDocument) => {
        onNavigate('document-detail', { name: doc.title });
    };

    const handleClearHistory = async () => {
        try {
            await api.clearSearchHistory();
            setSearchHistory([]);
        } catch (error) {
            console.error('Failed to clear search history:', error);
        }
    };

    const handleResultClick = (result: SearchResultType) => {
        onNavigate('document-detail', { name: result.title });
    };

    const getFileTypeIcon = (type: string) => {
        switch (type) {
            case 'PDF':
            case 'Word':
            case 'TXT':
            case 'Markdown':
            case 'HTML':
            case 'ODT':
                return FileText;
            case 'Excel':
            case 'CSV':
            case 'ODS':
                return FileSpreadsheet;
            case 'PPT':
                return FileCode;
            case 'JPG':
            case 'PNG':
            case 'GIF':
            case 'BMP':
                return Image;
            default:
                return FileText;
        }
    };

    const getFileTypeColor = (type: string) => {
        switch (type) {
            case 'PDF':
                return 'var(--state-error)';
            case 'Word':
                return 'var(--state-info)';
            case 'Excel':
            case 'CSV':
            case 'ODS':
                return 'var(--state-success)';
            case 'PPT':
                return 'var(--state-warning)';
            case 'JPG':
            case 'PNG':
            case 'GIF':
            case 'BMP':
                return '#eab308';
            case 'Markdown':
                return '#0ea5e9';
            case 'JSON':
                return '#8b5cf6';
            case 'XML':
                return '#ec4899';
            case 'ODT':
                return '#0ea5e9';
            default:
                return 'var(--color-text-secondary)';
        }
    };

    const getAuthorBgColor = (index: number) => {
        const colors = ['var(--color-primary-light)', 'var(--tag-hr)', 'var(--tag-finance)', 'var(--tag-legal)', 'var(--tag-general)'];
        return colors[index % colors.length];
    };

    const getAuthorTextColor = (index: number) => {
        const colors = ['var(--color-primary)', 'var(--tag-hr-text)', 'var(--tag-finance-text)', 'var(--tag-legal-text)', 'var(--tag-general-text)'];
        return colors[index % colors.length];
    };

    const getAuthorInitial = (author: string) => {
        return author ? author.charAt(0) : '?';
    };

    const formatDownloadDateTime = (dateTime: string): string => {
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

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('zh-CN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
            <header className="h-[56px] shrink-0 flex items-center justify-between px-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => onNavigate('documents')} className="flex items-center gap-1 text-[13px] whitespace-nowrap transition-colors duration-150 hover:underline" style={{ color: 'var(--color-text-tertiary)' }}>
                        <ChevronDown className="w-[14px] h-[14px] shrink-0" />
                        <span>文档库</span>
                    </button>
                    <ChevronDown className="w-[14px] h-[14px] shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>智能检索</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <div className="relative">
                        {hasPermission('history_view') && (
                            <button 
                                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                                className="flex items-center justify-center w-9 h-9 transition-colors duration-150 hover:bg-[var(--color-bg-hover)]" 
                                style={{ color: 'var(--color-text-secondary)' }}
                                title="下载历史"
                            >
                                <Download className="w-[18px] h-[18px]" />
                            </button>
                        )}
                        {showDownloadDropdown && (
                            <div ref={dropdownRef} className="absolute right-0 top-full mt-2 w-[320px] z-50" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderBottomColor: 'var(--color-border-light)' }}>
                                    <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>下载历史</span>
                                    {downloadHistory.length > 0 && hasPermission('history_manage') && (
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
                                                            {formatDownloadDateTime(record.download_time)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {hasPermission('history_manage') && (
                                                    <button 
                                                        onClick={() => deleteRecord(record.id)}
                                                        className="shrink-0 p-1 transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]" 
                                                        style={{ color: 'var(--color-text-tertiary)' }}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
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
                            <span>张</span>
                        </div>
                        <ChevronDown className="w-[14px] h-[14px]" style={{ color: 'var(--color-text-tertiary)' }} />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="max-w-[1200px] mx-auto">
                    <div className="mt-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                                <Search className="w-[18px] h-[18px] shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="输入搜索关键词..."
                                    className="flex-1 text-[14px] outline-none" style={{ backgroundColor: 'transparent', color: 'var(--color-text-primary)' }}
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="p-1 transition-colors hover:bg-[var(--color-bg-tertiary)] rounded"
                                    >
                                        <X className="w-[14px] h-[14px]" style={{ color: 'var(--color-text-tertiary)' }} />
                                    </button>
                                )}
                                {isSearching && (
                                    <div className="w-[16px] h-[16px] border-2 border-[var(--color-text-tertiary)] border-t-[var(--color-primary)] rounded-full animate-spin" />
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
                                <button 
                                    onClick={() => handleFilterChange('全部')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
                                        activeFilter === '全部' 
                                            ? 'bg-primary text-white' 
                                            : 'bg-bg-secondary text-text-secondary border border-border'
                                    }`}
                                >
                                    <span>全部</span>
                                    <span className="px-1.5 py-0.5 text-[11px]" style={activeFilter === '全部' ? { backgroundColor: 'rgba(255,255,255,0.2)' } : { backgroundColor: 'var(--color-bg-tertiary)' }}>{totalResults}</span>
                                </button>
                                <button 
                                    onClick={() => handleFilterChange('PDF')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
                                        activeFilter === 'PDF' 
                                            ? 'bg-primary text-white' 
                                            : 'bg-bg-secondary text-text-secondary border border-border'
                                    }`}
                                >
                                    <span>PDF</span>
                                </button>
                                <button 
                                    onClick={() => handleFilterChange('Word')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
                                        activeFilter === 'Word' 
                                            ? 'bg-primary text-white' 
                                            : 'bg-bg-secondary text-text-secondary border border-border'
                                    }`}
                                >
                                    <span>Word</span>
                                </button>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium whitespace-nowrap shrink-0" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                                    <ArrowUpDown className="w-[12px] h-[12px]" style={{ color: 'var(--color-text-tertiary)' }} />
                                    <span>相关度排序</span>
                                    <ChevronDown className="w-[12px] h-[12px]" style={{ color: 'var(--color-text-tertiary)' }} />
                                </div>
                            </div>
                            <span className="text-[12px] whitespace-nowrap shrink-0 ml-3" style={{ color: 'var(--color-text-tertiary)' }}>
                                {isSearching ? '搜索中...' : `找到 ${totalResults} 条相关结果`}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-6 mt-5">
                        <div className="flex-1 min-w-0 flex flex-col gap-4">
                            {isSearching ? (
                                <div className="flex items-center justify-center py-12" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 border-2 border-[var(--color-text-tertiary)] border-t-[var(--color-primary)] rounded-full animate-spin" />
                                        <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>正在搜索...</span>
                                    </div>
                                </div>
                            ) : results.length > 0 ? (
                                results.map((result, index) => {
                                    const FileIcon = getFileTypeIcon(result.fileType);
                                    const fileIconColor = getFileTypeColor(result.fileType);
                                    return (
                                        <div 
                                            key={result.id}
                                            className="block transition-colors duration-150 cursor-pointer"
                                            style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', padding: '20px' }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                                                e.currentTarget.style.backgroundColor = 'var(--color-primary-subtle)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                                            }}
                                            onClick={() => handleResultClick(result)}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{result.matchRate} 匹配</span>
                                                        <h3 className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{result.title}</h3>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{result.path}</span>
                                                    </div>
                                                    <p className="text-[13px] leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {result.summary}
                                                    </p>
                                                    <div className="flex items-center gap-4 mt-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <FileIcon className="w-[14px] h-[14px]" style={{ color: fileIconColor }} />
                                                            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{result.fileType} · {result.size}</span>
                                                        </div>
                                                        <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{formatDate(result.updateTime)} 更新</span>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-4 h-4 shrink-0 flex items-center justify-center text-[9px] font-medium" style={{ backgroundColor: getAuthorBgColor(index), color: getAuthorTextColor(index) }}>
                                                                {getAuthorInitial(result.author)}
                                                            </div>
                                                            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{result.author}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-2.5 flex-nowrap overflow-x-auto">
                                                        {result.tags.map((tag) => (
                                                            <span key={tag} className="inline-flex items-center px-2 py-0.5 text-[11px] whitespace-nowrap shrink-0" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                                    <div className="w-16 h-16 mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                                        <Search className="w-8 h-8" style={{ color: 'var(--color-text-tertiary)' }} />
                                    </div>
                                    <p className="text-[14px] font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>暂无搜索结果</p>
                                    <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>输入关键词开始搜索文档</p>
                                    {hasPermission('chat') && (
                                        <button onClick={() => onNavigate('chat')} className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}>
                                            <MessageSquare className="w-[14px] h-[14px]" />
                                            <span>尝试 AI 问答</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="w-[260px] min-w-[260px] shrink-0 flex flex-col gap-5">
                            <div style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', padding: '16px' }}>
                                <h4 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>相关文档推荐</h4>
                                <div className="flex flex-col gap-2.5">
                                    {relatedDocs.length > 0 ? (
                                        relatedDocs.map((doc, index) => {
                                            const FileIcon = getFileTypeIcon(doc.fileType);
                                            const fileIconColor = getFileTypeColor(doc.fileType);
                                            return (
                                                <div 
                                                    key={`${doc.id}-${index}`}
                                                    className="flex items-center gap-3 p-2 cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)] rounded"
                                                    onClick={() => handleRelatedDocClick(doc)}
                                                >
                                                    <FileIcon className="w-[16px] h-[16px] shrink-0 mt-0.5" style={{ color: fileIconColor }} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{doc.title}</p>
                                                            <span className="text-[10px] px-1.5 py-0.5 shrink-0" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{doc.matchRate}</span>
                                                        </div>
                                                        <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{doc.category}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="flex items-center justify-center py-8" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                                            <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>暂无推荐</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', padding: '16px' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1.5">
                                        <History className="w-[14px] h-[14px]" style={{ color: 'var(--color-text-tertiary)' }} />
                                        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>搜索历史</h4>
                                    </div>
                                    {searchHistory.length > 0 && (
                                        <button 
                                            onClick={handleClearHistory}
                                            className="text-[11px] transition-colors hover:text-[var(--color-primary)]"
                                            style={{ color: 'var(--color-text-tertiary)' }}
                                        >
                                            清空
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {searchHistory.length > 0 ? (
                                        searchHistory.map((item, index) => (
                                            <button
                                                key={`${item.query}-${index}`}
                                                onClick={() => handleSearchHistoryClick(item.query)}
                                                className="px-2.5 py-1 text-[12px] whitespace-nowrap transition-colors hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
                                                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
                                            >
                                                {item.query}
                                            </button>
                                        ))
                                    ) : (
                                        <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>暂无搜索历史</span>
                                    )}
                                </div>
                            </div>

                            <div style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', padding: '16px' }}>
                                <div className="flex items-center gap-1.5 mb-3">
                                    <TrendingUp className="w-[14px] h-[14px]" style={{ color: 'var(--color-text-tertiary)' }} />
                                    <h4 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>热门搜索</h4>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {hotSearches.length > 0 ? (
                                        hotSearches.map((item, index) => (
                                            <button
                                                key={`${item.query}-${index}`}
                                                onClick={() => handleHotSearchClick(item.query)}
                                                className="flex items-center gap-2 p-2 text-left transition-colors hover:bg-[var(--color-bg-tertiary)] rounded w-full"
                                            >
                                                <div className={`w-4 h-4 flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                                    index < 3 ? 'text-white' : 'text-[var(--color-text-tertiary)]'
                                                }`} style={{
                                                    backgroundColor: index === 0 ? 'var(--state-error)' : 
                                                                    index === 1 ? 'var(--state-warning)' : 
                                                                    index === 2 ? 'var(--state-info)' : 'var(--color-bg-tertiary)'
                                                }}>
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] truncate" style={{ color: 'var(--color-text-primary)' }}>{item.query}</p>
                                                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>搜索 {item.count} 次</p>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="flex items-center justify-center py-6" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-[14px] h-[14px]" style={{ color: 'var(--color-text-tertiary)' }} />
                                                <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>暂无热门搜索</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}