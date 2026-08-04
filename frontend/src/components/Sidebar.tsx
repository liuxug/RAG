import { FolderOpen, Search, MessageSquare, LogOut, Users, Shield, LayoutGrid } from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
    activeNav: string;
    onNavChange: (nav: string) => void;
    onLogout?: () => void;
    user?: User | null;
}

const navItems = [
    { id: 'documents', label: '文档库', icon: FolderOpen, requiredPermission: 'doc_view' },
    { id: 'search', label: '智能检索', icon: Search, requiredPermission: 'search' },
    { id: 'chat', label: 'AI 对话', icon: MessageSquare, requiredPermission: 'chat' },
];

const systemNavItems = [
    { id: 'global-stats', label: '全局统计', icon: LayoutGrid, requiredPermission: 'stats_view' },
    { id: 'role-management', label: '角色管理', icon: Shield, requiredPermission: 'role_view' },
    { id: 'user-management', label: '用户管理', icon: Users, requiredPermission: 'user_view' },
];

const hasPermission = (user: User | null | undefined, permission: string): boolean => {
    if (!user) return false;
    if (user.role === '超级管理员') return true;
    return user.permissions?.includes(permission) ?? false;
};

export default function Sidebar({ activeNav, onNavChange, onLogout, user }: SidebarProps) {
    const username = user?.username || '用户';
    const initial = username.charAt(0).toUpperCase();
    return (
        <aside className="hidden-sm w-[240px] min-w-[240px] h-screen sticky top-0 flex flex-col" style={{ backgroundColor: 'var(--color-primary)' }}>
            <div className="flex items-center gap-3 px-6 h-[56px] shrink-0">
                <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-inverse)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                </svg>
                 {/* <img src="/images/Logo.jpg" alt="logo" className="w-7 h-7 shrink-0"/> */}
                <span className="text-[var(--color-text-inverse)] font-semibold text-[15px] tracking-tight whitespace-nowrap truncate">智识RAG文档问答中台</span>
            </div>

            <nav className="flex flex-col gap-1 px-3 mt-2">
                {navItems.filter(item => hasPermission(user, item.requiredPermission)).map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavChange(item.id)}
                            className={`nav-sidebar-item flex items-center gap-3 px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors duration-150 ${
                                isActive
                                    ? 'bg-white/12 border-l-[3px] border-l-white/90 font-semibold'
                                    : 'border-l-[3px] border-l-transparent hover:bg-white/6'
                            }`}
                            style={{ color: 'var(--color-text-inverse)' }}
                            data-active={isActive}
                        >
                            <Icon className="w-[18px] h-[18px] shrink-0" style={{ color: 'var(--color-text-inverse)' }} />
                            <span className="truncate">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="my-3 mx-2" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}></div>

            <p className="px-3 mb-1 text-[11px] font-medium whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>系统管理</p>
            <nav className="flex flex-col gap-1 px-3">
                {systemNavItems.filter(item => hasPermission(user, item.requiredPermission)).map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavChange(item.id)}
                            className={`nav-sidebar-item flex items-center gap-3 px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors duration-150 ${
                                isActive
                                    ? 'bg-white/12 border-l-[3px] border-l-white/90 font-semibold'
                                    : 'border-l-[3px] border-l-transparent hover:bg-white/6'
                            }`}
                            style={{ color: 'var(--color-text-inverse)' }}
                            data-active={isActive}
                        >
                            <Icon className="w-[18px] h-[18px] shrink-0" style={{ color: 'var(--color-text-inverse)' }} />
                            <span className="truncate">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="flex-1"></div>

            <div className="px-5 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 shrink-0 flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: 'var(--color-text-inverse)' }}>
                        <span>{initial}</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-medium whitespace-nowrap truncate" style={{ color: 'var(--color-text-inverse)' }}>{username}</p>
                        <p className="text-[11px] whitespace-nowrap truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{user?.email}</p>
                    </div>
                </div>
                {onLogout && (
                    <button 
                        onClick={onLogout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors duration-150" 
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
                        onMouseOver={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.15)'}
                        onMouseOut={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)'}
                    >
                        <LogOut className="w-[16px] h-[16px]" />
                        <span>退出登录</span>
                    </button>
                )}
            </div>
        </aside>
    );
}