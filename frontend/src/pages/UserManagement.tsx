import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, UserCheck, UserX, Search, Upload, UserPlus, Pencil, Trash2, ChevronLeft, ChevronRight, X, Bell, Settings, ChevronDown, AlertCircle, CheckCircle } from 'lucide-react';
import { User, UserItem, Role } from '../types';
import { api } from '../utils/api';
import { useDebounce } from '../utils/debounce';
import Toast, { ToastMessage } from '../components/Toast';

interface UserManagementProps {
    user?: User | null;
}

const roleColorPool = [
    { bg: '#FDE8E8', text: 'var(--state-error)' },
    { bg: 'var(--color-primary-light)', text: 'var(--color-primary)' },
    { bg: 'var(--tag-hr)', text: 'var(--tag-hr-text)' },
    { bg: 'var(--tag-general)', text: 'var(--tag-general-text)' },
    { bg: 'var(--tag-legal)', text: 'var(--tag-legal-text)' },
    { bg: '#FEF3E2', text: 'var(--state-warning)' },
    { bg: '#E8F0FE', text: 'var(--state-info)' },
    { bg: '#FCE7F3', text: '#EC4899' },
    { bg: '#E0F2FE', text: '#0284C7' },
    { bg: '#F0FDF4', text: 'var(--state-success)' },
];

const avatarColors = ['var(--color-primary)', 'var(--state-success)', 'var(--state-warning)', 'var(--tag-legal-text)', 'var(--color-text-tertiary)', 'var(--color-text-secondary)', 'var(--tag-hr-text)', 'var(--state-info)'];

function getRoleColor(roleName: string): { bg: string; text: string } {
    let hash = 0;
    for (let i = 0; i < roleName.length; i++) {
        hash = roleName.charCodeAt(i) * (i + 1) + hash;
    }
    hash = (hash * 9301 + 49297) % 233280;
    const index = Math.abs(hash) % roleColorPool.length;
    return roleColorPool[index];
}

