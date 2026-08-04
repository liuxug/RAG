from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
from jose import JWTError, jwt
from loguru import logger
from pathlib import Path
import json

from utils.email_sender import send_verification_email, verify_code

ROLES_DATA_FILE = Path("./data/roles.json")

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

SECRET_KEY = "rag-doc-system-secret-key-change-in-production-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

USER_DATA_FILE = Path("./data/users.json")

class User(BaseModel):
    id: str
    username: str
    email: str
    hashed_password: str
    created_at: str
    is_active: bool = True

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=4, max_length=20, description="用户名（4-20位字母或数字）")
    email: EmailStr = Field(..., description="企业邮箱地址")
    password: str = Field(..., min_length=8, max_length=128, description="密码（至少8位）")
    code: str = Field(..., description="邮箱验证码")

class LoginRequest(BaseModel):
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")

class SendCodeRequest(BaseModel):
    email: EmailStr = Field(..., description="邮箱地址")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserInfoResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: str
    last_login: Optional[str] = None
    is_active: bool
    role: str
    permissions: List[str]

auth_router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def load_users() -> list:
    if not USER_DATA_FILE.exists():
        USER_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        default_user = User(
            id="1",
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("admin123"),
            created_at=datetime.now().isoformat(),
            is_active=True
        )
        with open(USER_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump([default_user.model_dump()], f, ensure_ascii=False, indent=2)
        return [default_user.model_dump()]
    with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_users(users: list) -> None:
    with open(USER_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def get_user_by_username(username: str) -> Optional[dict]:
    users = load_users()
    return next((u for u in users if u["username"] == username), None)

def get_user_by_email(email: str) -> Optional[dict]:
    users = load_users()
    return next((u for u in users if u["email"] == email), None)

def load_roles() -> list:
    if not ROLES_DATA_FILE.exists():
        return []
    with open(ROLES_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def get_role_permissions(role_name: str) -> List[str]:
    roles = load_roles()
    role = next((r for r in roles if r["name"] == role_name), None)
    if role:
        return role.get("permissions", [])
    return []

def get_user_permissions(user: dict) -> List[str]:
    role_name = user.get("role", "普通用户")
    return get_role_permissions(role_name)

def require_permission(permission: str):
    async def permission_checker(user: dict = Depends(get_current_user)):
        permissions = get_user_permissions(user)
        if permission not in permissions and user.get("role") != "超级管理员":
            raise HTTPException(status_code=403, detail=f"无权访问此功能，需要权限: {permission}")
        return user
    return permission_checker

def create_user(username: str, email: str, password: str) -> dict:
    users = load_users()
    user_id = str(len(users) + 1)
    new_user = User(
        id=user_id,
        username=username,
        email=email,
        hashed_password=get_password_hash(password),
        created_at=datetime.now().isoformat(),
        is_active=True
    )
    users.append(new_user.model_dump())
    save_users(users)
    return new_user.model_dump()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
        user = get_user_by_username(username)
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

@auth_router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    if get_user_by_username(request.username):
        raise HTTPException(status_code=400, detail="用户名已被存在")
    
    if get_user_by_email(request.email):
        raise HTTPException(status_code=400, detail="邮箱已被注册")
    
    if not verify_code(request.email, request.code):
        raise HTTPException(status_code=400, detail="验证码无效或过期")
    
    user = create_user(request.username, request.email, request.password)
    user["role"] = "普通用户"
    user["department"] = "-"
    save_users(load_users())
    permissions = get_user_permissions(user)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "id": user["id"]},
        expires_delta=access_token_expires
    )
    
    logger.info(f"User registered: {request.username}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "created_at": user["created_at"],
            "role": user["role"],
            "permissions": permissions
        }
    }

@auth_router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = get_user_by_username(request.username)
    if user is None:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    if not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="用户账号已被禁用")
    
    users = load_users()
    for u in users:
        if u["username"] == request.username:
            u["last_login"] = datetime.now().isoformat()
            break
    save_users(users)
    
    permissions = get_user_permissions(user)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "id": user["id"]},
        expires_delta=access_token_expires
    )
    
    from utils.system_log_storage import system_log_storage
    system_log_storage.add_log(
        user_id=user["id"],
        username=user["username"],
        action="登录",
        target="系统",
        target_type="system",
        detail="用户登录系统"
    )
    
    logger.info(f"User logged in: {request.username}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "created_at": user["created_at"],
            "last_login": users[next(i for i, u in enumerate(users) if u["username"] == request.username)]["last_login"],
            "role": user.get("role", "普通用户"),
            "permissions": permissions
        }
    }

@auth_router.post("/verify-token", response_model=UserInfoResponse)
async def verify_token(user: dict = Depends(get_current_user)):
    permissions = get_user_permissions(user)
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "created_at": user["created_at"],
        "last_login": user.get("last_login"),
        "is_active": user.get("is_active", True),
        "role": user.get("role", "普通用户"),
        "permissions": permissions
    }

@auth_router.post("/send-code")
async def send_code(request: SendCodeRequest):
    if get_user_by_email(request.email):
        raise HTTPException(status_code=400, detail="邮箱已被注册")
    
    code = send_verification_email(request.email)
    if code:
        logger.info(f"Verification code sent to email: {request.email}")
        return {"message": "验证码发送成功"}
    else:
        raise HTTPException(status_code=500, detail="发送验证码失败")
