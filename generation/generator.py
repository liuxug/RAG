from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from generation.custom_ollama import CustomOllamaChat
from core.config import settings
from loguru import logger
from typing import List, Dict

try:
    from langchain_dashscope import ChatDashScope
    HAS_DASHSCOPE = True
except ImportError:
    HAS_DASHSCOPE = False
    logger.warning("langchain-dashscope not installed, DashScope LLM will not be available")


class Generator:
    CHINESE_PROMPT = """你是一个专业的文档问答助手。请严格根据提供的上下文内容回答问题。

上下文信息：
{context}

问题：
{question}

回答要求：
1. 只能基于上下文内容进行回答，不得编造信息
2. 如果上下文无法回答问题，请明确回答"知识库中未找到相关信息"
3. 回答要简洁明了，逻辑清晰
4. 在回答末尾列出引用来源，格式为：【来源：文件名 第X页】

请开始回答："""

    ENGLISH_PROMPT = """You are a professional document QA assistant. Please strictly answer questions based on the provided context.

Context:
{context}

Question:
{question}

Answer Requirements:
1. Only answer based on the context, do not fabricate information
2. If the context cannot answer the question, clearly answer "No relevant information found in the knowledge base"
3. Answer concisely and clearly
4. List citation sources at the end of the answer, format: [Source: filename Page X]

Please start answering:"""

    def __init__(self):
        self.llm = self._initialize_llm()
        self.chinese_prompt = PromptTemplate(
            template=self.CHINESE_PROMPT,
            input_variables=["context", "question"]
        )
        self.english_prompt = PromptTemplate(
            template=self.ENGLISH_PROMPT,
            input_variables=["context", "question"]
        )
        self.chain = self.chinese_prompt | self.llm
        logger.info(f"Initialized Generator with LLM type: {settings.LLM_TYPE}")

    def switch_llm(self, llm_type: str, temperature: float = None, max_tokens: int = None):
        """Dynamically switch LLM type with optional parameters"""
        logger.info(f"Switching LLM type to: {llm_type}, temperature: {temperature}, max_tokens: {max_tokens}")
        settings.LLM_TYPE = llm_type
        if temperature is not None:
            settings.TEMPERATURE = temperature
        if max_tokens is not None:
            settings.MAX_TOKENS = max_tokens
        self.llm = self._initialize_llm()
        self.chain = self.chinese_prompt | self.llm
        logger.info(f"Successfully switched to LLM type: {llm_type}")
        return llm_type

    def _initialize_llm(self):
        """Initialize LLM based on configuration"""
        llm_type = settings.LLM_TYPE.lower()
        
        if llm_type == "ollama":
            return CustomOllamaChat(model=settings.OLLAMA_MODEL, temperature=settings.TEMPERATURE, max_tokens=settings.MAX_TOKENS)
        elif llm_type == "openai":
            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY is not set")
            chat_openai_kwargs = {
                "model": settings.OPENAI_MODEL,
                "api_key": settings.OPENAI_API_KEY,
                "temperature": settings.TEMPERATURE,
                "max_tokens": settings.MAX_TOKENS
            }
            if settings.OPENAI_BASE_URL:
                chat_openai_kwargs["base_url"] = settings.OPENAI_BASE_URL
            return ChatOpenAI(**chat_openai_kwargs)
        elif llm_type == "dashscope":
            if not HAS_DASHSCOPE:
                raise ValueError("langchain-dashscope is not installed. Please install it with: pip install langchain-dashscope")
            if not settings.DASHSCOPE_API_KEY:
                raise ValueError("DASHSCOPE_API_KEY is not set")
            return ChatDashScope(
                model=settings.DASHSCOPE_MODEL,
                dashscope_api_key=settings.DASHSCOPE_API_KEY,
                temperature=settings.TEMPERATURE,
                max_tokens=settings.MAX_TOKENS
            )
        else:
            raise ValueError(f"Unsupported LLM type: {llm_type}")

    def _build_context(self, documents: List[Dict]) -> str:
        """Build context string from retrieved documents"""
        if not documents:
            return ""
        
        context_parts = []
        for doc in documents:
            source = doc.get("source", "")
            page = doc.get("page", 0)
            content = doc.get("content", "")
            context_parts.append(f"【来源：{source} 第{page}页】\n{content}\n")
        
        return "\n".join(context_parts)

    def _extract_sources(self, documents: List[Dict]) -> List[Dict]:
        """Extract unique sources from documents, merge pages from same document"""
        sources = {}
        for doc in documents:
            source = doc.get("source", "")
            page = doc.get("page", 0)
            score = doc.get("score", 0.0)
            
            if source not in sources:
                sources[source] = {
                    "source": source,
                    "pages": set(),
                    "scores": []
                }
            
            sources[source]["pages"].add(page)
            sources[source]["scores"].append(score)
        
        result = []
        for source, info in sources.items():
            pages = sorted(info["pages"])
            avg_score = sum(info["scores"]) / len(info["scores"]) if info["scores"] else 0.0
            
            if len(pages) == 1:
                page_display = pages[0]
            elif len(pages) <= 3:
                page_display = ",".join(str(p) for p in pages)
            else:
                page_display = f"{pages[0]}-{pages[-1]}"
            
            result.append({
                "source": source,
                "page": page_display,
                "score": avg_score
            })
        
        result.sort(key=lambda x: x["score"])
        
        return result

    def generate(self, question: str, documents: List[Dict], language: str = "zh") -> Dict:
        """Generate answer based on retrieved documents"""
        logger.info(f"Generating answer for question: {question[:50]}... (language: {language})")
        
        if not documents:
            return {
                "answer": "知识库中未找到相关信息" if language == "zh" else "No relevant information found in the knowledge base",
                "sources": []
            }
        
        context = self._build_context(documents)
        
        if language == "en":
            chain = self.english_prompt | self.llm
        else:
            chain = self.chinese_prompt | self.llm
        
        try:
            result = chain.invoke({"context": context, "question": question})
            
            if hasattr(result, 'content'):
                answer = result.content.strip()
            else:
                answer = str(result).strip()
            
            sources = self._extract_sources(documents)
            
            logger.info("Answer generated successfully")
            return {
                "answer": answer,
                "sources": sources
            }
        except Exception as e:
            logger.error(f"Failed to generate answer: {str(e)}")
            return {
                "answer": "生成回答时发生错误" if language == "zh" else "Error generating answer",
                "sources": []
            }
