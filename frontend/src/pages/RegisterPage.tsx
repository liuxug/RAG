import { useState, useCallback } from 'react';
import { User, Mail, ShieldCheck, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { api } from '../utils/api';
import { RegisterRequest, User as UserType } from '../types';
import debounce from 'lodash.debounce';

interface RegisterPageProps {
    onNavigate: (path: string, user?: UserType) => void;
}

export default function RegisterPage({ onNavigate }: RegisterPageProps) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [codeLoading, setCodeLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
    const [countdown, setCountdown] = useState(0);

    const debouncedSetError = useCallback(
        debounce((msg: string) => {
            setError(msg);
        }, 100),
        []
    );

    const validatePassword = (pwd: string) => {
        let strength: 'weak' | 'medium' | 'strong' = 'weak';
        if (pwd.length >= 8) {
            strength = 'medium';
        }
        if (pwd.length >= 12 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd)) {
            strength = 'strong';
        }
        setPasswordStrength(strength);
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPassword(value);
        validatePassword(value);
    };

    const handleSendCode = async () => {
        if (!email.trim()) {
            debouncedSetError('请输入邮箱地址');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            debouncedSetError('请输入有效的邮箱地址');
            return;
        }

        setCodeLoading(true);
        try {
            await api.sendCode(email);
            debouncedSetError('');
            setCountdown(60);
            const timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err: any) {
            const errMsg = err.response?.data?.detail || '发送验证码失败';
            debouncedSetError(errMsg);
        } finally {
            setCodeLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !email.trim() || !code.trim() || !password.trim() || !confirmPassword.trim()) {
            debouncedSetError('请填写所有必填字段');
            return;
        }

        if (username.length < 4 || username.length > 20) {
            debouncedSetError('用户名需为4-20位字符');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            debouncedSetError('请输入有效的邮箱地址');
            return;
        }

        if (password.length < 8) {
            debouncedSetError('密码至少需要8位');
            return;
        }

        if (password !== confirmPassword) {
            debouncedSetError('两次输入的密码不一致');
            return;
        }

        if (!agreed) {
            debouncedSetError('请同意用户服务协议和隐私政策');
            return;
        }

        setIsLoading(true);

        try {
            const request: RegisterRequest = {
                username: username.trim(),
                email: email.trim(),
                password: password.trim(),
                code: code.trim(),
            };

            const response = await api.register(request);

            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('user', JSON.stringify(response.user));

            onNavigate('documents', response.user);
        } catch (err: any) {
            const errMsg = err.response?.data?.detail || '注册失败，请重试';
            debouncedSetError(errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const getStrengthColor = () => {
        switch (passwordStrength) {
            case 'weak': return 'var(--state-error)';
            case 'medium': return 'var(--state-warning)';
            case 'strong': return 'var(--state-success)';
        }
    };

    const getStrengthText = () => {
        switch (passwordStrength) {
            case 'weak': return '弱';
            case 'medium': return '中';
            case 'strong': return '强';
        }
    };

    return (
        <main className="min-h-screen flex">
            <aside className="hidden lg:flex lg:w-[60%] flex-col items-center justify-center relative" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)' }}>
                <div className="flex flex-col items-center max-w-md px-8 text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-text-inverse)' }}>智识RAG文档问答中台</h1>
                    <p className="text-base mb-12" style={{ color: 'rgba(255,255,255,0.7)' }}>创建账户，开启智能知识管理之旅</p>

                    <div className="flex flex-col gap-5 w-full max-w-xs">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                <Check className="w-3 h-3" style={{ color: 'var(--color-text-inverse)' }} />
                            </div>
                            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>免费注册，即刻体验全部功能</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                <Check className="w-3 h-3" style={{ color: 'var(--color-text-inverse)' }} />
                            </div>
                            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>支持多种企业邮箱快速验证</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                <Check className="w-3 h-3" style={{ color: 'var(--color-text-inverse)' }} />
                            </div>
                            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>安全可靠的企业级数据保护</span>
                        </div>
                    </div>
                </div>
            </aside>

            <section className="w-full lg:w-[40%] flex items-center justify-center py-12 px-6" style={{ background: 'var(--color-bg-secondary)' }}>
                <div className="w-full max-w-[400px]">
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>创建账户</h2>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>请填写以下信息完成注册</p>
                    </div>

                    {error && (
                        <div className="mb-4 px-4 py-2.5 text-sm font-medium" style={{ backgroundColor: '#FEF2F2', color: '#D04848', borderRadius: 'var(--radius-md)' }}>
                            {error}
                        </div>
                    )}

                    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>用户名</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-3 flex items-center pointer-events-none">
                                    <User className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                                </div>
                                <input 
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="请设置用户名（4-20位字母或数字）" 
                                    className="w-full h-[42px] pl-10 pr-4 text-sm outline-none transition-colors" 
                                    style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                                    onFocus={(e) => (e.target as HTMLElement).style.borderColor = 'var(--color-primary)'}
                                    onBlur={(e) => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
                                />
                            </div>
                            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>用户名设置后不可修改</p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>邮箱地址</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-3 flex items-center pointer-events-none">
                                    <Mail className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                                </div>
                                <input 
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="请输入企业邮箱地址" 
                                    className="w-full h-[42px] pl-10 pr-4 text-sm outline-none transition-colors" 
                                    style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                                    onFocus={(e) => (e.target as HTMLElement).style.borderColor = 'var(--color-primary)'}
                                    onBlur={(e) => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>邮箱验证码</label>
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 flex items-center">
                                    <div className="absolute left-3 flex items-center pointer-events-none">
                                        <ShieldCheck className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                                    </div>
                                    <input 
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        placeholder="请输入验证码" 
                                        className="w-full h-[42px] pl-10 pr-4 text-sm outline-none transition-colors" 
                                        style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                                        onFocus={(e) => (e.target as HTMLElement).style.borderColor = 'var(--color-primary)'}
                                        onBlur={(e) => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={handleSendCode}
                                    disabled={codeLoading || countdown > 0}
                                    className="shrink-0 h-[42px] px-4 text-sm font-medium whitespace-nowrap transition-colors" 
                                    style={{ 
                                        border: '1px solid var(--color-primary)', 
                                        borderRadius: 'var(--radius-md)', 
                                        background: codeLoading || countdown > 0 ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)', 
                                        color: codeLoading || countdown > 0 ? 'var(--color-text-tertiary)' : 'var(--color-primary)' 
                                    }}
                                >
                                    {codeLoading ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>密码</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-3 flex items-center pointer-events-none">
                                    <Lock className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                                </div>
                                <input 
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={handlePasswordChange}
                                    placeholder="请设置密码（至少8位）" 
                                    className="w-full h-[42px] pl-10 pr-10 text-sm outline-none transition-colors" 
                                    style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                                    onFocus={(e) => (e.target as HTMLElement).style.borderColor = 'var(--color-primary)'}
                                    onBlur={(e) => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 flex items-center pointer-events-auto"
                                >
                                    {showPassword ? <Eye className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} /> : <EyeOff className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />}
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <div className="h-1 flex-1 rounded-full" style={{ background: 'var(--color-border-light)' }}>
                                    <div className="h-full w-full rounded-full" style={{ background: passwordStrength === 'weak' ? 'var(--state-error)' : 'transparent' }}></div>
                                </div>
                                <div className="h-1 flex-1 rounded-full" style={{ background: 'var(--color-border-light)' }}>
                                    <div className="h-full w-full rounded-full" style={{ background: passwordStrength === 'weak' ? 'transparent' : 'var(--state-warning)' }}></div>
                                </div>
                                <div className="h-1 flex-1 rounded-full" style={{ background: 'var(--color-border-light)' }}>
                                    <div className="h-full w-full rounded-full" style={{ background: passwordStrength === 'strong' ? 'var(--state-success)' : 'transparent' }}></div>
                                </div>
                                <span className="text-xs ml-2" style={{ color: getStrengthColor() }}>{getStrengthText()}</span>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>需包含字母和数字</p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>确认密码</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-3 flex items-center pointer-events-none">
                                    <Lock className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                                </div>
                                <input 
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="请再次输入密码" 
                                    className="w-full h-[42px] pl-10 pr-10 text-sm outline-none transition-colors" 
                                    style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                                    onFocus={(e) => (e.target as HTMLElement).style.borderColor = 'var(--color-primary)'}
                                    onBlur={(e) => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 flex items-center pointer-events-auto"
                                >
                                    {showConfirmPassword ? <Eye className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} /> : <EyeOff className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5 mt-1">
                            <input 
                                type="checkbox" 
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="mt-0.5 shrink-0 w-4 h-4 rounded" 
                                style={{ accentColor: 'var(--color-primary)' }} 
                            />
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                                我已阅读并同意<a href="#" className="font-medium" style={{ color: 'var(--color-primary)' }}>《用户服务协议》</a>和<a href="#" className="font-medium" style={{ color: 'var(--color-primary)' }}>《隐私政策》</a>
                            </p>
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-[44px] text-sm font-semibold tracking-wider transition-colors mt-2" 
                            style={{ 
                                background: !isLoading ? 'var(--color-primary)' : 'var(--color-bg-tertiary)', 
                                color: !isLoading ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)', 
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
                            {isLoading ? '注册中...' : '注 册'}
                        </button>
                    </form>

                    <div className="flex items-center justify-center gap-1 mt-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <span>已有账户？</span>
                        <button 
                            onClick={() => onNavigate('login')}
                            className="font-medium" 
                            style={{ color: 'var(--color-primary)' }}
                        >
                            立即登录
                        </button>
                    </div>
                </div>
            </section>
        </main>
    );
}