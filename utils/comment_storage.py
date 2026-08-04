from pathlib import Path
import json
from datetime import datetime
from typing import List, Dict, Optional
from loguru import logger

COMMENT_FILE = Path("./data/comments.json")


class CommentStorage:
    def __init__(self):
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        COMMENT_FILE.parent.mkdir(parents=True, exist_ok=True)

    def add_comment(self, document_name: str, username: str, content: str):
        """Add a comment to a document"""
        comments = self._load_comments()
        
        record = {
            "id": str(datetime.now().timestamp()),
            "document_name": document_name,
            "username": username,
            "content": content,
            "created_at": datetime.now().isoformat()
        }
        
        comments.insert(0, record)
        
        if len(comments) > 500:
            comments = comments[:500]
        
        self._save_comments(comments)
        logger.info(f"Added comment to document: {document_name} by {username}")

    def get_comments(self, document_name: str) -> List[Dict]:
        """Get all comments for a document"""
        comments = self._load_comments()
        return [c for c in comments if c.get("document_name") == document_name]

    def delete_comment(self, comment_id: str, username: str) -> bool:
        """Delete a comment (only by the comment owner)"""
        comments = self._load_comments()
        original_length = len(comments)
        comments = [c for c in comments if not (c.get("id") == comment_id and c.get("username") == username)]
        
        if len(comments) < original_length:
            self._save_comments(comments)
            logger.info(f"Deleted comment: {comment_id} by {username}")
            return True
        return False

    def _load_comments(self) -> List[Dict]:
        if not COMMENT_FILE.exists():
            return []
        try:
            with open(COMMENT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return []

    def _save_comments(self, comments: List[Dict]):
        with open(COMMENT_FILE, "w", encoding="utf-8") as f:
            json.dump(comments, f, ensure_ascii=False, indent=2)


comment_storage = CommentStorage()
