import { useState, useEffect, useCallback } from 'react';
import { User, Lock, Eye, EyeOff, Building2 } from 'lucide-react';
import { api } from '../utils/api';
import { LoginRequest, User as UserType } from '../types';
import debounce from 'lodash.debounce';

interface LoginPageProps {
    onNavigate: (path: string, user?: UserType) => void;
}

export default function LoginPage({ onNavigate }: LoginPageProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    useEffect(() => {
        const savedUsername = localStorage.getItem('saved_username');
        if (savedUsername) {
            setUsername(savedUsername);
            setRememberMe(true);
        }
    }, []);

    const debouncedSetError = useCallback(
        debounce((msg: string) => {
            setError(msg);
        }, 100),
        []
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            debouncedSetError('请输入用户名和密码');
            return;
        }

        setIsLoading(true);

        try {
            const request: LoginRequest = {
                username: username.trim(),
                password: password.trim(),
            };

            const response = await api.login(request);

            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('user', JSON.stringify(response.user));

            if (rememberMe) {
                localStorage.setItem('saved_username', username.trim());
            } else {
                localStorage.removeItem('saved_username');
            }

            onNavigate('documents', response.user);
        } catch (err: any) {
            const errMsg = err.response?.data?.detail || '登录失败，请重试';
            debouncedSetError(errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen">
            <div className="hidden lg:flex lg:w-[60%] flex-col justify-center items-center px-16 relative" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)' }}>
                <div className="absolute top-12 left-12 w-40 h-40 rounded-full opacity-10" style={{ background: 'var(--color-text-inverse)' }}></div>
                <div className="absolute bottom-16 right-20 w-56 h-56 rounded-full opacity-[0.07]" style={{ background: 'var(--color-text-inverse)' }}></div>

                <div className="relative z-10 text-center max-w-md">
                    <div className="flex justify-center mb-8">
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10 9 9 9 8 9"/>
                            </svg>
                        </div>
                    </div>

                    <h1 className="text-white mb-3 font-semibold" style={{ fontSize: 'var(--font-size-2xl)', letterSpacing: 'var(--letter-spacing-tight)' }}>智识RAG文档问答中台</h1>
                    <p className="text-white mb-12" style={{ fontSize: 'var(--font-size-md)', opacity: 0.7 }}>企业级智能文档检索与管理平台</p>

                    <div className="flex flex-col gap-5 text-left max-w-xs mx-auto">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            </div>
                            <p className="text-white" style={{ fontSize: 'var(--font-size-base)', opacity: 0.85, lineHeight: 'var(--line-height-normal)' }}>基于 RAG 的智能检索，精准定位文档内容</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            </div>
                            <p className="text-white" style={{ fontSize: 'var(--font-size-base)', opacity: 0.85, lineHeight: 'var(--line-height-normal)' }}>支持多格式文档管理与知识沉淀</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            </div>
                            <p className="text-white" style={{ fontSize: 'var(--font-size-base)', opacity: 0.85, lineHeight: 'var(--line-height-normal)' }}>AI 驱动的文档问答与知识图谱</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:px-16" style={{ background: 'var(--color-bg-secondary)' }}>
                <div className="lg:hidden flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--color-primary)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                        </svg>
                    </div>
                    <span className="font-semibold" style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text-primary)' }}>智识RAG文档问答中台</span>
                </div>

                <div className="w-full" style={{ maxWidth: '380px' }}>
                    <div className="mb-8">
                        <h2 className="font-semibold mb-2" style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text-primary)' }}>欢迎回来</h2>
                        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>请登录您的账户以继续使用</p>
                    </div>

                    {error && (
                        <div className="mb-4 px-4 py-2.5 text-sm font-medium" style={{ backgroundColor: '#FEF2F2', color: '#D04848', borderRadius: 'var(--radius-md)' }}>
                            {error}
                        </div>
                    )}

                    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-1.5">
                            <label className="font-medium" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>用户名</label>
                            <div className="login-input-wrap flex items-center border rounded-md transition-colors" style={{ borderColor: 'var(--color-border)', height: '44px' }}>
                                <div className="flex items-center justify-center pl-3 pr-2" style={{ color: 'var(--color-text-tertiary)' }}>
                                    <User className="w-[18px] h-[18px]" />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="请输入用户名"
                                    className="flex-1 h-full outline-none bg-transparent pr-3"
                                    style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="font-medium" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>密码</label>
                            <div className="login-input-wrap flex items-center border rounded-md transition-colors" style={{ borderColor: 'var(--color-border)', height: '44px' }}>
                                <div className="flex items-center justify-center pl-3 pr-2" style={{ color: 'var(--color-text-tertiary)' }}>
                                    <Lock className="w-[18px] h-[18px]" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="请输入密码"
                                    className="flex-1 h-full outline-none bg-transparent pr-3"
                                    style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="flex items-center justify-center pr-3" 
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                    aria-label="显示密码"
                                >
                                    {showPassword ? <Eye className="w-[18px] h-[18px]" /> : <EyeOff className="w-[18px] h-[18px]" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                <input 
                                    type="checkbox" 
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded" 
                                    style={{ accentColor: 'var(--color-primary)' }} 
                                />
                                <span>记住我</span>
                            </label>
                            <button type="button" className="font-medium transition-colors" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>忘记密码?</button>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center font-semibold rounded-md transition-colors cursor-pointer"
                            style={{ 
                                height: '44px', 
                                background: !isLoading ? 'var(--color-primary)' : 'var(--color-bg-tertiary)', 
                                color: !isLoading ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)', 
                                fontSize: 'var(--font-size-base)', 
                                borderRadius: 'var(--radius-md)' 
                            }}
                            onMouseOver={(e) => {
                                if (!isLoading) {
                                    (e.target as HTMLElement).style.background = 'var(--color-primary-hover)';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!isLoading) {
                                    (e.target as HTMLElement).style.background = 'var(--color-primary)';
                                }
                            }}
                        >
                            {isLoading ? '登录中...' : '登 录'}
                        </button>

                        <div className="flex items-center gap-4 my-1">
                            <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }}></div>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>或</span>
                            <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }}></div>
                        </div>

                        <button
                            type="button"
                            className="w-full flex items-center justify-center gap-2 border rounded-md font-medium transition-colors cursor-pointer"
                            style={{ 
                                height: '44px', 
                                background: 'transparent', 
                                color: 'var(--color-text-secondary)', 
                                fontSize: 'var(--font-size-base)', 
                                borderColor: 'var(--color-border)', 
                                borderRadius: 'var(--radius-md)' 
                            }}
                            onMouseOver={(e) => {
                                (e.target as HTMLElement).style.background = 'var(--color-bg-hover)';
                            }}
                            onMouseOut={(e) => {
                                (e.target as HTMLElement).style.background = 'transparent';
                            }}
                        >
                            <Building2 className="w-[18px] h-[18px]" />
                            <span>企业 SSO 登录</span>
                        </button>
                    </form>

                    <div className="flex items-center justify-center gap-1 mt-8" style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                        <span>还没有账户？</span>
                        <button 
                            onClick={() => onNavigate('register')}
                            className="font-medium transition-colors" 
                            style={{ color: 'var(--color-primary)' }}
                        >
                            立即注册
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .login-input-wrap:focus-within {
                    border-color: var(--color-primary);
                }
            `}</style>
        </main>
    );
}