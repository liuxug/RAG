import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
    HealthResponse, UploadResponse, QueryResponse, QueryRequest,
    TokenResponse, LoginRequest, RegisterRequest, User, UserItem, Document, StatsResponse, DocumentFilter, DocumentDetailResponse,
    SearchResponse, SearchHistoryResponse, HotSearchResponse, RelatedDocumentsResponse,
    KnowledgeGraphResponse, RecommendationResponse, DownloadHistoryResponse,
    Comment, CommentsResponse, DocumentListResponse,
    Role, RoleStatsResponse, PermissionsResponse, Permission,
    ChatHistoryResponse, ChatSession, ChatSessionCreateRequest, ChatSessionUpdateRequest, ChatSessionResponse
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const getToken = () => {
    return localStorage.getItem('access_token');
};

const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 120000,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(
    (config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            const currentUrl = window.location.pathname;
            if (currentUrl !== '/login' && currentUrl !== '/register') {
                localStorage.removeItem('access_token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        console.error('API Error:', error);
        throw error;
    }
);

export const api = {
    health: async (): Promise<HealthResponse> => {
        const response = await apiClient.get<HealthResponse>('/health');
        return response.data;
    },

    upload: async (file: File): Promise<UploadResponse> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post<UploadResponse>('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    console.log(`Upload progress: ${percentCompleted}%`);
                }
            },
        });

        return response.data;
    },

    shareDocument: async (documentName: string): Promise<{ share_link: string; expires_in: number }> => {
        const response = await apiClient.get(`/documents/${encodeURIComponent(documentName)}/share`);
        return response.data;
    },

    uploadTemporary: async (file: File): Promise<UploadResponse> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post<UploadResponse>('/upload/temporary', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    console.log(`Temporary upload progress: ${percentCompleted}%`);
                }
            },
        });

        return response.data;
    },

    query: async (request: QueryRequest): Promise<QueryResponse> => {
        const response = await apiClient.post<QueryResponse>('/query', request);
        return response.data;
    },

    getKnowledgeGraph: async (request: QueryRequest): Promise<KnowledgeGraphResponse> => {
        const response = await apiClient.post<KnowledgeGraphResponse>('/query/knowledge-graph', request);
        return response.data;
    },

    getRecommendations: async (request: QueryRequest): Promise<RecommendationResponse> => {
        const response = await apiClient.post<RecommendationResponse>('/query/recommendations', request);
        return response.data;
    },

    login: async (request: LoginRequest): Promise<TokenResponse> => {
        const response = await apiClient.post<TokenResponse>('/auth/login', request);
        return response.data;
    },

    register: async (request: RegisterRequest): Promise<TokenResponse> => {
        const response = await apiClient.post<TokenResponse>('/auth/register', request);
        return response.data;
    },

    verifyToken: async (): Promise<User> => {
        const response = await apiClient.post<User>('/auth/verify-token');
        return response.data;
    },

    sendCode: async (email: string): Promise<{ message: string }> => {
        const response = await apiClient.post<{ message: string }>('/auth/send-code', { email });
        return response.data;
    },

    getDocuments: async (filter?: DocumentFilter): Promise<DocumentListResponse> => {
        const params: Record<string, string | number> = {};
        if (filter?.type) params.type = filter.type;
        if (filter?.category) params.category = filter.category;
        if (filter?.status) params.status = filter.status;
        if (filter?.search) params.search = filter.search;
        if (filter?.sort_by) params.sort_by = filter.sort_by;
        if (filter?.sort_order) params.sort_order = filter.sort_order;
        if (filter?.page) params.page = filter.page;
        if (filter?.page_size) params.page_size = filter.page_size;
        
        const response = await apiClient.get<DocumentListResponse>('/documents', { params });
        return response.data;
    },

    getStats: async (): Promise<StatsResponse> => {
        const response = await apiClient.get<StatsResponse>('/stats');
        return response.data;
    },

    getDocumentDetail: async (documentName: string): Promise<DocumentDetailResponse> => {
        const response = await apiClient.get<DocumentDetailResponse>(`/documents/${encodeURIComponent(documentName)}`);
        return response.data;
    },

    deleteDocument: async (documentName: string): Promise<{ message: string }> => {
        const response = await apiClient.delete<{ message: string }>(`/documents/${encodeURIComponent(documentName)}`);
        return response.data;
    },

    updateDocumentStatus: async (documentName: string, status: string): Promise<{ message: string }> => {
        const response = await apiClient.post<{ message: string }>(`/documents/${encodeURIComponent(documentName)}/status`, { status });
        return response.data;
    },

    updateDocumentCategory: async (documentName: string, category: string): Promise<{ message: string }> => {
        const response = await apiClient.post<{ message: string }>(`/documents/${encodeURIComponent(documentName)}/category`, { category });
        return response.data;
    },

    reviewDocument: async (documentName: string, action: 'approve' | 'reject', comment?: string): Promise<{ message: string; status: string }> => {
        const response = await apiClient.post<{ message: string; status: string }>(`/documents/${encodeURIComponent(documentName)}/review`, null, {
            params: { action, comment: comment || '' }
        });
        return response.data;
    },

    search: async (query: string, type?: string, limit: number = 10, offset: number = 0): Promise<SearchResponse> => {
        const params: Record<string, string | number> = {
            q: query,
            limit,
            offset
        };
        if (type && type !== '全部') {
            params.type = type;
        }
        
        const response = await apiClient.get<SearchResponse>('/search', { params });
        return response.data;
    },

    getSearchHistory: async (limit: number = 10): Promise<SearchHistoryResponse> => {
        const response = await apiClient.get<SearchHistoryResponse>('/search/history', { params: { limit } });
        return response.data;
    },

    clearSearchHistory: async (): Promise<{ message: string }> => {
        const response = await apiClient.delete<{ message: string }>('/search/history');
        return response.data;
    },

    getHotSearches: async (limit: number = 10): Promise<HotSearchResponse> => {
        const response = await apiClient.get<HotSearchResponse>('/search/hot', { params: { limit } });
        return response.data;
    },

    getRelatedDocuments: async (query: string, limit: number = 5): Promise<RelatedDocumentsResponse> => {
        const response = await apiClient.get<RelatedDocumentsResponse>('/search/related', { 
            params: { query, limit } 
        });
        return response.data;
    },

    getDownloadHistory: async (): Promise<DownloadHistoryResponse> => {
        const response = await apiClient.get<DownloadHistoryResponse>('/download/history');
        return response.data;
    },

    clearDownloadHistory: async (): Promise<{ message: string }> => {
        const response = await apiClient.delete<{ message: string }>('/download/history');
        return response.data;
    },

    deleteDownloadRecord: async (recordId: string): Promise<{ message: string }> => {
        const response = await apiClient.delete<{ message: string }>(`/download/history/${recordId}`);
        return response.data;
    },

    downloadDocument: async (documentName: string): Promise<Blob> => {
        const response = await apiClient.get(`/documents/${encodeURIComponent(documentName)}/download`, {
            responseType: 'blob',
        });
        return response.data;
    },

    getComments: async (documentName: string): Promise<CommentsResponse> => {
        const response = await apiClient.get<CommentsResponse>(`/documents/${encodeURIComponent(documentName)}/comments`);
        return response.data;
    },

    addComment: async (documentName: string, content: string): Promise<{ message: string }> => {
        const response = await apiClient.post<{ message: string }>(`/documents/${encodeURIComponent(documentName)}/comments`, { content });
        return response.data;
    },

    deleteComment: async (documentName: string, commentId: string): Promise<{ message: string }> => {
        const response = await apiClient.delete<{ message: string }>(`/documents/${encodeURIComponent(documentName)}/comments/${commentId}`);
        return response.data;
    },

    getLLMStatus: async (): Promise<{ 
        current_type: string; 
        available_types: Array<{ type: string; name: string; description: string; icon: string }>;
        current_model: string;
        temperature: number;
        max_tokens: number;
    }> => {
        const response = await apiClient.get('/llm/status');
        return response.data;
    },

    switchLLM: async (llm_type: string, temperature?: number, max_tokens?: number): Promise<{ message: string; current_type: string; temperature: number; max_tokens: number }> => {
        const response = await apiClient.post('/llm/switch', { llm_type, temperature, max_tokens });
        return response.data;
    },

    getRoles: async (): Promise<Role[]> => {
        const response = await apiClient.get<Role[]>('/roles');
        return response.data;
    },

    getRoleStats: async (): Promise<RoleStatsResponse> => {
        const response = await apiClient.get<RoleStatsResponse>('/roles/stats');
        return response.data;
    },

    getPermissions: async (): Promise<Permission[]> => {
        const response = await apiClient.get<PermissionsResponse>('/roles/permissions');
        return response.data.permissions;
    },

    getRole: async (roleId: string): Promise<Role> => {
        const response = await apiClient.get<Role>(`/roles/${roleId}`);
        return response.data;
    },

    createRole: async (name: string, description?: string, permissions?: string[]): Promise<Role> => {
        const response = await apiClient.post<Role>('/roles', { name, description, permissions });
        return response.data;
    },

    updateRole: async (roleId: string, data: { name?: string; description?: string; permissions?: string[]; status?: string }): Promise<Role> => {
        const response = await apiClient.put<Role>(`/roles/${roleId}`, data);
        return response.data;
    },

    deleteRole: async (roleId: string): Promise<{ message: string }> => {
        const response = await apiClient.delete<{ message: string }>(`/roles/${roleId}`);
        return response.data;
    },

    updateRoleStatus: async (roleId: string, status: 'active' | 'disabled'): Promise<{ message: string }> => {
        const response = await apiClient.post<{ message: string }>(`/roles/${roleId}/status`, null, { params: { status } });
        return response.data;
    },

    getGlobalStats: async (params?: {
        time_range?: string;
        start_date?: string;
        end_date?: string;
    }): Promise<{
        kpi_metrics: {
            total_documents: number;
            total_users: number;
            ai_conversations: number;
            search_count: number;
            avg_response_time: number;
            document_coverage: number;
        };
        upload_trend: { month: string; count: number }[];
        document_types: { type: string; count: number; percentage: number; color: string }[];
        user_activity: { role: string; count: number; percentage: number; color: string }[];
        hot_keywords: { rank: number; keyword: string; count: number; percentage: number }[];
        satisfaction: { overall: number; very_satisfied: number; neutral: number; unsatisfied: number };
        system_status: { name: string; status: string; color: string }[];
        recent_activity: { id: string; user_name: string; user_avatar: string; action: string; target: string; target_color: string; time_ago: string }[];
    }> => {
        const response = await apiClient.get('/stats/global', { params });
        return response.data;
    },

    exportStats: async (params?: {
        time_range?: string;
        start_date?: string;
        end_date?: string;
    }): Promise<string> => {
        const response = await apiClient.get('/stats/export', { params });
        return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    },

    getUsers: async (params: {
        page?: number;
        page_size?: number;
        search?: string;
        role?: string;
        status?: string;
        department?: string;
    }): Promise<{ users: UserItem[]; total: number; page: number; page_size: number }> => {
        const response = await apiClient.get('/users', { params });
        return response.data;
    },

    getUserStats: async (): Promise<{ total: number; active: number; disabled: number; pending: number }> => {
        const response = await apiClient.get('/users/stats');
        return response.data;
    },

    createUser: async (data: { username: string; email: string; password: string; role?: string; department?: string }): Promise<UserItem> => {
        const response = await apiClient.post('/users', data);
        return response.data;
    },

    updateUser: async (userId: string, data: { email?: string; role?: string; department?: string; is_active?: boolean }): Promise<UserItem> => {
        const response = await apiClient.put(`/users/${userId}`, data);
        return response.data;
    },

    deleteUser: async (userId: string): Promise<{ message: string }> => {
        const response = await apiClient.delete(`/users/${userId}`);
        return response.data;
    },

    batchImportUsers: async (users: Array<{ username: string; email: string; password?: string; role?: string; department?: string }>): Promise<{
        success_count: number;
        failed_count: number;
        total_count: number;
        results: Array<{
            index: number;
            username: string;
            email: string;
            role?: string;
            department?: string;
            status: string;
            password?: string;
            error?: string;
        }>;
    }> => {
        const response = await apiClient.post('/users/batch', { users });
        return response.data;
    },

    // 对话历史相关API
    getChatHistory: async (): Promise<ChatHistoryResponse> => {
        const response = await apiClient.get<ChatHistoryResponse>('/chat/history');
        return response.data;
    },

    getChatSession: async (sessionId: string): Promise<ChatSession> => {
        const response = await apiClient.get<ChatSession>(`/chat/session/${sessionId}`);
        return response.data;
    },

    createChatSession: async (data: ChatSessionCreateRequest): Promise<ChatSessionResponse> => {
        const response = await apiClient.post<ChatSessionResponse>('/chat/session', data);
        return response.data;
    },

    updateChatSession: async (sessionId: string, data: ChatSessionUpdateRequest): Promise<ChatSessionResponse> => {
        const response = await apiClient.put<ChatSessionResponse>(`/chat/session/${sessionId}`, data);
        return response.data;
    },

    deleteChatSession: async (sessionId: string): Promise<{ message: string }> => {
        const response = await apiClient.delete<{ message: string }>(`/chat/session/${sessionId}`);
        return response.data;
    },

    clearChatHistory: async (): Promise<{ message: string }> => {
        const response = await apiClient.delete<{ message: string }>('/chat/history');
        return response.data;
    },
};

export default apiClient;