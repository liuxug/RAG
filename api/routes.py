from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Depends, Form
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from ingest.document_processor import DocumentProcessor
from ingest.embedding_manager import EmbeddingManager
from ingest.vector_store import VectorStore
from retrieval.retriever import Retriever
from generation.generator import Generator
from core.config import settings
from utils.search_storage import search_storage
from loguru import logger
from pathlib import Path
import uuid
import json
import os
from datetime import datetime, timedelta

from api.auth import require_permission

router = APIRouter()
security = HTTPBearer()

USER_DATA_FILE = Path("./data/users.json")

def get_user_by_username(username: str):
    if not USER_DATA_FILE.exists():
        return None
    with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
        users = json.load(f)
    return next((u for u in users if u["username"] == username), None)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        from jose import jwt
        SECRET_KEY = "rag-doc-system-secret-key-change-in-production-2024"
        ALGORITHM = "HS256"
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return get_user_by_username(username)
    except Exception:
        return None

document_processor = DocumentProcessor()
embedding_manager = EmbeddingManager()
vector_store = VectorStore()
retriever = Retriever()
generator = Generator()


class QueryRequest(BaseModel):
    question: str
    language: str = "zh"
    source_filter: list = None


class QueryResponse(BaseModel):
    answer: str
    sources: list = []


class UploadResponse(BaseModel):
    message: str
    file_name: str
    chunks_count: int


class DocumentResponse(BaseModel):
    id: str
    name: str
    type: str
    category: str
    createTime: str
    updateTime: str
    status: str
    isFavorite: bool
    pages: int
    chunks: int
    author: str


@router.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "document_count": vector_store.get_document_count()}

@router.get("/stats")
async def get_stats(user: dict = Depends(require_permission("stats_view"))):
    """Get document statistics"""
    try:
        from datetime import datetime, timedelta
        documents = vector_store.get_all_documents()
        
        documents = [doc for doc in documents if doc.get("status") != "临时"]
        
        total_chunks = vector_store.get_document_count()
        
        total_docs = len(documents)
        published_docs = sum(1 for doc in documents if doc.get("status") == "已发布")
        pending_review = sum(1 for doc in documents if doc.get("status") == "待审核")
        
        total_pages = sum(doc.get("pages", 0) for doc in documents)
        
        now = datetime.now()
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        this_week_new = 0
        for doc in documents:
            create_time_str = doc.get("createTime", "")
            if create_time_str:
                try:
                    create_time = datetime.fromisoformat(create_time_str.replace('Z', '+00:00'))
                    if create_time >= week_start:
                        this_week_new += 1
                except:
                    pass
        
        return {
            "total_documents": total_docs,
            "published_documents": published_docs,
            "total_chunks": total_chunks,
            "total_pages": total_pages,
            "pending_review": pending_review,
            "favorites": 0,
            "this_week_new": this_week_new
        }
    except Exception as e:
        logger.error(f"Failed to fetch stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


@router.get("/documents")
async def get_documents(
    type: str = Query(None, description="Document type filter"),
    category: str = Query(None, description="Category filter"),
    status: str = Query(None, description="Status filter"),
    search: str = Query(None, description="Search query"),
    sort_by: str = Query("name", description="Sort field: name, type, category, pages"),
    sort_order: str = Query("asc", description="Sort order: asc, desc"),
    page: int = Query(1, description="Page number (starting from 1)"),
    page_size: int = Query(10, description="Number of items per page"),
    user: dict = Depends(require_permission("doc_view"))
):
    """Get documents from the knowledge base with filtering, sorting and pagination"""
    try:
        documents = vector_store.get_all_documents()
        
        documents = [doc for doc in documents if doc.get("status") != "临时"]
        
        logger.info(f"Raw documents from vector store: {documents}")
        
        if type:
            documents = [doc for doc in documents if doc.get("type") == type]
        
        if category:
            documents = [doc for doc in documents if doc.get("category") == category]
        
        if status:
            documents = [doc for doc in documents if doc.get("status") == status]
        
        if search:
            search_lower = search.lower()
            documents = [doc for doc in documents if search_lower in doc.get("name", "").lower()]
        
        if sort_by in ["name", "type", "category", "pages"]:
            documents.sort(key=lambda x: x.get(sort_by, ""), reverse=(sort_order == "desc"))
        
        total = len(documents)
        total_pages = (total + page_size - 1) // page_size
        
        start = (page - 1) * page_size
        end = start + page_size
        paginated_documents = documents[start:end]
        
        logger.info(f"Returning page {page}/{total_pages} with {len(paginated_documents)} documents")
        
        return {
            "documents": paginated_documents,
            "total": total,
            "total_pages": total_pages,
            "page": page,
            "page_size": page_size
        }
    except Exception as e:
        logger.error(f"Failed to fetch documents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch documents: {str(e)}")


@router.get("/documents/{document_name}/download")
async def download_document(document_name: str, user: dict = Depends(require_permission("doc_download"))):
    """Download a document and record download history"""
    try:
        from core.config import settings
        from utils.download_storage import download_storage
        import urllib.parse
        username = user.get("username") if isinstance(user, dict) else (user.username if hasattr(user, 'username') else 'unknown')
        
        safe_name = str(os.path.basename(document_name))
        upload_dir = Path(settings.UPLOAD_DIR)
        
        actual_file_path = None
        
        direct_path = upload_dir / safe_name
        if direct_path.exists():
            actual_file_path = direct_path
        else:
            for file in upload_dir.iterdir():
                if file.is_file() and file.name.endswith(f"_{safe_name}"):
                    actual_file_path = file
                    break
        
        if not actual_file_path:
            raise HTTPException(status_code=404, detail="Document not found")
        
        doc_info = vector_store.get_document_details(safe_name)
        
        download_storage.add_download(
            username=str(username),
            document_name=str(safe_name),
            document_type=str(doc_info.get("type", "")),
            category=str(doc_info.get("category", ""))
        )
        
        logger.info(f"Downloading document: {actual_file_path} (display name: {safe_name})")
        
        from fastapi.responses import FileResponse
        
        encoded_filename = urllib.parse.quote(safe_name)
        
        return FileResponse(
            actual_file_path,
            filename=safe_name,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download document: {str(e)}")


SHARE_TOKENS_FILE = "share_tokens.json"

def load_share_tokens():
    if os.path.exists(SHARE_TOKENS_FILE):
        try:
            with open(SHARE_TOKENS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_share_tokens(tokens):
    with open(SHARE_TOKENS_FILE, 'w', encoding='utf-8') as f:
        json.dump(tokens, f, ensure_ascii=False)

@router.get("/documents/{document_name}/share")
async def share_document(document_name: str):
    """Generate a share link for a document"""
    try:
        from core.config import settings
        
        safe_name = os.path.basename(document_name)
        
        documents = vector_store.get_all_documents()
        doc = next((d for d in documents if d.get("name") == safe_name), None)
        
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        share_token = uuid.uuid4().hex[:16]
        
        tokens = load_share_tokens()
        tokens[share_token] = {
            "document_name": safe_name,
            "created_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(days=1)).isoformat()
        }
        save_share_tokens(tokens)
        
        frontend_url = settings.BASE_URL or 'http://localhost:5173'
        share_link = f"{frontend_url}/share/{share_token}"
        
        return {
            "message": "Share link generated successfully",
            "share_link": share_link,
            "expires_in": 86400
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate share link: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate share link: {str(e)}")


@router.get("/share/verify/{share_token}")
async def verify_share_token(share_token: str):
    """Verify a share token and return document info"""
    try:
        tokens = load_share_tokens()
        
        if share_token not in tokens:
            raise HTTPException(status_code=404, detail="Invalid or expired share link")
        
        token_data = tokens[share_token]
        expires_at = datetime.fromisoformat(token_data["expires_at"])
        
        if datetime.now() > expires_at:
            del tokens[share_token]
            save_share_tokens(tokens)
            raise HTTPException(status_code=404, detail="Share link has expired")
        
        document_name = token_data["document_name"]
        documents = vector_store.get_all_documents()
        doc = next((d for d in documents if d.get("name") == document_name), None)
        
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {
            "valid": True,
            "document_name": document_name,
            "document": doc,
            "expires_at": token_data["expires_at"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to verify share token: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to verify share token: {str(e)}")


@router.get("/share/{share_token}")
async def access_shared_document(share_token: str):
    """Access a shared document content"""
    try:
        tokens = load_share_tokens()
        
        if share_token not in tokens:
            raise HTTPException(status_code=404, detail="Invalid or expired share link")
        
        token_data = tokens[share_token]
        expires_at = datetime.fromisoformat(token_data["expires_at"])
        
        if datetime.now() > expires_at:
            del tokens[share_token]
            save_share_tokens(tokens)
            raise HTTPException(status_code=404, detail="Share link has expired")
        
        document_name = token_data["document_name"]
        detail = vector_store.get_document_details(document_name)
        
        if not detail:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return detail
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to access shared document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to access shared document: {str(e)}")


class UploadRequest(BaseModel):
    status: str = "待审核"


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    status: str = Form("待审核"),
    category: str = Form("其他"),
    author: str = Form(""),
    current_user: dict = Depends(require_permission("doc_upload"))
):
    """Upload a document to the knowledge base"""
    try:
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in DocumentProcessor.SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}. Supported types: {DocumentProcessor.SUPPORTED_EXTENSIONS}"
            )

        if status not in ["草稿", "待审核"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid initial status: {status}. Must be '草稿' or '待审核'"
            )

        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        
        unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
        file_path = settings.upload_dir / unique_filename
        
        with open(file_path, "wb") as f:
            f.write(await file.read())
        
        logger.info(f"File saved: {file_path}")
        
        pages = document_processor.process(file_path)
        
        author = current_user["username"] if current_user else "系统"
        
        docs = embedding_manager.split_text(pages, file.filename, author, status)
        
        chunks_count = vector_store.add_documents(docs)
        
        from utils.system_log_storage import system_log_storage
        system_log_storage.add_log(
            user_id=current_user.get("id"),
            username=author,
            action="上传",
            target=file.filename,
            target_type="document",
            detail=f"上传文档，共 {chunks_count} 个片段"
        )
        
        return {"message": "Document uploaded and indexed successfully", "file_name": file.filename, "chunks_count": chunks_count}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/upload/temporary", response_model=UploadResponse)
async def upload_temporary_document(
    file: UploadFile = File(...)
):
    """Upload a temporary document for AI chat (auto-deleted after use)"""
    try:
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in DocumentProcessor.SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}. Supported types: {DocumentProcessor.SUPPORTED_EXTENSIONS}"
            )

        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        
        unique_filename = f"temp_{uuid.uuid4().hex}_{file.filename}"
        file_path = settings.upload_dir / unique_filename
        
        with open(file_path, "wb") as f:
            f.write(await file.read())
        
        logger.info(f"Temporary file saved: {file_path}")
        
        pages = document_processor.process(file_path)
        
        docs = embedding_manager.split_text(pages, file.filename, "临时用户", "临时")
        
        chunks_count = vector_store.add_documents(docs)
        
        return {"message": "Temporary document uploaded and indexed successfully", "file_name": file.filename, "chunks_count": chunks_count}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Temporary upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Temporary upload failed: {str(e)}")


@router.get("/documents/{document_name}")
async def get_document_detail(document_name: str, user: dict = Depends(require_permission("doc_view"))):
    """Get detailed information about a specific document"""
    try:
        logger.info(f"Fetching details for document: {document_name}")
        details = vector_store.get_document_details(document_name)
        
        if not details["all_chunks"]:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return details
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch document details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch document details: {str(e)}")


@router.delete("/documents/{document_name}")
async def delete_document(document_name: str, user: dict = Depends(require_permission("doc_delete"))):
    """Delete a document from the knowledge base"""
    try:
        logger.info(f"Deleting document: {document_name}")
        success = vector_store.delete_document(document_name)
        
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        
        from utils.system_log_storage import system_log_storage
        username = user.get("username", "unknown")
        system_log_storage.add_log(
            user_id=user.get("id"),
            username=username,
            action="删除",
            target=document_name,
            target_type="document",
            detail=f"删除文档: {document_name}"
        )
        
        return {"message": f"Document '{document_name}' deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")


class UpdateStatusRequest(BaseModel):
    status: str


class UpdateCategoryRequest(BaseModel):
    category: str


@router.post("/documents/{document_name}/status")
async def update_document_status(document_name: str, request: UpdateStatusRequest):
    """Update the status of a document"""
    try:
        valid_statuses = ["草稿", "待审核", "已发布", "已删除", "审核驳回"]
        
        if request.status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {request.status}. Valid statuses: {valid_statuses}"
            )
        
        logger.info(f"Updating status for document: {document_name} to {request.status}")
        success = vector_store.update_document_status(document_name, request.status)
        
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {"message": f"Document '{document_name}' status updated to '{request.status}' successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update document status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update document status: {str(e)}")


