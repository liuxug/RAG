from pathlib import Path
from datetime import datetime
import json

SYSTEM_LOG_FILE = Path("./data/system_logs.json")


class SystemLogStorage:
    def __init__(self):
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        SYSTEM_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    def _load_data(self):
        if not SYSTEM_LOG_FILE.exists():
            return {"logs": []}
        try:
            with open(SYSTEM_LOG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {"logs": []}

    def _save_data(self, data):
        with open(SYSTEM_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add_log(self, user_id=None, username=None, action=None, target=None, target_type=None, detail=None):
        data = self._load_data()
        log = {
            "id": str(datetime.now().timestamp()),
            "user_id": user_id,
            "username": username,
            "action": action,
            "target": target,
            "target_type": target_type,
            "detail": detail,
            "timestamp": datetime.now().isoformat()
        }
        data["logs"].insert(0, log)
        if len(data["logs"]) > 500:
            data["logs"] = data["logs"][:500]
        self._save_data(data)

    def get_recent_logs(self, limit=20):
        data = self._load_data()
        return data.get("logs", [])[:limit]

    def get_logs_by_user(self, user_id, limit=20):
        data = self._load_data()
        return [l for l in data.get("logs", []) if l.get("user_id") == user_id][:limit]


system_log_storage = SystemLogStorage()