from langchain_chroma import Chroma
from langchain_core.documents import Document
from core.config import settings
from loguru import logger
from typing import List


class VectorStore:
    def __init__(self):
        from ingest.embedding_manager import EmbeddingManager
        self.embedding_manager = EmbeddingManager()
        self.db = self._initialize_db()

    def _initialize_db(self) -> Chroma:
        """Initialize Chroma vector database"""
        settings.chroma_db_path.mkdir(parents=True, exist_ok=True)
        
        db = Chroma(
            persist_directory=str(settings.chroma_db_path),
            embedding_function=self.embedding_manager.embeddings
        )
        logger.info(f"Initialized Chroma DB at: {settings.chroma_db_path}")
        return db

    def add_documents(self, docs: List[Document]) -> int:
        """Add documents to the vector store"""
        if not docs:
            logger.warning("No documents to add")
            return 0
        
        logger.info(f"Adding {len(docs)} documents to vector store")
        if docs:
            logger.info(f"First doc metadata: {docs[0].metadata}")
        
        self.db.add_documents(docs)
        
        logger.info(f"Successfully added {len(docs)} documents")
        
        verify_data = self.db.get()
        if verify_data["metadatas"]:
            logger.info(f"Verified first metadata after add: {verify_data['metadatas'][0]}")
        
        return len(docs)

    def get_document_count(self) -> int:
        """Get the number of documents in the vector store"""
        return len(self.db.get()["ids"])

    def search(self, query: str, k: int = 5, status_filter: str = None, source_filter: list = None) -> List[dict]:
        """Search for similar documents"""
        logger.info(f"Searching for: {query[:50]}...")
        results = self.db.similarity_search_with_score(query, k=k * 2)
        
        formatted_results = []
        for doc, score in results:
            status = doc.metadata.get("status", "")
            source = doc.metadata.get("source", "")
            
            if status_filter and status != status_filter:
                continue
            
            if source_filter and source not in source_filter:
                continue
                
            formatted_results.append({
                "score": float(score),
                "source": source,
                "page": doc.metadata.get("page", 0),
                "content": doc.page_content,
                "status": status
            })
        
        formatted_results = formatted_results[:k]
        
        logger.info(f"Found {len(formatted_results)} results")
        return formatted_results

    def get_all_documents(self, status_filter: str = None) -> List[dict]:
        """Get all unique documents from the vector store with aggregated metadata"""
        logger.info(f"Fetching all documents from vector store (status_filter: {status_filter})")
        all_data = self.db.get()
        
        logger.info(f"All data metadatas sample: {all_data['metadatas'][:2] if all_data['metadatas'] else 'empty'}")
        
        documents_map = {}
        
        for i, doc_id in enumerate(all_data["ids"]):
            metadata = all_data["metadatas"][i] if all_data["metadatas"] else {}
            source = metadata.get("source", "")
            page = metadata.get("page", 0)
            author = metadata.get("author", "系统")
            create_time = metadata.get("create_time", "")
            update_time = metadata.get("update_time", "")
            status = metadata.get("status", "待审核")
            
            if source not in documents_map:
                documents_map[source] = {
                    "name": source,
                    "type": self._get_file_type(source),
                    "category": metadata.get("category") or self._get_category(source),
                    "pages": 0,
                    "chunks": 0,
                    "first_page": page,
                    "author": author,
                    "create_time": create_time,
                    "update_time": update_time,
                    "status": status
                }
            else:
                if author != "系统" and documents_map[source]["author"] == "系统":
                    documents_map[source]["author"] = author
                if create_time and not documents_map[source]["create_time"]:
                    documents_map[source]["create_time"] = create_time
                if update_time and not documents_map[source]["update_time"]:
                    documents_map[source]["update_time"] = update_time
            
            documents_map[source]["chunks"] += 1
            documents_map[source]["pages"] = max(documents_map[source]["pages"], page)
        
        documents = []
        for idx, (source, info) in enumerate(documents_map.items()):
            if status_filter and info["status"] != status_filter:
                continue
            documents.append({
                "id": str(idx + 1),
                "name": info["name"],
                "type": info["type"],
                "category": info["category"],
                "createTime": info["create_time"],
                "updateTime": info["update_time"],
                "status": info["status"],
                "isFavorite": False,
                "pages": info["pages"],
                "chunks": info["chunks"],
                "author": info["author"]
            })
        
        logger.info(f"Found {len(documents)} unique documents")
        return documents

    def _get_file_type(self, filename: str) -> str:
        """Extract file type from filename"""
        if filename.endswith(".pdf"):
            return "PDF"
        elif filename.endswith(".md") or filename.endswith(".markdown"):
            return "Markdown"
        elif filename.endswith(".txt"):
            return "TXT"
        elif filename.endswith(".docx") or filename.endswith(".doc"):
            return "Word"
        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            return "Excel"
        elif filename.endswith(".pptx") or filename.endswith(".ppt"):
            return "PPT"
        elif filename.endswith(".csv"):
            return "CSV"
        elif filename.endswith(".json"):
            return "JSON"
        elif filename.endswith(".xml"):
            return "XML"
        elif filename.endswith(".html") or filename.endswith(".htm"):
            return "HTML"
        elif filename.endswith(".odt"):
            return "ODT"
        elif filename.endswith(".ods"):
            return "ODS"
        elif filename.endswith(".jpg") or filename.endswith(".jpeg"):
            return "JPG"
        elif filename.endswith(".png"):
            return "PNG"
        elif filename.endswith(".gif"):
            return "GIF"
        elif filename.endswith(".bmp"):
            return "BMP"
        else:
            return "其他"

    def get_document_details(self, document_name: str) -> dict:
        """Get detailed information about a specific document including all chunks"""
        logger.info(f"Fetching details for document: {document_name}")
        all_data = self.db.get()
        
        document_chunks = []
        pages_set = set()
        author = ""
        create_time = ""
        update_time = ""
        status = ""
        review_comment = ""
        
        for i, doc_id in enumerate(all_data["ids"]):
            metadata = all_data["metadatas"][i] if all_data["metadatas"] else {}
            source = metadata.get("source", "")
            
            if source == document_name:
                page = metadata.get("page", 0)
                chunk_id = metadata.get("chunk_id", "")
                pages_set.add(page)
                if not author:
                    author = metadata.get("author", "")
                if not create_time:
                    create_time = metadata.get("create_time", "")
                if not update_time:
                    update_time = metadata.get("update_time", "")
                if not status:
                    status = metadata.get("status", "")
                if not review_comment:
                    review_comment = metadata.get("review_comment", "")
                document_chunks.append({
                    "chunk_id": chunk_id,
                    "page": page,
                    "content": all_data["documents"][i] if all_data["documents"] else "",
                    "metadata": metadata
                })
        
        document_chunks.sort(key=lambda x: (x["page"], x["chunk_id"]))
        
        category = ""
        if document_chunks:
            category = document_chunks[0]["metadata"].get("category", "")
        
        return {
            "name": document_name,
            "type": self._get_file_type(document_name),
            "category": category or self._get_category(document_name),
            "pages": len(pages_set),
            "chunks": len(document_chunks),
            "all_chunks": document_chunks,
            "author": author if author else "系统",
            "createTime": create_time,
            "updateTime": update_time,
            "status": status,
            "review_comment": review_comment
        }

    def _get_category(self, filename: str) -> str:
        """Determine category based on filename keywords"""
        filename_lower = filename.lower()
        if any(keyword in filename_lower for keyword in ["技术", "api", "架构", "代码", "开发", "tech", "architecture", "code"]):
            return "技术"
        elif any(keyword in filename_lower for keyword in ["财务", "报告", "报表", "finance", "report"]):
            return "财务"
        elif any(keyword in filename_lower for keyword in ["人力", "员工", "hr", "employee"]):
            return "人力资源"
        elif any(keyword in filename_lower for keyword in ["合同", "法务", "legal", "contract"]):
            return "法务"
        elif any(keyword in filename_lower for keyword in ["市场", "分析", "marketing", "analysis"]):
            return "市场"
        elif any(keyword in filename_lower for keyword in ["产品", "需求", "prd", "product", "requirement"]):
            return "产品"
        else:
            return "其他"

    def update_document_status(self, document_name: str, status: str, review_comment: str = "") -> bool:
        """Update the status of all chunks belonging to a specific document"""
        from datetime import datetime
        from langchain_core.documents import Document
        now = datetime.now().isoformat()
        
        logger.info(f"Updating status for document: {document_name} to {status}")
        all_data = self.db.get()
        
        ids_to_update = []
        documents_to_update = []
        
        for i, doc_id in enumerate(all_data["ids"]):
            metadata = all_data["metadatas"][i] if all_data["metadatas"] else {}
            source = metadata.get("source", "")
            
            if source == document_name:
                ids_to_update.append(doc_id)
                new_metadata = metadata.copy()
                new_metadata["status"] = status
                new_metadata["update_time"] = now
                if review_comment:
                    new_metadata["review_comment"] = review_comment
                
                page_content = all_data["documents"][i] if all_data["documents"] else ""
                documents_to_update.append(Document(page_content=page_content, metadata=new_metadata))
        
        if ids_to_update:
            self.db.update_documents(ids_to_update, documents_to_update)
            logger.info(f"Updated status for {len(ids_to_update)} chunks for document: {document_name}")
            return True
        else:
            logger.warning(f"No chunks found for document: {document_name}")
            return False

    def update_document_category(self, document_name: str, category: str) -> bool:
        """Update the category of all chunks belonging to a specific document"""
        from datetime import datetime
        from langchain_core.documents import Document
        now = datetime.now().isoformat()
        
        logger.info(f"Updating category for document: {document_name} to {category}")
        all_data = self.db.get()
        
        ids_to_update = []
        documents_to_update = []
        
        for i, doc_id in enumerate(all_data["ids"]):
            metadata = all_data["metadatas"][i] if all_data["metadatas"] else {}
            source = metadata.get("source", "")
            
            if source == document_name:
                ids_to_update.append(doc_id)
                new_metadata = metadata.copy()
                new_metadata["category"] = category
                new_metadata["update_time"] = now
                
                page_content = all_data["documents"][i] if all_data["documents"] else ""
                documents_to_update.append(Document(page_content=page_content, metadata=new_metadata))
        
        if ids_to_update:
            self.db.update_documents(ids_to_update, documents_to_update)
            logger.info(f"Updated category for {len(ids_to_update)} chunks for document: {document_name}")
            return True
        else:
            logger.warning(f"No chunks found for document: {document_name}")
            return False

    def delete_document(self, document_name: str) -> bool:
        """Delete all chunks belonging to a specific document"""
        logger.info(f"Deleting document: {document_name}")
        all_data = self.db.get()
        
        ids_to_delete = []
        for i, doc_id in enumerate(all_data["ids"]):
            metadata = all_data["metadatas"][i] if all_data["metadatas"] else {}
            source = metadata.get("source", "")
            
            if source == document_name:
                ids_to_delete.append(doc_id)
        
        if ids_to_delete:
            self.db.delete(ids_to_delete)
            logger.info(f"Deleted {len(ids_to_delete)} chunks for document: {document_name}")
            return True
        else:
            logger.warning(f"No chunks found for document: {document_name}")
            return False
