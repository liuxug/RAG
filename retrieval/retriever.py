from ingest.vector_store import VectorStore
from core.config import settings
from loguru import logger
from typing import List, Dict


class Retriever:
    def __init__(self):
        self.vector_store = VectorStore()
        logger.info("Initialized Retriever")

    def retrieve(self, query: str, top_k: int = None, status_filter: str = "已发布", source_filter: list = None) -> List[Dict]:
        """Retrieve top-k relevant documents for the given query"""
        k = top_k if top_k is not None else settings.TOP_K
        
        effective_status_filter = status_filter if not source_filter else None
        
        logger.info(f"Retrieving top-{k} documents for query: {query[:50]}... (status_filter: {effective_status_filter}, source_filter: {source_filter})")
        
        results = self.vector_store.search(query, k=k, status_filter=effective_status_filter, source_filter=source_filter)
        
        if not results:
            logger.warning("No documents found for the query")
            return []
        
        logger.info(f"Retrieved {len(results)} documents")
        return results
