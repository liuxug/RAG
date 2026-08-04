import { FileText, Database, BookOpen, TrendingUp } from 'lucide-react';

interface StatsPanelProps {
    documentCount: number;
    chunkCount: number;
    isLoading: boolean;
}

export default function StatsPanel({ documentCount, chunkCount, isLoading }: StatsPanelProps) {
    const stats = [
        {
            icon: FileText,
            label: '已上传文档',
            value: documentCount,
            color: 'text-primary-600',
            bgColor: 'bg-primary-50',
            borderColor: 'border-primary-200',
        },
        {
            icon: Database,
            label: '向量数据库',
            value: chunkCount,
            color: 'text-teal-600',
            bgColor: 'bg-teal-50',
            borderColor: 'border-teal-200',
        },
        {
            icon: BookOpen,
            label: '知识库状态',
            value: isLoading ? '加载中' : documentCount > 0 ? '可用' : '空',
            color: isLoading ? 'text-yellow-600' : documentCount > 0 ? 'text-green-600' : 'text-gray-500',
            bgColor: isLoading ? 'bg-yellow-50' : documentCount > 0 ? 'bg-green-50' : 'bg-gray-50',
            borderColor: isLoading ? 'border-yellow-200' : documentCount > 0 ? 'border-green-200' : 'border-gray-200',
        },
    ];

    return (
        <div className="container mx-auto px-4 -mt-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.map((stat, index) => (
                    <div
                        key={index}
                        className={`bg-white rounded-2xl p-5 shadow-lg border transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${stat.borderColor} animate-fadeIn`}
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>
                                    {isLoading && index < 2 ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
                                        </span>
                                    ) : (
                                        typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value
                                    )}
                                </p>
                            </div>
                        </div>
                        {index === 0 && documentCount > 0 && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                                <TrendingUp className="w-3 h-3" />
                                <span>支持 PDF / Markdown / TXT</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
