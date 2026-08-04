from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict
import json
import os

SEARCH_DATA_FILE = Path("./data/search_data.json")

class SearchStorage:
    def __init__(self):
        SEARCH_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        self._init_data()

    def _init_data(self):
        if not SEARCH_DATA_FILE.exists():
            data = {
                "search_history": [],
                "hot_searches": []
            }
            with open(SEARCH_DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_data(self) -> dict:
        if not SEARCH_DATA_FILE.exists():
            self._init_data()
        with open(SEARCH_DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_data(self, data: dict):
        with open(SEARCH_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add_search_history(self, query: str, user_id: str = None, source: str = "search"):
        data = self._load_data()
        
        history_item = {
            "query": query,
            "user_id": user_id,
            "timestamp": datetime.now().isoformat(),
            "source": source
        }
        
        data["search_history"].insert(0, history_item)
        
        data["search_history"] = data["search_history"][:50]
        
        for item in data["search_history"][1:]:
            if item["query"] == query and item.get("source") == source:
                data["search_history"].remove(item)
                break
        
        self._save_data(data)

    def get_search_history(self, user_id: str = None, limit: int = 10, source: str = "search") -> List[Dict]:
        data = self._load_data()
        history = data["search_history"]
        
        history = [h for h in history if h.get("source") == source]
        
        if user_id:
            history = [h for h in history if h.get("user_id") == user_id]
        
        one_day_ago = (datetime.now() - timedelta(days=7)).isoformat()
        history = [h for h in history if h["timestamp"] > one_day_ago]
        
        return history[:limit]

    def add_hot_search(self, query: str):
        data = self._load_data()
        
        existing = next((h for h in data["hot_searches"] if h["query"] == query), None)
        if existing:
            existing["count"] += 1
            existing["last_search"] = datetime.now().isoformat()
        else:
            data["hot_searches"].append({
                "query": query,
                "count": 1,
                "last_search": datetime.now().isoformat()
            })
        
        data["hot_searches"].sort(key=lambda x: (-x["count"], x["last_search"]))
        
        data["hot_searches"] = data["hot_searches"][:20]
        
        self._save_data(data)

    def get_hot_searches(self, limit: int = 10) -> List[Dict]:
        data = self._load_data()
        
        one_week_ago = (datetime.now() - timedelta(days=30)).isoformat()
        hot_searches = [h for h in data["hot_searches"] if h["last_search"] > one_week_ago]
        
        hot_searches.sort(key=lambda x: (-x["count"], x["last_search"]))
        
        return hot_searches[:limit]

    def record_search(self, query: str, user_id: str = None, source: str = "search"):
        self.add_search_history(query, user_id, source)
        self.add_hot_search(query)

search_storage = SearchStorage()