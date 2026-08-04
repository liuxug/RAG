export interface HealthResponse {
    status: string;
    document_count: number;
}

export interface UploadResponse {
    message: string;
    file_name: string;
    chunks_count: number;
}

export interface Source {
    source: string;
    page: number | string;
    content?: string;
    score: number;
}

export interface QueryResponse {
    answer: string;
    sources: Source[];
}

export interface QueryRequest {
    question: string;
    language: string;
    source_filter?: string[];
}

export interface KnowledgeGraphNode {
    id: string;
    label: string;
    position: string;
}

export interface KnowledgeGraphResponse {
    nodes: KnowledgeGraphNode[];
}

export interface Recommendation {
    id: string;
    name: string;
    category: string;
    matchRate: string;
}

export interface RecommendationResponse {
    recommendations: Recommendation[];
}

export interface DownloadRecord {
    id: string;
    username: string;
    document_name: string;
    document_type: string;
    category: string;
    download_time: string;
}

export interface DownloadHistoryResponse {
    history: DownloadRecord[];
}

export interface Comment {
    id: string;
    document_name: string;
    username: string;
    content: string;
    created_at: string;
}

export interface CommentsResponse {
    comments: Comment[];
}

export interface Notification {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
}

export interface UploadProgress {
    fileName: string;
    progress: number;
    status: 'uploading' | 'processing' | 'completed' | 'error';
}

export interface User {
    id: string;
    username: string;
    email: string;
    created_at: string;
    is_active: boolean;
    role: string;
    department: string;
    last_login: string | null;
    permissions: string[];
}

export interface UserItem {
    id: string;
    username: string;
    email: string;
    role: string;
    department: string;
    is_active: boolean;
    last_login: string | null;
    created_at: string;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
    user: User;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    code: string;
}

export interface SendCodeRequest {
    email: string;
}

export type DocumentStatus = '草稿' | '待审核' | '已发布' | '已删除' | '审核驳回';

export interface Document {
    id: string;
    name: string;
    type: string;
    category: string;
    createTime: string;
    updateTime: string;
    status: DocumentStatus;
    isFavorite: boolean;
    pages: number;
    chunks: number;
    author: string;
    review_comment?: string;
}

export interface DocumentsResponse {
    documents: Document[];
    total: number;
}

export interface StatsResponse {
    total_documents: number;
    published_documents: number;
    total_chunks: number;
    total_pages: number;
    pending_review: number;
    favorites: number;
    this_week_new: number;
}

export interface DocumentFilter {
    type?: string;
    category?: string;
    status?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    page_size?: number;
}

export interface DocumentListResponse {
    documents: Document[];
    total: number;
    total_pages: number;
    page: number;
    page_size: number;
}

export interface DocumentChunk {
    chunk_id: string;
    page: number;
    content: string;
    metadata: Record<string, any>;
}

export interface DocumentDetailResponse {
    name: string;
    type: string;
    category: string;
    pages: number;
    chunks: number;
    all_chunks: DocumentChunk[];
    author: string;
    createTime: string;
    updateTime: string;
    status?: string;
    review_comment?: string;
}

export interface SearchResult {
    id: string;
    title: string;
    matchRate: string;
    path: string;
    summary: string;
    fileType: string;
    size: string;
    updateTime: string;
    author: string;
    tags: string[];
}

export interface SearchResponse {
    results: SearchResult[];
    total: number;
}

export interface SearchHistoryItem {
    query: string;
    user_id: string | null;
    timestamp: string;
}

export interface SearchHistoryResponse {
    history: SearchHistoryItem[];
}

export interface HotSearchItem {
    query: string;
    count: number;
    last_search: string;
}

export interface HotSearchResponse {
    hot_searches: HotSearchItem[];
}

export interface RelatedDocument {
    id: string;
    title: string;
    category: string;
    fileType: string;
    score: number;
    matchRate: string;
}

export interface RelatedDocumentsResponse {
    related: RelatedDocument[];
}

export interface Permission {
    id: string;
    name: string;
    description: string;
}

export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    permissions_count: number;
    members: number;
    status: 'active' | 'disabled';
    is_built_in: boolean;
    created_at: string;
    updated_at: string;
}

export interface RoleCreateRequest {
    name: string;
    description?: string;
    permissions?: string[];
    is_built_in?: boolean;
}

export interface RoleUpdateRequest {
    name?: string;
    description?: string;
    permissions?: string[];
    status?: string;
}

export interface RoleStatsResponse {
    total_roles: number;
    active_roles: number;
    disabled_roles: number;
    built_in_roles: number;
}

export interface PermissionsResponse {
    permissions: Permission[];
}

// 对话历史相关类型
export interface ChatMessage {
    type: 'user' | 'assistant';
    content: string;
    timestamp?: string;
    sources?: Source[];
}

export interface ChatSession {
    id: string;
    user_id: string;
    title: string;
    messages: ChatMessage[];
    created_at: string;
    updated_at: string;
}

export interface ChatHistoryResponse {
    sessions: ChatSession[];
}

export interface ChatSessionCreateRequest {
    title: string;
    messages: ChatMessage[];
}

export interface ChatSessionUpdateRequest {
    title?: string;
    messages?: ChatMessage[];
}

export interface ChatSessionResponse {
    message: string;
    session: ChatSession;
}
