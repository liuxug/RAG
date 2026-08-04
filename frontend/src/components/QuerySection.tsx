import { useState, useCallback, useEffect } from 'react';
import { Send, Loader2, Globe, ChevronDown } from 'lucide-react';
import debounce from 'lodash.debounce';
import { QueryRequest, QueryResponse } from '../types';

interface QuerySectionProps {
    onQueryComplete: (result: QueryResponse) => void;
    onError: (message: string) => void;
}

export default function QuerySection({ onQueryComplete, onError }: QuerySectionProps) {
    const [question, setQuestion] = useState('');
    const [language, setLanguage] = useState('zh');
    const [isLoading, setIsLoading] = useState(false);
    const [showLanguageMenu, setShowLanguageMenu] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (!question.trim() || isLoading) return;

        setIsLoading(true);

        try {
            const request: QueryRequest = {
                question: question.trim(),
                language,
            };

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '查询失败');
            }

            const result: QueryResponse = await response.json();
            onQueryComplete(result);

        } catch (error) {
            console.error('Query error:', error);
            onError(error instanceof Error ? error.message : '查询失败');
        } finally {
            setIsLoading(false);
        }
    }, [question, language, isLoading, onQueryComplete, onError]);

    const debouncedSubmit = useCallback(
        debounce(() => {
            if (question.trim().length > 10) {
                handleSubmit();
            }
        }, 800),
        [question, handleSubmit]
    );

    useEffect(() => {
        return () => {
            debouncedSubmit.cancel();
        };
    }, [debouncedSubmit]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const languages = [
        { value: 'zh', label: '中文', flag: 'CN' },
        { value: 'en', label: 'English', flag: 'EN' },
    ];

    const currentLanguage = languages.find(l => l.value === language) || languages[0];

    return (
        <div className="container mx-auto px-4 pb-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">知识库查询</h3>
                            <div className="relative">
                                <button
                                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors duration-200"
                                >
                                    <Globe className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700">
                                        {currentLanguage.label}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showLanguageMenu ? 'rotate-180' : ''}`} />
                                </button>

                                {showLanguageMenu && (
                                    <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-10 animate-fadeIn">
                                        {languages.map((lang) => (
                                            <button
                                                key={lang.value}
                                                onClick={() => {
                                                    setLanguage(lang.value);
                                                    setShowLanguageMenu(false);
                                                }}
                                                className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                                                    language === lang.value ? 'text-primary-600 font-medium bg-primary-50' : 'text-gray-700'
                                                }`}
                                            >
                                                <span>{lang.label}</span>
                                                {language === lang.value && (
                                                    <span className="w-2 h-2 bg-primary-500 rounded-full" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="relative">
                            <textarea
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={language === 'zh' ? '请输入您的问题...' : 'Enter your question...'}
                                className="w-full h-28 px-5 py-4 pr-24 text-gray-800 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-400 transition-all duration-200 placeholder-gray-400"
                            />
                            
                            <button
                                onClick={handleSubmit}
                                disabled={!question.trim() || isLoading}
                                className={`absolute right-3 bottom-3 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                                    !question.trim() || isLoading
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-primary-600 to-teal-600 text-white hover:shadow-lg hover:shadow-primary-500/30 hover:-translate-y-0.5'
                                }`}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                            <div className="flex items-center gap-4">
                                <span>按 Enter 提交</span>
                                <span>Shift + Enter 换行</span>
                            </div>
                            {question.length > 10 && (
                                <span className="text-primary-500">检测到长问题，将自动提交...</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
