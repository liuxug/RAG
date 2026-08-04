from pathlib import Path
import json
from datetime import datetime
from typing import List, Dict, Optional
from loguru import logger

CHAT_HISTORY_FILE = Path("./data/chat_history.json")


class ChatHistoryStorage:
    def __init__(self):
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        CHAT_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    def _load_history(self) -> List[Dict]:
        if not CHAT_HISTORY_FILE.exists():
            return []
        try:
            with open(CHAT_HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return []

    def _save_history(self, history: List[Dict]):
        with open(CHAT_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)

    def create_session(self, user_id: str, title: str, messages: List[Dict]) -> Dict:
        """创建新的对话会话"""
        history = self._load_history()
        
        session = {
            "id": str(int(datetime.now().timestamp() * 1000)),
            "user_id": user_id,
            "title": title[:100] if len(title) > 100 else title,
            "messages": messages,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        history.insert(0, session)
        
        # 每个用户最多保存20个会话
        user_sessions = [s for s in history if s.get("user_id") == user_id]
        if len(user_sessions) > 20:
            # 获取需要删除的会话ID
            sessions_to_remove = {s["id"] for s in user_sessions[20:]}
            history = [s for s in history if s["id"] not in sessions_to_remove]
        
        self._save_history(history)
        logger.info(f"Created chat session for user {user_id}: {session['id']}")
        return session

    def update_session(self, session_id: str, user_id: str, title: Optional[str] = None, 
                       messages: Optional[List[Dict]] = None) -> Optional[Dict]:
        """更新对话会话"""
        history = self._load_history()
        
        for session in history:
            if session["id"] == session_id and session["user_id"] == user_id:
                if title:
                    session["title"] = title[:100] if len(title) > 100 else title
                if messages:
                    session["messages"] = messages
                session["updated_at"] = datetime.now().isoformat()
                self._save_history(history)
                logger.info(f"Updated chat session: {session_id}")
                return session
        
        return None

    def get_user_sessions(self, user_id: str) -> List[Dict]:
        """获取用户的所有对话会话"""
        history = self._load_history()
        user_sessions = [s for s in history if s.get("user_id") == user_id]
        # 按更新时间倒序排列
        user_sessions.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return user_sessions

    def get_session(self, session_id: str, user_id: str) -> Optional[Dict]:
        """获取单个对话会话"""
        history = self._load_history()
        for session in history:
            if session["id"] == session_id and session["user_id"] == user_id:
                return session
        return None

    def delete_session(self, session_id: str, user_id: str) -> bool:
        """删除单个对话会话"""
        history = self._load_history()
        original_len = len(history)
        history = [s for s in history if not (s["id"] == session_id and s["user_id"] == user_id)]
        
        if len(history) < original_len:
            self._save_history(history)
            logger.info(f"Deleted chat session: {session_id}")
            return True
        return False

    def clear_user_sessions(self, user_id: str) -> int:
        """清空用户的所有对话会话"""
        history = self._load_history()
        original_len = len(history)
        history = [s for s in history if s.get("user_id") != user_id]
        removed_count = original_len - len(history)
        
        self._save_history(history)
        logger.info(f"Cleared {removed_count} chat sessions for user: {user_id}")
        return removed_count


chat_history_storage = ChatHistoryStorage()