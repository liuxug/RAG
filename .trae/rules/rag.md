# Role
你是一位资深后端与 AI 工程专家。请帮我设计并实现一个**生产级、可扩展的 RAG（检索增强生成）文档问答系统**。

---

# 目标
构建一个完整的 RAG Pipeline，支持上传文档、自动索引、语义检索，并基于大语言模型生成带引用的答案。

---

# 技术栈（必须使用）
- Python 3.10+
- LangChain（最新版）
- FastAPI（REST API）
- Chroma（本地向量数据库，持久化到 disk）
- Sentence-Transformers：`bge-large-zh-v1.5`（中文 Embedding）
- 支持切换 LLM：
  - 本地：Ollama（Qwen2.5 / Llama3）
  - 云端：OpenAI / 通义千问 API（通过环境变量切换）
- PyMuPDF / Unstructured（PDF 解析）
- Pydantic v2（数据校验）
---

# 功能需求

## 1. 文档 ingestion（离线索引）
- 支持上传 PDF / Markdown / TXT
- 自动解析文档内容
- 使用 `RecursiveCharacterTextSplitter`
  - chunk_size = 800
  - chunk_overlap = 150
- 为每个 chunk 生成 embedding
- 存储到 Chroma，包含 metadata：
  - source（文件名）
  - page（页码）
  - chunk_id

## 2. 检索（Retrieval）
- 用户输入问题后，先向量检索 Top-5 相关 chunk
- 返回结果必须包含：
  - score
  - source
  - page
  - content

## 3. 生成（Generation）
- 使用 Prompt Template，强制模型**只基于检索到的上下文回答**
- 若上下文无法回答问题，必须明确回答“知识库中未找到相关信息”
- 回答末尾附带引用来源（文件名 + 页码）
- Prompt 需支持中英文切换

## 4. API 设计（FastAPI）
请实现以下接口：
- POST `/upload`
  - 上传文档并触发索引
- POST `/query`
  - 输入 question，返回 answer + sources
- GET `/health`
  - 服务健康检查

## 5. 工程规范
- 项目结构清晰，模块化：
  - `ingest/`
  - `retrieval/`
  - `generation/`
  - `api/`
  - `core/config.py`
- 使用 `.env` 管理配置（模型路径、API Key、LLM 类型）
- 所有代码必须有清晰注释
- 提供 `requirements.txt`
- 提供 `README.md`：
  - 项目说明
  - 启动方式
  - 示例请求（curl / Python）
- 日志使用 `loguru`
- 错误处理统一封装

---

# 高级特性（加分项）
- 支持混合检索（向量 + BM25）
- 支持 Rerank（bge-reranker）
- 支持流式返回（Streaming Response）
- Dockerfile + docker-compose

---

# 输出要求
1. 先给出**项目目录结构**
2. 再逐个文件输出**完整代码**
3. 最后给出**运行示例与测试命令**
4. 不要省略关键代码，不要只给思路

---