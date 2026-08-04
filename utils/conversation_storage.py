from pathlib import Path
from datetime import datetime
import json

CONVERSATION_DATA_FILE = Path("./data/conversation_data.json")


class ConversationStorage:
    def __init__(self):
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        CONVERSATION_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

    def _load_data(self):
        if not CONVERSATION_DATA_FILE.exists():
            return {"conversations": [], "total_count": 0}
        try:
            with open(CONVERSATION_DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {"conversations": [], "total_count": 0}

    def _save_data(self, data):
        with open(CONVERSATION_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def record_conversation(self, user_id=None, question=None, response_time=None):
        data = self._load_data()
        record = {
            "id": str(datetime.now().timestamp()),
            "user_id": user_id,
            "question": question[:100] if question else "",
            "response_time": response_time,
            "timestamp": datetime.now().isoformat()
        }
        data["conversations"].insert(0, record)
        data["total_count"] += 1
        if len(data["conversations"]) > 1000:
            data["conversations"] = data["conversations"][:1000]
        self._save_data(data)

    def get_total_conversations(self):
        data = self._load_data()
        return data.get("total_count", 0)

    def get_conversations_count_by_period(self, days=30):
        data = self._load_data()
        cutoff = (datetime.now() - datetime.timedelta(days=days)).isoformat()
        count = 0
        for conv in data.get("conversations", []):
            if conv.get("timestamp", "") > cutoff:
                count += 1
        return count

    def get_avg_response_time(self):
        data = self._load_data()
        times = [c.get("response_time") for c in data.get("conversations", []) if c.get("response_time")]
        if not times:
            return None
        return sum(times) / len(times)


conversation_storage = ConversationStorage()