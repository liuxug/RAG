import { useState, useCallback, useEffect, useRef } from 'react';
import { Bot, Plus, History, Settings2, Send, Paperclip, Copy, FileText, Clock, ChevronDown, Trash2, X, Bookmark } from 'lucide-react';
import { api } from '../utils/api';
import { QueryResponse, Source, KnowledgeGraphNode, Recommendation, StatsResponse, ChatSession as ChatSessionType, ChatMessage, Document, User, DocumentStatus } from '../types';

interface Message {
    id: string;
    type: 'user' | 'ai';
    content: string;
    sources?: Source[];
    isLoading?: boolean;
}

interface ReferenceDoc {
    name: string;
    referenceCount: number;
    score: number;
}

interface ChatPageProps {
    onNavigate?: (nav: string, data?: Document | User) => void;
    user?: User | null;
}

const suggestedQuestions = [
    '绩效考核的评分标准是什么？',
    '年假政策有哪些变化？',
    'API 接口的认证方式有几种？',
];

const questionKeywords = [
    '什么', '怎么', '为什么', '如何', '哪些', '哪里', '哪边',
    '几点', '多少', '几个', '谁', '请问', '告诉我',
    '解释', '说明', '介绍', '分析', '对比', '区别',
    '可以', '能否', '是否', '有没有', '吗', '呢',
];

const greetingKeywords = [
    '你好', '您好', 'hi', 'hello', 'hey', '嗨',
    '谢谢', '感谢', '再见', '拜拜', 'goodbye',
    '早上好', '下午好', '晚上好', '晚安',
    '在吗', '在不', '忙吗',
];

const isQuestion = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length < 2) return false;
    
    const lowerText = trimmed.toLowerCase();
    
    // 检查是否是问候/闲聊
    for (const keyword of greetingKeywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
            // 只有当文本很短，或者只是问候语时才判定为闲聊
            if (trimmed.length <= keyword.length + 5 || trimmed === keyword) {
                return false;
            }
        }
    }
    
    // 检查是否以问号结尾
    if (trimmed.endsWith('？') || trimmed.endsWith('?')) {
        return true;
    }
    
    // 检查是否包含疑问关键词
    for (const keyword of questionKeywords) {
        if (trimmed.includes(keyword)) {
            return true;
        }
    }
    
    // 检查是否包含疑问语气词
    if (trimmed.endsWith('吗') || trimmed.endsWith('呢') || trimmed.endsWith('吧') || trimmed.endsWith('么')) {
        return true;
    }
    
    // 对于较长的文本（>15字符），如果包含问号或关键词，倾向于判定为问题
    if (trimmed.length > 15) {
        // 检查是否包含问句特征
        if (/[？?吗呢吧么]$/.test(trimmed) || 
            /什么|怎么|为什么|如何|哪些|哪里|请问|解释|说明|介绍|分析/.test(trimmed)) {
            return true;
        }
    }
    
    // 默认：较长的内容视为问题
    return trimmed.length >= 5;
};

interface UploadedFile {
        id: string;
        name: string;
        size: number;
        file: File;
        uploaded: boolean;
        uploadProgress: number;
    }

