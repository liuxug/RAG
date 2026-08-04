from pathlib import Path
import json
from datetime import datetime
from typing import List, Dict, Optional
from loguru import logger

DOWNLOAD_HISTORY_FILE = Path("./data/download_history.json")


class DownloadStorage:
    def __init__(self):
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        DOWNLOAD_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    def add_download(self, username: str, document_name: str, document_type: str, category: str):
        """Add a download record"""
        history = self._load_history()
        
        record = {
            "id": str(datetime.now().timestamp()),
            "username": username,
            "document_name": document_name,
            "document_type": document_type,
            "category": category,
            "download_time": datetime.now().isoformat()
        }
        
        history.insert(0, record)
        
        if len(history) > 100:
            history = history[:100]
        
        self._save_history(history)
        logger.info(f"Added download record: {document_name} by {username}")

    def get_download_history(self, username: str) -> List[Dict]:
        """Get download history for a user"""
        history = self._load_history()
        return [h for h in history if h.get("username") == username]

    def clear_download_history(self, username: str):
        """Clear download history for a user"""
        history = self._load_history()
        history = [h for h in history if h.get("username") != username]
        self._save_history(history)
        logger.info(f"Cleared download history for: {username}")

    def delete_download_record(self, username: str, record_id: str):
        """Delete a specific download record"""
        history = self._load_history()
        history = [h for h in history if not (h.get("username") == username and h.get("id") == record_id)]
        self._save_history(history)

    def _load_history(self) -> List[Dict]:
        if not DOWNLOAD_HISTORY_FILE.exists():
            return []
        try:
            with open(DOWNLOAD_HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return []

    def _save_history(self, history: List[Dict]):
        with open(DOWNLOAD_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)


download_storage = DownloadStorage()