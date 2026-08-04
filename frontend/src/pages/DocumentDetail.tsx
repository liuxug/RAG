import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    ArrowLeft, Download, Share2, Edit3, Trash2, Bookmark, 
    FileText, Calendar, User as UserIcon, Clock, Eye, ChevronDown, ChevronUp,
    Search, MessageSquare, Tag, FileCheck, AlertCircle, History, Printer,
    CheckCircle, XCircle, X, Send, RefreshCw, ArrowUp, ArrowDown
} from 'lucide-react';
import debounce from 'lodash.debounce';
import { Spinner, BlockLoading } from '../components/loading';
import { api } from '../utils/api';
import { Document, DocumentDetailResponse, Comment, DocumentStatus, User } from '../types';

const formatDateTime = (dateTime: string | undefined): string => {
    if (!dateTime) return '';
    try {
        const date = new Date(dateTime);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '';
    }
};

interface TableOfContentsItem {
    id: string;
    label: string;
    level: number;
    isExpanded?: boolean;
    children?: TableOfContentsItem[];
}

interface SearchMatch {
    chunkIndex: number;
    startIndex: number;
    length: number;
    context: string;
}

interface DocumentDetailProps {
    onNavigate: (nav: string, document?: Document) => void;
    document: Document | null;
    user?: User | null;
}