export default function ChatPage({ onNavigate, user }: ChatPageProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            type: 'ai',
            content: '你好！我是基于企业知识库的 AI 助手。你可以向我提问任何与公司文档相关的问题，我会基于最新的文档内容为你提供准确的答案，并标注信息来源。',
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [knowledgeGraphNodes, setKnowledgeGraphNodes] = useState<KnowledgeGraphNode[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [isLastUserQuestion, setIsLastUserQuestion] = useState(true);
    const [documentCount, setDocumentCount] = useState(1286);
    const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatSessionType[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const currentSessionIdRef = useRef<string | null>(null);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [currentLLMType, setCurrentLLMType] = useState<string>('cloud');
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [modelTemperature, setModelTemperature] = useState(0.7);
    const [modelMaxTokens, setModelMaxTokens] = useState(4096);
    const [hasSwitchModelPermission, setHasSwitchModelPermission] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const historyDropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    useEffect(() => {
        currentSessionIdRef.current = currentSessionId;
    }, [currentSessionId]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadStats();
        loadChatHistory();
        loadLLMStatus();
        checkSwitchModelPermission();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target as Node)) {
                setShowHistoryDropdown(false);
            }
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadLLMStatus = async () => {
        try {
            const status = await api.getLLMStatus();
            setCurrentLLMType(status.current_type === 'ollama' ? 'local' : 'cloud');
            setModelTemperature(status.temperature);
            setModelMaxTokens(status.max_tokens);
        } catch (error) {
            console.error('Failed to load LLM status:', error);
        }
    };

    const checkSwitchModelPermission = () => {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                const permissions = user.permissions || [];
                const hasPermission = permissions.some((p: string | { id: string }) => 
                    typeof p === 'string' ? p === 'llm_switch' : p.id === 'llm_switch'
                );
                setHasSwitchModelPermission(hasPermission);
            }
        } catch (error) {
            console.error('Failed to check switch model permission:', error);
            setHasSwitchModelPermission(false);
        }
    };

    const handleSwitchModel = async (type: string) => {
        try {
            const llmType = type === 'local' ? 'ollama' : 'openai';
            const result = await api.switchLLM(llmType, modelTemperature, modelMaxTokens);
            setCurrentLLMType(type);
            setModelTemperature(result.temperature);
            setModelMaxTokens(result.max_tokens);
            setShowModelDropdown(false);
        } catch (error) {
            console.error('Failed to switch model:', error);
        }
    };

    const loadStats = async () => {
        try {
            const stats = await api.getStats();
            setDocumentCount(stats.published_documents);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const loadChatHistory = async () => {
        try {
            const response = await api.getChatHistory();
            setChatHistory(response.sessions || []);
        } catch (error) {
            console.error('Failed to load chat history:', error);
            setChatHistory([]);
        }
    };

    const saveChatHistory = async (currentMessages: Message[]) => {
        if (currentMessages.length <= 1) return;
        
        const sessionTitle = currentMessages.find(m => m.type === 'user')?.content || '未命名对话';
        const sessionId = currentSessionIdRef.current;
        
        // 转换消息格式，包含sources字段
        const chatMessages: ChatMessage[] = currentMessages.map(msg => ({
            type: msg.type === 'ai' ? 'assistant' : 'user',
            content: msg.content,
            timestamp: new Date().toISOString(),
            sources: msg.sources || undefined
        }));
        
        try {
            if (sessionId) {
                // 更新现有会话
                await api.updateChatSession(sessionId, {
                    title: sessionTitle.length > 100 ? sessionTitle.substring(0, 100) : sessionTitle,
                    messages: chatMessages
                });
                // 更新本地状态
                setChatHistory(prevHistory => 
                    prevHistory.map(session => 
                        session.id === sessionId 
                            ? { ...session, title: sessionTitle, messages: chatMessages, updated_at: new Date().toISOString() }
                            : session
                    )
                );
            } else {
                // 创建新会话
                const response = await api.createChatSession({
                    title: sessionTitle.length > 100 ? sessionTitle.substring(0, 100) : sessionTitle,
                    messages: chatMessages
                });
                setCurrentSessionId(response.session.id);
                // 更新本地状态
                setChatHistory(prevHistory => [response.session, ...prevHistory]);
            }
        } catch (error) {
            console.error('Failed to save chat history:', error);
        }
    };

    const deleteChatHistory = async (id: string) => {
        try {
            await api.deleteChatSession(id);
            setChatHistory(prevHistory => prevHistory.filter(session => session.id !== id));
        } catch (error) {
            console.error('Failed to delete chat session:', error);
        }
    };

    const clearAllHistory = async () => {
        try {
            await api.clearChatHistory();
            setChatHistory([]);
            setShowHistoryDropdown(false);
        } catch (error) {
            console.error('Failed to clear chat history:', error);
        }
    };

    const loadChatSession = (session: ChatSessionType) => {
        // 转换消息格式，恢复sources字段
        const convertedMessages: Message[] = session.messages.map(msg => ({
            id: Date.now().toString() + Math.random(),
            type: msg.type === 'assistant' ? 'ai' : 'user',
            content: msg.content,
            sources: msg.sources || undefined
        }));
        setMessages(convertedMessages);
        setCurrentSessionId(session.id);
        setShowHistoryDropdown(false);
        const lastUserMessage = convertedMessages.filter(m => m.type === 'user').pop();
        if (lastUserMessage && isQuestion(lastUserMessage.content)) {
            setIsLastUserQuestion(true);
            fetchRelatedData(lastUserMessage.content);
        } else {
            // 非问题或无用户消息时，清空右侧面板数据
            setIsLastUserQuestion(false);
            setKnowledgeGraphNodes([]);
            setRecommendations([]);
        }
    };

    const fetchRelatedData = async (question: string) => {
        try {
            const [graphResponse, recResponse] = await Promise.all([
                api.getKnowledgeGraph({ question, language: 'zh' }),
                api.getRecommendations({ question, language: 'zh' }),
            ]);

            if (graphResponse.nodes.length > 0) {
                setKnowledgeGraphNodes(graphResponse.nodes);
            }

            if (recResponse.recommendations.length > 0) {
                setRecommendations(recResponse.recommendations);
            }
        } catch (error) {
            console.error('Failed to fetch related data:', error);
        }
    };

    const getReferenceDocs = (): ReferenceDoc[] => {
        // 如果最后一条用户消息不是问题，返回空数组
        if (!isLastUserQuestion) {
            return [];
        }
        
        const docMap: Record<string, { count: number; score: number }> = {};
        
        messages.forEach(msg => {
            if (msg.type === 'ai' && msg.sources) {
                msg.sources.forEach(source => {
                    const sourceName = source.source?.trim();
                    if (!sourceName) return;
                    
                    if (!docMap[sourceName]) {
                        docMap[sourceName] = { count: 0, score: 0 };
                    }
                    docMap[sourceName].count++;
                    docMap[sourceName].score = Math.max(docMap[sourceName].score, source.score);
                });
            }
        });

        return Object.entries(docMap).map(([name, info]) => ({
            name,
            referenceCount: info.count,
            score: info.score,
        }));
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newFiles: UploadedFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            newFiles.push({
                id: Date.now().toString() + '-' + i,
                name: file.name,
                size: file.size,
                file: file,
                uploaded: false,
                uploadProgress: 0,
            });
        }
        setUploadedFiles(prev => [...prev, ...newFiles]);
        e.target.value = '';
    };

    const removeUploadedFile = (id: string) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== id));
    };

    const uploadFiles = async (): Promise<string[]> => {
        const filesToUpload = uploadedFiles.filter(f => !f.uploaded);
        const uploadedNames: string[] = [];

        for (let fileItem of filesToUpload) {
            try {
                setUploadedFiles(prev => prev.map(f => 
                    f.id === fileItem.id ? { ...f, uploadProgress: 30 } : f
                ));
                
                const response = await api.uploadTemporary(fileItem.file);
                uploadedNames.push(response.file_name);
                
                setUploadedFiles(prev => prev.map(f => 
                    f.id === fileItem.id ? { ...f, uploadProgress: 100, uploaded: true } : f
                ));
            } catch (error) {
                console.error('Failed to upload file:', error);
                setUploadedFiles(prev => prev.map(f => 
                    f.id === fileItem.id ? { ...f, uploadProgress: -1 } : f
                ));
            }
        }

        return uploadedNames;
    };

    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || isLoading || isUploading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            type: 'user',
            content: inputValue.trim(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        const loadingMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: 'ai',
            content: '',
            isLoading: true,
        };
        setMessages(prev => [...prev, loadingMessage]);

        // 判断用户输入是否为有效问题
        const isUserQuestion = isQuestion(userMessage.content);

        try {
            let sourceFilter: string[] | undefined = undefined;
            
            if (uploadedFiles.length > 0) {
                setIsUploading(true);
                const uploadedNames = await uploadFiles();
                if (uploadedNames.length > 0) {
                    sourceFilter = uploadedNames;
                }
                setIsUploading(false);
                setUploadedFiles([]);
            }

            // 如果不是问题，只获取对话回答，不获取知识图谱和推荐
            if (!isUserQuestion) {
                const response = await api.query({
                    question: userMessage.content,
                    language: 'zh',
                    source_filter: sourceFilter,
                });

                const aiMessage: Message = {
                    id: loadingMessage.id,
                    type: 'ai',
                    content: response.answer,
                    sources: [], // 非问题时不保存来源
                    isLoading: false,
                };

                const updatedMessages = messages.concat([userMessage, aiMessage]);
                setMessages(prev => prev.map(msg => 
                    msg.id === loadingMessage.id ? aiMessage : msg
                ));

                // 非问题时清空右侧面板数据
                setKnowledgeGraphNodes([]);
                setRecommendations([]);
                setIsLastUserQuestion(false);

                saveChatHistory(updatedMessages);
            } else {
                const [response, graphResponse, recResponse] = await Promise.all([
                    api.query({
                        question: userMessage.content,
                        language: 'zh',
                        source_filter: sourceFilter,
                    }),
                    api.getKnowledgeGraph({
                        question: userMessage.content,
                        language: 'zh',
                    }),
                    api.getRecommendations({
                        question: userMessage.content,
                        language: 'zh',
                    }),
                ]);

                // 判断是否在知识库中找到相关信息
                const noInfoKeywords = ['未找到相关信息', '知识库中未找到', '未找到相关', '没有找到相关'];
                const hasNoInfoAnswer = noInfoKeywords.some(keyword => response.answer.includes(keyword));
                const hasSources = response.sources && response.sources.length > 0;
                const hasFoundInfo = !hasNoInfoAnswer && hasSources;

                const aiMessage: Message = {
                    id: loadingMessage.id,
                    type: 'ai',
                    content: response.answer,
                    sources: hasFoundInfo ? response.sources : [],
                    isLoading: false,
                };

                const updatedMessages = messages.concat([userMessage, aiMessage]);
                setMessages(prev => prev.map(msg => 
                    msg.id === loadingMessage.id ? aiMessage : msg
                ));

                if (hasFoundInfo) {
                    if (graphResponse.nodes.length > 0) {
                        setKnowledgeGraphNodes(graphResponse.nodes);
                    }
                    if (recResponse.recommendations.length > 0) {
                        setRecommendations(recResponse.recommendations);
                    }
                    setIsLastUserQuestion(true);
                } else {
                    // 知识库未查到相关信息时，清空右侧面板数据
                    setKnowledgeGraphNodes([]);
                    setRecommendations([]);
                    setIsLastUserQuestion(false);
                }

                saveChatHistory(updatedMessages);
            }
        } catch (error) {
            const errorMessage: Message = {
                id: loadingMessage.id,
                type: 'ai',
                content: '抱歉，我遇到了一些问题，请稍后再试。',
                isLoading: false,
            };
            setMessages(prev => prev.map(msg => 
                msg.id === loadingMessage.id ? errorMessage : msg
            ));
        } finally {
            setIsLoading(false);
            setIsUploading(false);
        }
    }, [inputValue, isLoading, isUploading, uploadedFiles]);

    const handleNewChat = () => {
        saveChatHistory(messages);
        setMessages([{
            id: '1',
            type: 'ai',
            content: '你好！我是基于企业知识库的 AI 助手。你可以向我提问任何与公司文档相关的问题，我会基于最新的文档内容为你提供准确的答案，并标注信息来源。',
        }]);
        setCurrentSessionId(null);
        setKnowledgeGraphNodes([]);
        setRecommendations([]);
        setIsLastUserQuestion(true);
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSuggestedQuestion = (question: string) => {
        setInputValue(question);
    };

    const getScoreLabel = (score: number) => {
        if (score >= 0.7) return '高相关';
        if (score >= 0.4) return '相关';
        return '参考';
    };

    const getScoreColor = (score: number) => {
        if (score >= 0.7) return { bg: 'var(--color-primary-light)', text: 'var(--color-primary)' };
        return { bg: 'var(--tag-general)', text: 'var(--tag-general-text)' };
    };

    const getCategoryIconColor = (category: string) => {
        switch (category) {
            case '技术':
                return { bg: 'var(--tag-tech)', text: 'var(--tag-tech-text)' };
            case '人力资源':
                return { bg: 'var(--tag-hr)', text: 'var(--tag-hr-text)' };
            case '财务':
                return { bg: 'var(--tag-finance)', text: 'var(--tag-finance-text)' };
            case '法务':
                return { bg: 'var(--tag-legal)', text: 'var(--tag-legal-text)' };
            case '市场':
                return { bg: 'var(--tag-general)', text: 'var(--tag-general-text)' };
            case '产品':
                return { bg: 'var(--tag-general)', text: 'var(--tag-general-text)' };
            default:
                return { bg: 'var(--tag-general)', text: 'var(--tag-general-text)' };
        }
    };

    const referenceDocs = getReferenceDocs();

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        
        if (hours < 1) return '刚刚';
        if (hours < 24) return `${hours}小时前`;
        
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}天前`;
        
        return date.toLocaleDateString('zh-CN');
    };

    return (
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
            <header className="h-[56px] shrink-0 flex items-center justify-between px-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 min-w-0">
                    <ChevronDown className="w-[14px] h-[14px] shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>AI 对话</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    {/* <button className="flex items-center justify-center w-9 h-9 transition-colors duration-150" style={{ color: 'var(--color-text-secondary)' }}>
                        <Clock className="w-[18px] h-[18px]" />
                    </button>
                    <button className="flex items-center justify-center w-9 h-9 transition-colors duration-150" style={{ color: 'var(--color-text-secondary)' }}>
                        <Settings2 className="w-[18px] h-[18px]" />
                    </button> */}
                    <button className="flex items-center gap-2 pl-3 transition-colors duration-150" style={{ borderLeft: '1px solid var(--color-border)' }}>
                        <div className="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                            <span>张</span>
                        </div>
                        <ChevronDown className="w-[14px] h-[14px]" style={{ color: 'var(--color-text-tertiary)' }} />
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="flex-1 flex flex-col min-w-0" style={{ maxWidth: '70%' }}>
                    <div className="shrink-0 flex items-center justify-between px-6 py-4" style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                                <Bot className="w-[18px] h-[18px]" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>AI 知识助手</h1>
                                <p className="text-[12px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>基于 RAG 的智能文档问答</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button 
                                onClick={handleNewChat}
                                className="inline-flex items-center gap-2 px-3 py-[7px] text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}
                            >
                                <Plus className="w-4 h-4" />
                                <span>新建对话</span>
                            </button>
                            <div className="relative">
                                <button 
                                    onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                                    className="inline-flex items-center gap-1.5 px-3 py-[7px] text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}
                                >
                                    <History className="w-4 h-4" />
                                    <span>对话历史</span>
                                    <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${showHistoryDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showHistoryDropdown && (
                                    <div ref={historyDropdownRef} className="absolute right-0 top-full mt-2 w-[280px] z-50" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                                        <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderBottomColor: 'var(--color-border-light)' }}>
                                            <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>最近对话</span>
                                            {chatHistory.length > 0 && (
                                                <button onClick={clearAllHistory} className="inline-flex items-center gap-1 text-[11px] transition-colors duration-150" style={{ color: 'var(--color-text-tertiary)' }}>
                                                    <Trash2 className="w-3 h-3" />
                                                    <span>清空</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto">
                                            {chatHistory.length > 0 ? (
                                                chatHistory.map((session) => (
                                                    <div 
                                                        key={session.id}
                                                        onClick={() => loadChatSession(session)}
                                                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-[var(--color-bg-hover)]"
                                                    >
                                                        <div className="w-7 h-7 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                                                            <Bot className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{session.title}</p>
                                                            <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{formatDate(session.created_at)}</p>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteChatHistory(session.id);
                                                            }}
                                                            className="shrink-0 p-1 transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]" style={{ color: 'var(--color-text-tertiary)' }}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
                                                    <History className="w-8 h-8 mb-2" />
                                                    <span className="text-[12px]">暂无对话历史</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {hasSwitchModelPermission && (
                                <div className="relative">
                                    <button 
                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                        className="inline-flex items-center gap-1.5 px-3 py-[7px] text-[13px] font-medium whitespace-nowrap transition-colors duration-150" 
                                        style={{ backgroundColor: currentLLMType === 'cloud' ? 'var(--color-primary)' : 'var(--color-bg-tertiary)', color: currentLLMType === 'cloud' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}
                                    >
                                        <span>{currentLLMType === 'cloud' ? '☁️ 云端模型' : '💻 本地模型'}</span>
                                        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${showModelDropdown ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showModelDropdown && (
                                        <div ref={modelDropdownRef} className="absolute right-0 top-full mt-2 w-[280px] z-50" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                                            <div className="px-3 py-2 border-b" style={{ borderBottomColor: 'var(--color-border-light)' }}>
                                                <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>模型设置</span>
                                            </div>
                                            <div className="p-3">
                                                <div className="space-y-3">
                                                    <div 
                                                        onClick={() => handleSwitchModel('cloud')}
                                                        className={`flex items-center gap-3 p-2.5 cursor-pointer rounded-lg transition-colors duration-150 ${currentLLMType === 'cloud' ? 'bg-[var(--color-primary-light)]' : 'hover:bg-[var(--color-bg-hover)]'}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${currentLLMType === 'cloud' ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]' : 'bg-[var(--color-bg-tertiary)]'}`}>
                                                            ☁️
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>云端模型</p>
                                                            <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>GPT-4o-mini，响应快速，知识更新</p>
                                                        </div>
                                                        {currentLLMType === 'cloud' && (
                                                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                                                        )}
                                                    </div>
                                                    <div 
                                                        onClick={() => handleSwitchModel('local')}
                                                        className={`flex items-center gap-3 p-2.5 cursor-pointer rounded-lg transition-colors duration-150 ${currentLLMType === 'local' ? 'bg-[var(--color-primary-light)]' : 'hover:bg-[var(--color-bg-hover)]'}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${currentLLMType === 'local' ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]' : 'bg-[var(--color-bg-tertiary)]'}`}>
                                                            💻
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>本地模型</p>
                                                            <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Qwen2.5，数据不出网，安全可控</p>
                                                        </div>
                                                        {currentLLMType === 'local' && (
                                                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-3 border-t" style={{ borderTopColor: 'var(--color-border-light)' }}>
                                                    <div className="mb-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>温度参数</span>
                                                            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{modelTemperature}</span>
                                                        </div>
                                                        <input 
                                                            type="range" 
                                                            min="0" 
                                                            max="1" 
                                                            step="0.1" 
                                                            value={modelTemperature}
                                                            onChange={(e) => setModelTemperature(parseFloat(e.target.value))}
                                                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                                            style={{ backgroundColor: 'var(--color-border-light)' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>最大上下文</span>
                                                            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{modelMaxTokens} tokens</span>
                                                        </div>
                                                        <select 
                                                            value={modelMaxTokens}
                                                            onChange={(e) => setModelMaxTokens(parseInt(e.target.value))}
                                                            className="w-full px-2 py-1.5 text-[12px] rounded border-none outline-none cursor-pointer"
                                                            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
                                                        >
                                                            <option value={2048}>2048 tokens</option>
                                                            <option value={4096}>4096 tokens</option>
                                                            <option value={8192}>8192 tokens</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div 
                        ref={chatContainerRef}
                        className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin" 
                        style={{ backgroundColor: 'var(--color-bg)' }}
                    >
                        <div className="flex flex-col gap-6 max-w-[780px] mx-auto">
                            {messages.map((message) => (
                                <div key={message.id} className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : ''}`}>
                                    {message.type === 'ai' ? (
                                        <>
                                            <div className="w-8 h-8 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}>
                                                <Bot className="w-[16px] h-[16px]" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>知识助手</p>
                                                <div className="px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                                                    {message.isLoading ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex gap-1.5">
                                                                <span className="w-2 h-2 inline-block animate-bounce-dot" style={{ backgroundColor: 'var(--color-text-tertiary)' }} />
                                                                <span className="w-2 h-2 inline-block animate-bounce-dot" style={{ backgroundColor: 'var(--color-text-tertiary)', animationDelay: '0.16s' }} />
                                                                <span className="w-2 h-2 inline-block animate-bounce-dot" style={{ backgroundColor: 'var(--color-text-tertiary)', animationDelay: '0.32s' }} />
                                                            </div>
                                                            <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>正在检索相关文档...</p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{message.content}</p>
                                                    )}
                                                </div>

                                                {message.sources && message.sources.length > 0 && !message.isLoading && (
                                                    <>
                                                        <div className="flex flex-col gap-2 mt-3">
                                                            <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>引用来源</p>
                                                            <div className="flex flex-col gap-2">
                                                                {message.sources.map((source, index) => {
                                                                    const scoreColor = getScoreColor(source.score);
                                                                    return (
                                                                        <button key={index} className="flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                                                                            <div className="w-8 h-8 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--tag-tech)', color: 'var(--tag-tech-text)' }}>
                                                                                <FileText className="w-4 h-4" />
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{source.source}</p>
                                                                                <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>第 {source.page} 页</p>
                                                                            </div>
                                                                            <span className="shrink-0 inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: scoreColor.bg, color: scoreColor.text }}>
                                                                                {getScoreLabel(source.score)}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 mt-3">
                                                            <button 
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(message.content).then(() => {
                                                                        const btn = document.querySelector(`[data-copy-btn="${message.id}"]`);
                                                                        if (btn) {
                                                                            const icon = btn.querySelector('svg');
                                                                            const text = btn.querySelector('span');
                                                                            if (icon) icon.innerHTML = '<path fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></path>';
                                                                            if (text) text.textContent = '已复制';
                                                                            setTimeout(() => {
                                                                                if (icon) icon.innerHTML = '<path fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></path>';
                                                                                if (text) text.textContent = '复制回答';
                                                                            }, 2000);
                                                                        }
                                                                    }).catch(err => {
                                                                        console.error('复制失败:', err);
                                                                    });
                                                                }}
                                                                data-copy-btn={message.id}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--color-text-tertiary)' }}
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                                <span>复制回答</span>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="min-w-0 flex-1 flex flex-col items-end">
                                                <p className="text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>张明</p>
                                                <div className="px-4 py-3 max-w-[85%]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}>
                                                    <p className="text-[14px] leading-relaxed">{message.content}</p>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 shrink-0 flex items-center justify-center text-[12px] font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                                                <span>张</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}

                            {messages.length === 1 && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}>
                                        <Bot className="w-[16px] h-[16px]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {suggestedQuestions.map((question, index) => (
                                                <button 
                                                    key={index}
                                                    onClick={() => handleSuggestedQuestion(question)}
                                                    className="inline-flex items-center gap-2 px-3 py-2 text-[12px] whitespace-nowrap transition-colors duration-150" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-secondary)' }}
                                                >
                                                    <FileText className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="truncate">{question}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 px-6 py-4" style={{ backgroundColor: 'var(--color-bg-secondary)', borderTop: '1px solid var(--color-border)' }}>
                        <div className="max-w-[780px] mx-auto">
                            {uploadedFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {uploadedFiles.map(file => (
                                        <div 
                                            key={file.id} 
                                            className="flex items-center gap-2 px-3 py-1.5 text-[12px]" 
                                            style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-light)', borderRadius: '4px' }}
                                        >
                                            <FileText className="w-[14px] h-[14px]" style={{ color: 'var(--color-text-tertiary)' }} />
                                            <span className="truncate max-w-[150px]" style={{ color: 'var(--color-text-secondary)' }}>{file.name}</span>
                                            {file.uploadProgress === -1 && (
                                                <span className="text-red-500">上传失败</span>
                                            )}
                                            {file.uploadProgress > 0 && file.uploadProgress < 100 && (
                                                <span style={{ color: 'var(--color-primary)' }}>{file.uploadProgress}%</span>
                                            )}
                                            {file.uploadProgress === 100 && (
                                                <span style={{ color: 'var(--color-success)' }}>已上传</span>
                                            )}
                                            <button 
                                                onClick={() => removeUploadedFile(file.id)}
                                                className="hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-[14px] h-[14px]" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-end gap-2" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
                                <label className="flex items-center justify-center w-10 h-10 shrink-0 transition-colors duration-150 cursor-pointer hover:bg-[var(--color-bg-tertiary)]" style={{ color: 'var(--color-text-tertiary)' }}>
                                    <Paperclip className="w-[18px] h-[18px]" />
                                    <input 
                                        ref={fileInputRef}
                                        type="file" 
                                        multiple 
                                        accept=".pdf,.md,.txt,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.json,.xml,.html,.htm,.jpg,.jpeg,.png,.gif,.bmp,.ods,.odt"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </label>
                                <textarea 
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="输入你的问题，按 Enter 发送..."
                                    className="flex-1 resize-none py-2.5 text-[14px] min-h-[40px] leading-relaxed focus:outline-none" style={{ backgroundColor: 'transparent', color: 'var(--color-text-primary)' }}
                                    rows={2}
                                />
                                <button 
                                    onClick={handleSend}
                                    disabled={!inputValue.trim() || isLoading}
                                    className="flex items-center justify-center w-10 h-10 shrink-0 transition-colors duration-150" style={{ backgroundColor: !inputValue.trim() || isLoading ? 'var(--color-bg-tertiary)' : 'var(--color-primary)', color: !inputValue.trim() || isLoading ? 'var(--color-text-tertiary)' : 'var(--color-text-inverse)' }}
                                >
                                    <Send className="w-[18px] h-[18px]" />
                                </button>
                            </div>
                            <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--color-text-tertiary)' }}>基于 {documentCount.toLocaleString()} 篇文档进行智能检索 · 支持上传文档辅助提问</p>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 overflow-y-auto scrollbar-thin" style={{ width: '30%', minWidth: '300px', borderLeft: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
                    <div className="flex flex-col gap-5 p-5">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>当前对话引用</h2>
                                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-medium rounded" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>已引用 {referenceDocs.length} 篇文档</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {referenceDocs.length > 0 ? (
                                    referenceDocs.map((doc, index) => {
                                        const scoreColor = getScoreColor(doc.score);
                                        const fileType = doc.name.split('.').pop()?.toUpperCase() || '其他';
                                        const matchRate = `${Math.round(doc.score * 100)}%`;
                                        
                                        return (
                                            <div key={index} className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors duration-150 cursor-pointer" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                                                <div className="w-7 h-7 shrink-0 flex items-center justify-center rounded" style={{ backgroundColor: 'var(--tag-tech)', color: 'var(--tag-tech-text)' }}>
                                                    <FileText className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{doc.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{fileType}</span>
                                                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border-light)' }}>引用 {doc.referenceCount} 次</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-0.5 shrink-0">
                                                    <span className="text-[11px] font-semibold" style={{ color: scoreColor.text }}>{matchRate}</span>
                                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ backgroundColor: scoreColor.bg, color: scoreColor.text }}>{getScoreLabel(doc.score)}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-8 rounded" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                                        <Bookmark className="w-8 h-8" style={{ color: 'var(--color-text-tertiary)' }} />
                                        <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>暂无引用文档</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>知识图谱</h2>
                            <div className="relative px-4 py-6 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                                {knowledgeGraphNodes.length > 0 ? (
                                    <div className="relative" style={{ width: '240px', height: '200px' }}>
                                        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
                                            {knowledgeGraphNodes.filter(n => n.position !== 'center').map((node, idx) => {
                                                const centerX = 120;
                                                const centerY = 100;
                                                let nodeX = 0, nodeY = 0;
                                                
                                                switch (node.position) {
                                                    case 'top-left': nodeX = 30; nodeY = 20; break;
                                                    case 'top-right': nodeX = 210; nodeY = 20; break;
                                                    case 'bottom-left': nodeX = 30; nodeY = 180; break;
                                                    case 'bottom-right': nodeX = 210; nodeY = 180; break;
                                                    default: nodeX = centerX; nodeY = centerY;
                                                }
                                                
                                                return (
                                                    <line
                                                        key={`line-${node.id}`}
                                                        x1={centerX}
                                                        y1={centerY}
                                                        x2={nodeX}
                                                        y2={nodeY}
                                                        stroke="var(--color-border)"
                                                        strokeWidth="1"
                                                        strokeDasharray="4,2"
                                                        className="animate-fadeIn"
                                                        style={{ animationDelay: `${idx * 0.1}s` }}
                                                    />
                                                );
                                            })}
                                        </svg>
                                        {knowledgeGraphNodes.map((node, idx) => {
                                            const isCenter = node.position === 'center';
                                            const isCategory = node.id.startsWith('cat');
                                            let left = 0, top = 0;
                                            
                                            switch (node.position) {
                                                case 'top-left': left = 0; top = 0; break;
                                                case 'top-right': left = 140; top = 0; break;
                                                case 'bottom-left': left = 0; top = 150; break;
                                                case 'bottom-right': left = 140; top = 150; break;
                                                default: left = 85; top = 80;
                                            }
                                            
                                            return (
                                                <div 
                                                    key={node.id}
                                                    className="absolute flex items-center justify-center whitespace-nowrap px-2.5 py-1.5 text-[11px] font-medium rounded"
                                                    style={{
                                                        left: isCenter ? '50%' : left,
                                                        top: isCenter ? '50%' : top,
                                                        transform: isCenter ? 'translate(-50%, -50%)' : 'none',
                                                        backgroundColor: isCenter ? 'var(--color-primary)' : isCategory ? 'var(--tag-tech)' : 'var(--color-bg-secondary)',
                                                        color: isCenter ? 'var(--color-text-inverse)' : isCategory ? 'var(--tag-tech-text)' : 'var(--color-text-secondary)',
                                                        border: isCenter ? 'none' : '1px solid var(--color-border-light)',
                                                        zIndex: 2,
                                                        boxShadow: isCenter ? '0 2px 8px rgba(43, 94, 167, 0.3)' : 'none',
                                                        animation: 'fadeIn 0.3s ease-out forwards',
                                                        animationDelay: `${idx * 0.08}s`,
                                                        opacity: 0,
                                                    }}
                                                >
                                                    {node.label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-8">
                                        <div className="w-10 h-10 flex items-center justify-center rounded-full" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        </div>
                                        <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>发送问题后显示知识图谱</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>推荐阅读</h2>
                            <div className="flex flex-col gap-2">
                                {recommendations.length > 0 ? (
                                    recommendations.map((doc) => {
                                        const iconColor = getCategoryIconColor(doc.category);
                                        const handleView = async () => {
                                            try {
                                                const detail = await api.getDocumentDetail(doc.name);
                                                const document: Document = {
                                                    id: doc.id,
                                                    name: detail.name,
                                                    type: detail.type || 'pdf',
                                                    category: detail.category || '',
                                                    createTime: detail.createTime || '',
                                                    updateTime: detail.updateTime || '',
                                                    status: (detail.status || '已发布') as DocumentStatus,
                                                    isFavorite: false,
                                                    pages: detail.pages || 0,
                                                    chunks: detail.chunks || 0,
                                                    author: detail.author || '',
                                                    review_comment: detail.review_comment || '',
                                                };
                                                onNavigate?.('document-detail', document);
                                            } catch (error) {
                                                console.error('Failed to navigate to document detail:', error);
                                            }
                                        };
                                        
                                        return (
                                            <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors duration-150 cursor-pointer" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                                                <div className="w-7 h-7 shrink-0 flex items-center justify-center rounded" style={{ backgroundColor: iconColor.bg, color: iconColor.text }}>
                                                    <FileText className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{doc.name}</p>
                                                    <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{doc.category}</p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ backgroundColor: 'var(--tag-tech)', color: 'var(--tag-tech-text)' }}>{doc.matchRate}</span>
                                                    <button onClick={handleView} className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-medium whitespace-nowrap rounded hover:bg-[var(--color-primary-light)] transition-colors duration-150" style={{ color: 'var(--color-primary)' }}>查看</button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-8 rounded" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                                        <div className="w-10 h-10 flex items-center justify-center rounded-full" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        </div>
                                        <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>发送问题后显示推荐文档</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}