function formatDateTime(dateTime: string | null): string {
    if (!dateTime) return '从未登录';
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export default function UserManagement({ user }: UserManagementProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('全部角色');
    const [statusFilter, setStatusFilter] = useState('全部状态');
    const [departmentFilter, setDepartmentFilter] = useState('全部部门');
    const [currentPage, setCurrentPage] = useState(1);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const [users, setUsers] = useState<UserItem[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [pageSize] = useState(10);
    const [stats, setStats] = useState({ total: 0, active: 0, disabled: 0 });
    const [loading, setLoading] = useState(false);
    const [editUser, setEditUser] = useState<UserItem | null>(null);
    const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
    const [deleteUsername, setDeleteUsername] = useState<string | null>(null);

    const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: '', department: '技术部' });
    const [editForm, setEditForm] = useState({ email: '', role: '', department: '', is_active: true });
    const [roles, setRoles] = useState<Role[]>([]);

    const [showImportModal, setShowImportModal] = useState(false);
    const [importUsers, setImportUsers] = useState<Array<{ username: string; email: string; password: string; role: string; department: string; errors: string[] }>>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: boolean; successCount: number; failedCount: number; results: Array<{ index: number; username: string; email: string; status: string; password?: string; error?: string }> } | null>(null);
    const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

    const initialized = useRef(false);
    const fetchingRef = useRef(false);

    const hasPermission = (perm: string): boolean => {
        return user.permissions?.includes(perm) || false;
    };

    const showToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
        const id = Date.now().toString();
        setToastMessages(prev => [...prev, { id, type, title, message }]);
    };

    const removeToast = (id: string) => {
        setToastMessages(prev => prev.filter(t => t.id !== id));
    };

    const loadUsers = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setLoading(true);
        try {
            const params: Record<string, string | number> = {
                page: currentPage,
                page_size: pageSize,
            };
            if (searchTerm) params.search = searchTerm;
            if (roleFilter && roleFilter !== '全部角色') params.role = roleFilter;
            if (statusFilter && statusFilter !== '全部状态') params.status = statusFilter;
            if (departmentFilter && departmentFilter !== '全部部门') params.department = departmentFilter;

            const result = await api.getUsers(params);
            setUsers(result.users);
            setTotalUsers(result.total);
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            fetchingRef.current = false;
            setLoading(false);
        }
    }, [currentPage, pageSize, searchTerm, roleFilter, statusFilter, departmentFilter]);

    const loadStats = useCallback(async () => {
        try {
            const result = await api.getUserStats();
            setStats(result);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }, []);

    const loadRoles = useCallback(async () => {
        try {
            const result = await api.getRoles();
            setRoles(result);
            if (result.length > 0) {
                setNewUser(prev => ({ ...prev, role: result[0].name }));
            }
        } catch (error) {
            console.error('Failed to load roles:', error);
        }
    }, []);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadUsers();
        loadStats();
        loadRoles();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter, statusFilter, departmentFilter]);

    const debouncedLoadUsers = useDebounce(loadUsers, 300);

    useEffect(() => {
        debouncedLoadUsers();
    }, [debouncedLoadUsers]);

    const totalPages = Math.ceil(totalUsers / pageSize);

    const handleClearFilters = () => {
        setSearchTerm('');
        setRoleFilter('全部角色');
        setStatusFilter('全部状态');
        setDepartmentFilter('全部部门');
        setCurrentPage(1);
    };

    const getStatusStyle = (isActive: boolean) => {
        if (isActive) {
            return { dot: 'var(--state-success)', text: 'var(--state-success)', label: '活跃' };
        }
        return { dot: 'var(--color-text-tertiary)', text: 'var(--color-text-tertiary)', label: '已禁用' };
    };

    const handleAddUser = async () => {
        if (!newUser.username || !newUser.email || !newUser.password || !newUser.role) {
            showToast('error', '提示', '请填写完整信息');
            return;
        }
        try {
            await api.createUser(newUser);
            setShowAddModal(false);
            setNewUser({ username: '', email: '', password: '', role: roles.length > 0 ? roles[0].name : '', department: '技术部' });
            loadUsers();
            loadStats();
            showToast('success', '成功', '添加用户成功');
        } catch (error: any) {
            showToast('error', '失败', error.response?.data?.detail || '添加用户失败');
        }
    };

    const handleOpenEdit = (user: UserItem) => {
        setEditUser(user);
        setEditForm({ email: user.email, role: user.role, department: user.department, is_active: user.is_active });
        setShowEditModal(true);
    };

    const handleEditUser = async () => {
        if (!editUser) return;
        try {
            await api.updateUser(editUser.id, editForm);
            setShowEditModal(false);
            setEditUser(null);
            loadUsers();
            loadStats();
            showToast('success', '成功', '编辑用户成功');
        } catch (error: any) {
            showToast('error', '失败', error.response?.data?.detail || '编辑用户失败');
        }
    };

    const handleOpenDelete = (userId: string, username: string) => {
        setDeleteUserId(userId);
        setDeleteUsername(username);
        setShowDeleteModal(true);
    };

    const handleDeleteUser = async () => {
        if (!deleteUserId) return;
        try {
            await api.deleteUser(deleteUserId);
            setShowDeleteModal(false);
            setDeleteUserId(null);
            setDeleteUsername(null);
            loadUsers();
            loadStats();
            showToast('success', '成功', '删除用户成功');
        } catch (error: any) {
            showToast('error', '失败', error.response?.data?.detail || '删除用户失败');
        }
    };

    const handleImportClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.xls';
        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                await parseImportFile(files[0]);
            }
        };
        input.click();
    };

    const parseImportFile = async (file: File) => {
        const fileName = file.name.toLowerCase();
        const users: Array<{ username: string; email: string; password: string; role: string; department: string; errors: string[] }> = [];

        try {
            const text = await file.text();
            
            if (fileName.endsWith('.csv')) {
                const lines = text.split('\n').filter(line => line.trim());
                const headers = lines[0].split(',').map(h => h.trim());
                
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',');
                    const userData: Record<string, string> = {};
                    headers.forEach((header, idx) => {
                        userData[header] = values[idx]?.trim() || '';
                    });
                    
                    users.push({
                        username: userData['用户名'] || userData['username'] || '',
                        email: userData['邮箱'] || userData['email'] || '',
                        password: userData['密码'] || userData['password'] || '',
                        role: userData['角色'] || userData['role'] || '普通用户',
                        department: userData['部门'] || userData['department'] || '-',
                        errors: []
                    });
                }
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                showToast('error', '提示', 'Excel文件暂不支持，请使用CSV格式');
                return;
            }
            
            validateImportUsers(users);
            setShowImportModal(true);
        } catch (error) {
            showToast('error', '失败', '文件解析失败，请确保文件格式正确');
        }
    };

    const validateImportUsers = (users: Array<{ username: string; email: string; password: string; role: string; department: string; errors: string[] }>) => {
        const existingUsernames = new Set(users.map(u => u.username));
        const existingEmails = new Set(users.map(u => u.email));
        
        users.forEach((u, idx) => {
            u.errors = [];
            if (!u.username) u.errors.push('用户名不能为空');
            if (!u.email) u.errors.push('邮箱不能为空');
            else if (!u.email.includes('@')) u.errors.push('邮箱格式不正确');
            if (u.username && users.filter((_, i) => i !== idx && users[i].username === u.username).length > 0) {
                u.errors.push('用户名重复');
            }
            if (u.email && users.filter((_, i) => i !== idx && users[i].email === u.email).length > 0) {
                u.errors.push('邮箱重复');
            }
        });
        
        setImportUsers(users);
    };

    const handleImportSubmit = async () => {
        const validUsers = importUsers.filter(u => u.errors.length === 0);
        if (validUsers.length === 0) {
            showToast('error', '提示', '没有有效的用户数据');
            return;
        }

        setIsImporting(true);
        try {
            const result = await api.batchImportUsers(validUsers.map(u => ({
                username: u.username,
                email: u.email,
                password: u.password,
                role: u.role,
                department: u.department
            })));
            
            setImportResult({
                success: true,
                successCount: result.success_count,
                failedCount: result.failed_count,
                results: result.results
            });
            
            if (result.success_count > 0) {
                loadUsers();
                loadStats();
            }
        } catch (error: any) {
            setImportResult({
                success: false,
                successCount: 0,
                failedCount: 0,
                results: []
            });
        } finally {
            setIsImporting(false);
        }
    };

    const handleCloseImportModal = () => {
        setShowImportModal(false);
        setImportUsers([]);
        setImportResult(null);
    };

    const username = user?.username || '用户';
    const initial = username.charAt(0).toUpperCase();

    return (
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
            <header className="h-[56px] shrink-0 flex items-center justify-between px-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>系统管理</span>
                    <ChevronRight className="w-[14px] h-[14px] shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="text-[13px] font-medium whitespace-nowrap truncate" style={{ color: 'var(--color-text-primary)' }}>用户管理</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    {/* <button className="flex items-center justify-center w-9 h-9 transition-colors duration-150" style={{ color: 'var(--color-text-secondary)' }}>
                        <Bell className="w-[18px] h-[18px]" />
                    </button>
                    <button className="flex items-center justify-center w-9 h-9 transition-colors duration-150" style={{ color: 'var(--color-text-secondary)' }}>
                        <Settings className="w-[18px] h-[18px]" />
                    </button> */}
                    <button className="flex items-center gap-2 pl-3 transition-colors duration-150" style={{ borderLeft: '1px solid var(--color-border)' }}>
                        <div className="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                            <span>{initial}</span>
                        </div>
                        <ChevronDown className="w-[14px] h-[14px]" style={{ color: 'var(--color-text-tertiary)' }} />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="min-w-0">
                        <h1 className="text-[20px] font-bold whitespace-nowrap truncate" style={{ color: 'var(--color-text-primary)' }}>用户管理</h1>
                        <p className="text-[13px] mt-1 whitespace-nowrap truncate" style={{ color: 'var(--color-text-secondary)' }}>管理系统用户账户、角色分配与权限</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {hasPermission('user_create') && (
                            <>
                                <button onClick={handleImportClick} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }}>
                                    <Upload className="w-4 h-4 shrink-0" />
                                    <span>批量导入</span>
                                </button>
                                <button onClick={() => setShowAddModal(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--color-text-inverse)', backgroundColor: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                                    <UserPlus className="w-4 h-4 shrink-0" />
                                    <span>添加用户</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <div className="w-9 h-9 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)' }}>
                            <Users className="w-[18px] h-[18px]" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[20px] font-bold leading-tight whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{stats.total}</p>
                            <p className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>全部用户</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <div className="w-9 h-9 shrink-0 flex items-center justify-center" style={{ backgroundColor: '#E8F8F0', borderRadius: 'var(--radius-md)' }}>
                            <UserCheck className="w-[18px] h-[18px]" style={{ color: 'var(--state-success)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[20px] font-bold leading-tight whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{stats.active}</p>
                            <p className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>活跃用户</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <div className="w-9 h-9 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <UserX className="w-[18px] h-[18px]" style={{ color: 'var(--color-text-tertiary)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[20px] font-bold leading-tight whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{stats.disabled}</p>
                            <p className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>已禁用</p>
                        </div>
                    </div>

                </div>

                <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <div className="relative flex-1 min-w-[200px] max-w-[360px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                        <input
                            type="text"
                            placeholder="搜索用户名、邮箱或姓名..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-[13px] outline-none"
                            style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }}
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-3 py-2 text-[13px] outline-none appearance-none cursor-pointer"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', minWidth: '130px' }}
                    >
                        <option>全部角色</option>
                        {roles.map(role => (
                            <option key={role.id} value={role.name}>{role.name}</option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 text-[13px] outline-none appearance-none cursor-pointer"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', minWidth: '110px' }}
                    >
                        <option>全部状态</option>
                        <option>活跃</option>
                        <option>已禁用</option>
                    </select>
                    <select
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="px-3 py-2 text-[13px] outline-none appearance-none cursor-pointer"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', minWidth: '110px' }}
                    >
                        <option>全部部门</option>
                        <option>技术部</option>
                        <option>产品部</option>
                        <option>人力资源部</option>
                        <option>财务部</option>
                        <option>市场部</option>
                        <option>-</option>
                    </select>
                    {(searchTerm || roleFilter !== '全部角色' || statusFilter !== '全部状态' || departmentFilter !== '全部部门') && (
                        <button onClick={handleClearFilters} className="px-3 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }}>
                            清除筛选
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <table className="w-full table-fixed" style={{ minWidth: '860px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th className="px-4 py-3 text-left text-[12px] font-medium w-[40px]" style={{ color: 'var(--color-text-secondary)' }}>
                                    <input type="checkbox" className="cursor-pointer" />
                                </th>
                                <th className="px-4 py-3 text-left text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>用户信息</th>
                                <th className="px-4 py-3 text-left text-[12px] font-medium w-[120px]" style={{ color: 'var(--color-text-secondary)' }}>角色</th>
                                <th className="px-4 py-3 text-left text-[12px] font-medium w-[100px]" style={{ color: 'var(--color-text-secondary)' }}>部门</th>
                                <th className="px-4 py-3 text-left text-[12px] font-medium w-[90px]" style={{ color: 'var(--color-text-secondary)' }}>状态</th>
                                <th className="px-4 py-3 text-left text-[12px] font-medium w-[160px]" style={{ color: 'var(--color-text-secondary)' }}>最后登录</th>
                                <th className="px-4 py-3 text-left text-[12px] font-medium w-[80px]" style={{ color: 'var(--color-text-secondary)' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>加载中...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center">
                                        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>暂无用户数据</p>
                                    </td>
                                </tr>
                            ) : (
                                users.map((userItem, index) => {
                                    const roleStyle = getRoleColor(userItem.role);
                                    const statusStyle = getStatusStyle(userItem.is_active);
                                    const avatarColor = avatarColors[index % avatarColors.length];
                                    return (
                                        <tr key={userItem.id} style={{ borderBottom: '1px solid var(--color-divider)', backgroundColor: index % 2 === 1 ? 'var(--color-bg)' : undefined }}>
                                            <td className="px-4 py-3">
                                                <input type="checkbox" className="cursor-pointer" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 shrink-0 flex items-center justify-center text-[13px] font-medium" style={{ backgroundColor: avatarColor, color: 'var(--color-text-inverse)', borderRadius: 'var(--radius-full)' }}>
                                                        {userItem.username.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[14px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{userItem.username}</p>
                                                        <p className="text-[12px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>{userItem.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[12px] font-medium whitespace-nowrap" style={{ backgroundColor: roleStyle.bg, color: roleStyle.text, borderRadius: 'var(--radius-sm)' }}>
                                                    {userItem.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-[13px] truncate" style={{ color: userItem.department === '-' ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)' }}>{userItem.department}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: statusStyle.dot, borderRadius: 'var(--radius-full)' }}></span>
                                                    <span className="text-[13px] whitespace-nowrap" style={{ color: statusStyle.text }}>{statusStyle.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{formatDateTime(userItem.last_login)}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {hasPermission('user_edit') && (
                                                        <button onClick={() => handleOpenEdit(userItem)} className="flex items-center justify-center w-7 h-7 transition-colors duration-150 hover:bg-gray-100 rounded" style={{ color: 'var(--color-text-secondary)' }} title="编辑">
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {hasPermission('user_delete') && (
                                                        <button onClick={() => handleOpenDelete(userItem.id, userItem.username)} className="flex items-center justify-center w-7 h-7 transition-colors duration-150 hover:bg-gray-100 rounded" style={{ color: '#EF4444' }} title="删除">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between mt-4 px-1">
                    <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>共 {totalUsers} 条记录</span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="flex items-center justify-center w-8 h-8 text-[13px] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className="flex items-center justify-center w-8 h-8 text-[13px] font-medium transition-colors duration-150"
                                    style={{
                                        color: currentPage === pageNum ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                                        backgroundColor: currentPage === pageNum ? 'var(--color-primary)' : undefined,
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-sm)'
                                    }}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        {totalPages > 5 && (
                            <>
                                <span className="text-[13px]" style={{ color: 'var(--color-text-tertiary)', margin: '0 4px' }}>...</span>
                                <button onClick={() => setCurrentPage(totalPages)} className="flex items-center justify-center w-8 h-8 text-[13px] transition-colors duration-150" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                                    {totalPages}
                                </button>
                            </>
                        )}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="flex items-center justify-center w-8 h-8 text-[13px] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {showAddModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[500px] max-w-[90vw]" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <h3 className="text-[16px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>添加用户</h3>
                            <button onClick={() => setShowAddModal(false)} className="flex items-center justify-center w-8 h-8 transition-colors duration-150" style={{ color: 'var(--color-text-tertiary)' }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>用户名</label>
                                    <input type="text" className="w-full px-3 py-2 text-[14px] outline-none" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} placeholder="请输入用户名" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>邮箱</label>
                                    <input type="email" className="w-full px-3 py-2 text-[14px] outline-none" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} placeholder="请输入邮箱" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>密码</label>
                                    <input type="password" className="w-full px-3 py-2 text-[14px] outline-none" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} placeholder="请输入密码" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>角色</label>
                                    <select className="w-full px-3 py-2 text-[14px] outline-none appearance-none cursor-pointer" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                                        {roles.map(role => (
                                            <option key={role.id} value={role.name}>{role.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>部门</label>
                                    <select className="w-full px-3 py-2 text-[14px] outline-none appearance-none cursor-pointer" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}>
                                        <option>技术部</option>
                                        <option>产品部</option>
                                        <option>人力资源部</option>
                                        <option>财务部</option>
                                        <option>市场部</option>
                                        <option>-</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }}>取消</button>
                            <button onClick={handleAddUser} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-inverse)', backgroundColor: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>确认添加</button>
                        </div>
                    </div>
                </div>
            )}

            {showEditModal && editUser && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[500px] max-w-[90vw]" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <h3 className="text-[16px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>编辑用户 - {editUser.username}</h3>
                            <button onClick={() => setShowEditModal(false)} className="flex items-center justify-center w-8 h-8 transition-colors duration-150" style={{ color: 'var(--color-text-tertiary)' }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>用户名</label>
                                    <input type="text" className="w-full px-3 py-2 text-[14px] outline-none" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', cursor: 'not-allowed' }} value={editUser.username} disabled />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>邮箱</label>
                                    <input type="email" className="w-full px-3 py-2 text-[14px] outline-none" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} placeholder="请输入邮箱" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>角色</label>
                                    <select className="w-full px-3 py-2 text-[14px] outline-none appearance-none cursor-pointer" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                                        {roles.map(role => (
                                            <option key={role.id} value={role.name}>{role.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>部门</label>
                                    <select className="w-full px-3 py-2 text-[14px] outline-none appearance-none cursor-pointer" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}>
                                        <option>技术部</option>
                                        <option>产品部</option>
                                        <option>人力资源部</option>
                                        <option>财务部</option>
                                        <option>市场部</option>
                                        <option>-</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>状态</label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="editStatus" checked={editForm.is_active} onChange={() => setEditForm({ ...editForm, is_active: true })} className="cursor-pointer" />
                                            <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>启用</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="editStatus" checked={!editForm.is_active} onChange={() => setEditForm({ ...editForm, is_active: false })} className="cursor-pointer" />
                                            <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>禁用</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }}>取消</button>
                            <button onClick={handleEditUser} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-inverse)', backgroundColor: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>确认修改</button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[400px] max-w-[90vw]" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="flex items-center gap-3 px-5 py-4">
                            <div className="w-10 h-10 flex items-center justify-center rounded-full" style={{ backgroundColor: '#FEF2F2' }}>
                                <AlertCircle className="w-5 h-5" style={{ color: '#EF4444' }} />
                            </div>
                            <h3 className="text-[16px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>确认删除</h3>
                        </div>
                        <div className="px-5 py-2">
                            <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>确定要删除用户「{deleteUsername}」吗？此操作无法撤销。</p>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }}>取消</button>
                            <button onClick={handleDeleteUser} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-inverse)', backgroundColor: '#EF4444', borderRadius: 'var(--radius-md)' }}>删除</button>
                        </div>
                    </div>
                </div>
            )}

            {showImportModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[800px] max-w-[90vw] max-h-[80vh]" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <h3 className="text-[16px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>批量导入用户</h3>
                            <button onClick={handleCloseImportModal} className="flex items-center justify-center w-8 h-8 transition-colors duration-150" style={{ color: 'var(--color-text-tertiary)' }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {importResult ? (
                            <div className="p-5 overflow-y-auto max-h-[calc(80vh-140px)]">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: importResult.success ? '#E8F8F0' : '#FEF2F2', borderRadius: 'var(--radius-md)' }}>
                                        {importResult.success ? (
                                            <CheckCircle className="w-5 h-5" style={{ color: 'var(--state-success)' }} />
                                        ) : (
                                            <AlertCircle className="w-5 h-5" style={{ color: '#EF4444' }} />
                                        )}
                                        <span className="text-[14px] font-medium" style={{ color: importResult.success ? 'var(--state-success)' : '#EF4444' }}>
                                            {importResult.success ? `导入成功` : `导入失败`}
                                        </span>
                                    </div>
                                    <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                                        成功: {importResult.successCount} | 失败: {importResult.failedCount}
                                    </span>
                                </div>

                                {importResult.results.length > 0 && (
                                    <div className="space-y-2">
                                        {importResult.results.map((r) => (
                                            <div key={r.index} className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: r.status === 'success' ? '#E8F8F0' : '#FEF2F2', borderRadius: 'var(--radius-md)' }}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[12px] px-2 py-0.5" style={{ backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-tertiary)' }}>{r.index}</span>
                                                    <div>
                                                        <span className="text-[14px]" style={{ color: 'var(--color-text-primary)' }}>{r.username}</span>
                                                        <span className="text-[12px] ml-2" style={{ color: 'var(--color-text-tertiary)' }}>{r.email}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {r.status === 'success' ? (
                                                        <>
                                                            <span className="text-[12px]" style={{ color: 'var(--state-success)' }}>已导入</span>
                                                            {r.password && (
                                                                <span className="text-[12px] px-2 py-0.5" style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)' }}>
                                                                    密码: {r.password}
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-[12px]" style={{ color: '#EF4444' }}>{r.error}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-5 overflow-y-auto max-h-[calc(80vh-140px)]">
                                <div className="mb-4 p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <p className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                                        <strong>CSV文件格式要求：</strong>
                                    </p>
                                    <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                        支持的列名：用户名(username)、邮箱(email)、密码(password，可选)、角色(role，默认普通用户)、部门(department，默认-)
                                    </p>
                                    <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                        如果密码为空，系统将自动生成8位随机密码
                                    </p>
                                </div>

                                {importUsers.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                                                    <th className="px-4 py-2 text-left text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>序号</th>
                                                    <th className="px-4 py-2 text-left text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>用户名</th>
                                                    <th className="px-4 py-2 text-left text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>邮箱</th>
                                                    <th className="px-4 py-2 text-left text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>角色</th>
                                                    <th className="px-4 py-2 text-left text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>部门</th>
                                                    <th className="px-4 py-2 text-left text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>状态</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {importUsers.map((u, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                                                        <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>{idx + 1}</td>
                                                        <td className="px-4 py-3 text-[13px]" style={{ color: u.errors.length > 0 ? '#EF4444' : 'var(--color-text-primary)' }}>{u.username}</td>
                                                        <td className="px-4 py-3 text-[13px]" style={{ color: u.errors.length > 0 ? '#EF4444' : 'var(--color-text-secondary)' }}>{u.email}</td>
                                                        <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{u.role}</td>
                                                        <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{u.department}</td>
                                                        <td className="px-4 py-3">
                                                            {u.errors.length > 0 ? (
                                                                <span className="text-[12px] px-2 py-1" style={{ backgroundColor: '#FEF2F2', color: '#EF4444', borderRadius: 'var(--radius-sm)' }}>
                                                                    {u.errors.join(', ')}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[12px] px-2 py-1" style={{ backgroundColor: '#E8F8F0', color: 'var(--state-success)', borderRadius: 'var(--radius-sm)' }}>正常</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {importUsers.length === 0 && (
                                    <div className="text-center py-8">
                                        <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>请选择CSV文件导入用户数据</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                            <button onClick={handleCloseImportModal} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }}>
                                {importResult ? '关闭' : '取消'}
                            </button>
                            {!importResult && (
                                <button 
                                    onClick={handleImportSubmit} 
                                    disabled={isImporting || importUsers.filter(u => u.errors.length === 0).length === 0}
                                    className="px-4 py-2 text-[13px] font-medium" 
                                    style={{ 
                                        color: 'var(--color-text-inverse)', 
                                        backgroundColor: 'var(--color-primary)', 
                                        borderRadius: 'var(--radius-md)',
                                        opacity: isImporting || importUsers.filter(u => u.errors.length === 0).length === 0 ? 0.5 : 1,
                                        cursor: isImporting || importUsers.filter(u => u.errors.length === 0).length === 0 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {isImporting ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            导入中...
                                        </span>
                                    ) : (
                                        `确认导入 (${importUsers.filter(u => u.errors.length === 0).length})`
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Toast messages={toastMessages} onRemove={removeToast} />
        </div>
    );
}