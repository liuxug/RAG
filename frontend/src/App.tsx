import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import DocumentLibrary from '@/pages/DocumentLibrary';
import SearchPage from '@/pages/SearchPage';
import ChatPage from '@/pages/ChatPage';
import DocumentDetail from '@/pages/DocumentDetail';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import UserManagement from '@/pages/UserManagement';
import RoleManagement from '@/pages/RoleManagement';
import GlobalStats from '@/pages/GlobalStats';
import SharePage from '@/pages/SharePage';
import { api } from './utils/api';
import { User, Document } from './types';

type PageType = 'documents' | 'search' | 'chat' | 'document-detail' | 'login' | 'register' | 'user-management' | 'role-management' | 'global-stats' | 'share';

export default function App() {
    const [activeNav, setActiveNav] = useState<PageType>('login');
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

    useEffect(() => {
        const path = window.location.pathname;
        
        if (path.startsWith('/share/')) {
            setActiveNav('share');
            setIsLoading(false);
            return;
        }
        
        const token = localStorage.getItem('access_token');
        if (token) {
            api.verifyToken()
                .then(response => {
                    setUser(response);
                    setActiveNav('documents');
                })
                .catch(() => {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user');
                    setActiveNav('login');
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            setIsLoading(false);
        }
    }, []);

    const handleNavigate = (nav: string, data?: Document | User) => {
        setActiveNav(nav as PageType);
        if (data) {
            if ('name' in data) {
                setSelectedDocument(data as Document);
            } else {
                setUser(data as User);
            }
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        setUser(null);
        setActiveNav('login');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-primary)' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-primary)', animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-primary)', animationDelay: '0.2s' }} />
                </div>
            </div>
        );
    }

    const isAuthPage = activeNav === 'login' || activeNav === 'register';

    if (isAuthPage) {
        return (
            <>
                {activeNav === 'login' && <LoginPage onNavigate={handleNavigate} />}
                {activeNav === 'register' && <RegisterPage onNavigate={handleNavigate} />}
            </>
        );
    }

    if (activeNav === 'share') {
        return <SharePage />;
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
            <Sidebar activeNav={activeNav} onNavChange={handleNavigate} onLogout={handleLogout} user={user} />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {activeNav === 'documents' && <DocumentLibrary onNavigate={handleNavigate} user={user} />}
                {activeNav === 'search' && <SearchPage onNavigate={handleNavigate} user={user} />}
                {activeNav === 'chat' && <ChatPage onNavigate={handleNavigate} user={user} />}
                {activeNav === 'document-detail' && <DocumentDetail onNavigate={handleNavigate} document={selectedDocument} user={user} />}
                {activeNav === 'user-management' && <UserManagement user={user} />}
                {activeNav === 'role-management' && <RoleManagement user={user} />}
                {activeNav === 'global-stats' && <GlobalStats user={user} />}
            </main>
        </div>
    );
}