@router.post("/documents/{document_name}/category")
async def update_document_category(document_name: str, request: UpdateCategoryRequest):
    """Update the category of a document"""
    try:
        valid_categories = ["技术", "人力资源", "财务", "法务", "市场", "产品", "其他"]
        
        if request.category not in valid_categories:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid category: {request.category}. Valid categories: {valid_categories}"
            )
        
        logger.info(f"Updating category for document: {document_name} to {request.category}")
        success = vector_store.update_document_category(document_name, request.category)
        
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {"message": f"Document '{document_name}' category updated to '{request.category}' successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update document category: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update document category: {str(e)}")


@router.post("/documents/{document_name}/review")
async def review_document(
    document_name: str, 
    action: str = Query(..., description="Review action: approve, reject"),
    comment: str = Query("", description="Review comment/rejection reason"),
    user: dict = Depends(require_permission("doc_review"))
):
    """Review a document - approve or reject"""
    try:
        if action == "approve":
            new_status = "已发布"
        elif action == "reject":
            new_status = "审核驳回"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid action: {action}. Must be 'approve' or 'reject'"
            )
        
        logger.info(f"Reviewing document: {document_name}, action: {action}, comment: {comment}")
        success = vector_store.update_document_status(document_name, new_status, comment)
        
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        
        from utils.system_log_storage import system_log_storage
        username = user.get("username", "unknown")
        action_label = "批准" if action == "approve" else "驳回"
        system_log_storage.add_log(
            user_id=user.get("id"),
            username=username,
            action=action_label,
            target=document_name,
            target_type="document",
            detail=f"{action_label}文档: {document_name}{f'，意见: {comment}' if comment else ''}"
        )
        
        return {"message": f"Document '{document_name}' {action}d successfully", "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to review document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to review document: {str(e)}")


class CommentRequest(BaseModel):
    content: str


