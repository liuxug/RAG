from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from loguru import logger
from pathlib import Path
from datetime import datetime
import json
import uuid

from api.auth import require_permission

roles_router = APIRouter(prefix="/roles", tags=["roles"])

ROLES_DATA_FILE = Path("./data/roles.json")
USERS_DATA_FILE = Path("./data/users.json")

class Permission(BaseModel):
    id: str
    name: str
    description: str

class RoleCreateRequest(BaseModel):
    name: str
    description: str = ""
    permissions: list[str] = []
    is_built_in: bool = False

class RoleUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    permissions: list[str] | None = None
    status: str | None = None

class RoleResponse(BaseModel):
    id: str
    name: str
    description: str
    permissions: list[str]
    permissions_count: int
    members: int
    status: str
    is_built_in: bool
    created_at: str
    updated_at: str

class RoleStatsResponse(BaseModel):
    total_roles: int
    active_roles: int
    disabled_roles: int
    built_in_roles: int

ALL_PERMISSIONS = [
    Permission(id="doc_view", name="文档查看", description="查看文档内容"),
    Permission(id="doc_upload", name="文档上传", description="上传新文档"),
    Permission(id="doc_edit", name="文档编辑", description="编辑文档信息"),
    Permission(id="doc_delete", name="文档删除", description="删除文档"),
    Permission(id="doc_download", name="文档下载", description="下载文档"),
    Permission(id="doc_review", name="文档审核", description="审核文档"),
    Permission(id="doc_publish", name="文档发布", description="发布文档"),
    Permission(id="doc_comment", name="文档评论", description="评论文档"),
    
    Permission(id="user_view", name="用户查看", description="查看用户列表"),
    Permission(id="user_create", name="用户创建", description="创建新用户"),
    Permission(id="user_edit", name="用户编辑", description="编辑用户信息"),
    Permission(id="user_delete", name="用户删除", description="删除用户"),
    Permission(id="user_disable", name="用户禁用", description="禁用/启用用户"),
    
    Permission(id="role_view", name="角色查看", description="查看角色列表"),
    Permission(id="role_create", name="角色创建", description="创建新角色"),
    Permission(id="role_edit", name="角色编辑", description="编辑角色信息"),
    Permission(id="role_delete", name="角色删除", description="删除角色"),
    Permission(id="role_disable", name="角色禁用", description="禁用/启用角色"),
    
    Permission(id="search", name="智能检索", description="使用智能检索功能"),
    Permission(id="chat", name="AI对话", description="使用AI对话功能"),
    Permission(id="knowledge_graph", name="知识图谱", description="查看知识图谱"),
    Permission(id="recommend", name="推荐文档", description="获取推荐文档"),
    
    Permission(id="stats_view", name="统计查看", description="查看数据统计"),
    # Permission(id="system_settings", name="系统设置", description="修改系统设置"),
    Permission(id="llm_switch", name="模型切换", description="切换LLM模型"),
    
    Permission(id="history_view", name="历史记录", description="查看搜索/下载历史"),
    Permission(id="history_manage", name="历史管理", description="管理历史记录"),
]

def get_all_permissions():
    return [p.model_dump() for p in ALL_PERMISSIONS]

