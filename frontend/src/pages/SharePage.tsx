import { useState, useEffect } from 'react';
import { FileText, Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = '/api';

export default function SharePage() {
    const [token, setToken] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [document, setDocument] = useState<any>(null);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const path = window.location.pathname;
        const match = path.match(/\/share\/([a-zA-Z0-9]+)/);
        if (match) {
            setToken(match[1]);
        }
    }, []);

    useEffect(() => {
        if (!token) return;

        const fetchDocument = async () => {
            try {
                setLoading(true);
                setError('');
                
                const response = await axios.get(`${API_BASE_URL}/share/${token}`);
                setDocument(response.data);
            } catch (err: any) {
                setError(err.response?.data?.detail || err.message || '无法访问分享链接');
            } finally {
                setLoading(false);
            }
        };

        fetchDocument();
    }, [token]);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('zh-CN');
    };

    const renderContent = (content: string) => {
        if (!content) return null;
        
        const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g);
        
        return parts.map((part, index) => {
            if (part.startsWith('```')) {
                const code = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
                return (
                    <pre key={index} className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto my-4 font-mono">
                        <code>{code}</code>
                    </pre>
                );
            } else if (part.startsWith('`') && part.endsWith('`')) {
                return (
                    <code key={index} className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
                        {part.slice(1, -1)}
                    </code>
                );
            }
            return part;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#f5f7fa' }}>
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1e40af' }} />
                    <p className="text-gray-600">正在加载文档...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#f5f7fa' }}>
                <div className="flex flex-col items-center gap-4 max-w-md mx-4">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800">分享链接无效或已过期</h2>
                    <p className="text-gray-600 text-center">{error}</p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        返回首页
                    </button>
                </div>
            </div>
        );
    }

    if (!document) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#f5f7fa' }}>
                <div className="flex flex-col items-center gap-4">
                    <AlertCircle className="w-12 h-12 text-gray-400" />
                    <p className="text-gray-600">文档未找到</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: '#f5f7fa' }}>
            <header className="bg-white shadow-sm border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-800">{document.name}</h1>
                            <p className="text-sm text-gray-500">
                                {document.category} · {document.type} · {document.pages}页 · {document.chunks}个段落
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            分享文档
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            创建时间: {formatDate(document.createTime)}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            更新时间: {formatDate(document.updateTime)}
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6">
                        <div className="space-y-6">
                            {(document.all_chunks || []).map((chunk: any, index: number) => (
                                <div key={chunk.chunk_id || index} className="border-b border-gray-100 pb-6 last:border-0">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-gray-500">
                                            第 {chunk.page || 1} 页 · 段落 {index + 1}
                                        </span>
                                    </div>
                                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                        {renderContent(chunk.content)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center text-sm text-gray-400">
                    <p>此分享链接有效期为24小时</p>
                </div>
            </main>
        </div>
    );
}