@router.get("/documents/{document_name}/comments")
async def get_document_comments(document_name: str, user: dict = Depends(require_permission("doc_comment"))):
    """Get all comments for a document"""
    try:
        from utils.comment_storage import comment_storage
        
        comments = comment_storage.get_comments(document_name)
        
        return {"comments": comments}
    except Exception as e:
        logger.error(f"Failed to get comments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get comments: {str(e)}")


@router.post("/documents/{document_name}/comments")
async def add_comment(document_name: str, request: CommentRequest, user: dict = Depends(require_permission("doc_comment"))):
    """Add a comment to a document"""
    try:
        from utils.comment_storage import comment_storage
        
        if not request.content.strip():
            raise HTTPException(status_code=400, detail="Comment content cannot be empty")
        
        username = user.get("username", "unknown")
        
        comment_storage.add_comment(document_name, str(username), request.content)
        
        return {"message": "Comment added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add comment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add comment: {str(e)}")


@router.delete("/documents/{document_name}/comments/{comment_id}")
async def delete_comment(document_name: str, comment_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Delete a comment from a document"""
    try:
        from utils.comment_storage import comment_storage
        
        user = await get_current_user(credentials)
        username = user.username if hasattr(user, 'username') else user.get('username', 'unknown')
        
        success = comment_storage.delete_comment(comment_id, str(username))
        
        if not success:
            raise HTTPException(status_code=404, detail="Comment not found or not authorized")
        
        return {"message": "Comment deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete comment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete comment: {str(e)}")


@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest, user: dict = Depends(require_permission("chat"))):
    """Query the knowledge base"""
    try:
        import time
        
        if not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")
        
        logger.info(f"Received query: {request.question[:50]}...")
        
        start_time = time.time()
        
        documents = retriever.retrieve(request.question, source_filter=request.source_filter)
        
        result = generator.generate(request.question, documents, language=request.language)
        
        response_time = round(time.time() - start_time, 2)
        
        search_storage.record_search(request.question, user.get("id") if user else None, source="chat")
        
        from utils.conversation_storage import conversation_storage
        conversation_storage.record_conversation(
            user_id=user.get("id") if user else None,
            question=request.question,
            response_time=response_time
        )
        
        from utils.system_log_storage import system_log_storage
        system_log_storage.add_log(
            user_id=user.get("id") if user else None,
            username=user.get("username") if user else "匿名用户",
            action="查询",
            target=request.question[:50],
            target_type="query",
            detail=f"AI对话查询，响应时间 {response_time}s"
        )
        
        if request.source_filter:
            for source_name in request.source_filter:
                try:
                    vector_store.delete_document(source_name)
                    logger.info(f"Deleted temporary document: {source_name}")
                except Exception as e:
                    logger.warning(f"Failed to delete temporary document {source_name}: {str(e)}")
        
        return JSONResponse(content={
            "answer": result["answer"],
            "sources": result["sources"]
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


class KnowledgeGraphNode(BaseModel):
    id: str
    label: str
    position: str


class KnowledgeGraphResponse(BaseModel):
    nodes: list[KnowledgeGraphNode]


@router.post("/query/knowledge-graph", response_model=KnowledgeGraphResponse)
async def get_knowledge_graph(request: QueryRequest, user: dict = Depends(require_permission("knowledge_graph"))):
    """Get knowledge graph based on query context"""
    try:
        if not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")
        
        logger.info(f"Generating knowledge graph for query: {request.question[:50]}...")
        
        documents = retriever.retrieve(request.question, top_k=5)
        
        categories = set()
        source_names = []
        
        for doc in documents:
            source = doc.get("source", "")
            if source:
                source_names.append(source)
                category = vector_store._get_category(source)
                if category and category != "其他":
                    categories.add(category)
        
        nodes = []
        center_label = request.question[:10] if len(request.question) > 10 else request.question
        nodes.append({
            "id": "center",
            "label": center_label,
            "position": "center"
        })
        
        category_positions = ["top-left", "top-right"]
        source_positions = ["bottom-left", "bottom-right"]
        
        for idx, category in enumerate(list(categories)[:2]):
            nodes.append({
                "id": f"cat-{idx}",
                "label": category,
                "position": category_positions[idx % len(category_positions)]
            })
        
        for idx, source in enumerate(source_names[:3]):
            short_name = source.split(".")[0][:8]
            if len(source.split(".")[0]) > 8:
                short_name += "..."
            nodes.append({
                "id": f"src-{idx}",
                "label": short_name,
                "position": source_positions[idx % len(source_positions)]
            })
        
        return {"nodes": nodes[:6]}
    
    except Exception as e:
        logger.error(f"Failed to generate knowledge graph: {str(e)}")
        return {"nodes": []}


class Recommendation(BaseModel):
    id: str
    name: str
    category: str
    matchRate: str


class RecommendationResponse(BaseModel):
    recommendations: list[Recommendation]


@router.post("/query/recommendations", response_model=RecommendationResponse)
async def get_recommendations(request: QueryRequest, user: dict = Depends(require_permission("recommend"))):
    """Get recommended documents based on query context"""
    try:
        if not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")
        
        logger.info(f"Generating recommendations for query: {request.question[:50]}...")
        
        all_documents = vector_store.get_all_documents(status_filter="已发布")
        
        keyword_results = []
        for doc in all_documents:
            name = doc.get("name", "")
            category = doc.get("category", "")
            score = _calculate_keyword_score(request.question, name, category)
            if score > 0:
                keyword_results.append({
                    "doc": doc,
                    "score": score
                })
        
        vector_results = retriever.retrieve(request.question, top_k=10)
        
        vector_doc_map = {}
        for result in vector_results:
            source = result.get("source", "")
            distance = result.get("score", 0)
            similarity = _distance_to_similarity(distance)
            if source not in vector_doc_map or similarity > vector_doc_map[source]["similarity"]:
                vector_doc_map[source] = {
                    "similarity": similarity
                }
        
        combined_results = []
        seen_sources = set()
        
        for kr in keyword_results:
            source = kr["doc"].get("name", "")
            if source not in seen_sources:
                seen_sources.add(source)
                vector_similarity = vector_doc_map.get(source, {}).get("similarity", 0)
                final_score = max(kr["score"], vector_similarity)
                combined_results.append({
                    "doc": kr["doc"],
                    "score": final_score
                })
        
        for result in vector_results:
            source = result.get("source", "")
            if source not in seen_sources:
                seen_sources.add(source)
                doc = next((d for d in all_documents if d.get("name") == source), None)
                if doc:
                    distance = result.get("score", 0)
                    similarity = _distance_to_similarity(distance)
                    combined_results.append({
                        "doc": doc,
                        "score": similarity
                    })
        
        combined_results.sort(key=lambda x: x["score"], reverse=True)
        
        recommendations = []
        for idx, item in enumerate(combined_results[:5]):
            doc = item["doc"]
            match_rate = f"{int(item['score'] * 100)}%"
            recommendations.append({
                "id": doc.get("id", str(idx)),
                "name": doc.get("name", ""),
                "category": doc.get("category", ""),
                "matchRate": match_rate
            })
        
        return {"recommendations": recommendations}
    
    except Exception as e:
        logger.error(f"Failed to generate recommendations: {str(e)}")
        return {"recommendations": []}


class SearchResult(BaseModel):
    id: str
    title: str
    matchRate: str
    path: str
    summary: str
    fileType: str
    size: str
    updateTime: str
    author: str
    tags: list


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int


def _calculate_keyword_score(query: str, name: str, category: str, content: str = "") -> float:
    """Calculate keyword matching score based on match quality"""
    q_lower = query.lower()
    name_lower = name.lower()
    category_lower = category.lower()
    content_lower = content.lower() if content else ""
    
    if q_lower == name_lower:
        return 1.0
    elif name_lower.startswith(q_lower):
        return 0.9
    elif q_lower in name_lower:
        match_ratio = len(q_lower) / len(name_lower)
        return max(0.7, min(0.85, match_ratio))
    elif q_lower == category_lower:
        return 0.65
    elif q_lower in category_lower:
        return 0.6
    elif q_lower in content_lower:
        match_count = content_lower.count(q_lower)
        density = match_count / max(1, len(content_lower) / len(q_lower))
        return max(0.3, min(0.55, 0.3 + density * 0.25))
    return 0.0


def _distance_to_similarity(distance: float) -> float:
    """Convert Chroma L2 distance to similarity score (0-1)"""
    return 1.0 / (1.0 + distance)


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., description="Search query"),
    type: str = Query(None, description="File type filter"),
    limit: int = Query(10, description="Results limit"),
    offset: int = Query(0, description="Results offset"),
    user: dict = Depends(require_permission("search"))
):
    """Smart search with keyword + vector retrieval"""
    try:
        if not q.strip():
            raise HTTPException(status_code=400, detail="Search query cannot be empty")
        
        logger.info(f"Smart search query: {q[:50]}...")
        
        search_storage.record_search(q, user.get("id") if user else None)
        
        all_documents = vector_store.get_all_documents(status_filter="已发布")
        
        keyword_results = []
        for doc in all_documents:
            name = doc.get("name", "")
            category = doc.get("category", "")
            
            score = _calculate_keyword_score(q, name, category)
            
            if score > 0:
                keyword_results.append({
                    "doc": doc,
                    "score": score,
                    "summary": ""
                })
            else:
                doc_details = vector_store.get_document_details(name)
                all_content = ""
                if doc_details.get("all_chunks"):
                    for chunk in doc_details["all_chunks"]:
                        all_content += chunk.get("content", "") + " "
                
                content_score = _calculate_keyword_score(q, name, category, all_content)
                if content_score > 0:
                    keyword_results.append({
                        "doc": doc,
                        "score": content_score,
                        "summary": all_content[:300] if all_content else ""
                    })
        
        vector_results = retriever.retrieve(q, top_k=20)
        
        vector_doc_map = {}
        for result in vector_results:
            source = result.get("source", "")
            distance = result.get("score", 0)
            similarity = _distance_to_similarity(distance)
            if source not in vector_doc_map or similarity > vector_doc_map[source]["similarity"]:
                vector_doc_map[source] = {
                    "similarity": similarity,
                    "distance": distance,
                    "content": result.get("content", "")[:200]
                }
        
        combined_results = []
        seen_sources = set()
        
        for kr in keyword_results:
            source = kr["doc"].get("name", "")
            if source not in seen_sources:
                seen_sources.add(source)
                vector_similarity = vector_doc_map.get(source, {}).get("similarity", 0)
                final_score = max(kr["score"], vector_similarity)
                vector_summary = vector_doc_map.get(source, {}).get("content", "")
                keyword_summary = kr.get("summary", "")
                combined_results.append({
                    "doc": kr["doc"],
                    "score": final_score,
                    "summary": vector_summary if vector_summary else keyword_summary
                })
        
        for result in vector_results:
            source = result.get("source", "")
            if source not in seen_sources:
                seen_sources.add(source)
                doc = next((d for d in all_documents if d.get("name") == source), None)
                if doc:
                    distance = result.get("score", 0)
                    similarity = _distance_to_similarity(distance)
                    combined_results.append({
                        "doc": doc,
                        "score": similarity,
                        "summary": result.get("content", "")[:200]
                    })
        
        combined_results.sort(key=lambda x: x["score"], reverse=True)
        
        if type:
            combined_results = [r for r in combined_results if r["doc"].get("type") == type]
        
        paginated_results = combined_results[offset:offset + limit]
        
        formatted_results = []
        for idx, item in enumerate(paginated_results):
            doc = item["doc"]
            score = item["score"]
            match_rate = f"{int(score * 100)}%"
            
            formatted_results.append({
                "id": doc.get("id", str(idx)),
                "title": doc.get("name", ""),
                "matchRate": match_rate,
                "path": doc.get("name", ""),
                "summary": item.get("summary", "") or "暂无摘要",
                "fileType": doc.get("type", "其他"),
                "size": f"{doc.get('pages', 0)}页",
                "updateTime": doc.get("updateTime", ""),
                "author": doc.get("author", "系统"),
                "tags": [doc.get("category", "")] if doc.get("category") else []
            })
        
        return {
            "results": formatted_results,
            "total": len(combined_results)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/search/history")
async def get_search_history(
    limit: int = Query(10, description="History limit"),
    user: dict = Depends(require_permission("history_view"))
):
    """Get search history"""
    try:
        user_id = user.get("id") if user else None
        history = search_storage.get_search_history(user_id, limit)
        
        return {
            "history": history
        }
    except Exception as e:
        logger.error(f"Failed to get search history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get search history: {str(e)}")


@router.delete("/search/history")
async def clear_search_history(user: dict = Depends(require_permission("history_manage"))):
    """Clear search history"""
    try:
        data = {
            "search_history": [],
            "hot_searches": []
        }
        with open("./data/search_data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return {"message": "Search history cleared"}
    except Exception as e:
        logger.error(f"Failed to clear search history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear search history: {str(e)}")


@router.get("/search/hot")
async def get_hot_searches(limit: int = Query(10, description="Hot searches limit")):
    """Get hot searches"""
    try:
        hot_searches = search_storage.get_hot_searches(limit)
        
        return {
            "hot_searches": hot_searches
        }
    except Exception as e:
        logger.error(f"Failed to get hot searches: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get hot searches: {str(e)}")


@router.get("/download/history")
async def get_download_history(user: dict = Depends(require_permission("history_view"))):
    """Get download history for current user"""
    try:
        from utils.download_storage import download_storage
        
        username = user.get("username") if user else None
        if not username:
            raise HTTPException(status_code=400, detail="User not found")
        
        history = download_storage.get_download_history(username)
        
        return {
            "history": history
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get download history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get download history: {str(e)}")


@router.delete("/download/history")
async def clear_download_history(user: dict = Depends(require_permission("history_manage"))):
    """Clear download history for current user"""
    try:
        from utils.download_storage import download_storage
        
        username = user.get("username") if user else None
        if not username:
            raise HTTPException(status_code=400, detail="User not found")
        
        download_storage.clear_download_history(username)
        
        return {"message": "Download history cleared"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to clear download history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear download history: {str(e)}")


@router.delete("/download/history/{record_id}")
async def delete_download_record(record_id: str, user: dict = Depends(require_permission("history_manage"))):
    """Delete a specific download record"""
    try:
        from utils.download_storage import download_storage
        
        username = user.get("username") if user else None
        if not username:
            raise HTTPException(status_code=400, detail="User not found")
        
        download_storage.delete_download_record(username, record_id)
        
        return {"message": "Download record deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete download record: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete download record: {str(e)}")


@router.get("/search/related")
async def get_related_documents(
    query: str = Query(..., description="Search query"),
    limit: int = Query(5, description="Related documents limit"),
    user: dict = Depends(get_current_user)
):
    """Get related documents using same matching logic as search"""
    try:
        logger.info(f"Finding related documents for query: {query[:50]}...")
        
        all_documents = vector_store.get_all_documents(status_filter="已发布")
        
        keyword_results = []
        for doc in all_documents:
            name = doc.get("name", "")
            category = doc.get("category", "")
            score = _calculate_keyword_score(query, name, category)
            if score > 0:
                keyword_results.append({
                    "doc": doc,
                    "score": score
                })
        
        vector_results = retriever.retrieve(query, top_k=20)
        
        vector_doc_map = {}
        for result in vector_results:
            source = result.get("source", "")
            distance = result.get("score", 0)
            similarity = _distance_to_similarity(distance)
            if source not in vector_doc_map or similarity > vector_doc_map[source]["similarity"]:
                vector_doc_map[source] = {
                    "similarity": similarity,
                    "distance": distance,
                    "content": result.get("content", "")[:200]
                }
        
        combined_results = []
        seen_sources = set()
        
        for kr in keyword_results:
            source = kr["doc"].get("name", "")
            if source not in seen_sources:
                seen_sources.add(source)
                vector_similarity = vector_doc_map.get(source, {}).get("similarity", 0)
                final_score = max(kr["score"], vector_similarity)
                combined_results.append({
                    "doc": kr["doc"],
                    "score": final_score
                })
        
        for result in vector_results:
            source = result.get("source", "")
            if source not in seen_sources:
                seen_sources.add(source)
                doc = next((d for d in all_documents if d.get("name") == source), None)
                if doc:
                    distance = result.get("score", 0)
                    similarity = _distance_to_similarity(distance)
                    combined_results.append({
                        "doc": doc,
                        "score": similarity
                    })
        
        combined_results.sort(key=lambda x: x["score"], reverse=True)
        
        seen_sources = set()
        related_docs = []
        for item in combined_results:
            source = item["doc"].get("name", "")
            if source not in seen_sources:
                seen_sources.add(source)
                doc = item["doc"]
                score = item["score"]
                related_docs.append({
                    "id": doc.get("id", ""),
                    "title": doc.get("name", ""),
                    "category": doc.get("category", ""),
                    "fileType": doc.get("type", "其他"),
                    "score": score,
                    "matchRate": f"{int(score * 100)}%"
                })
        
        return {
            "related": related_docs[:limit]
        }
    
    except Exception as e:
        logger.error(f"Failed to get related documents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get related documents: {str(e)}")


@router.get("/llm/status")
async def get_llm_status(user: dict = Depends(get_current_user)):
    """Get current LLM type and available options"""
    try:
        return {
            "current_type": settings.LLM_TYPE,
            "available_types": [
                {
                    "type": "cloud",
                    "name": "云端模型",
                    "description": "GPT-4o-mini，响应快速，知识更新",
                    "icon": "☁️"
                },
                {
                    "type": "local",
                    "name": "本地模型",
                    "description": "Qwen2.5，数据不出网，安全可控",
                    "icon": "💻"
                }
            ],
            "current_model": {
                "ollama": settings.OLLAMA_MODEL,
                "openai": settings.OPENAI_MODEL,
                "dashscope": settings.DASHSCOPE_MODEL
            }.get(settings.LLM_TYPE.lower()),
            "temperature": settings.TEMPERATURE,
            "max_tokens": settings.MAX_TOKENS
        }
    except Exception as e:
        logger.error(f"Failed to get LLM status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get LLM status: {str(e)}")


class SwitchLLMRequest(BaseModel):
    llm_type: str
    temperature: float | None = None
    max_tokens: int | None = None


@router.post("/llm/switch")
async def switch_llm(request: SwitchLLMRequest, user: dict = Depends(require_permission("llm_switch"))):
    """Switch LLM type dynamically"""
    try:
        llm_type = request.llm_type.lower()
        
        if llm_type not in ["ollama", "openai", "dashscope"]:
            raise HTTPException(status_code=400, detail="Invalid LLM type. Supported types: ollama, openai, dashscope")
        
        new_type = generator.switch_llm(llm_type, request.temperature, request.max_tokens)
        
        return {
            "message": f"LLM switched to {new_type} successfully",
            "current_type": new_type,
            "temperature": settings.TEMPERATURE,
            "max_tokens": settings.MAX_TOKENS
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to switch LLM: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to switch LLM: {str(e)}")


class UserRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "普通用户"
    department: str = "-"


class UserUpdateRequest(BaseModel):
    email: str = None
    role: str = None
    department: str = None
    is_active: bool = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    department: str
    is_active: bool
    created_at: str
    last_login: str = None


class UserListResponse(BaseModel):
    users: list
    total: int
    page: int
    page_size: int


class UserStatsResponse(BaseModel):
    total: int
    active: int
    disabled: int
    pending: int


def save_users(users: list):
    """Save users to JSON file"""
    USER_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(USER_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


def hash_password(password: str) -> str:
    """Hash password using pbkdf2-sha256"""
    import hashlib
    import base64
    import os
    salt = os.urandom(16)
    iterations = 29000
    hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    return f"$pbkdf2-sha256${iterations}${base64.b64encode(salt).decode('utf-8')}${base64.b64encode(hash_bytes).decode('utf-8')}"


@router.get("/users", response_model=UserListResponse)
async def get_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str = Query(None),
    role: str = Query(None),
    status: str = Query(None),
    department: str = Query(None),
    user: dict = Depends(require_permission("user_view"))
):
    """Get user list with pagination and filtering"""
    try:
        if not USER_DATA_FILE.exists():
            return {"users": [], "total": 0, "page": page, "page_size": page_size}
        
        with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
            users = json.load(f)
        
        filtered_users = users
        
        if search:
            search_lower = search.lower()
            filtered_users = [u for u in filtered_users 
                            if search_lower in u["username"].lower() or search_lower in u["email"].lower()]
        
        if role and role != "全部角色":
            filtered_users = [u for u in filtered_users if u.get("role") == role]
        
        if status:
            status_map = {"活跃": True, "已禁用": False}
            if status in status_map:
                filtered_users = [u for u in filtered_users if u.get("is_active") == status_map[status]]
        
        if department and department != "全部部门":
            filtered_users = [u for u in filtered_users if u.get("department") == department]
        
        total = len(filtered_users)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_users = filtered_users[start:end]
        
        for u in paginated_users:
            u.pop("hashed_password", None)
        
        return {
            "users": paginated_users,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    except Exception as e:
        logger.error(f"Failed to get users: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get users: {str(e)}")


@router.get("/users/stats", response_model=UserStatsResponse)
async def get_user_stats(user: dict = Depends(require_permission("user_view"))):
    """Get user statistics"""
    try:
        if not USER_DATA_FILE.exists():
            return {"total": 0, "active": 0, "disabled": 0, "pending": 0}
        
        with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
            users = json.load(f)
        
        total = len(users)
        active = sum(1 for u in users if u.get("is_active"))
        disabled = sum(1 for u in users if not u.get("is_active") and u.get("last_login"))
        pending = sum(1 for u in users if not u.get("is_active") and not u.get("last_login"))
        
        return {
            "total": total,
            "active": active,
            "disabled": disabled,
            "pending": pending
        }
    except Exception as e:
        logger.error(f"Failed to get user stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get user stats: {str(e)}")


@router.post("/users", response_model=UserResponse)
async def create_user(request: UserRequest, user: dict = Depends(require_permission("user_create"))):
    """Create a new user"""
    try:
        if not USER_DATA_FILE.exists():
            users = []
        else:
            with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
                users = json.load(f)
        
        if any(u["username"] == request.username for u in users):
            raise HTTPException(status_code=400, detail="Username already exists")
        
        if any(u["email"] == request.email for u in users):
            raise HTTPException(status_code=400, detail="Email already exists")
        
        new_user = {
            "id": str(len(users) + 1),
            "username": request.username,
            "email": request.email,
            "hashed_password": hash_password(request.password),
            "role": request.role,
            "department": request.department,
            "is_active": True,
            "created_at": str(__import__('datetime').datetime.now().isoformat()),
            "last_login": ""
        }
        
        users.append(new_user)
        save_users(users)
        
        from utils.system_log_storage import system_log_storage
        system_log_storage.add_log(
            user_id=user.get("id"),
            username=user.get("username"),
            action="create",
            target=request.username,
            target_type="user",
            detail=f"创建用户: {request.username} ({request.email}), 角色: {request.role}, 部门: {request.department}"
        )
        
        new_user.pop("hashed_password")
        return new_user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    request: UserUpdateRequest,
    current_user: dict = Depends(require_permission("user_edit"))
):
    """Update user information"""
    try:
        if not USER_DATA_FILE.exists():
            raise HTTPException(status_code=404, detail="User not found")
        
        with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
            users = json.load(f)
        
        user_index = next((i for i, u in enumerate(users) if u["id"] == user_id), None)
        if user_index is None:
            raise HTTPException(status_code=404, detail="User not found")
        
        user = users[user_index]
        old_username = user["username"]
        old_email = user["email"]
        old_role = user["role"]
        old_department = user["department"]
        old_is_active = user["is_active"]
        
        changes = []
        if request.email and request.email != old_email:
            if any(u["email"] == request.email and u["id"] != user_id for u in users):
                raise HTTPException(status_code=400, detail="Email already in use")
            user["email"] = request.email
            changes.append(f"邮箱: {old_email} -> {request.email}")
        
        if request.role and request.role != old_role:
            user["role"] = request.role
            changes.append(f"角色: {old_role} -> {request.role}")
        
        if request.department and request.department != old_department:
            user["department"] = request.department
            changes.append(f"部门: {old_department} -> {request.department}")
        
        if request.is_active is not None and request.is_active != old_is_active:
            user["is_active"] = request.is_active
            changes.append(f"状态: {'活跃' if old_is_active else '禁用'} -> {'活跃' if request.is_active else '禁用'}")
        
        save_users(users)
        
        from utils.system_log_storage import system_log_storage
        system_log_storage.add_log(
            user_id=current_user.get("id"),
            username=current_user.get("username"),
            action="update",
            target=old_username,
            target_type="user",
            detail=f"编辑用户: {old_username}, 修改内容: {'; '.join(changes) if changes else '无'}"
        )
        
        user.pop("hashed_password", None)
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_permission("user_delete"))):
    """Delete a user"""
    try:
        if not USER_DATA_FILE.exists():
            raise HTTPException(status_code=404, detail="User not found")
        
        with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
            users = json.load(f)
        
        user_index = next((i for i, u in enumerate(users) if u["id"] == user_id), None)
        if user_index is None:
            raise HTTPException(status_code=404, detail="User not found")
        
        deleted_user = users.pop(user_index)
        save_users(users)
        
        from utils.system_log_storage import system_log_storage
        system_log_storage.add_log(
            user_id=user.get("id"),
            username=user.get("username"),
            action="delete",
            target=deleted_user["username"],
            target_type="user",
            detail=f"删除用户: {deleted_user['username']} ({deleted_user['email']}), 角色: {deleted_user['role']}, 部门: {deleted_user['department']}"
        )
        
        return {"message": f"User {deleted_user['username']} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")


class BatchUserImportRequest(BaseModel):
    users: list[dict]


class BatchUserImportResponse(BaseModel):
    success_count: int
    failed_count: int
    total_count: int
    results: list[dict]


@router.post("/users/batch", response_model=BatchUserImportResponse)
async def batch_import_users(request: BatchUserImportRequest, user: dict = Depends(require_permission("user_create"))):
    """Batch import users"""
    try:
        if not USER_DATA_FILE.exists():
            existing_users = []
        else:
            with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
                existing_users = json.load(f)
        
        existing_usernames = set(u["username"] for u in existing_users)
        existing_emails = set(u["email"] for u in existing_users)
        
        results = []
        success_count = 0
        failed_count = 0
        
        import random
        import string
        
        def generate_default_password():
            chars = string.ascii_letters + string.digits + string.punctuation
            return ''.join(random.choices(chars, k=8))
        
        for idx, user_data in enumerate(request.users):
            try:
                username = user_data.get("username", "").strip()
                email = user_data.get("email", "").strip()
                password = user_data.get("password", "").strip()
                role = user_data.get("role", "普通用户").strip()
                department = user_data.get("department", "-").strip()
                
                errors = []
                if not username:
                    errors.append("用户名不能为空")
                if not email:
                    errors.append("邮箱不能为空")
                elif "@" not in email:
                    errors.append("邮箱格式不正确")
                
                if username in existing_usernames:
                    errors.append(f"用户名 '{username}' 已存在")
                if email in existing_emails:
                    errors.append(f"邮箱 '{email}' 已存在")
                
                if errors:
                    failed_count += 1
                    results.append({
                        "index": idx + 1,
                        "username": username,
                        "email": email,
                        "status": "failed",
                        "error": "; ".join(errors)
                    })
                    continue
                
                if not password:
                    password = generate_default_password()
                
                new_user = {
                    "id": str(len(existing_users) + success_count + 1),
                    "username": username,
                    "email": email,
                    "hashed_password": hash_password(password),
                    "role": role,
                    "department": department,
                    "is_active": True,
                    "created_at": str(__import__('datetime').datetime.now().isoformat()),
                    "last_login": None
                }
                
                existing_users.append(new_user)
                existing_usernames.add(username)
                existing_emails.add(email)
                success_count += 1
                
                results.append({
                    "index": idx + 1,
                    "username": username,
                    "email": email,
                    "role": role,
                    "department": department,
                    "status": "success",
                    "password": password
                })
                
            except Exception as e:
                failed_count += 1
                results.append({
                    "index": idx + 1,
                    "username": user_data.get("username", ""),
                    "email": user_data.get("email", ""),
                    "status": "failed",
                    "error": str(e)
                })
        
        if success_count > 0:
            save_users(existing_users)
        
        from utils.system_log_storage import system_log_storage
        success_usernames = [r["username"] for r in results if r["status"] == "success"]
        system_log_storage.add_log(
            user_id=user.get("id"),
            username=user.get("username"),
            action="batch_import",
            target=f"批量导入 {success_count} 个用户",
            target_type="user",
            detail=f"批量导入用户: 成功 {success_count} 个, 失败 {failed_count} 个, 成功用户: {', '.join(success_usernames)[:100]}..."
        )
        
        return {
            "success_count": success_count,
            "failed_count": failed_count,
            "total_count": len(request.users),
            "results": results
        }
    
    except Exception as e:
        logger.error(f"Failed to batch import users: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to batch import users: {str(e)}")


@router.get("/stats/global")
async def get_global_stats(user: dict = Depends(require_permission("stats_view"))):
    """Get global statistics for dashboard"""
    try:
        from datetime import datetime, timedelta
        from utils.conversation_storage import conversation_storage
        
        documents = vector_store.get_all_documents()
        documents = [doc for doc in documents if doc.get("status") != "临时"]
        
        total_documents = len(documents)
        
        document_types = {}
        for doc in documents:
            doc_type = doc.get("type", "其他")
            document_types[doc_type] = document_types.get(doc_type, 0) + 1
        
        total_chunks = sum(doc.get("chunks", 0) for doc in documents)
        document_coverage = min(100, int(total_chunks / max(total_documents, 1) * 10)) if total_documents > 0 else 0
        
        if not USER_DATA_FILE.exists():
            users = []
        else:
            with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
                users = json.load(f)
        
        total_users = len(users)
        
        user_by_role = {}
        for u in users:
            role = u.get("role", "普通用户")
            user_by_role[role] = user_by_role.get(role, 0) + 1
        
        hot_searches = search_storage.get_hot_searches(8)
        
        ai_conversations = conversation_storage.get_total_conversations()
        
        search_count = sum(h.get("count", 0) for h in hot_searches)
        
        avg_response_time = conversation_storage.get_avg_response_time()
        if avg_response_time is None:
            avg_response_time = 1.5
        
        upload_trend = []
        now = datetime.now()
        for i in range(11, -1, -1):
            month_date = now - timedelta(days=i * 30)
            month_label = f"{month_date.year}-{str(month_date.month).zfill(2)}"
            count = 0
            for doc in documents:
                create_time = doc.get("createTime", "")
                if create_time:
                    try:
                        ct = datetime.fromisoformat(create_time.replace('Z', '+00:00'))
                        if ct.year == month_date.year and ct.month == month_date.month:
                            count += 1
                    except:
                        pass
            upload_trend.append({"month": month_label, "count": count})
        
        type_colors = {
            "PDF": "#2B5EA7",
            "Markdown": "#2D9B6E",
            "TXT": "#D4930D",
            "Word": "#1E74B8",
            "Excel": "#217346",
            "其他": "#6B7280"
        }
        
        document_type_list = []
        total_types = sum(document_types.values())
        for doc_type, count in document_types.items():
            percentage = int(count / max(total_types, 1) * 100)
            document_type_list.append({
                "type": doc_type,
                "count": count,
                "percentage": percentage,
                "color": type_colors.get(doc_type, "#6B7280")
            })
        
        role_colors = {
            "超级管理员": "#2B5EA7",
            "知识库管理员": "#2D9B6E",
            "普通用户": "#D4930D",
            "审核员": "#9B59B6",
            "外部访客": "#6B7280"
        }
        
        user_activity_list = []
        total_roles = sum(user_by_role.values())
        for role, count in user_by_role.items():
            percentage = int(count / max(total_roles, 1) * 100)
            user_activity_list.append({
                "role": role,
                "count": count,
                "percentage": percentage,
                "color": role_colors.get(role, "#6B7280")
            })
        
        hot_keywords_list = []
        max_count = max(h.get("count", 0) for h in hot_searches) if hot_searches else 1
        for idx, h in enumerate(hot_searches):
            percentage = int(h.get("count", 0) / max_count * 100)
            hot_keywords_list.append({
                "rank": idx + 1,
                "keyword": h.get("query", ""),
                "count": h.get("count", 0),
                "percentage": percentage
            })
        
        from utils.system_log_storage import system_log_storage
        
        recent_activity = []
        
        logs = system_log_storage.get_recent_logs(8)
        
        target_colors = {
            "document": "#2B5EA7",
            "query": "#2D9B6E",
            "system": "#9B59B6",
            "user": "#D4930D",
            "role": "#6B7280"
        }
        
        action_labels = {
            "登录": "登录了",
            "上传": "上传了",
            "查询": "查询了",
            "删除": "删除了",
            "创建": "创建了",
            "更新": "更新了"
        }
        
        for log in logs:
            log_time = log.get("timestamp", "")
            time_ago = "刚刚"
            if log_time:
                try:
                    lt = datetime.fromisoformat(log_time.replace('Z', '+00:00'))
                    delta = now - lt
                    if delta.days > 0:
                        time_ago = f"{delta.days} 天前"
                    elif delta.seconds > 3600:
                        time_ago = f"{delta.seconds // 3600} 小时前"
                    elif delta.seconds > 60:
                        time_ago = f"{delta.seconds // 60} 分钟前"
                except:
                    pass
            
            username = log.get("username", "系统")
            initial = username[0].upper() if username else "U"
            action = action_labels.get(log.get("action", ""), log.get("action", ""))
            target_color = target_colors.get(log.get("target_type", ""), "#6B7280")
            
            recent_activity.append({
                "id": log.get("id", ""),
                "user_name": username,
                "user_avatar": initial,
                "action": action,
                "target": log.get("target", ""),
                "target_color": target_color,
                "time_ago": time_ago
            })
        
        return {
            "kpi_metrics": {
                "total_documents": total_documents,
                "total_users": total_users,
                "ai_conversations": ai_conversations,
                "search_count": search_count,
                "avg_response_time": round(avg_response_time, 1),
                "document_coverage": document_coverage
            },
            "upload_trend": upload_trend,
            "document_types": document_type_list,
            "user_activity": user_activity_list,
            "hot_keywords": hot_keywords_list,
            "recent_activity": recent_activity
        }
    except Exception as e:
        logger.error(f"Failed to fetch global stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch global stats: {str(e)}")


@router.get("/stats/export")
async def export_stats(
    time_range: str = Query("30d", description="时间范围: 7d(7天), 30d(30天), 90d(90天), 1y(1年)"),
    start_date: str = Query(None, description="开始日期(YYYY-MM-DD)"),
    end_date: str = Query(None, description="结束日期(YYYY-MM-DD)"),
    user: dict = Depends(get_current_user)
):
    """导出统计数据为CSV格式"""
    try:
        import io
        import csv
        from datetime import datetime, timedelta
        from utils.conversation_storage import conversation_storage
        from utils.system_log_storage import system_log_storage
        
        documents = vector_store.get_all_documents()
        documents = [doc for doc in documents if doc.get("status") != "临时"]
        
        total_documents = len(documents)
        
        document_types = {}
        for doc in documents:
            doc_type = doc.get("type", "其他")
            document_types[doc_type] = document_types.get(doc_type, 0) + 1
        
        total_chunks = sum(doc.get("chunks", 0) for doc in documents)
        document_coverage = min(100, int(total_chunks / max(total_documents, 1) * 10)) if total_documents > 0 else 0
        
        if not USER_DATA_FILE.exists():
            users = []
        else:
            with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
                users = json.load(f)
        
        total_users = len(users)
        
        user_by_role = {}
        for u in users:
            role = u.get("role", "普通用户")
            user_by_role[role] = user_by_role.get(role, 0) + 1
        
        hot_searches = search_storage.get_hot_searches(8)
        
        ai_conversations = conversation_storage.get_total_conversations()
        
        search_count = sum(h.get("count", 0) for h in hot_searches)
        
        avg_response_time = conversation_storage.get_avg_response_time()
        if avg_response_time is None:
            avg_response_time = 1.5
        
        upload_trend = []
        now = datetime.now()
        for i in range(11, -1, -1):
            month_date = now - timedelta(days=i * 30)
            month_label = f"{month_date.year}-{str(month_date.month).zfill(2)}"
            count = 0
            for doc in documents:
                create_time = doc.get("createTime", "")
                if create_time:
                    try:
                        ct = datetime.fromisoformat(create_time.replace('Z', '+00:00'))
                        if ct.year == month_date.year and ct.month == month_date.month:
                            count += 1
                    except:
                        pass
            upload_trend.append({"month": month_label, "count": count})
        
        document_type_list = []
        total_types = sum(document_types.values())
        for doc_type, count in document_types.items():
            percentage = int(count / max(total_types, 1) * 100)
            document_type_list.append({
                "type": doc_type,
                "count": count,
                "percentage": percentage
            })
        
        user_activity_list = []
        total_roles = sum(user_by_role.values())
        for role, count in user_by_role.items():
            percentage = int(count / max(total_roles, 1) * 100)
            user_activity_list.append({
                "role": role,
                "count": count,
                "percentage": percentage
            })
        
        hot_keywords_list = []
        max_count = max(h.get("count", 0) for h in hot_searches) if hot_searches else 1
        for idx, h in enumerate(hot_searches):
            percentage = int(h.get("count", 0) / max_count * 100)
            hot_keywords_list.append({
                "rank": idx + 1,
                "keyword": h.get("query", ""),
                "count": h.get("count", 0),
                "percentage": percentage
            })
        
        logs = system_log_storage.get_recent_logs(8)
        action_labels = {
            "登录": "登录了",
            "上传": "上传了",
            "查询": "查询了",
            "删除": "删除了",
            "创建": "创建了",
            "更新": "更新了"
        }
        recent_activity = []
        for log in logs:
            log_time = log.get("timestamp", "")
            time_ago = "刚刚"
            if log_time:
                try:
                    lt = datetime.fromisoformat(log_time.replace('Z', '+00:00'))
                    delta = now - lt
                    if delta.days > 0:
                        time_ago = f"{delta.days} 天前"
                    elif delta.seconds > 3600:
                        time_ago = f"{delta.seconds // 3600} 小时前"
                    elif delta.seconds > 60:
                        time_ago = f"{delta.seconds // 60} 分钟前"
                except:
                    pass
            
            username = log.get("username", "系统")
            action = action_labels.get(log.get("action", ""), log.get("action", ""))
            
            recent_activity.append({
                "user_name": username,
                "action": action,
                "target": log.get("target", ""),
                "time_ago": time_ago
            })
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["统计指标", "数值"])
        writer.writerow(["总文档数", total_documents])
        writer.writerow(["总用户数", total_users])
        writer.writerow(["AI对话次数", ai_conversations])
        writer.writerow(["检索次数", search_count])
        writer.writerow(["平均响应时间(秒)", round(avg_response_time, 1)])
        writer.writerow(["文档覆盖率(%)", document_coverage])
        
        writer.writerow([])
        writer.writerow(["文档类型分布"])
        writer.writerow(["类型", "数量", "百分比(%)"])
        for item in document_type_list:
            writer.writerow([item["type"], item["count"], item["percentage"]])
        
        writer.writerow([])
        writer.writerow(["用户活跃度(按角色)"])
        writer.writerow(["角色", "数量", "百分比(%)"])
        for item in user_activity_list:
            writer.writerow([item["role"], item["count"], item["percentage"]])
        
        writer.writerow([])
        writer.writerow(["热门检索关键词"])
        writer.writerow(["排名", "关键词", "检索次数", "热度(%)"])
        for item in hot_keywords_list:
            writer.writerow([item["rank"], item["keyword"], item["count"], item["percentage"]])
        
        writer.writerow([])
        writer.writerow(["上传趋势"])
        writer.writerow(["月份", "文档数"])
        for item in upload_trend:
            writer.writerow([item["month"], item["count"]])
        
        writer.writerow([])
        writer.writerow(["最近活动"])
        writer.writerow(["用户", "操作", "目标", "时间"])
        for item in recent_activity:
            writer.writerow([item["user_name"], item["action"], item["target"], item["time_ago"]])
        
        csv_string = '\ufeff' + output.getvalue()
        
        return csv_string
    except Exception as e:
        logger.error(f"Failed to export stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"导出统计数据失败: {str(e)}")


# ==================== 对话历史 API ====================

class ChatMessage(BaseModel):
    type: str
    content: str
    timestamp: Optional[str] = None
    sources: Optional[List[dict]] = None

class ChatSessionCreate(BaseModel):
    title: str
    messages: List[ChatMessage]

class ChatSessionUpdate(BaseModel):
    title: Optional[str] = None
    messages: Optional[List[ChatMessage]] = None


@router.get("/chat/history")
async def get_chat_history(user: dict = Depends(get_current_user)):
    """获取当前用户的对话历史"""
    if not user:
        raise HTTPException(status_code=401, detail="未授权访问")
    
    try:
        from utils.chat_history_storage import chat_history_storage
        user_id = user.get("id") or user.get("username")
        sessions = chat_history_storage.get_user_sessions(user_id)
        return {"sessions": sessions}
    except Exception as e:
        logger.error(f"Failed to get chat history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取对话历史失败: {str(e)}")


@router.get("/chat/session/{session_id}")
async def get_chat_session(session_id: str, user: dict = Depends(get_current_user)):
    """获取单个对话会话详情"""
    if not user:
        raise HTTPException(status_code=401, detail="未授权访问")
    
    try:
        from utils.chat_history_storage import chat_history_storage
        user_id = user.get("id") or user.get("username")
        session = chat_history_storage.get_session(session_id, user_id)
        if not session:
            raise HTTPException(status_code=404, detail="对话会话不存在")
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取对话会话失败: {str(e)}")


@router.post("/chat/session")
async def create_chat_session(session_data: ChatSessionCreate, user: dict = Depends(get_current_user)):
    """创建新的对话会话"""
    if not user:
        raise HTTPException(status_code=401, detail="未授权访问")
    
    try:
        from utils.chat_history_storage import chat_history_storage
        user_id = user.get("id") or user.get("username")
        
        messages = [msg.dict() for msg in session_data.messages]
        
        session = chat_history_storage.create_session(
            user_id=user_id,
            title=session_data.title,
            messages=messages
        )
        return {"message": "创建成功", "session": session}
    except Exception as e:
        logger.error(f"Failed to create chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建对话会话失败: {str(e)}")


@router.put("/chat/session/{session_id}")
async def update_chat_session(
    session_id: str, 
    session_data: ChatSessionUpdate, 
    user: dict = Depends(get_current_user)
):
    """更新对话会话"""
    if not user:
        raise HTTPException(status_code=401, detail="未授权访问")
    
    try:
        from utils.chat_history_storage import chat_history_storage
        user_id = user.get("id") or user.get("username")
        
        messages = None
        if session_data.messages:
            messages = [msg.dict() for msg in session_data.messages]
        
        session = chat_history_storage.update_session(
            session_id=session_id,
            user_id=user_id,
            title=session_data.title,
            messages=messages
        )
        
        if not session:
            raise HTTPException(status_code=404, detail="对话会话不存在")
        
        return {"message": "更新成功", "session": session}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新对话会话失败: {str(e)}")


@router.delete("/chat/session/{session_id}")
async def delete_chat_session(session_id: str, user: dict = Depends(get_current_user)):
    """删除单个对话会话"""
    if not user:
        raise HTTPException(status_code=401, detail="未授权访问")
    
    try:
        from utils.chat_history_storage import chat_history_storage
        user_id = user.get("id") or user.get("username")
        
        success = chat_history_storage.delete_session(session_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="对话会话不存在")
        
        return {"message": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除对话会话失败: {str(e)}")


@router.delete("/chat/history")
async def clear_chat_history(user: dict = Depends(get_current_user)):
    """清空当前用户的所有对话历史"""
    if not user:
        raise HTTPException(status_code=401, detail="未授权访问")
    
    try:
        from utils.chat_history_storage import chat_history_storage
        user_id = user.get("id") or user.get("username")
        
        count = chat_history_storage.clear_user_sessions(user_id)
        
        return {"message": f"已清空 {count} 条对话记录"}
    except Exception as e:
        logger.error(f"Failed to clear chat history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"清空对话历史失败: {str(e)}")