def load_roles():
    if not ROLES_DATA_FILE.exists():
        ROLES_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        default_roles = [
            {
                "id": "1",
                "name": "超级管理员",
                "description": "拥有系统全部权限，可管理所有用户和配置",
                "permissions": [p.id for p in ALL_PERMISSIONS],
                "members": 2,
                "status": "active",
                "is_built_in": True,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            },
            {
                "id": "2",
                "name": "知识库管理员",
                "description": "管理文档库的分类、上传审核及内容发布",
                "permissions": ["doc_view", "doc_upload", "doc_edit", "doc_delete", "doc_download", "doc_review", "doc_publish", "doc_comment", "search", "chat", "knowledge_graph", "recommend", "stats_view"],
                "members": 5,
                "status": "active",
                "is_built_in": False,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            },
            {
                "id": "3",
                "name": "普通用户",
                "description": "可浏览、检索文档和使用AI对话功能",
                "permissions": ["doc_view", "doc_download", "doc_comment", "search", "chat", "recommend", "history_view"],
                "members": 128,
                "status": "active",
                "is_built_in": False,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            },
            {
                "id": "4",
                "name": "审核员",
                "description": "负责文档内容的审核与质量把控",
                "permissions": ["doc_view", "doc_download", "doc_review", "doc_publish", "doc_comment", "stats_view"],
                "members": 8,
                "status": "active",
                "is_built_in": False,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            },
            {
                "id": "5",
                "name": "外部访客",
                "description": "仅可访问公开文档，无上传和下载权限",
                "permissions": ["doc_view", "search", "chat"],
                "members": 15,
                "status": "active",
                "is_built_in": False,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            },
            {
                "id": "6",
                "name": "数据分析师",
                "description": "可访问数据统计和报表分析功能",
                "permissions": ["doc_view", "stats_view", "knowledge_graph", "recommend"],
                "members": 0,
                "status": "disabled",
                "is_built_in": False,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
        ]
        with open(ROLES_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(default_roles, f, ensure_ascii=False, indent=2)
        return default_roles
    with open(ROLES_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_roles(roles: list):
    with open(ROLES_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(roles, f, ensure_ascii=False, indent=2)

def get_role_by_id(role_id: str) -> dict | None:
    roles = load_roles()
    return next((r for r in roles if r["id"] == role_id), None)

def get_role_by_name(name: str) -> dict | None:
    roles = load_roles()
    return next((r for r in roles if r["name"] == name), None)

def _get_roles_data():
    """获取角色数据（内部方法）"""
    roles = load_roles()
    
    user_role_counts = {}
    if USERS_DATA_FILE.exists():
        try:
            with open(USERS_DATA_FILE, "r", encoding="utf-8") as f:
                users = json.load(f)
            for user in users:
                role_name = user.get("role", "")
                if role_name:
                    user_role_counts[role_name] = user_role_counts.get(role_name, 0) + 1
        except:
            pass
    
    for role in roles:
        if "permissions_count" not in role:
            role["permissions_count"] = len(role.get("permissions", []))
        role["members"] = user_role_counts.get(role["name"], 0)
    return roles

@roles_router.get("/", response_model=list[RoleResponse])
async def get_roles():
    """获取所有角色列表"""
    try:
        return _get_roles_data()
    except Exception as e:
        logger.error(f"Failed to get roles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取角色列表失败: {str(e)}")

@roles_router.get("", response_model=list[RoleResponse])
async def get_roles_no_slash():
    """获取所有角色列表（不带斜杠）"""
    return await get_roles()

@roles_router.get("/stats", response_model=RoleStatsResponse)
async def get_role_stats():
    """获取角色统计信息"""
    try:
        roles = load_roles()
        total = len(roles)
        active = sum(1 for r in roles if r["status"] == "active")
        disabled = sum(1 for r in roles if r["status"] == "disabled")
        built_in = sum(1 for r in roles if r.get("is_built_in", False))
        
        return {
            "total_roles": total,
            "active_roles": active,
            "disabled_roles": disabled,
            "built_in_roles": built_in
        }
    except Exception as e:
        logger.error(f"Failed to get role stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取角色统计失败: {str(e)}")

@roles_router.get("/permissions")
async def get_permissions():
    """获取所有可用权限列表"""
    try:
        return {"permissions": get_all_permissions()}
    except Exception as e:
        logger.error(f"Failed to get permissions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取权限列表失败: {str(e)}")

@roles_router.get("/{role_id}", response_model=RoleResponse)
async def get_role(role_id: str):
    """获取单个角色详情"""
    try:
        role = get_role_by_id(role_id)
        if not role:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        if "permissions_count" not in role:
            role["permissions_count"] = len(role.get("permissions", []))
        
        if USERS_DATA_FILE.exists():
            try:
                with open(USERS_DATA_FILE, "r", encoding="utf-8") as f:
                    users = json.load(f)
                role["members"] = sum(1 for u in users if u.get("role") == role["name"])
            except:
                pass
        
        return role
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取角色详情失败: {str(e)}")

@roles_router.post("/", response_model=RoleResponse)
async def create_role(request: RoleCreateRequest, user: dict = Depends(require_permission("role_create"))):
    """创建新角色"""
    try:
        if get_role_by_name(request.name):
            raise HTTPException(status_code=400, detail="角色名称已存在")
        
        roles = load_roles()
        
        new_role = {
            "id": str(len(roles) + 1),
            "name": request.name,
            "description": request.description,
            "permissions": request.permissions,
            "permissions_count": len(request.permissions),
            "members": 0,
            "status": "active",
            "is_built_in": request.is_built_in,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        roles.append(new_role)
        save_roles(roles)
        
        logger.info(f"Role created: {request.name}")
        
        from utils.system_log_storage import system_log_storage
        system_log_storage.add_log(
            user_id=user.get("id"),
            username=user.get("username", ""),
            action="创建角色",
            target=new_role["name"],
            target_type="role",
            detail=f"创建角色: {new_role['name']}"
        )
        
        return new_role
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建角色失败: {str(e)}")

@roles_router.put("/{role_id}", response_model=RoleResponse)
async def update_role(role_id: str, request: RoleUpdateRequest, user: dict = Depends(require_permission("role_edit"))):
    """更新角色信息"""
    try:
        roles = load_roles()
        role_index = next((i for i, r in enumerate(roles) if r["id"] == role_id), None)
        
        if role_index is None:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        role = roles[role_index]
        
        if role.get("is_built_in", False):
            raise HTTPException(status_code=400, detail="内置角色不可修改")
        
        if request.name is not None:
            existing_role = get_role_by_name(request.name)
            if existing_role and existing_role["id"] != role_id:
                raise HTTPException(status_code=400, detail="角色名称已存在")
            role["name"] = request.name
        
        if request.description is not None:
            role["description"] = request.description
        
        if request.permissions is not None:
            role["permissions"] = request.permissions
            role["permissions_count"] = len(request.permissions)
        
        if request.status is not None:
            if request.status not in ["active", "disabled"]:
                raise HTTPException(status_code=400, detail="状态只能为 active 或 disabled")
            role["status"] = request.status
        
        role["updated_at"] = datetime.now().isoformat()
        save_roles(roles)
        
        logger.info(f"Role updated: {role_id}")
        
        from utils.system_log_storage import system_log_storage
        system_log_storage.add_log(
            user_id=user.get("id"),
            username=user.get("username", ""),
            action="编辑角色",
            target=role["name"],
            target_type="role",
            detail=f"编辑角色: {role['name']}"
        )
        
        return role
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新角色失败: {str(e)}")

@roles_router.delete("/{role_id}")
async def delete_role(role_id: str, user: dict = Depends(require_permission("role_delete"))):
    """删除角色"""
    try:
        roles = load_roles()
        role_index = next((i for i, r in enumerate(roles) if r["id"] == role_id), None)
        
        if role_index is None:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        role = roles[role_index]
        
        if role.get("is_built_in", False):
            raise HTTPException(status_code=400, detail="内置角色不可删除")
        
        if role.get("members", 0) > 0:
            raise HTTPException(status_code=400, detail="该角色下还有用户，无法删除")
        
        deleted_role = roles.pop(role_index)
        save_roles(roles)
        
        logger.info(f"Role deleted: {role_id}")
        
        from utils.system_log_storage import system_log_storage
        system_log_storage.add_log(
            user_id=user.get("id"),
            username=user.get("username", ""),
            action="删除角色",
            target=deleted_role["name"],
            target_type="role",
            detail=f"删除角色: {deleted_role['name']}"
        )
        
        return {"message": f"角色 '{deleted_role['name']}' 删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除角色失败: {str(e)}")

@roles_router.post("/{role_id}/status")
async def update_role_status(role_id: str, status: str = Query(..., description="角色状态: active, disabled"), user: dict = Depends(require_permission("role_disable"))):
    """更新角色状态"""
    try:
        if status not in ["active", "disabled"]:
            raise HTTPException(status_code=400, detail="状态只能为 active 或 disabled")
        
        roles = load_roles()
        role_index = next((i for i, r in enumerate(roles) if r["id"] == role_id), None)
        
        if role_index is None:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        role = roles[role_index]
        
        if role.get("is_built_in", False) and status == "disabled":
            raise HTTPException(status_code=400, detail="内置角色不可禁用")
        
        role["status"] = status
        role["updated_at"] = datetime.now().isoformat()
        save_roles(roles)
        
        logger.info(f"Role status updated: {role_id} -> {status}")
        
        from utils.system_log_storage import system_log_storage
        status_label = "启用" if status == "active" else "禁用"
        system_log_storage.add_log(
            user_id=user.get("id"),
            username=user.get("username", ""),
            action=status_label + "角色",
            target=role["name"],
            target_type="role",
            detail=f"{status_label}角色: {role['name']}"
        )
        
        return {"message": f"角色状态已更新为 '{status}'"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update role status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新角色状态失败: {str(e)}")