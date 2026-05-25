# 薄云 AI-CRM v1.0.0

面向 B2B 销售团队的 AI 销售助手，基于 Next.js + SQLite + Obsidian 构建。

## 核心功能

- **客户分析**：输入客户名称，自动完成华为系 CP/VP/AP 全链路分析，生成万字报告并归档
- **商机管理**：录入、追踪、查询商机进展
- **联系人管理**：客户-联系人-商机关联
- **活动记录**：自动记录所有分析、商机操作

## 技术架构

- **前端**：Next.js 16 (App Router) + React + Tailwind CSS
- **后端**：Next.js API Routes + SQLite（结构化数据）
- **知识库**：Obsidian Vault（Markdown 文档）
- **AI**：Claude API（Anthropic），多智能体编排

## 快速开始

### 环境要求

- Node.js 20+
- npm 或 yarn

### 安装

```bash
# 解压
tar -xzf ai-crm-v1.0.0.tar.gz
cd ai-crm-app

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000

### 配置

在项目根目录创建 `.env.local`：

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx
OBSIDIAN_VAULT_PATH=/Users/bring/ai-crm-vault
NO_PROXY=localhost,127.0.0.1
no_proxy=localhost,127.0.0.1
```

- `ANTHROPIC_API_KEY`：Anthropic API 密钥（必须）
- `OBSIDIAN_VAULT_PATH`：Obsidian 仓库路径，用于存储客户分析报告和商机文档（可选，默认 `./vault`）

### 生产部署

```bash
npm run build
npm run start
```

## 使用说明

### 小悦 AI 助手

聊天窗口支持自然语言指令：

| 指令 | 说明 |
|------|------|
| `帮我分析海康威视` | 启动客户分析，生成完整报告 |
| `录入商机：XX项目` | 新建商机 |
| `查一下XX项目进展` | 查询商机状态 |
| 任意闲聊 | 小悦回复 |

### 客户分析流程

1. 对小悦说「帮我分析XX客户」
2. 等待报告生成（实时显示分析阶段）
3. 报告自动归档到 Obsidian，字段自动填充到客户档案
4. 点击聊天窗口的「查看详情」跳转到客户页面

### 客户详情页

- 启动客户分析
- 手动编辑行业/规模/地区/官网
- 查看分析报告全文
- 查看联系人列表
- 查看活动记录

## 目录结构

```
ai-crm-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes
│   │   │   ├── chat/          # 聊天相关 API
│   │   │   ├── customers/     # 客户 CRUD API
│   │   │   ├── opportunities/ # 商机 CRUD API
│   │   │   └── vault/         # Obsidian 文件 API
│   │   ├── customers/         # 客户页面
│   │   └── opportunities/     # 商机页面
│   ├── components/            # React 组件
│   └── lib/                   # 核心逻辑
│       ├── agents/            # AI 智能体
│       │   ├── workflow.ts    # 客户分析工作流
│       │   ├── coordinator.ts  # 意图识别
│       │   ├── client.ts      # Claude API 调用
│       │   └── crm.ts        # CRM 数据操作
│       ├── db.ts              # SQLite 连接
│       └── vault.ts           # Obsidian 文件操作
├── vault/                     # Obsidian 文档仓库（需自行创建并配置路径）
└── data/                     # SQLite 数据库文件（自动生成）
```

## 数据存储

- **SQLite**（`data/crm.db`）：客户、商机、联系人、活动记录
- **Obsidian**（`vault/`）：客户分析报告、商机文档

## 环境变量

| 变量 | 必须 | 说明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | 是 | Anthropic API 密钥 |
| `OBSIDIAN_VAULT_PATH` | 否 | Obsidian 仓库路径，默认 `./vault` |
| `NO_PROXY` / `no_proxy` | 否 | 代理跳过设置 |
