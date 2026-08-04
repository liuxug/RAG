import { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, FileText, BookOpen, Copy, Check } from 'lucide-react';
import { QueryResponse, Source } from '../types';

interface AnswerDisplayProps {
    result: QueryResponse;
    question: string;
}

export default function AnswerDisplay({ result, question }: AnswerDisplayProps) {
    const [showSources, setShowSources] = useState(true);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(result.answer);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatAnswer = (answer: string) => {
        return answer.split('\n').map((paragraph, index) => (
            <p key={index} className="mb-4 last:mb-0 leading-relaxed">
                {paragraph}
            </p>
        ));
    };

    const getScoreColor = (score: number) => {
        if (score >= 0.7) return 'text-green-600 bg-green-50';
        if (score >= 0.4) return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 0.7) return '高相关';
        if (score >= 0.4) return '中等相关';
        return '低相关';
    };

    return (
        <div className="container mx-auto px-4 pb-8">
            <div className="max-w-3xl mx-auto animate-fadeIn">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary-50 to-teal-50 px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">AI 回答</h3>
                                <p className="text-sm text-gray-500 mt-0.5">基于知识库检索生成</p>
                            </div>
                            <button
                                onClick={handleCopy}
                                className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-green-600">已复制</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 text-gray-600" />
                                        <span className="text-sm text-gray-600">复制答案</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                            <p className="text-sm text-gray-500 font-medium mb-2">您的问题</p>
                            <p className="text-gray-800">{question}</p>
                        </div>

                        <div className="prose prose-lg max-w-none">
                            {formatAnswer(result.answer)}
                        </div>

                        {result.sources && result.sources.length > 0 && (
                            <div className="mt-8">
                                <button
                                    onClick={() => setShowSources(!showSources)}
                                    className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                                >
                                    {showSources ? (
                                        <>
                                            <ChevronUp className="w-4 h-4" />
                                            <span>收起引用来源</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="w-4 h-4" />
                                            <span>展开引用来源 ({result.sources.length})</span>
                                        </>
                                    )}
                                </button>

                                {showSources && (
                                    <div className="mt-4 space-y-3 animate-slideIn">
                                        {result.sources.map((source: Source, index: number) => (
                                            <div
                                                key={index}
                                                className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary-200 transition-colors"
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                                                            <FileText className="w-4 h-4 text-primary-600" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-800">{source.source}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <BookOpen className="w-3 h-3 text-gray-400" />
                                                                <span className="text-sm text-gray-500">第 {source.page} 页</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(source.score)}`}>
                                                        {getScoreLabel(source.score)} ({(source.score * 100).toFixed(0)}%)
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 line-clamp-3">
                                                    {source.content}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
