from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from core.config import settings
from loguru import logger
from typing import List, Tuple


class EmbeddingManager:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""]
        )
        self.embeddings = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
        logger.info(f"Initialized EmbeddingManager with model: {settings.EMBEDDING_MODEL}")

    def split_text(self, pages: List[Tuple[int, str]], source: str, author: str = "系统", status: str = "待审核") -> List[Document]:
        """Split text into chunks and create Document objects"""
        from datetime import datetime
        now = datetime.now().isoformat()
        docs = []
        chunk_id = 0
        
        logger.info(f"split_text called with author: {repr(author)}, source: {source}, status: {status}")
        
        for page_num, text in pages:
            chunks = self.text_splitter.split_text(text)
            for chunk in chunks:
                if chunk.strip():
                    metadata = {
                        "source": source,
                        "page": page_num,
                        "chunk_id": chunk_id,
                        "author": author,
                        "create_time": now,
                        "update_time": now,
                        "status": status
                    }
                    logger.debug(f"Creating document with metadata: {metadata}")
                    docs.append(Document(page_content=chunk.strip(), metadata=metadata))
                    chunk_id += 1
        
        logger.info(f"Split {len(pages)} pages into {len(docs)} chunks")
        return docs

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts"""
        logger.info(f"Generating embeddings for {len(texts)} texts")
        return self.embeddings.embed_documents(texts)
