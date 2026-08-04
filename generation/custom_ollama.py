from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from core.config import settings
from loguru import logger
import requests


class CustomOllamaChat(BaseChatModel):
    model: str = settings.OLLAMA_MODEL
    base_url: str = "http://localhost:11434"
    
    def _generate(self, messages: list[BaseMessage], stop: list[str] | None = None, run_manager=None, **kwargs) -> ChatResult:
        prompt = ""
        for msg in messages:
            if isinstance(msg, HumanMessage):
                prompt += f"用户: {msg.content}\n"
            elif isinstance(msg, AIMessage):
                prompt += f"助手: {msg.content}\n"
        
        logger.info(f"Sending prompt to Ollama: {prompt[:100]}...")
        
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=120,
            )
            
            if response.status_code != 200:
                logger.error(f"Ollama API returned status code: {response.status_code}")
                raise Exception(f"API error: {response.status_code}")
            
            result = response.json()
            answer = result.get("response", "")
            
            return ChatResult(
                generations=[ChatGeneration(message=AIMessage(content=answer))]
            )
        except Exception as e:
            logger.error(f"Failed to call Ollama API: {str(e)}")
            raise
    
    @property
    def _llm_type(self) -> str:
        return "custom-ollama"
