import { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, CheckCircle, Ban, Lock, Key, Users, Plus, Pencil, Trash2, Eye, Power, Bell, Settings, ChevronDown, X, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import { User, Role, Permission, RoleStatsResponse } from '../types';
import { api } from '../utils/api';
import Toast, { ToastMessage } from '../components/Toast';

interface RoleManagementProps {
    user?: User | null;
}

export default function RoleManagement({ user }: RoleManagementProps) {
    const [roles, setRoles] = useState<Role[]>([]);
    const [stats, setStats] = useState<RoleStatsResponse | null>(null);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({
        title: '',
        message: '',
        type: 'confirm' as 'confirm' | 'delete' | 'warning',
        onConfirm: () => {}
    });
    const isFetchedRef = useRef(false);
    const fetchingRef = useRef(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        permissions: [] as string[]
    });

    const [editFormData, setEditFormData] = useState({
        name: '',
        description: '',
        permissions: [] as string[]
    });

    const username = user?.username || '用户';
    const initial = username.charAt(0).toUpperCase();
    
    const userPermissions = user?.permissions || [];
    const hasPermission = (perm: string) => userPermissions.includes(perm);
    
    const showToast = (type: 'success' | 'error' | 'info', title: string, message: string, action?: ToastMessage['action']) => {
        const id = Date.now().toString();
        setToastMessages(prev => [...prev, { id, type, title, message, action }]);
    };
    
    const removeToast = (id: string) => {
        setToastMessages(prev => prev.filter(t => t.id !== id));
    };

    const fetchRoles = useCallback(async () => {
        if (fetchingRef.current) {
            return;
        }
        fetchingRef.current = true;
        setIsLoading(true);
        try {
            const [rolesData, statsData, permissionsData] = await Promise.all([
                api.getRoles(),
                api.getRoleStats(),
                api.getPermissions()
            ]);
            setRoles(rolesData);
            setStats(statsData);
            setPermissions(permissionsData);
            isFetchedRef.current = true;
        } catch (error) {
            console.error('Failed to fetch roles:', error);
        } finally {
            fetchingRef.current = false;
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    const handleCreateRole = async () => {
        if (!formData.name.trim()) {
            alert('请输入角色名称');
            return;
        }
        try {
            await api.createRole(formData.name, formData.description, formData.permissions);
            setShowAddModal(false);
            setFormData({ name: '', description: '', permissions: [] });
            fetchRoles();
        } catch (error) {
            console.error('Failed to create role:', error);
            alert('创建角色失败');
        }
    };

    const handleUpdateRole = async () => {
        if (!selectedRole) return;
        if (!editFormData.name.trim()) {
            showToast('error', '提示', '请输入角色名称');
            return;
        }
        try {
            await api.updateRole(selectedRole.id, {
                name: editFormData.name,
                description: editFormData.description,
                permissions: editFormData.permissions
            });
            setSelectedRole(null);
            fetchRoles();
            showToast('success', '保存成功', '角色权限已更新');
        } catch (error) {
            console.error('Failed to update role:', error);
            showToast('error', '更新失败', '更新角色权限时发生错误，请重试');
        }
    };

    const handleDeleteRole = async (roleId: string, roleName: string) => {
        setConfirmConfig({
            title: '确认删除',
            message: `确定要删除角色 "${roleName}" 吗？此操作不可撤销。`,
            type: 'delete',
            onConfirm: async () => {
                try {
                    await api.deleteRole(roleId);
                    fetchRoles();
                    showToast('success', '删除成功', `角色「${roleName}」已删除`);
                } catch (error: any) {
                    console.error('Failed to delete role:', error);
                    showToast('error', '删除失败', error.response?.data?.detail || '删除角色失败');
                }
            }
        });
        setShowConfirmModal(true);
    };

    const handleStatusToggle = async (roleId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
        const actionText = newStatus === 'active' ? '启用' : '禁用';
        setConfirmConfig({
            title: `${actionText}角色`,
            message: `确定要${actionText}该角色吗？`,
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await api.updateRoleStatus(roleId, newStatus as 'active' | 'disabled');
                    fetchRoles();
                    showToast('success', `${actionText}成功`, `角色已${actionText}`);
                } catch (error: any) {
                    console.error('Failed to update role status:', error);
                    showToast('error', `${actionText}失败`, error.response?.data?.detail || `${actionText}角色失败`);
                }
            }
        });
        setShowConfirmModal(true);
    };

    const handleConfirm = () => {
        confirmConfig.onConfirm();
        setShowConfirmModal(false);
    };

    const handleOpenEdit = (role: Role, viewOnly: boolean = false) => {
        setSelectedRole(role);
        setIsViewMode(viewOnly || role.is_built_in);
        setEditFormData({
            name: role.name,
            description: role.description,
            permissions: [...role.permissions]
        });
    };

    const getBorderColor = (role: Role) => {
        if (role.is_built_in) return 'var(--state-error)';
        const roleColors: Record<string, string> = {
            '超级管理员': 'var(--state-error)',
            '知识库管理员': 'var(--color-primary)',
            '普通用户': 'var(--state-success)',
            '审核员': 'var(--state-warning)',
        };
        return roleColors[role.name] || 'var(--color-text-tertiary)';
    };

    const togglePermission = (permissionId: string, isEdit: boolean) => {
        if (isEdit && selectedRole?.is_built_in) return;
        
        if (isEdit) {
            setEditFormData(prev => ({
                ...prev,
                permissions: prev.permissions.includes(permissionId)
                    ? prev.permissions.filter(p => p !== permissionId)
                    : [...prev.permissions, permissionId]
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                permissions: prev.permissions.includes(permissionId)
                    ? prev.permissions.filter(p => p !== permissionId)
                    : [...prev.permissions, permissionId]
            }));
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
            <header className="h-[56px] shrink-0 flex items-center justify-between px-6" style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>系统管理</span>
                    <ChevronRight className="w-[14px] h-[14px] shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>角色管理</span>
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
                        <h1 className="text-[20px] font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>角色管理</h1>
                        <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>管理系统中的角色及其权限配置</p>
                    </div>
                    {hasPermission('role_create') && (
                        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 h-9 text-[13px] font-medium shrink-0 transition-colors duration-150 whitespace-nowrap" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)', borderRadius: 'var(--radius-md)' }}>
                            <Plus className="w-[16px] h-[16px]" />
                            <span>新建角色</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="w-9 h-9 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)' }}>
                            <Shield className="w-[18px] h-[18px]" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{stats?.total_roles || '-'}</p>
                            <p className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>全部角色</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="w-9 h-9 shrink-0 flex items-center justify-center" style={{ backgroundColor: '#E8F8F0', borderRadius: 'var(--radius-md)' }}>
                            <CheckCircle className="w-[18px] h-[18px]" style={{ color: 'var(--state-success)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{stats?.active_roles || '-'}</p>
                            <p className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>活跃角色</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="w-9 h-9 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <Ban className="w-[18px] h-[18px]" style={{ color: 'var(--color-text-tertiary)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{stats?.disabled_roles || '-'}</p>
                            <p className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>已禁用</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="w-9 h-9 shrink-0 flex items-center justify-center" style={{ backgroundColor: '#FEF3E2', borderRadius: 'var(--radius-md)' }}>
                            <Lock className="w-[18px] h-[18px]" style={{ color: 'var(--state-warning)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-bold whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{stats?.built_in_roles || '-'}</p>
                            <p className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>内置角色</p>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {roles.map((role) => (
                            <div key={role.id} className="flex flex-col" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderLeft: `3px solid ${getBorderColor(role)}`, borderRadius: 'var(--radius-lg)' }}>
                                <div className="p-4 pb-3">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <h3 className="text-[16px] font-semibold truncate min-w-0" style={{ color: 'var(--color-text-primary)' }}>{role.name}</h3>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {role.is_built_in && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                                                    <Lock className="w-[11px] h-[11px]" />
                                                    系统内置
                                                </span>
                                            )}
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0" style={{ backgroundColor: role.status === 'active' ? '#E8F8F0' : 'var(--color-bg-tertiary)', color: role.status === 'active' ? 'var(--state-success)' : 'var(--color-text-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                                                {role.status === 'active' ? '活跃' : (
                                                    <>
                                                        <span className="w-1.5 h-1.5 inline-block" style={{ backgroundColor: 'var(--color-text-tertiary)', borderRadius: '50%' }}></span>
                                                        已禁用
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[14px] line-clamp-2 mb-3" style={{ color: 'var(--color-text-secondary)' }}>{role.description}</p>
                                    <div className="flex items-center gap-4 text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                            <Key className="w-[14px] h-[14px]" />
                                            {role.is_built_in ? `全部权限 (${role.permissions.length}项)` : `${role.permissions.length} 项权限`}
                                        </span>
                                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                            <Users className="w-[14px] h-[14px]" />
                                            {role.members} 位成员
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-2 px-4 py-2.5 shrink-0" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                                    {role.is_built_in ? (
                                        <button onClick={() => handleOpenEdit(role, true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                                            <Eye className="w-[14px] h-[14px]" />
                                            查看权限
                                        </button>
                                    ) : role.status === 'disabled' ? (
                                        <>
                                            {hasPermission('role_edit') ? (
                                                <button onClick={() => handleOpenEdit(role)} className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                                                    <Pencil className="w-[14px] h-[14px]" />
                                                    编辑
                                                </button>
                                            ) : (
                                                <button onClick={() => handleOpenEdit(role, true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                                                    <Eye className="w-[14px] h-[14px]" />
                                                    查看权限
                                                </button>
                                            )}
                                            {hasPermission('role_disable') && (
                                                <button onClick={() => handleStatusToggle(role.id, role.status)} className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                                                    <Power className="w-[14px] h-[14px]" />
                                                    启用
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {hasPermission('role_edit') ? (
                                                <button onClick={() => handleOpenEdit(role)} className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                                                    <Pencil className="w-[14px] h-[14px]" />
                                                    编辑
                                                </button>
                                            ) : (
                                                <button onClick={() => handleOpenEdit(role, true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                                                    <Eye className="w-[14px] h-[14px]" />
                                                    查看权限
                                                </button>
                                            )}
                                            {hasPermission('role_disable') && (
                                                <button onClick={() => handleStatusToggle(role.id, role.status)} className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--state-warning)', borderRadius: 'var(--radius-md)' }}>
                                                    <Power className="w-[14px] h-[14px]" />
                                                    禁用
                                                </button>
                                            )}
                                            {hasPermission('role_delete') && (
                                                <button onClick={() => handleDeleteRole(role.id, role.name)} className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150" style={{ color: 'var(--state-error)', borderRadius: 'var(--radius-md)' }}>
                                                    <Trash2 className="w-[14px] h-[14px]" />
                                                    删除
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showAddModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[500px] max-w-[90vw]" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <h3 className="text-[16px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>新建角色</h3>
                            <button onClick={() => setShowAddModal(false)} className="flex items-center justify-center w-8 h-8 transition-colors duration-150" style={{ color: 'var(--color-text-tertiary)' }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>角色名称</label>
                                    <input 
                                        type="text" 
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-3 py-2 text-[14px] outline-none" 
                                        style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} 
                                        placeholder="请输入角色名称" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>角色描述</label>
                                    <textarea 
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full px-3 py-2 text-[14px] outline-none resize-none" 
                                        style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', minHeight: '80px' }} 
                                        placeholder="请输入角色描述" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>权限配置</label>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {permissions.map((permission) => (
                                            <label key={permission.id} className="flex items-center gap-3 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4" 
                                                    checked={formData.permissions.includes(permission.id)}
                                                    onChange={() => togglePermission(permission.id, false)}
                                                />
                                                <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{permission.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }}>取消</button>
                            <button onClick={handleCreateRole} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-inverse)', backgroundColor: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>确认创建</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedRole && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[500px] max-w-[90vw]" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <h3 className="text-[16px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedRole.name} - {isViewMode ? '查看权限' : '编辑权限'}</h3>
                            <button onClick={() => setSelectedRole(null)} className="flex items-center justify-center w-8 h-8 transition-colors duration-150" style={{ color: 'var(--color-text-tertiary)' }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>角色名称</label>
                                    <input 
                                        type="text" 
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                        disabled={isViewMode}
                                        className="w-full px-3 py-2 text-[14px] outline-none" 
                                        style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', opacity: isViewMode ? 0.6 : 1, cursor: isViewMode ? 'not-allowed' : 'text' }} 
                                        placeholder="请输入角色名称" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>角色描述</label>
                                    <textarea 
                                        value={editFormData.description}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                                        disabled={isViewMode}
                                        className="w-full px-3 py-2 text-[14px] outline-none resize-none" 
                                        style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', minHeight: '80px', opacity: isViewMode ? 0.6 : 1, cursor: isViewMode ? 'not-allowed' : 'text' }} 
                                        placeholder="请输入角色描述" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>权限配置</label>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {permissions.map((permission) => (
                                            <label key={permission.id} className="flex items-center gap-3 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4" 
                                                    checked={editFormData.permissions.includes(permission.id)}
                                                    onChange={() => togglePermission(permission.id, true)}
                                                    disabled={isViewMode}
                                                />
                                                <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{permission.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                            <button onClick={() => setSelectedRole(null)} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-secondary)' }}>关闭</button>
                            {!isViewMode && (
                                <button onClick={handleUpdateRole} className="px-4 py-2 text-[13px] font-medium" style={{ color: 'var(--color-text-inverse)', backgroundColor: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>保存修改</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showConfirmModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[420px] max-w-[90vw]" style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-float)' }}>
                        <div className="px-6 pt-6 pb-3 flex items-start gap-3">
                            <div className="shrink-0 mt-0.5">
                                {confirmConfig.type === 'delete' ? (
                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full" style={{ backgroundColor: 'rgba(208,72,72,0.1)' }}>
                                        <AlertTriangle className="w-4 h-4" style={{ color: 'var(--state-error)' }} />
                                    </div>
                                ) : confirmConfig.type === 'warning' ? (
                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full" style={{ backgroundColor: 'rgba(212,147,13,0.1)' }}>
                                        <AlertTriangle className="w-4 h-4" style={{ color: 'var(--state-warning)' }} />
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                                        <Info className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                    </div>
                                )}
                            </div>
                            <h4 className="text-base font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>{confirmConfig.title}</h4>
                        </div>
                        <div className="px-6 pb-5">
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{confirmConfig.message}</p>
                        </div>
                        <div className="px-6 pb-5 flex items-center justify-end gap-3">
                            <button onClick={() => setShowConfirmModal(false)} className="inline-flex items-center justify-center px-4 h-9 rounded-lg text-sm font-medium whitespace-nowrap" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary)' }}>取消</button>
                            <button onClick={handleConfirm} className="inline-flex items-center justify-center px-4 h-9 rounded-lg text-sm font-medium whitespace-nowrap" style={{ backgroundColor: confirmConfig.type === 'delete' ? 'var(--state-error)' : 'var(--color-primary)', color: 'var(--color-text-inverse)' }}>
                                {confirmConfig.type === 'delete' ? '确认删除' : '确认'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <Toast messages={toastMessages} onRemove={removeToast} />
        </div>
    );
}