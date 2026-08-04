import { useState, useEffect, useRef } from 'react';
import { FileText, FileSpreadsheet, FileCode, Archive, Image, Eye, Star, MoreHorizontal, Upload, Layers, Search, ChevronDown, ChevronLeft, ChevronRight, X, Edit3, Trash2, Download, Share2 } from 'lucide-react';
import debounce from 'lodash.debounce';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast, { ToastMessage } from '../components/Toast';
import { Spinner, BlockLoading } from '../components/loading';
import { api } from '../utils/api';
import { Document, StatsResponse, User, DocumentListResponse } from '../types';

const DOCUMENT_TYPES = ['全部', 'PDF', 'Word', 'Excel', 'Markdown', 'TXT', '压缩包', '其他'];
const CATEGORIES = ['全部', '技术', '人力资源', '财务', '法务', '市场', '产品', '其他'];
const STATUS_OPTIONS = ['全部', '草稿', '待审核', '已发布', '审核驳回', '已删除'];
const SORT_OPTIONS = [
    { label: '名称升序', value: 'name', order: 'asc' },
    { label: '名称降序', value: 'name', order: 'desc' },
    { label: '页数升序', value: 'pages', order: 'asc' },
    { label: '页数降序', value: 'pages', order: 'desc' },
];

const iconMap = {
    'file-text': FileText,
    'file-spreadsheet': FileSpreadsheet,
    'file-code': FileCode,
    'archive': Archive,
    'image': Image,
};

const formatDateTime = (dateTime: string): string => {
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
        return dateTime;
    }
};

const getIconForType = (type: string): 'file-text' | 'file-spreadsheet' | 'file-code' | 'archive' | 'image' => {
    if (type === 'Excel' || type === 'CSV' || type === 'ODS') return 'file-spreadsheet';
    if (type === 'Markdown' || type === 'TXT' || type === 'JSON' || type === 'XML' || type === 'HTML' || type === 'ODT') return 'file-code';
    if (type === 'PPT') return 'file-code';
    if (type === 'JPG' || type === 'PNG' || type === 'GIF' || type === 'BMP') return 'image';
    if (type === '压缩包') return 'archive';
    return 'file-text';
};

const categoryColors = {
    '技术': { bg: 'bg-tag-tech', text: 'text-tag-tech-text' },
    '人力资源': { bg: 'bg-tag-hr', text: 'text-tag-hr-text' },
    '财务': { bg: 'bg-tag-finance', text: 'text-tag-finance-text' },
    '法务': { bg: 'bg-tag-legal', text: 'text-tag-legal-text' },
    '市场': { bg: 'bg-tag-general', text: 'text-tag-general-text' },
    '产品': { bg: 'bg-tag-general', text: 'text-tag-general-text' },
    '其他': { bg: 'bg-bg-tertiary', text: 'text-text-secondary' },
};

const statusColors: Record<string, { bg: string; text: string }> = {
    '草稿': { bg: 'bg-tag-general', text: 'text-tag-general-text' },
    '待审核': { bg: 'bg-tag-hr', text: 'text-tag-hr-text' },
    '已发布': { bg: 'bg-tag-finance', text: 'text-tag-finance-text' },
    '审核驳回': { bg: 'bg-state-error', text: 'text-white' },
    '已删除': { bg: 'bg-bg-tertiary', text: 'text-text-tertiary' },
};

const typeColors = {
    'PDF': { bg: 'bg-tag-general', text: 'text-tag-general-text' },
    'Word': { bg: 'bg-tag-tech', text: 'text-tag-tech-text' },
    'Excel': { bg: 'bg-state-success', text: 'text-white' },
    'Markdown': { bg: 'bg-bg-tertiary', text: 'text-text-secondary' },
    'TXT': { bg: 'bg-bg-tertiary', text: 'text-text-secondary' },
    '压缩包': { bg: 'bg-bg-tertiary', text: 'text-text-secondary' },
    '其他': { bg: 'bg-bg-tertiary', text: 'text-text-secondary' },
};

interface DocumentLibraryProps {
    onNavigate: (page: string, document?: Document) => void;
    user?: User | null;
}