export default function DocumentDetail({ onNavigate, document, user }: DocumentDetailProps) {
    const [documentDetail, setDocumentDetail] = useState<DocumentDetailResponse | null>(null);
    const [toc, setToc] = useState<TableOfContentsItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
    const [toastMessages, setToastMessages] = useState<{ id: string; type: 'success' | 'error' | 'info'; title: string; message: string }[]>([]);
    
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showCommentPanel, setShowCommentPanel] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
    const [reviewComment, setReviewComment] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);

    const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
    const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
    const [isSearchActive, setIsSearchActive] = useState(false);

    const lastFetchedName = useRef<string | null>(null);
    const isFetching = useRef(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const showToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
        const id = Date.now().toString();
        setToastMessages(prev => [...prev, { id, type, title, message }]);
        setTimeout(() => {
            setToastMessages(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const hasPermission = (perm: string): boolean => {
        return user?.permissions?.includes(perm) || false;
    };

    const performSearch = useCallback((query: string) => {
        if (!query.trim() || !documentDetail) {
            setSearchMatches([]);
            setActiveMatchIndex(-1);
            setIsSearchActive(false);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const matches: SearchMatch[] = [];

        documentDetail.all_chunks.forEach((chunk, chunkIndex) => {
            const content = chunk.content.toLowerCase();
            let startIdx = 0;
            
            while (startIdx < content.length) {
                const foundIdx = content.indexOf(lowerQuery, startIdx);
                if (foundIdx === -1) break;

                const originalContent = chunk.content;
                const contextStart = Math.max(0, foundIdx - 20);
                const contextEnd = Math.min(originalContent.length, foundIdx + query.length + 20);
                const context = (contextStart > 0 ? '...' : '') + 
                    originalContent.slice(contextStart, contextEnd) + 
                    (contextEnd < originalContent.length ? '...' : '');

                matches.push({
                    chunkIndex: chunkIndex,
                    startIndex: foundIdx,
                    length: query.length,
                    context: context
                });

                startIdx = foundIdx + query.length;
            }
        });

        setSearchMatches(matches);
        setIsSearchActive(matches.length > 0);
        if (matches.length > 0) {
            setActiveMatchIndex(0);
            scrollToMatch(0, matches);
        } else {
            setActiveMatchIndex(-1);
        }
    }, [documentDetail]);

    const debouncedSearch = useMemo(
        () => debounce((query: string) => performSearch(query), 200),
        [performSearch]
    );

    const handleSearch = () => {
        performSearch(searchQuery);
    };

    const navigateMatch = (direction: 'up' | 'down') => {
        if (searchMatches.length === 0) return;

        let newIndex: number;
        if (direction === 'down') {
            newIndex = activeMatchIndex < searchMatches.length - 1 
                ? activeMatchIndex + 1 
                : 0;
        } else {
            newIndex = activeMatchIndex > 0 
                ? activeMatchIndex - 1 
                : searchMatches.length - 1;
        }

        setActiveMatchIndex(newIndex);
        scrollToMatch(newIndex, searchMatches);
    };

    const scrollToMatch = (index: number, matches: SearchMatch[]) => {
        if (!contentRef.current || matches.length === 0) return;

        const match = matches[index];
        const chunkElements = contentRef.current.querySelectorAll('[data-chunk-id]');
        const targetChunk = chunkElements[match.chunkIndex];

        if (targetChunk) {
            targetChunk.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        } else if (e.key === 'Escape') {
            setSearchQuery('');
            setSearchMatches([]);
            setActiveMatchIndex(-1);
            setIsSearchActive(false);
        }
    };

    useEffect(() => {
        const documentName = document?.name;
        if (documentName && documentName !== lastFetchedName.current && !isFetching.current) {
            isFetching.current = true;
            lastFetchedName.current = documentName;
            fetchDocumentDetail(documentName);
            fetchComments(documentName);
        }
    }, [document?.name]);

    useEffect(() => {
        if (documentDetail && searchQuery.trim()) {
            performSearch(searchQuery);
        }
    }, [documentDetail]);

    useEffect(() => {
        return () => {
            debouncedSearch.cancel();
        };
    }, [debouncedSearch]);

    const fetchDocumentDetail = async (documentName: string) => {
        try {
            setLoading(true);
            setSearchQuery('');
            setSearchMatches([]);
            setActiveMatchIndex(-1);
            setIsSearchActive(false);
            const detail = await api.getDocumentDetail(documentName);
            setDocumentDetail(detail);
            generateToc(detail);
            const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            setIsFavorite(favorites.includes(documentName));
        } catch (error) {
            console.error('Failed to fetch document detail:', error);
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    };

    const fetchComments = async (documentName: string) => {
        try {
            setCommentsLoading(true);
            const response = await api.getComments(documentName);
            setComments(response.comments);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        } finally {
            setCommentsLoading(false);
        }
    };

    const generateToc = (detail: DocumentDetailResponse) => {
        const newToc: TableOfContentsItem[] = [];
        const idCounter = { value: 0 };

        detail.all_chunks.forEach((chunk, index) => {
            const content = chunk.content;
            const lines = content.split('\n');
            
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('### ')) {
                    newToc.push({
                        id: `toc-${idCounter.value++}`,
                        label: trimmedLine.replace(/^###\s*/, ''),
                        level: 2,
                        isExpanded: false
                    });
                } else if (trimmedLine.startsWith('## ')) {
                    newToc.push({
                        id: `toc-${idCounter.value++}`,
                        label: trimmedLine.replace(/^##\s*/, ''),
                        level: 1,
                        isExpanded: index === 0
                    });
                } else if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('##')) {
                    newToc.push({
                        id: `toc-${idCounter.value++}`,
                        label: trimmedLine.replace(/^#\s*/, ''),
                        level: 1,
                        isExpanded: index === 0
                    });
                }
            });
        });

        const groupedToc: TableOfContentsItem[] = [];
        let currentChapter: TableOfContentsItem | null = null;
        
        newToc.forEach(item => {
            if (item.level === 1) {
                currentChapter = { ...item, children: [] };
                groupedToc.push(currentChapter);
            } else if (item.level === 2 && currentChapter) {
                currentChapter.children?.push(item);
            }
        });

        setToc(groupedToc.length > 0 ? groupedToc : generateSimpleToc(detail));
    };

    const generateSimpleToc = (detail: DocumentDetailResponse): TableOfContentsItem[] => {
        const toc: TableOfContentsItem[] = [];
        detail.all_chunks.forEach((chunk, index) => {
            const page = chunk.page;
            const chunkNum = index + 1;
            toc.push({
                id: `toc-${chunkNum}`,
                label: `第 ${page} 页 - Chunk ${chunkNum}`,
                level: 1,
                isExpanded: index === 0
            });
        });
        return toc;
    };

    const toggleTocItem = (id: string) => {
        setToc(prev => prev.map(item => 
            item.id === id 
                ? { ...item, isExpanded: !item.isExpanded }
                : { ...item, children: item.children ? item.children.map(child => 
                    child.id === id ? { ...child, isExpanded: !child.isExpanded } : child
                ) : undefined }
        ));
    };

    const toggleFavorite = () => {
        const newFavorite = !isFavorite;
        setIsFavorite(newFavorite);
        
        if (document?.name) {
            const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            if (newFavorite) {
                if (!favorites.includes(document.name)) {
                    favorites.push(document.name);
                }
            } else {
                const index = favorites.indexOf(document.name);
                if (index > -1) {
                    favorites.splice(index, 1);
                }
            }
            localStorage.setItem('favorites', JSON.stringify(favorites));
            
            showToast('success', newFavorite ? '收藏成功' : '取消收藏', newFavorite ? `已收藏文档「${document.name}」` : `已取消收藏文档「${document.name}」`);
        }
    };

    const handlePrint = () => {
        if (!contentRef.current) return;
        
        const printContent = contentRef.current.cloneNode(true) as HTMLElement;
        printContent.style.maxHeight = 'none';
        printContent.style.overflow = 'visible';
        printContent.style.backgroundColor = 'white';
        printContent.style.width = '100%';
        printContent.style.padding = '20mm';
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast('error', '打印失败', '请允许弹窗权限');
            return;
        }
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${document?.name || '文档打印'}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
                    h1 { font-size: 18px; margin-bottom: 16px; color: #1a1a1a; }
                    h2 { font-size: 16px; margin-top: 20px; margin-bottom: 12px; color: #333; }
                    h3 { font-size: 14px; margin-top: 16px; margin-bottom: 8px; color: #444; }
                    p { font-size: 13px; line-height: 1.8; color: #666; margin-bottom: 10px; }
                    ul, ol { font-size: 13px; line-height: 1.8; color: #666; padding-left: 20px; margin-bottom: 10px; }
                    li { margin-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
                    th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
                    th { background-color: #f5f5f5; font-weight: 600; }
                    .chunk-header { font-size: 11px; color: #999; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #eee; }
                    @media print {
                        body { padding: 0; }
                        @page { margin: 20mm; }
                    }
                </style>
            </head>
            <body>
                <h1>${document?.name || '文档'}</h1>
                <div style="font-size: 12px; color: #999; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    ${document?.type || '未知格式'} · ${document?.pages || 0} 页 · ${documentDetail?.chunks || 0} 个章节
                </div>
        `);
        
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    const handlePreview = () => {
        if (!contentRef.current) return;
        
        const previewContent = contentRef.current.cloneNode(true) as HTMLElement;
        previewContent.style.maxHeight = 'none';
        previewContent.style.overflow = 'visible';
        previewContent.style.backgroundColor = 'white';
        previewContent.style.width = '100%';
        previewContent.style.padding = '24px';
        
        const previewWindow = window.open('', '_blank');
        if (!previewWindow) {
            showToast('error', '预览失败', '请允许弹窗权限');
            return;
        }
        
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${document?.name || '文档预览'}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 60px; background-color: #f5f5f5; }
                    .preview-container { max-width: 800px; margin: 0 auto; background-color: white; padding: 40px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
                    h1 { font-size: 22px; margin-bottom: 20px; color: #1a1a1a; border-bottom: 2px solid #007bff; padding-bottom: 12px; }
                    h2 { font-size: 18px; margin-top: 28px; margin-bottom: 14px; color: #333; }
                    h3 { font-size: 16px; margin-top: 20px; margin-bottom: 10px; color: #444; }
                    p { font-size: 14px; line-height: 2; color: #555; margin-bottom: 14px; text-align: justify; }
                    ul, ol { font-size: 14px; line-height: 2; color: #555; padding-left: 24px; margin-bottom: 14px; }
                    li { margin-bottom: 6px; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
                    th { background-color: #f8f9fa; font-weight: 600; color: #333; }
                    .chunk-header { font-size: 12px; color: #888; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #ddd; }
                    .header-bar { position: fixed; top: 0; left: 0; right: 0; background: white; padding: 12px 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); z-index: 100; display: flex; justify-content: space-between; align-items: center; }
                    .header-bar button { padding: 6px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
                    .header-bar button:hover { background: #0069d9; }
                    .content-area { margin-top: 60px; }
                </style>
            </head>
            <body>
                <div class="header-bar">
                    <span style="font-weight: 600; color: #333;">${document?.name || '文档预览'}</span>
                    <button onclick="window.print()">打印文档</button>
                </div>
                <div class="preview-container">
                    <div style="font-size: 13px; color: #888; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
                        ${document?.type || '未知格式'} · ${document?.pages || 0} 页 · ${documentDetail?.chunks || 0} 个章节 · 更新于 ${document?.updateTime || '未知'}
                    </div>
        `);
        
        previewWindow.document.write(previewContent.innerHTML);
        previewWindow.document.write('</div></body></html>');
        previewWindow.document.close();
    };

    const handleDelete = async () => {
        if (!document?.name) return;
        
        setDeleteLoading(true);
        try {
            await api.deleteDocument(document.name);
            showToast('success', '删除成功', `文档「${document.name}」已删除`);
            setShowDeleteModal(false);
            onNavigate('documents');
        } catch (error: any) {
            showToast('error', '删除失败', error?.message || '删除文档时发生错误');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleReview = async () => {
        if (!document?.name) return;
        
        setReviewLoading(true);
        try {
            const response = await api.reviewDocument(document.name, reviewAction, reviewComment);
            showToast('success', reviewAction === 'approve' ? '审批通过' : '审批驳回', response.message);
            setShowReviewModal(false);
            setReviewComment('');
            
            if (document) {
                fetchDocumentDetail(document.name);
                onNavigate('document-detail', { ...document, status: response.status as DocumentStatus });
            }
        } catch (error: any) {
            showToast('error', '审批失败', error?.message || '审批时发生错误');
        } finally {
            setReviewLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!document?.name || !newComment.trim()) return;
        
        try {
            await api.addComment(document.name, newComment.trim());
            showToast('success', '评论成功', '评论已添加');
            setNewComment('');
            await fetchComments(document.name);
        } catch (error: any) {
            showToast('error', '评论失败', error?.message || '添加评论时发生错误');
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!document?.name) return;
        
        try {
            await api.deleteComment(document.name, commentId);
            showToast('success', '删除成功', '评论已删除');
            await fetchComments(document.name);
        } catch (error: any) {
            showToast('error', '删除失败', error?.message || '删除评论时发生错误');
        }
    };

    const renderToc = (items: TableOfContentsItem[]) => {
        return items.map(item => (
            <div key={item.id}>
                <button 
                    onClick={() => toggleTocItem(item.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]"
                    style={{ 
                        paddingLeft: `${(item.level - 1) * 12 + 8}px`,
                        color: 'var(--color-text-secondary)',
                        fontSize: '13px',
                    }}
                >
                    {item.children && (
                        item.isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                            <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                        )
                    )}
                    <span className="truncate">{item.label}</span>
                </button>
                {item.children && item.isExpanded && renderToc(item.children)}
            </div>
        ));
    };

    const highlightText = (
        text: string, 
        query: string, 
        chunkIndex: number,
        chunkMatchIndices: number[],
        localMatchCount: { count: number }
    ): React.ReactNode => {
        if (!query || !isSearchActive) return text;

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const parts: React.ReactNode[] = [];
        let searchIndex = 0;
        let lastIdx = 0;

        while (searchIndex < lowerText.length) {
            const found = lowerText.indexOf(lowerQuery, searchIndex);
            if (found === -1) break;

            if (found > lastIdx) {
                parts.push(text.slice(lastIdx, found));
            }

            const globalMatchIdx = chunkMatchIndices[localMatchCount.count];
            const isActiveMatch = globalMatchIdx === activeMatchIndex;
            
            if (isActiveMatch) {
                parts.push(
                    <mark 
                        key={`hl-${chunkIndex}-${found}-${localMatchCount.count}`}
                        style={{ backgroundColor: '#FEF08A', color: '#92400E', padding: '1px 2px', borderRadius: '2px', boxShadow: '0 0 0 2px #F59E0B', fontWeight: 600 }}
                    >
                        {text.slice(found, found + query.length)}
                    </mark>
                );
            } else {
                parts.push(
                    <mark 
                        key={`hl-${chunkIndex}-${found}-${localMatchCount.count}`}
                        style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '1px 2px', borderRadius: '2px' }}
                    >
                        {text.slice(found, found + query.length)}
                    </mark>
                );
            }

            localMatchCount.count++;
            lastIdx = found + query.length;
            searchIndex = lastIdx;
        }

        if (lastIdx < text.length) {
            parts.push(text.slice(lastIdx));
        }

        return <>{parts}</>;
    };

    const renderContent = () => {
        if (!documentDetail) return null;

        const query = searchQuery.trim().toLowerCase();
        const chunkMatchMap: Record<number, number[]> = {};
        searchMatches.forEach((m, idx) => {
            if (!chunkMatchMap[m.chunkIndex]) chunkMatchMap[m.chunkIndex] = [];
            chunkMatchMap[m.chunkIndex].push(idx);
        });

        return documentDetail.all_chunks.map((chunk, index) => {
            const content = chunk.content;
            const lines = content.split('\n');
            const elements: React.ReactNode[] = [];
            let inCodeBlock = false;
            let codeBlockContent = '';
            let codeLanguage = '';
            const chunkMatches = chunkMatchMap[index] || [];
            const isActiveChunk = chunkMatches.some(mi => mi === activeMatchIndex);
            const localMatchCount = { count: 0 };

            const formatInlineCode = (text: string): React.ReactNode => {
                const codeRegex = /`([^`]+)`/g;
                const parts: React.ReactNode[] = [];
                let lastIndex = 0;
                let match;
                while ((match = codeRegex.exec(text)) !== null) {
                    if (match.index > lastIndex) {
                        parts.push(text.slice(lastIndex, match.index));
                    }
                    parts.push(
                        <code key={`code-${match.index}`} style={{ backgroundColor: '#f0f0f0', color: '#d04848', padding: '0 4px', borderRadius: '2px', fontFamily: 'Consolas, Monaco, monospace' }}>
                            {match[1]}
                        </code>
                    );
                    lastIndex = match.index + match[0].length;
                }
                if (lastIndex < text.length) {
                    parts.push(text.slice(lastIndex));
                }
                return <>{parts}</>;
            };

            lines.forEach((line, lineIndex) => {
                const trimmedLine = line.trim();
                
                if (trimmedLine.startsWith('```')) {
                    if (inCodeBlock) {
                        elements.push(
                            <pre key={`code-${index}-${lineIndex}`} className="mb-4 p-4 text-sm overflow-x-auto rounded" style={{ backgroundColor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'Consolas, Monaco, monospace' }}>
                                <code>{codeBlockContent}</code>
                            </pre>
                        );
                        inCodeBlock = false;
                        codeBlockContent = '';
                        codeLanguage = '';
                    } else {
                        inCodeBlock = true;
                        codeLanguage = trimmedLine.slice(3).trim();
                        codeBlockContent = '';
                    }
                    return;
                }

                if (inCodeBlock) {
                    codeBlockContent += (codeBlockContent ? '\n' : '') + line;
                    return;
                }

                if (trimmedLine.startsWith('### ')) {
                    const text = trimmedLine.replace(/^###\s*/, '');
                    elements.push(<h3 key={lineIndex} className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--color-text-primary)' }}>
                        {query && isSearchActive ? highlightText(text, query, index, chunkMatches, localMatchCount) : text}
                    </h3>);
                } else if (trimmedLine.startsWith('## ')) {
                    const text = trimmedLine.replace(/^##\s*/, '');
                    elements.push(<h2 key={lineIndex} className="text-xl font-semibold mt-8 mb-4" style={{ color: 'var(--color-text-primary)' }}>
                        {query && isSearchActive ? highlightText(text, query, index, chunkMatches, localMatchCount) : text}
                    </h2>);
                } else if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('##')) {
                    const text = trimmedLine.replace(/^#\s*/, '');
                    elements.push(<h1 key={lineIndex} className="text-2xl font-bold mt-10 mb-6" style={{ color: 'var(--color-text-primary)' }}>
                        {query && isSearchActive ? highlightText(text, query, index, chunkMatches, localMatchCount) : text}
                    </h1>);
                } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                    const text = trimmedLine.replace(/^[-*]\s*/, '');
                    elements.push(<li key={lineIndex} className="ml-4 mb-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {query && isSearchActive ? highlightText(text, query, index, chunkMatches, localMatchCount) : text}
                    </li>);
                } else if (trimmedLine.startsWith('1. ') || trimmedLine.startsWith('2. ') || trimmedLine.startsWith('3. ') || /^\d+\./.test(trimmedLine)) {
                    elements.push(<li key={lineIndex} className="ml-4 mb-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {query && isSearchActive ? highlightText(trimmedLine, query, index, chunkMatches, localMatchCount) : trimmedLine}
                    </li>);
                } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                    const text = trimmedLine.replace(/^\*\*|\*\*$/g, '');
                    elements.push(<p key={lineIndex} className="font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                        {query && isSearchActive ? highlightText(text, query, index, chunkMatches, localMatchCount) : text}
                    </p>);
                } else if (trimmedLine.startsWith('`') && trimmedLine.endsWith('`')) {
                    const text = trimmedLine.replace(/^`|`$/g, '');
                    elements.push(<code key={lineIndex} className="px-1.5 py-0.5 text-sm rounded" style={{ backgroundColor: '#f0f0f0', color: '#d04848', fontFamily: 'Consolas, Monaco, monospace' }}>
                        {query && isSearchActive ? highlightText(text, query, index, chunkMatches, localMatchCount) : text}
                    </code>);
                } else if (trimmedLine) {
                    if (query && isSearchActive) {
                        const renderedLine = highlightText(trimmedLine, query, index, chunkMatches, localMatchCount);
                        elements.push(<p key={lineIndex} className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{renderedLine}</p>);
                    } else {
                        elements.push(<p key={lineIndex} className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{formatInlineCode(trimmedLine)}</p>);
                    }
                } else {
                    elements.push(<br key={lineIndex} />);
                }
            });

            return (
                <div 
                    key={chunk.chunk_id || index} 
                    data-chunk-id={index}
                    className={`mb-8 transition-all duration-200 ${isActiveChunk && isSearchActive ? 'ring-2 ring-yellow-400 ring-opacity-50 rounded-lg p-2 -m-2' : ''}`}
                    style={{ scrollMarginTop: '80px' }}
                >
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                            <span>第 {chunk.page} 页</span>
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>Chunk {index + 1}</span>
                        {chunkMatches.length > 0 && (
                            <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                {chunkMatches.length} 处匹配
                            </span>
                        )}
                    </div>
                    <div className="prose prose-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {elements}
                    </div>
                </div>
            );
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case '已发布': return { bg: '#10B981', text: '#FFFFFF' };
            case '待审核': return { bg: '#F59E0B', text: '#FFFFFF' };
            case '草稿': return { bg: '#6B7280', text: '#FFFFFF' };
            case '审核驳回': return { bg: '#EF4444', text: '#FFFFFF' };
            case '已删除': return { bg: '#9CA3AF', text: '#FFFFFF' };
            default: return { bg: '#3B82F6', text: '#FFFFFF' };
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <header className="h-[56px] shrink-0 flex items-center justify-between px-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-4 min-w-0">
                        <button 
                            onClick={() => onNavigate('documents')}
                            className="flex items-center justify-center w-9 h-9 shrink-0 transition-colors duration-150" style={{ color: 'var(--color-text-secondary)' }}
                        >
                            <ArrowLeft className="w-[18px] h-[18px]" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>文档详情</h1>
                            <p className="text-[11px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>加载中...</p>
                        </div>
                    </div>
                </header>
                <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <BlockLoading text="加载文档详情..." />
                </div>
            </div>
        );
    }

    return (
        <>
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
            <header className="h-[56px] shrink-0 flex items-center justify-between px-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-4 min-w-0">
                    <button 
                        onClick={() => onNavigate('documents')}
                        className="flex items-center justify-center w-9 h-9 shrink-0 transition-colors duration-150" style={{ color: 'var(--color-text-secondary)' }}
                    >
                        <ArrowLeft className="w-[18px] h-[18px]" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>文档详情</h1>
                        <p className="text-[11px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>查看文档内容与详细信息</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <button 
                        onClick={handlePreview}
                        className="flex items-center justify-center w-9 h-9 transition-colors duration-150 hover:bg-gray-100 rounded" style={{ color: 'var(--color-text-secondary)' }}
                        title="预览文档"
                    >
                        <Eye className="w-[18px] h-[18px]" />
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center justify-center w-9 h-9 transition-colors duration-150 hover:bg-gray-100 rounded" style={{ color: 'var(--color-text-secondary)' }}
                        title="打印文档"
                    >
                        <Printer className="w-[18px] h-[18px]" />
                    </button>
                    {/* <button className="flex items-center justify-center w-9 h-9 transition-colors duration-150" style={{ color: 'var(--color-text-secondary)' }}>
                        <History className="w-[18px] h-[18px]" />
                    </button> */}
                    <button className="flex items-center gap-2 pl-3 transition-colors duration-150" style={{ borderLeft: '1px solid var(--color-border)' }}>
                        <div className="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                            <span>{document?.name?.charAt(0) || '文'}</span>
                        </div>
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="shrink-0 overflow-y-auto scrollbar-thin" style={{ width: '260px', borderRight: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: 'var(--tag-tech)', color: 'var(--tag-tech-text)' }}>
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{document?.name || '文档详情'}</h2>
                                <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{document?.type || '未知'} · {document?.pages || 0} 页</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {document?.category && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: 'var(--tag-hr)', color: 'var(--tag-hr-text)' }}>
                                    <Tag className="w-3 h-3" />
                                    <span>{document.category}</span>
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: 'var(--tag-general)', color: 'var(--tag-general-text)' }}>
                                <Tag className="w-3 h-3" />
                                <span>{document?.type || '文档'}</span>
                            </span>
                            {document?.status && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: getStatusColor(document.status).bg, color: getStatusColor(document.status).text }}>
                                    <span>{document.status}</span>
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                                <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>创建时间：{formatDateTime(documentDetail?.createTime || document?.createTime) || '未知'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                                <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>更新时间：{formatDateTime(documentDetail?.updateTime || document?.updateTime) || '未知'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <UserIcon className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                                <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>作者：{documentDetail?.author || document?.author || '系统'}</span>
                            </div>
                            {(documentDetail?.status === '审核驳回' || document?.status === '审核驳回') && (documentDetail?.review_comment || document?.review_comment) && (
                                <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#FEF2F2', borderLeft: '3px solid #EF4444' }}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertCircle className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                                        <span className="text-[11px] font-medium" style={{ color: '#EF4444' }}>驳回意见</span>
                                    </div>
                                    <p className="text-[12px]" style={{ color: '#DC2626', lineHeight: '1.5' }}>
                                        {documentDetail?.review_comment || document?.review_comment}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 mb-4">
                            {hasPermission('doc_download') && (
                                <button 
                                    onClick={() => {
                                        if (document?.name) {
                                            api.downloadDocument(document.name)
                                                .then(blob => {
                                                    const downloadUrl = window.URL.createObjectURL(blob);
                                                    const a = window.document.createElement('a');
                                                    a.href = downloadUrl;
                                                    a.download = document.name;
                                                    window.document.body.appendChild(a);
                                                    a.click();
                                                    window.document.body.removeChild(a);
                                                    window.URL.revokeObjectURL(downloadUrl);
                                                    showToast('success', '下载成功', `文档「${document.name}」已开始下载`);
                                                })
                                                .catch(error => {
                                                    showToast('error', '下载失败', error.message);
                                                });
                                        }
                                    }}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>下载</span>
                                </button>
                            )}
                            {hasPermission('doc_view') && (
                                <button 
                                    onClick={() => {
                                        if (document?.name) {
                                            api.shareDocument(document.name)
                                                .then(data => {
                                                    navigator.clipboard.writeText(data.share_link)
                                                        .then(() => {
                                                            showToast('success', '分享成功', '分享链接已复制到剪贴板');
                                                        })
                                                        .catch(() => {
                                                            showToast('success', '分享成功', `分享链接: ${data.share_link}`);
                                                        });
                                                })
                                                .catch(error => {
                                                    showToast('error', '分享失败', error.message);
                                                });
                                        }
                                    }}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>分享</span>
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2 mb-4">
                            {/* <button className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>编辑</span>
                            </button> */}
                            {hasPermission('doc_delete') && (
                                <button 
                                    onClick={() => setShowDeleteModal(true)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-red-50" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: '#EF4444', border: '1px solid var(--color-border-light)' }}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>删除</span>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between mb-4 p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                            <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>收藏文档</span>
                            <button 
                                onClick={toggleFavorite}
                                className="w-5 h-5 flex items-center justify-center transition-colors duration-150"
                                style={{ color: isFavorite ? '#F59E0B' : 'var(--color-text-tertiary)' }}
                            >
                                <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                            </button>
                        </div>

                        <div className="flex gap-2 mb-6">
                            {hasPermission('doc_comment') && (
                                <button 
                                    onClick={() => setShowCommentPanel(!showCommentPanel)}
                                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors duration-150 ${showCommentPanel ? 'bg-primary text-white' : ''}`} style={{ backgroundColor: showCommentPanel ? 'var(--color-primary)' : 'var(--color-bg-tertiary)', color: showCommentPanel ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>评论</span>
                                    {comments.length > 0 && (
                                        <span className="px-1.5 py-0.5 text-[10px] rounded-full" style={{ backgroundColor: showCommentPanel ? 'rgba(255,255,255,0.2)' : 'var(--color-primary)', color: showCommentPanel ? 'white' : 'white' }}>
                                            {comments.length}
                                        </span>
                                    )}
                                </button>
                            )}
                            {hasPermission('doc_review') && document?.status === '待审核' && (
                                <button 
                                    onClick={() => setShowReviewModal(true)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                                    <FileCheck className="w-3.5 h-3.5" />
                                    <span>审批</span>
                                </button>
                            )}
                        </div>

                        {showCommentPanel && (
                            <div className="mb-6 p-3" style={{ backgroundColor: 'var(--color-bg)' }}>
                                <div className="flex flex-col gap-3">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="输入评论内容..."
                                        className="w-full px-3 py-2 text-sm resize-none"
                                        style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', outline: 'none', borderRadius: '4px', minHeight: '60px' }}
                                        rows={3}
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleAddComment}
                                            disabled={!newComment.trim()}
                                            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}>
                                            <Send className="w-3.5 h-3.5" />
                                            <span>提交评论</span>
                                        </button>
                                    </div>
                                </div>
                                
                                {commentsLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Spinner size="sm" />
                                    </div>
                                ) : comments.length > 0 ? (
                                    <div className="mt-4 space-y-3">
                                        {comments.map(comment => (
                                            <div key={comment.id} className="p-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[12px] font-medium" style={{ color: 'var(--color-primary)' }}>{comment.username}</span>
                                                    <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{formatDateTime(comment.created_at)}</span>
                                                </div>
                                                <p className="text-[12px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>{comment.content}</p>
                                                <button
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                    className="text-[11px]" style={{ color: '#EF4444' }}>
                                                    删除
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-4 text-center py-4">
                                        <p className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>暂无评论</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>目录</h3>
                            <div className="space-y-1" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {toc.length > 0 ? (
                                    renderToc(toc)
                                ) : (
                                    <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-tertiary)' }}>暂无目录</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-4 px-6 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        <div className="relative flex-1 min-w-0" style={{ maxWidth: '420px' }}>
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }} />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    debouncedSearch(e.target.value);
                                }}
                                placeholder="在文档中搜索（按 Enter 搜索，Esc 清除）..." 
                                className="w-full pl-9 pr-9 h-9 text-sm" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', outline: 'none', transition: 'border-color var(--transition-fast)' }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                                onKeyDown={handleKeyDown}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSearchMatches([]);
                                        setActiveMatchIndex(-1);
                                        setIsSearchActive(false);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                    title="清除搜索"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {isSearchActive && searchMatches.length > 0 ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium" style={{ color: '#92400E' }}>
                                    {activeMatchIndex + 1} / {searchMatches.length}
                                </span>
                                <button
                                    onClick={() => navigateMatch('up')}
                                    className="flex items-center justify-center w-7 h-7 rounded transition-colors"
                                    style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                                    title="上一个匹配"
                                >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => navigateMatch('down')}
                                    className="flex items-center justify-center w-7 h-7 rounded transition-colors"
                                    style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                                    title="下一个匹配"
                                >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : searchQuery && !isSearchActive ? (
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                未找到匹配
                            </span>
                        ) : (
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                {documentDetail?.chunks || 0} 个章节
                            </span>
                        )}
                    </div>

                    <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-6" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                        {documentDetail ? (
                            renderContent()
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full">
                                <AlertCircle className="w-12 h-12 mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>文档内容加载失败</p>
                                <button 
                                    onClick={() => document?.name && fetchDocumentDetail(document.name)}
                                    className="mt-4 text-sm" style={{ color: 'var(--color-primary)' }}
                                >
                                    重试加载
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="shrink-0 overflow-y-auto scrollbar-thin" style={{ width: '280px', borderLeft: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
                    <div className="p-4">
                        <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>相关文档</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                                <div className="w-8 h-8 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--tag-tech)', color: 'var(--tag-tech-text)' }}>
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{document?.name}</p>
                                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{document?.category} · {formatDateTime(document?.updateTime)}</p>
                                </div>
                                <span className="shrink-0 px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'var(--tag-tech)', color: 'var(--tag-tech-text)' }}>高</span>
                            </div>
                        </div>

                        <div className="p-4 mt-4" style={{ backgroundColor: 'var(--color-bg)' }}>
                            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>文档信息</h3>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>文件格式</span>
                                    <span className="text-[12px]" style={{ color: 'var(--color-text-primary)' }}>{documentDetail?.type || document?.type || '未知'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>页数</span>
                                    <span className="text-[12px]" style={{ color: 'var(--color-text-primary)' }}>{documentDetail?.pages || document?.pages || 0} 页</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>Chunk数量</span>
                                    <span className="text-[12px]" style={{ color: 'var(--color-text-primary)' }}>{documentDetail?.chunks || document?.chunks || 0} 个</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>状态</span>
                                    <span className="text-[12px]" style={{ color: getStatusColor(document?.status || '已发布').bg }}>{document?.status || '已发布'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 mt-4" style={{ backgroundColor: 'var(--color-bg)' }}>
                            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>标签</h3>
                            <div className="flex flex-wrap gap-1.5">
                                {document?.category && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: 'var(--tag-hr)', color: 'var(--tag-hr-text)' }}>{document.category}</span>
                                )}
                                {document?.type && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: 'var(--tag-general)', color: 'var(--tag-general-text)' }}>{document.type}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-sm mx-4 p-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 flex items-center justify-center rounded-full" style={{ backgroundColor: '#FEF2F2' }}>
                            <AlertCircle className="w-5 h-5" style={{ color: '#EF4444' }} />
                        </div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>确认删除</h3>
                    </div>
                    <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>确定要删除文档「{document?.name}」吗？此操作无法撤销。</p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowDeleteModal(false)}
                            className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                            取消
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={deleteLoading}
                            className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors duration-150 flex items-center justify-center gap-2" style={{ backgroundColor: '#EF4444', color: 'white', opacity: deleteLoading ? 0.7 : 1, cursor: deleteLoading ? 'not-allowed' : 'pointer' }}>
                            {deleteLoading ? <Spinner size="sm" /> : null}
                            <span>{deleteLoading ? '删除中...' : '删除'}</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showReviewModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-md mx-4 p-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center rounded-full" style={{ backgroundColor: '#EFF6FF' }}>
                                <FileCheck className="w-5 h-5" style={{ color: '#3B82F6' }} />
                            </div>
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>文档审批</h3>
                        </div>
                        <button
                            onClick={() => setShowReviewModal(false)}
                            className="w-8 h-8 flex items-center justify-center transition-colors duration-150" style={{ color: 'var(--color-text-tertiary)' }}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="mb-6">
                        <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>请选择审批结果</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setReviewAction('approve')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-150 border ${reviewAction === 'approve' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                                style={{ borderRadius: '6px', color: reviewAction === 'approve' ? '#10B981' : 'var(--color-text-secondary)' }}>
                                <CheckCircle className="w-4 h-4" />
                                <span>通过</span>
                            </button>
                            <button
                                onClick={() => setReviewAction('reject')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-150 border ${reviewAction === 'reject' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                                style={{ borderRadius: '6px', color: reviewAction === 'reject' ? '#EF4444' : 'var(--color-text-secondary)' }}>
                                <XCircle className="w-4 h-4" />
                                <span>驳回</span>
                            </button>
                        </div>
                    </div>
                    
                    {reviewAction === 'reject' && (
                        <div className="mb-6">
                            <label className="text-sm mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>驳回原因（可选）</label>
                            <textarea
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="请输入驳回原因..."
                                className="w-full px-3 py-2 text-sm resize-none"
                                style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', outline: 'none', borderRadius: '4px', minHeight: '80px' }}
                                rows={3}
                            />
                        </div>
                    )}
                    
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowReviewModal(false)}
                            className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                            取消
                        </button>
                        <button
                            onClick={handleReview}
                            disabled={reviewLoading}
                            className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors duration-150 flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)', opacity: reviewLoading ? 0.7 : 1, cursor: reviewLoading ? 'not-allowed' : 'pointer' }}>
                            {reviewLoading ? <Spinner size="sm" /> : null}
                            <span>{reviewLoading ? '提交中...' : '提交审批'}</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {toastMessages.map((toast) => (
            <div 
                key={toast.id}
                className="fixed top-4 right-4 z-50 px-4 py-3 text-sm font-medium shadow-lg"
                style={{ 
                    backgroundColor: toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#3B82F6',
                    color: '#FFFFFF',
                    borderRadius: '8px'
                }}
            >
                <div className="font-semibold">{toast.title}</div>
                <div className="opacity-90 text-xs">{toast.message}</div>
            </div>
        ))}
        </>
    );
}
