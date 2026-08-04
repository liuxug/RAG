import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import StatsPanel from '../components/StatsPanel';
import UploadZone from '../components/UploadZone';
import QuerySection from '../components/QuerySection';
import AnswerDisplay from '../components/AnswerDisplay';
import Notification from '../components/Notification';
import { QueryResponse, Notification as NotificationType } from '../types';

export default function Home() {
    const [healthStatus, setHealthStatus] = useState<'healthy' | 'unhealthy' | 'loading'>('loading');
    const [documentCount, setDocumentCount] = useState(0);
    const [chunkCount, setChunkCount] = useState(0);
    const [isStatsLoading, setIsStatsLoading] = useState(true);
    const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
    const [lastQuestion, setLastQuestion] = useState('');
    const [notifications, setNotifications] = useState<NotificationType[]>([]);

    const addNotification = useCallback((type: NotificationType['type'], message: string) => {
        const id = Date.now().toString();
        setNotifications((prev) => [...prev, { id, type, message }]);
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const fetchHealthStatus = useCallback(async () => {
        try {
            setHealthStatus('loading');
            setIsStatsLoading(true);
            
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/health`);
            
            if (response.ok) {
                const data = await response.json();
                setDocumentCount(data.document_count || 0);
                setChunkCount(data.chunk_count || 0);
                setHealthStatus('healthy');
            } else {
                setHealthStatus('unhealthy');
            }
        } catch (error) {
            console.error('Failed to fetch health status:', error);
            setHealthStatus('unhealthy');
        } finally {
            setIsStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealthStatus();
        const interval = setInterval(fetchHealthStatus, 30000);
        return () => clearInterval(interval);
    }, [fetchHealthStatus]);

    const handleUploadComplete = useCallback(() => {
        addNotification('success', '文档上传并索引成功！');
        fetchHealthStatus();
    }, [addNotification, fetchHealthStatus]);

    const handleUploadError = useCallback((message: string) => {
        addNotification('error', message);
    }, [addNotification]);

    const handleQueryComplete = useCallback((result: QueryResponse) => {
        setQueryResult(result);
    }, []);

    const handleQueryError = useCallback((message: string) => {
        addNotification('error', message);
    }, [addNotification]);

    const handleQuestionChange = useCallback((question: string) => {
        setLastQuestion(question);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <Header healthStatus={healthStatus} />
            <StatsPanel 
                documentCount={documentCount} 
                chunkCount={chunkCount} 
                isLoading={isStatsLoading} 
            />
            <UploadZone 
                onUploadComplete={handleUploadComplete} 
                onError={handleUploadError} 
            />
            <QuerySection 
                onQueryComplete={handleQueryComplete} 
                onError={handleQueryError} 
            />
            {queryResult && (
                <AnswerDisplay result={queryResult} question={lastQuestion} />
            )}
            <Notification 
                notifications={notifications} 
                onRemove={removeNotification} 
            />
        </div>
    );
}