export default function DocumentLibrary({ onNavigate, user }: DocumentLibraryProps) {
    const hasPermission = (perm: string): boolean => {
        return user?.permissions?.includes(perm) || false;
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [documentCount, setDocumentCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<StatsResponse>({
        total_documents: 0,
        published_documents: 0,
        total_chunks: 0,
        total_pages: 0,
        pending_review: 0,
        favorites: 0,
        this_week_new: 0
    });

    const [selectedType, setSelectedType] = useState('全部');
    const [selectedCategory, setSelectedCategory] = useState('全部');
    const [selectedStatus, setSelectedStatus] = useState('全部');
    const [selectedSort, setSelectedSort] = useState('名称升序');
    const [sortOrder, setSortOrder] = useState('asc');

    const [openTypeDropdown, setOpenTypeDropdown] = useState(false);
    const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false);
    const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
    const [openSortDropdown, setOpenSortDropdown] = useState(false);

    const [openMoreMenu, setOpenMoreMenu] = useState<string | null>(null);
    const [moreMenuPosition, setMoreMenuPosition] = useState({ x: 0, y: 0 });
    const moreMenuRef = useRef<HTMLDivElement>(null);

    const [openCategoryEditMenu, setOpenCategoryEditMenu] = useState<string | null>(null);
    const [categoryMenuPosition, setCategoryMenuPosition] = useState({ x: 0, y: 0 });
    const categoryMenuRef = useRef<HTMLDivElement>(null);
    const [categoryLoading, setCategoryLoading] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        type: 'delete' | 'confirm' | 'warning';
        title: string;
        showInput?: boolean;
        inputPlaceholder?: string;
        message: string;
        warningText?: string;
        confirmText?: string;
        onConfirm: (inputValue?: string) => void;
        isLoading?: boolean;
    }>({
        isOpen: false,
        type: 'confirm',
        title: '',
        message: '',
        onConfirm: () => {},
        isLoading: false,
    });

    const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.filter-dropdown-container')) {
                setOpenTypeDropdown(false);
                setOpenCategoryDropdown(false);
                setOpenStatusDropdown(false);
                setOpenSortDropdown(false);
            }
            if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
                setOpenMoreMenu(null);
            }
            if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
                setOpenCategoryEditMenu(null);
            }
        };
        
        const handleScroll = () => {
            setOpenMoreMenu(null);
            setOpenCategoryEditMenu(null);
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('scroll', handleScroll, true);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const sortOption = SORT_OPTIONS.find(opt => opt.label === selectedSort) || SORT_OPTIONS[0];    
            const filter: Record<string, string | number> = {};
            if (selectedType !== '全部') filter.type = selectedType;
            if (selectedCategory !== '全部') filter.category = selectedCategory;
            if (selectedStatus !== '全部') filter.status = selectedStatus;
            if (searchQuery) filter.search = searchQuery;
            filter.sort_by = sortOption.value;
            filter.sort_order = sortOption.order;
            filter.page = currentPage;
            filter.page_size = pageSize;
            
            const [docResponse, statsData] = await Promise.all([
                api.getDocuments(filter),
                api.getStats()
            ]);
            
            const docs: Document[] = docResponse.documents || [];
            const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            const docsWithFavorites = docs.map(doc => ({
                ...doc,
                isFavorite: favorites.includes(doc.name)
            }));
            
            const favoriteCount = docsWithFavorites.filter(doc => doc.isFavorite).length;
            
            setDocuments(docsWithFavorites);
            setDocumentCount(docResponse.total || 0);
            setTotalPages(docResponse.total_pages || 0);
            setStats({
                ...statsData,
                favorites: favoriteCount
            });
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setDocuments([]);
            setDocumentCount(0);
            setTotalPages(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAllData();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, selectedType, selectedCategory, selectedStatus, selectedSort, currentPage, pageSize]);

    const toggleDocumentSelect = (id: string) => {
        setSelectedDocuments(prev => 
            prev.includes(id) ? prev.filter(docId => docId !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedDocuments.length === documents.length) {
            setSelectedDocuments([]);
        } else {
            setSelectedDocuments(documents.map(doc => doc.id));
        }
    };

    const toggleFavorite = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        
        let updatedFavorites: string[] = [];
        let targetDocName = '';
        let isAddingFavorite = false;
        
        setDocuments(prev => {
            const updatedDocs = prev.map(doc => {
                if (doc.id === id) {
                    const newFavorite = !doc.isFavorite;
                    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                    updatedFavorites = newFavorite 
                        ? [...favorites, doc.name] 
                        : favorites.filter((name: string) => name !== doc.name);
                    targetDocName = doc.name;
                    isAddingFavorite = newFavorite;
                    return { ...doc, isFavorite: newFavorite };
                }
                return doc;
            });
            localStorage.setItem('favorites', JSON.stringify(updatedFavorites));
            return updatedDocs;
        });
        
        const statsData = await api.getStats();
        setStats({
            ...statsData,
            favorites: updatedFavorites.length
        });
        
        showToast('success', isAddingFavorite ? '收藏成功' : '取消收藏', isAddingFavorite ? `文档「${targetDocName}」已添加到收藏` : '已取消收藏');
    };

    const showToast = (type: 'success' | 'error' | 'info', title: string, message: string, action?: ToastMessage['action']) => {
        const id = Date.now().toString();
        setToastMessages(prev => [...prev, { id, type, title, message, action }]);
    };

    const removeToast = (id: string) => {
        setToastMessages(prev => prev.filter(t => t.id !== id));
    };

    const handleView = (doc: Document) => {
        setSelectedDocument(doc);
        onNavigate('document-detail', doc);
    };

    const handleMoreClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (openMoreMenu === id) {
            setOpenMoreMenu(null);
        } else {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            setMoreMenuPosition({ x: rect.right - 160, y: rect.bottom + 4 });
            setOpenMoreMenu(id);
        }
    };

    const handleEdit = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        setOpenMoreMenu(null);
        showToast('info', '编辑文档', `文档「${doc.name}」编辑功能开发中`);
    };

    const handleCategoryClick = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setCategoryMenuPosition({ x: rect.left, y: rect.bottom + 4 });
        setOpenCategoryEditMenu(doc.id);
    };

    const handleCategoryChange = async (doc: Document, newCategory: string) => {
        if (doc.category === newCategory) {
            setOpenCategoryEditMenu(null);
            return;
        }

        if (categoryLoading === doc.id) {
            return;
        }

        setCategoryLoading(doc.id);
        try {
            await api.updateDocumentCategory(doc.name, newCategory);
            setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, category: newCategory } : d));
            setOpenCategoryEditMenu(null);
            showToast('success', '分类修改成功', `文档「${doc.name}」已归类到「${newCategory}」`);
        } catch (error) {
            showToast('error', '分类修改失败', '修改文档分类时发生错误，请重试');
        } finally {
            setCategoryLoading(null);
        }
    };

    const handleDownload = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        setOpenMoreMenu(null);
        
        api.downloadDocument(doc.name)
            .then(blob => {
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = doc.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(downloadUrl);
                showToast('success', '下载成功', `文档「${doc.name}」已开始下载`);
            })
            .catch(error => {
                showToast('error', '下载失败', error.message);
            });
    };

    const handleShare = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        setOpenMoreMenu(null);
        
        api.shareDocument(doc.name)
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
    };

    const handleSubmitForReview = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        if (actionLoading === doc.id) return;
        
        setOpenMoreMenu(null);
        setConfirmDialog({
            isOpen: true,
            type: 'confirm',
            title: '提交审核',
            message: `确定要提交文档「${doc.name}」进行审核吗？`,
            confirmText: '提交审核',
            onConfirm: async () => {
                if (actionLoading === doc.id) return;
                setActionLoading(doc.id);
                setConfirmDialog(prev => ({ ...prev, isLoading: true }));
                try {
                    await api.updateDocumentStatus(doc.name, '待审核');
                    await fetchAllData();
                    showToast('success', '提交成功', `文档「${doc.name}」已提交审核`);
                } catch (error) {
                    showToast('error', '提交失败', '提交审核时发生错误，请重试');
                } finally {
                    setActionLoading(null);
                    setConfirmDialog(prev => ({ ...prev, isLoading: false }));
                }
            },
        });
    };

    const handleApprove = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        if (actionLoading === doc.id) return;
        
        setOpenMoreMenu(null);
        setConfirmDialog({
            isOpen: true,
            type: 'confirm',
            title: '审核通过',
            message: `确定要通过文档「${doc.name}」的审核吗？`,
            confirmText: '审核通过',
            onConfirm: async () => {
                if (actionLoading === doc.id) return;
                setActionLoading(doc.id);
                setConfirmDialog(prev => ({ ...prev, isLoading: true }));
                try {
                    await api.reviewDocument(doc.name, 'approve');
                    await fetchAllData();
                    showToast('success', '审核通过', `文档「${doc.name}」已审核通过并发布`);
                } catch (error) {
                    showToast('error', '审核失败', '审核操作时发生错误，请重试');
                } finally {
                    setActionLoading(null);
                    setConfirmDialog(prev => ({ ...prev, isLoading: false }));
                }
            },
        });
    };

    const handleReject = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        if (actionLoading === doc.id) return;
        
        setOpenMoreMenu(null);
        setConfirmDialog({
            isOpen: true,
            type: 'warning',
            title: '审核驳回',
            message: `确定要驳回文档「${doc.name}」的审核吗？`,
            warningText: '文档将被标记为审核驳回状态',
            confirmText: '确认驳回',
            showInput: true,
            inputPlaceholder: '请输入驳回原因...',
            onConfirm: async (comment) => {
                if (actionLoading === doc.id) return;
                setActionLoading(doc.id);
                setConfirmDialog(prev => ({ ...prev, isLoading: true }));
                try {
                    await api.reviewDocument(doc.name, 'reject', comment);
                    await fetchAllData();
                    showToast('success', '审核驳回', `文档「${doc.name}」已被驳回`);
                } catch (error) {
                    showToast('error', '驳回失败', '驳回操作时发生错误，请重试');
                } finally {
                    setActionLoading(null);
                    setConfirmDialog(prev => ({ ...prev, isLoading: false }));
                }
            },
        });
    };

    const handlePublish = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        if (actionLoading === doc.id) return;
        
        setOpenMoreMenu(null);
        setConfirmDialog({
            isOpen: true,
            type: 'confirm',
            title: '发布文档',
            message: `确定要发布文档「${doc.name}」吗？`,
            confirmText: '确认发布',
            onConfirm: async () => {
                if (actionLoading === doc.id) return;
                setActionLoading(doc.id);
                setConfirmDialog(prev => ({ ...prev, isLoading: true }));
                try {
                    await api.updateDocumentStatus(doc.name, '已发布');
                    await fetchAllData();
                    showToast('success', '发布成功', `文档「${doc.name}」已成功发布`);
                } catch (error) {
                    showToast('error', '发布失败', '发布文档时发生错误，请重试');
                } finally {
                    setActionLoading(null);
                    setConfirmDialog(prev => ({ ...prev, isLoading: false }));
                }
            },
        });
    };

    const handleRestore = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        if (actionLoading === doc.id) return;
        
        setOpenMoreMenu(null);
        setConfirmDialog({
            isOpen: true,
            type: 'confirm',
            title: '恢复文档',
            message: `确定要恢复文档「${doc.name}」吗？`,
            confirmText: '确认恢复',
            onConfirm: async () => {
                if (actionLoading === doc.id) return;
                setActionLoading(doc.id);
                setConfirmDialog(prev => ({ ...prev, isLoading: true }));
                try {
                    await api.updateDocumentStatus(doc.name, '草稿');
                    await fetchAllData();
                    showToast('success', '恢复成功', `文档「${doc.name}」已恢复为草稿状态`);
                } catch (error) {
                    showToast('error', '恢复失败', '恢复文档时发生错误，请重试');
                } finally {
                    setActionLoading(null);
                    setConfirmDialog(prev => ({ ...prev, isLoading: false }));
                }
            },
        });
    };

    const handleDelete = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        if (actionLoading === doc.id) return;
        
        setOpenMoreMenu(null);
        const isSoftDelete = doc.status !== '已删除';
        setConfirmDialog({
            isOpen: true,
            type: 'delete',
            title: isSoftDelete ? '确认删除' : '永久删除',
            message: isSoftDelete 
                ? `确定要删除文档「${doc.name}」吗？文档将被移至已删除状态。`
                : `确定要永久删除文档「${doc.name}」吗？此操作不可撤销！`,
            warningText: isSoftDelete ? '文档可从已删除状态恢复' : '关联的引用链接和对话记录也将被清除',
            confirmText: isSoftDelete ? '确认删除' : '永久删除',
            onConfirm: async () => {
                if (actionLoading === doc.id) return;
                setActionLoading(doc.id);
                setConfirmDialog(prev => ({ ...prev, isLoading: true }));
                try {
                    if (isSoftDelete) {
                        await api.updateDocumentStatus(doc.name, '已删除');
                        showToast('success', '删除成功', `文档「${doc.name}」已移至已删除状态`);
                    } else {
                        await api.deleteDocument(doc.name);
                        showToast('success', '删除成功', `文档「${doc.name}」已永久删除`);
                    }
                    await fetchAllData();
                } catch (error) {
                    showToast('error', '删除失败', '删除文档时发生错误，请重试');
                } finally {
                    setActionLoading(null);
                    setConfirmDialog(prev => ({ ...prev, isLoading: false }));
                }
            },
        });
    };

    const handleUploadClick = () => {
        if (isUploading) return;
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.md,.txt,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.json,.xml,.html,.htm,.jpg,.jpeg,.png,.gif,.bmp,.ods,.odt';
        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                setIsUploading(true);
                try {
                    await api.upload(files[0]);
                    await fetchAllData();
                    showToast('success', '上传成功', `文档「${files[0].name}」已添加到知识库`);
                } catch (error) {
                    showToast('error', '上传失败', '文档上传时发生错误，请重试');
                } finally {
                    setIsUploading(false);
                }
            }
        };
        input.click();
    };

    return (
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
            <Header title="文档库" user={user} onNavigate={onNavigate} />
            
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialog.onConfirm}
                type={confirmDialog.type}
                title={confirmDialog.title}
                message={confirmDialog.message}
                warningText={confirmDialog.warningText}
                cancelText="取消"
                confirmText={confirmDialog.confirmText}
                showInput={confirmDialog.showInput}
                inputPlaceholder={confirmDialog.inputPlaceholder}
                isLoading={confirmDialog.isLoading}
            />
            
            <Toast messages={toastMessages} onRemove={removeToast} />

            <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="flex items-start justify-between mb-6">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>文档库</h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>管理和检索企业知识文档</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                        {/* <button className="inline-flex items-center gap-2 px-4 h-9 text-sm font-medium whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
                            <Layers className="w-4 h-4" />
                            <span>批量操作</span>
                        </button> */}
                        {hasPermission('doc_upload') && (
                            <button 
                                onClick={handleUploadClick}
                                disabled={isUploading}
                                className="inline-flex items-center gap-2 px-4 h-9 text-sm font-medium whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)', opacity: isUploading ? 0.7 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                                {isUploading ? (
                                    <Spinner size="sm" />
                                ) : (
                                    <Upload className="w-4 h-4" />
                                )}
                                <span>{isUploading ? '上传中...' : '上传文档'}</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center gap-4 px-5 py-4" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                        <div className="w-10 h-10 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                            <FileText className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{stats.total_documents.toLocaleString()}</p>
                            <p className="text-xs whitespace-nowrap truncate" style={{ color: 'var(--color-text-tertiary)' }}>全部文档</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-5 py-4" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                        <div className="w-10 h-10 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--tag-finance)' }}>
                            <Search className="w-5 h-5" style={{ color: 'var(--state-success)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{stats.this_week_new}</p>
                            <p className="text-xs whitespace-nowrap truncate" style={{ color: 'var(--color-text-tertiary)' }}>本周新增</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-5 py-4" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                        <div className="w-10 h-10 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--tag-hr)' }}>
                            <Eye className="w-5 h-5" style={{ color: 'var(--state-warning)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{stats.pending_review}</p>
                            <p className="text-xs whitespace-nowrap truncate" style={{ color: 'var(--color-text-tertiary)' }}>待审核</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-5 py-4" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                        <div className="w-10 h-10 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--tag-legal)' }}>
                            <Star className="w-5 h-5" style={{ color: 'var(--tag-legal-text)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{stats.favorites}</p>
                            <p className="text-xs whitespace-nowrap truncate" style={{ color: 'var(--color-text-tertiary)' }}>收藏文档</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="relative flex-1 min-w-0 w-full sm:w-auto" style={{ maxWidth: '420px' }}>
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }} />
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜索文档名称、关键词或内容..." 
                            className="w-full pl-9 pr-4 h-9 text-sm" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', outline: 'none', transition: 'border-color var(--transition-fast)' }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                        />
                    </div>

                    <div className="relative filter-dropdown-container">
                        <button 
                            onClick={() => { setOpenTypeDropdown(!openTypeDropdown); setOpenCategoryDropdown(false); setOpenStatusDropdown(false); setOpenSortDropdown(false); }}
                            className="inline-flex items-center gap-2 px-3 h-9 text-sm whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                        >
                            <span>{selectedType === '全部' ? '文档类型' : selectedType}</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {openTypeDropdown && (
                            <div className="absolute top-full left-0 mt-1 z-50 w-36" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                                {DOCUMENT_TYPES.map((type) => (
                                    <button 
                                        key={type}
                                        onClick={() => { setSelectedType(type); setOpenTypeDropdown(false); }}
                                        className="w-full px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]" 
                                        style={{ color: selectedType === type ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative filter-dropdown-container">
                        <button 
                            onClick={() => { setOpenCategoryDropdown(!openCategoryDropdown); setOpenTypeDropdown(false); setOpenStatusDropdown(false); setOpenSortDropdown(false); }}
                            className="inline-flex items-center gap-2 px-3 h-9 text-sm whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                        >
                            <span>{selectedCategory === '全部' ? '分类标签' : selectedCategory}</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {openCategoryDropdown && (
                            <div className="absolute top-full left-0 mt-1 z-50 w-36" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                                {CATEGORIES.map((category) => (
                                    <button 
                                        key={category}
                                        onClick={() => { setSelectedCategory(category); setOpenCategoryDropdown(false); }}
                                        className="w-full px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]" 
                                        style={{ color: selectedCategory === category ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative filter-dropdown-container">
                        <button 
                            onClick={() => { setOpenStatusDropdown(!openStatusDropdown); setOpenTypeDropdown(false); setOpenCategoryDropdown(false); setOpenSortDropdown(false); }}
                            className="inline-flex items-center gap-2 px-3 h-9 text-sm whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                        >
                            <span>{selectedStatus === '全部' ? '状态筛选' : selectedStatus}</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {openStatusDropdown && (
                            <div className="absolute top-full left-0 mt-1 z-50 w-36" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                                {STATUS_OPTIONS.map((status) => (
                                    <button 
                                        key={status}
                                        onClick={() => { setSelectedStatus(status); setOpenStatusDropdown(false); }}
                                        className="w-full px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]" 
                                        style={{ color: selectedStatus === status ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative filter-dropdown-container">
                        <button 
                            onClick={() => { setOpenSortDropdown(!openSortDropdown); setOpenTypeDropdown(false); setOpenCategoryDropdown(false); setOpenStatusDropdown(false); }}
                            className="inline-flex items-center gap-2 px-3 h-9 text-sm whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                        >
                            <span>{selectedSort}</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {openSortDropdown && (
                            <div className="absolute top-full left-0 mt-1 z-50 w-40" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                                {SORT_OPTIONS.map((option) => (
                                    <button 
                                        key={option.label}
                                        onClick={() => { setSelectedSort(option.label); setOpenSortDropdown(false); }}
                                        className="w-full px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]" 
                                        style={{ color: selectedSort === option.label ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                    {selectedType !== '全部' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                            <span>{selectedType}</span>
                            <button onClick={() => setSelectedType('全部')} className="hover:opacity-70">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {selectedCategory !== '全部' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs whitespace-nowrap" style={{ backgroundColor: 'var(--tag-tech)', color: 'var(--tag-tech-text)' }}>
                            <span>{selectedCategory}</span>
                            <button onClick={() => setSelectedCategory('全部')} className="hover:opacity-70">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {selectedStatus !== '全部' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs whitespace-nowrap" style={{ backgroundColor: 'var(--tag-hr)', color: 'var(--tag-hr-text)' }}>
                            <span>{selectedStatus}</span>
                            <button onClick={() => setSelectedStatus('全部')} className="hover:opacity-70">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {searchQuery && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs whitespace-nowrap" style={{ backgroundColor: 'var(--tag-finance)', color: 'var(--state-success)' }}>
                            <span>搜索: {searchQuery}</span>
                            <button onClick={() => setSearchQuery('')} className="hover:opacity-70">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                </div>

                <div className="overflow-x-auto" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                    <table className="w-full text-sm" style={{ minWidth: '780px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th className="w-10 px-4 py-3 text-left" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                                    <input type="checkbox" className="w-4 h-4" checked={selectedDocuments.length === documents.length && documents.length > 0} onChange={toggleSelectAll} />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>文档名称</th>
                                <th className="w-20 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>类型</th>
                                <th className="w-24 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>分类</th>
                                <th className="w-36 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>更新时间</th>
                                <th className="w-20 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>状态</th>
                                <th className="w-28 px-4 py-3 text-center text-xs font-medium uppercase tracking-wide" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center">
                                        <BlockLoading text="加载中..." />
                                    </td>
                                </tr>
                            ) : documents.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center">
                                        <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
                                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>暂无文档</p>
                                        {hasPermission('doc_upload') && (
                                            <button 
                                                onClick={handleUploadClick}
                                                disabled={isUploading}
                                                className="mt-3 inline-flex items-center gap-2 px-4 h-9 text-sm font-medium whitespace-nowrap transition-colors duration-150" 
                                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)', opacity: isUploading ? 0.7 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
                                            >
                                                {isUploading ? (
                                                    <Spinner size="sm" />
                                                ) : (
                                                    <Upload className="w-4 h-4" />
                                                )}
                                                <span>{isUploading ? '上传中...' : '上传文档'}</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                documents.map((doc, index) => {
                                const iconKey = getIconForType(doc.type);
                                const Icon = iconMap[iconKey];
                                const categoryColor = categoryColors[doc.category] || categoryColors['产品'];
                                const statusColor = statusColors[doc.status] || statusColors['草稿'];
                                const typeColor = typeColors[doc.type] || typeColors['PDF'];
                                return (
                                    <tr 
                                        key={doc.id} 
                                        className="doc-row transition-colors duration-150 cursor-pointer" 
                                        style={{ borderBottom: '1px solid var(--color-divider)', backgroundColor: index % 2 === 1 ? 'var(--color-bg-hover)' : 'transparent' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? 'var(--color-bg-hover)' : 'transparent'}
                                    >
                                        <td className="px-4 py-3">
                                            <input type="checkbox" className="w-4 h-4" checked={selectedDocuments.includes(doc.id)} onChange={() => toggleDocumentSelect(doc.id)} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Icon className="w-4 h-4 shrink-0" style={{ color: doc.type === 'PDF' ? 'var(--state-error)' : doc.type === 'Word' ? 'var(--state-info)' : 'var(--color-text-secondary)' }} />
                                                <span className="truncate" style={{ color: 'var(--color-text-primary)' }}>{doc.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 text-xs whitespace-nowrap ${typeColor.bg} ${typeColor.text}`}>{doc.type}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {hasPermission('doc_edit') ? (
                                                <button
                                                    onClick={(e) => handleCategoryClick(e, doc)}
                                                    disabled={categoryLoading === doc.id}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs whitespace-nowrap ${categoryColor.bg} ${categoryColor.text} hover:opacity-80 transition-opacity rounded`}
                                                    title="点击修改分类"
                                                    style={{ cursor: categoryLoading === doc.id ? 'not-allowed' : 'pointer', opacity: categoryLoading === doc.id ? 0.6 : 1 }}
                                                >
                                                {categoryLoading === doc.id ? (
                                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <span>{doc.category}</span>
                                                        <ChevronDown className="w-3 h-3" />
                                                    </>
                                                )}
                                                </button>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs whitespace-nowrap ${categoryColor.bg} ${categoryColor.text} rounded`}>
                                                    {doc.category}
                                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>{formatDateTime(doc.updateTime)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 text-xs whitespace-nowrap ${statusColor.bg} ${statusColor.text}`}>{doc.status}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                {hasPermission('doc_view') && (
                                                    <button 
                                                        onClick={() => handleView(doc)}
                                                        disabled={actionLoading === doc.id}
                                                        className="w-7 h-7 flex items-center justify-center transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)] rounded" 
                                                        style={{ color: 'var(--color-text-secondary)', opacity: actionLoading === doc.id ? 0.5 : 1, cursor: actionLoading === doc.id ? 'not-allowed' : 'pointer' }} 
                                                        title="查看"
                                                    >
                                                        {actionLoading === doc.id ? (
                                                            <Spinner size="sm" />
                                                        ) : (
                                                            <Eye className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={(e) => toggleFavorite(e, doc.id)}
                                                    disabled={actionLoading === doc.id}
                                                    className="w-7 h-7 flex items-center justify-center transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)] rounded" 
                                                    style={{ color: doc.isFavorite ? 'var(--state-warning)' : 'var(--color-text-secondary)', opacity: actionLoading === doc.id ? 0.5 : 1, cursor: actionLoading === doc.id ? 'not-allowed' : 'pointer' }} 
                                                    title={doc.isFavorite ? '已收藏' : '收藏'}
                                                >
                                                    {actionLoading === doc.id ? (
                                                        <Spinner size="sm" />
                                                    ) : (
                                                        <Star className="w-4 h-4" style={doc.isFavorite ? { fill: 'var(--state-warning)' } : {}} />
                                                    )}
                                                </button>
                                                {(hasPermission('doc_download') || hasPermission('doc_delete') || hasPermission('doc_review') || hasPermission('doc_upload')) && (
                                                    <button 
                                                        onClick={(e) => handleMoreClick(e, doc.id)}
                                                        disabled={actionLoading === doc.id}
                                                        className="w-7 h-7 flex items-center justify-center transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)] rounded" 
                                                        style={{ color: 'var(--color-text-secondary)', opacity: actionLoading === doc.id ? 0.5 : 1, cursor: actionLoading === doc.id ? 'not-allowed' : 'pointer' }} 
                                                        title="更多"
                                                    >
                                                        {actionLoading === doc.id ? (
                                                            <Spinner size="sm" />
                                                        ) : (
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                                }))}
                        </tbody>
                    </table>
                </div>

                {openMoreMenu && (
                    <div 
                        ref={moreMenuRef}
                        className="fixed z-50 w-44" 
                        style={{ 
                            left: moreMenuPosition.x, 
                            top: moreMenuPosition.y,
                            backgroundColor: 'var(--color-bg-secondary)', 
                            border: '1px solid var(--color-border)', 
                            borderRadius: '4px', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                        }}
                    >
                        {(() => {
                            const doc = documents.find(d => d.id === openMoreMenu);
                            if (!doc) return null;
                            
                            const menuItems = [];
                            
                            if (doc.status === '草稿') {
                                if (hasPermission('doc_download')) {
                                    menuItems.push(
                                        { icon: Download, label: '下载', action: handleDownload, color: 'var(--color-text-secondary)' },
                                        { icon: Share2, label: '分享', action: handleShare, color: 'var(--color-text-secondary)' },
                                    );
                                }
                                if (menuItems.length > 0 && (hasPermission('doc_upload') || hasPermission('doc_delete'))) {
                                    menuItems.push({ divider: true });
                                }
                                if (hasPermission('doc_upload')) {
                                    menuItems.push(
                                        { icon: Eye, label: '提交审核', action: handleSubmitForReview, color: 'var(--color-primary)' },
                                    );
                                }
                                if (hasPermission('doc_delete')) {
                                    menuItems.push(
                                        { icon: Trash2, label: '删除', action: handleDelete, color: 'var(--state-error)' },
                                    );
                                }
                            } else if (doc.status === '待审核') {
                                if (hasPermission('doc_download')) {
                                    menuItems.push(
                                        { icon: Download, label: '下载', action: handleDownload, color: 'var(--color-text-secondary)' },
                                        { icon: Share2, label: '分享', action: handleShare, color: 'var(--color-text-secondary)' },
                                    );
                                }
                                if (menuItems.length > 0 && (hasPermission('doc_review') || hasPermission('doc_delete'))) {
                                    menuItems.push({ divider: true });
                                }
                                if (hasPermission('doc_review')) {
                                    menuItems.push(
                                        { icon: Eye, label: '审核通过', action: handleApprove, color: 'var(--state-success)' },
                                        { icon: X, label: '审核驳回', action: handleReject, color: 'var(--state-error)' },
                                    );
                                }
                                if (hasPermission('doc_delete')) {
                                    menuItems.push(
                                        { icon: Trash2, label: '删除', action: handleDelete, color: 'var(--state-error)' },
                                    );
                                }
                            } else if (doc.status === '已发布') {
                                if (hasPermission('doc_download')) {
                                    menuItems.push(
                                        { icon: Download, label: '下载', action: handleDownload, color: 'var(--color-text-secondary)' },
                                        { icon: Share2, label: '分享', action: handleShare, color: 'var(--color-text-secondary)' },
                                    );
                                }
                                if (menuItems.length > 0 && hasPermission('doc_delete')) {
                                    menuItems.push({ divider: true });
                                }
                                if (hasPermission('doc_delete')) {
                                    menuItems.push(
                                        { icon: Trash2, label: '删除', action: handleDelete, color: 'var(--state-error)' },
                                    );
                                }
                            } else if (doc.status === '审核驳回') {
                                if (hasPermission('doc_download')) {
                                    menuItems.push(
                                        { icon: Download, label: '下载', action: handleDownload, color: 'var(--color-text-secondary)' },
                                        { icon: Share2, label: '分享', action: handleShare, color: 'var(--color-text-secondary)' },
                                    );
                                }
                                if (menuItems.length > 0 && (hasPermission('doc_upload') || hasPermission('doc_delete'))) {
                                    menuItems.push({ divider: true });
                                }
                                if (hasPermission('doc_upload')) {
                                    menuItems.push(
                                        { icon: Eye, label: '重新提交审核', action: handleSubmitForReview, color: 'var(--color-primary)' },
                                    );
                                }
                                if (hasPermission('doc_delete')) {
                                    menuItems.push(
                                        { icon: Trash2, label: '删除', action: handleDelete, color: 'var(--state-error)' },
                                    );
                                }
                            } else if (doc.status === '已删除') {
                                if (hasPermission('doc_download')) {
                                    menuItems.push(
                                        { icon: Download, label: '下载', action: handleDownload, color: 'var(--color-text-secondary)' },
                                    );
                                }
                                if (menuItems.length > 0 && (hasPermission('doc_upload') || hasPermission('doc_delete'))) {
                                    menuItems.push({ divider: true });
                                }
                                if (hasPermission('doc_upload')) {
                                    menuItems.push(
                                        { icon: Eye, label: '恢复文档', action: handleRestore, color: 'var(--color-primary)' },
                                    );
                                }
                                if (hasPermission('doc_delete')) {
                                    menuItems.push(
                                        { icon: Trash2, label: '永久删除', action: handleDelete, color: 'var(--state-error)' },
                                    );
                                }
                            }
                            
                            return menuItems.map((item, index) => {
                                if (item.divider) {
                                    return <div key={`divider-${index}`} className="h-px" style={{ backgroundColor: 'var(--color-border)' }}></div>;
                                }
                                const Icon = item.icon!;
                                const isLoading = actionLoading === doc.id;
                                return (
                                    <button 
                                        key={`item-${index}`}
                                        onClick={(e) => item.action!(e, doc)}
                                        disabled={isLoading}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]" 
                                        style={{ color: item.color, opacity: isLoading ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                                    >
                                        {isLoading ? (
                                            <Spinner size="sm" />
                                        ) : (
                                            <Icon className="w-3.5 h-3.5" />
                                        )}
                                        <span>{isLoading ? '处理中...' : item.label}</span>
                                    </button>
                                );
                            });
                        })()}
                    </div>
                )}

                {openCategoryEditMenu && (
                    <div 
                        ref={categoryMenuRef}
                        className="fixed z-50 w-36" 
                        style={{ 
                            left: categoryMenuPosition.x, 
                            top: categoryMenuPosition.y,
                            backgroundColor: 'var(--color-bg-secondary)', 
                            border: '1px solid var(--color-border)', 
                            borderRadius: '4px', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                        }}
                    >
                        {(() => {
                            const doc = documents.find(d => d.id === openCategoryEditMenu);
                            if (!doc) return null;
                            
                            const isLoading = categoryLoading === doc.id;
                            
                            if (isLoading) {
                                return (
                                    <div className="flex items-center justify-center py-4">
                                        <Spinner size="sm" />
                                    </div>
                                );
                            }
                            
                            const editableCategories = CATEGORIES.filter(c => c !== '全部');
                            
                            return editableCategories.map((category) => {
                                const isSelected = doc.category === category;
                                return (
                                    <button 
                                        key={category}
                                        onClick={() => handleCategoryChange(doc, category)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]" 
                                        style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                    >
                                        <span>{category}</span>
                                        {isSelected && <ChevronDown className="w-3 h-3" />}
                                    </button>
                                );
                            });
                        })()}
                    </div>
                )}

                <div className="flex items-center justify-between mt-4">
                    <span className="text-sm whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>共 {documentCount.toLocaleString()} 条记录</span>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage <= 1}
                            className="inline-flex items-center justify-center w-8 h-8 text-sm whitespace-nowrap transition-colors duration-150" 
                            style={{ 
                                backgroundColor: currentPage <= 1 ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)', 
                                color: currentPage <= 1 ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)', 
                                border: '1px solid var(--color-border)',
                                opacity: currentPage <= 1 ? 0.5 : 1,
                                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                            }} 
                            title="上一页"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        {(() => {
                            const pages = [];
                            const maxVisiblePages = 5;
                            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                            
                            if (endPage - startPage + 1 < maxVisiblePages) {
                                startPage = Math.max(1, endPage - maxVisiblePages + 1);
                            }
                            
                            for (let i = startPage; i <= endPage; i++) {
                                pages.push(
                                    <button 
                                        key={i}
                                        onClick={() => setCurrentPage(i)}
                                        className="inline-flex items-center justify-center w-8 h-8 text-sm font-medium whitespace-nowrap transition-colors duration-150" 
                                        style={{ 
                                            backgroundColor: i === currentPage ? 'var(--color-primary)' : 'var(--color-bg-secondary)', 
                                            color: i === currentPage ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)', 
                                            border: `1px solid ${i === currentPage ? 'var(--color-primary)' : 'var(--color-border)'}`
                                        }}
                                    >
                                        {i}
                                    </button>
                                );
                            }
                            
                            return pages;
                        })()}
                        
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage >= totalPages}
                            className="inline-flex items-center justify-center w-8 h-8 text-sm whitespace-nowrap transition-colors duration-150" 
                            style={{ 
                                backgroundColor: currentPage >= totalPages ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)', 
                                color: currentPage >= totalPages ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)', 
                                border: '1px solid var(--color-border)',
                                opacity: currentPage >= totalPages ? 0.5 : 1,
                                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                            }} 
                            title="下一页"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        
                        <select 
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="h-8 text-sm pl-2 pr-6" 
                            style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', outline: 'none' }}
                        >
                            <option value={10}>10 条/页</option>
                            <option value={20}>20 条/页</option>
                            <option value={50}>50 条/页</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}