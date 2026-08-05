# 智识 RAG 文档问答中台

![Python](https://img.shields.io/badge/python-3.10+-3776AB?logo=python&logoColor=fff)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=fff)
![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=fff)
![TypeScript](https://img.shields.io/badge/typescript-5-3178C6?logo=typescript&logoColor=fff)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-3-4-06B6D4?logo=tailwindcss&logoColor=fff)
![Chroma](https://img.shields.io/badge/ChromaDB-0.5+-2E4057)
![LangChain](https://img.shields.io/badge/LangChain-0.3+-1C1C1C?logo=langchain)

![image-20260804180025461](C:\Users\admin\AppData\Roaming\Typora\typora-user-images\image-20260804180025461.png)

![image-20260804180055206](C:\Users\admin\AppData\Roaming\Typora\typora-user-images\image-20260804180055206.png)

> 智识 RAG 文档问答中台是一套基于检索增强生成（Retrieval-Augmented Generation, RAG）技术构建的企业级智能文档问答系统。系统支持多种格式文档的上传与自动向量化索引，结合语义检索与大模型生成能力，为用户提供**准确、可溯源、可扩展**的智能问答服务。

---

## ✨ 项目亮点

- 🧠 **多模型可切换**：同时支持本地 Ollama（qwen2.5 等）、云端 DashScope（qwen3.7-max）与 OpenAPI 兼容模型，一键切换。
- 📚 **多格式文档解析**：支持 `PDF / DOCX / PPTX / XLSX / MD / TXT / ODT / ODS / ODP / 图片(OCR)` 等十余种格式。
- 🔍 **智能检索**：关键词 + 向量相似度双路召回，融合排序，兼顾准确率与召回率。
- 💬 **可溯源问答**：回答附带引用来源（文件名 + 页码），支持知识库过滤、追问上下文。
- 🏷️ **文档生命周期管理**：草稿 / 待审核 / 已发布 / 审核驳回 / 已删除，配合审核流。
- 👥 **RBAC 权限体系**：角色 × 权限点矩阵式控制（文档查看、上传、下载、审核、问答、LLM 切换等）。
- 📊 **运营统计**：文档总量、周新增、查询量、下载历史、搜索热词、活跃趋势可视化。
- 🔗 **分享与协作**：一键生成带过期时间的文档分享链接；支持评论批注、知识库问答推荐、知识图谱可视化。
- 🛡️ **安全可靠**：JWT 鉴权、密码哈希（pbkdf2-sha256）、文件存储使用 URL 指针而非 Base64 入库。
- 🌙 **极客 UI**：React + TypeScript + TailwindCSS 深色界面，沉浸式对话体验。

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│   React 18 · TypeScript · Vite · TailwindCSS · Zustand      │
└───────────────────────────┬─────────────────────────────────┘
                            │ RESTful / JWT
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI)                      │
│                                                             │
│  ┌───────────────┬───────────────────┬──────────────────┐   │
│  │   文档入库     │     检索引擎        │     生成引擎       │   │
│  │  DocumentProc │    Retriever      │    Generator      │   │
│  │  EmbeddingMgr │  (关键词+向量融合)  │ (Ollama/Dash/   │   │
│  │  VectorStore  │                   │  OpenAI 可切换)   │   │
│  └──────┬────────┴────────┬──────────┴────────┬────────┘   │
│         │                 │                   │              │
│         ▼                 ▼                   ▼              │
│   ChromaDB         Sentence-Transformers    LLM API         │
│   (向量数据库)       (BAAI/bge-large-zh)    (可选多路)       │
└─────────────────────────────────────────────────────────────┘
```

### 核心模块说明

| 模块 | 路径 | 职责 |
| ---- | ---- | ---- |
| 文档处理 | `ingest/` | 多格式解析、文本切片、Embedding 向量化、向量库写入 |
| 检索引擎 | `retrieval/` | 关键词 + 向量双路召回，融合排序返回 Top-K 相关片段 |
| 生成引擎 | `generation/` | 多路 LLM 适配（Ollama / DashScope / OpenAI），中英文 Prompt 模板 |
| API 路由 | `api/` | 文档、问答、检索、权限、统计、LLM 切换等接口 |
| 数据存储 | `utils/` | 用户、会话、评论、下载、搜索、系统日志等持久化 |
| 权限认证 | `api/auth.py` / `api/roles.py` | JWT + RBAC 权限矩阵 |

---

## 🚀 快速开始

### 环境要求

- Python **≥ 3.10**
- Node.js **≥ 18**
- （可选）[Ollama](https://ollama.com/) 本地运行时
- （可选）GPU 用于本地大模型推理加速

### 1. 后端启动

```bash
# 克隆项目
git clone <repo-url>
cd RAG

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（复制 .env 并按需修改）
cp .env.example .env

# 启动服务（默认 8000 端口）
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 开发模式（默认 5173 端口）
npm run dev

# 构建生产包
npm run build

# 预览构建产物
npm run preview
```

启动后访问 `http://localhost:5173`，默认管理员账号可在 `data/users.json` 中查看。

---

## ⚙️ 配置说明

`.env` 关键配置项：

```env
# 大模型类型：ollama / dashscope / openai
LLM_TYPE=ollama

# 本地 Ollama
OLLAMA_MODEL=qwen2.5:7b

# 阿里云 DashScope
DASHSCOPE_API_KEY=sk-xxx
DASHSCOPE_MODEL=qwen3.7-max

# OpenAI 兼容
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=

# Embedding 模型
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5

# 检索参数
CHUNK_SIZE=800
CHUNK_OVERLAP=150
TOP_K=5

# 服务端口
PORT=8000
```

---

## 📁 目录结构

```
RAG/
├── main.py                   # FastAPI 入口
├── requirements.txt          # 后端依赖
├── .env                      # 环境变量
├── api/                      # 路由层（鉴权、文档、问答、统计、角色）
├── core/                     # 配置（config.py）
├── ingest/                   # 文档入库（解析、Embedding、向量库）
├── retrieval/                # 检索引擎
├── generation/               # 生成引擎（多路 LLM）
├── utils/                    # 持久化工具（会话/评论/下载/日志等）
├── chroma_db/                # ChromaDB 向量库持久化
├── data/                     # 业务 JSON 数据（用户、角色、会话等）
├── uploads/                  # 上传文件存储（URL 指针，不入库 Base64）
└── frontend/                 # React + TS 前端（独立工程）
    ├── src/
    │   ├── components/       # UI 组件（Header/Sidebar/AnswerDisplay 等）
    │   ├── pages/            # 页面（ChatPage / SearchPage / DocumentLibrary ...）
    │   ├── hooks/            # 自定义 hooks（useTheme）
    │   ├── utils/api.ts      # 封装的请求方法
    │   └── utils/debounce.ts # 防抖工具
    ├── tailwind.config.js
    ├── vite.config.ts
    └── package.json
```

---

## 🔌 核心 API

| Method | Path | 说明 |
| ------ | ---- | ---- |
| POST   | `/api/upload` | 上传文档并建立向量索引 |
| POST   | `/api/upload/temporary` | 临时文档（会话结束自动清理） |
| GET    | `/api/documents` | 文档列表（分页、过滤、排序） |
| GET    | `/api/documents/{name}` | 文档详情 + 全量切片 |
| DELETE | `/api/documents/{name}` | 删除文档 |
| POST   | `/api/documents/{name}/review` | 文档审核（approve/reject） |
| POST   | `/api/query` | **AI 问答接口**（核心） |
| GET    | `/api/search` | 智能搜索（关键词+向量融合） |
| POST   | `/api/query/recommendations` | 推荐相关文档 |
| POST   | `/api/query/knowledge-graph` | 知识图谱可视化数据 |
| GET    | `/api/stats` | 全局统计 |
| GET    | `/api/llm/status` / POST `/api/llm/switch` | 大模型动态切换 |
| POST   | `/api/auth/login` / `/api/auth/register` | 登录注册（邮箱验证码） |
| GET    | `/api/roles` / POST `/api/roles` | 角色 & 权限管理 |
| GET    | `/api/documents/{name}/share` | 生成分享链接（带过期时间） |
| GET    | `/api/documents/{name}/comments` | 文档评论列表 |

---

## 🧩 支持的文档格式

| 类别 | 扩展名 |
| ---- | ------ |
| 文本 | `.pdf` `.docx` `.doc` `.txt` `.md` `.rtf` `.csv` |
| 演示 | `.pptx` `.ppt` |
| 表格 | `.xlsx` `.xls` |
| OpenDocument | `.odt` `.ods` `.odp` |
| 图片 OCR | `.png` `.jpg` `.jpeg` `.bmp` `.tiff` |

---

## 🎯 典型使用流程

1. **管理员登录** → 创建角色并分配权限点。
2. **上传文档** → 选择分类（技术 / 人力 / 财务 / 法务 / 市场 / 产品 / 其他），进入「待审核」。
3. **审核发布** → 管理员在文档详情页批准后，文档对所有有权限用户可见。
4. **智能检索** → 在检索页输入关键词，系统返回命中文档、匹配度、摘要与路径。
5. **AI 问答** → 在对话页提问，自动召回 Top-K 切片并交给 LLM 生成答案，附带引用来源。
6. **切换模型** → 在对话页顶部一键切换本地 / 云端模型，平衡数据安全与回答质量。
7. **分享与协作** → 生成分享链接邀请外部查看；对文档进行评论与批注。

---

## 🛡️ 权限点矩阵（节选）

| 权限 Key | 说明 |
| -------- | ---- |
| `doc_view` / `doc_upload` / `doc_download` / `doc_delete` | 文档读写 |
| `doc_review` / `doc_comment` | 审核与评论 |
| `chat` / `knowledge_graph` / `recommend` | 问答能力 |
| `search` / `history_view` / `history_manage` | 检索与历史 |
| `stats_view` | 全局统计 |
| `llm_switch` | 切换大模型 |

默认角色：**超级管理员 / 管理员 / 审核员 / 编辑 / 普通用户 / 访客**。

---

## 🖼️ 界面预览

> 欢迎提交截图 / GIF 补充。建议包含以下页面：
> - 🔐 登录 & 注册（邮箱验证码）
> - 💬 AI 对话（多模型切换、引用溯源、流式回答）
> - 📚 文档库（筛选、分类、审核、收藏）
> - 📄 文档详情（切片预览、评论、版本状态）
> - 🔍 智能检索（匹配度排序、摘要、高亮）
> - 🧑‍🤝‍🧑 用户管理 & 角色权限
> - 📊 全局统计（文档、问答、周新增趋势）
> - 🔗 分享与知识图谱

---

## 🛠️ 技术栈

**后端：**
- [FastAPI](https://fastapi.tiangolo.com/) - Web 框架
- [LangChain](https://www.langchain.com/) - LLM 编排
- [ChromaDB](https://www.trychroma.com/) - 向量数据库
- [Sentence-Transformers](https://huggingface.co/sentence-transformers) - Embedding（BAAI/bge-large-zh-v1.5）
- [PyMuPDF](https://pymupdf.readthedocs.io/) / `python-docx` / `python-pptx` / `openpyxl` - 多格式文档解析
- [Pydantic](https://docs.pydantic.dev/) - 数据校验
- [Loguru](https://github.com/Delgan/loguru) - 日志

**前端：**
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) 构建
- [TailwindCSS](https://tailwindcss.com/) 样式
- [Zustand](https://github.com/pmndrs/zustand) 状态管理
- [React Router v7](https://reactrouter.com/) 路由
- [Lucide React](https://lucide.dev/) 图标
- [Axios](https://axios-http.com/) 封装请求（带防抖）

---

## 📄 License

本项目基于 [MIT License](./LICENSE) 开源，欢迎二次开发与企业内部落地。

---

<p align="center">
  <strong>Built with ❤️ by 智识 RAG Team</strong>
</p>
