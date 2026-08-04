from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    LLM_TYPE: str = "ollama"
    OLLAMA_MODEL: str = "qwen2.5:7b"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_BASE_URL: str = ""
    DASHSCOPE_API_KEY: str = ""
    DASHSCOPE_MODEL: str = "qwen3.7-max"
    
    TEMPERATURE: float = 0.7
    MAX_TOKENS: int = 4096

    EMBEDDING_MODEL: str = "BAAI/bge-large-zh-v1.5"
    CHROMA_DB_PATH: str = "./chroma_db"
    UPLOAD_DIR: str = "./uploads"
    BASE_URL: str = ""

    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150
    TOP_K: int = 5

    LOG_LEVEL: str = "INFO"
    PORT: int = 8000

    SMTP_HOST: str = "smtp.qq.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_SENDER: str = ""
    CODE_EXPIRE_MINUTES: int = 5

    @property
    def chroma_db_path(self) -> Path:
        return Path(self.CHROMA_DB_PATH)

    @property
    def upload_dir(self) -> Path:
        return Path(self.UPLOAD_DIR)


settings = Settings()
