import { callModel, MODEL, MODEL_THINKING, Message } from './client';
import { researchCustomer, researchMarket } from './research';
import { analyzeCustomer } from './analysis';
import { writeCustomerReport, writeOpportunityDocs } from './writer';
import { upsertCustomer, createOpportunity, createActivity } from './crm';
import { getDb } from '@/lib/db';

export interface WorkflowResult {
  ok: boolean;
  message: string;
  data?: any;
}

export interface ConversationContext {
  userId?: string;
  messages: Message[];
}

/**
 * 协调者 Agent - 理解用户意图，分发任务，汇总结果
 */
export async function coordinator(userMessage: string, context?: ConversationContext): Promise<WorkflowResult> {
  // 先解析用户意图
  const intent = await parseIntent(userMessage);

  switch (intent.type) {
    case 'customer_analysis':
      return await workflowCustomerAnalysis(intent.params);
    case 'opportunity_ingest':
      return await workflowOpportunityIngest(intent.params);
    case 'opportunity_query':
      return await workflowOpportunityQuery(intent.params);
    case 'general_chat':
      return await workflowGeneralChat(userMessage);
    default:
      return { ok: false, message: '我不太理解你的意思，可以说「帮我分析XX客户」或「录入XX商机」' };
  }
}

interface Intent {
  type: 'customer_analysis' | 'opportunity_ingest' | 'opportunity_query' | 'general_chat';
  params: Record<string, string>;
}

async function parseIntent(message: string): Promise<Intent> {
  const msg = message.trim();

  // 完全由 LLM 判断意图 + 提取参数
  const system = `你是一个B2B销售助手「小悦」的意图识别中枢。
根据用户的自然语言，判断用户想要什么，并提取相关参数。

注意：如果用户消息中包含「网站：」或「http」相关链接，那不是公司名称，不要把它当作公司名的一部分。

用户可能说：
1. 分析客户：「帮我分析华为」「分析一下海康威视」「调研思源电气」「分析豪达（浙江）汽车配件有限公司，网站：http://www.geelyhd.com」
2. 录入商机：「录入商机：XX项目」「记录：XX商机」「新建一个叫XX的商机」
3. 查询商机进展：「查一下XX项目进展」「XX商机怎么样了」「查询XX状态」
4. 闲聊/其他：补充客户信息、整理记录、问如何使用、纯聊天等

返回JSON格式：
{
  "type": "customer_analysis" | "opportunity_ingest" | "opportunity_query" | "general_chat",
  "params": {
    "customer_name": "客户名/公司名，只提取公司名本身，忽略网站/网址/链接",
    "name": "实体名（customer_analysis 或 opportunity_query）",
    "opportunity_name": "商机名（仅 opportunity_ingest/opportunity_query）"
  }
}

只返回JSON，不要其他文字。`;

  const result = await callModel(MODEL, [{ role: 'user', content: msg }], system, 300);

  try {
    const parsed = JSON.parse(result.content.trim());
    return {
      type: parsed.type || 'general_chat',
      params: parsed.params || {},
    };
  } catch {
    return { type: 'general_chat', params: {} };
  }
}

// ============ 工作流1: 客户分析 ============

async function workflowCustomerAnalysis(params: Record<string, string>): Promise<WorkflowResult> {
  const customerName = params.customer_name || params.name;
  if (!customerName) {
    return { ok: false, message: '请提供客户名称，例如：「帮我分析思源电气」' };
  }

  try {
    // Step 1: 调研
    const researchResult = await researchCustomer(customerName, params.industry);

    // Step 2: 分析
    const analysisResult = await analyzeCustomer(customerName, researchResult, params);

    // Step 3: 写入 Obsidian
    const writeResult = await writeCustomerReport(customerName, analysisResult);

    // Step 4: 写入 SQLite
    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE name LIKE ?').get(`%${customerName}%`) as any;
    let customerId: number;
    if (customer) {
      db.prepare("UPDATE customers SET doc_path = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(writeResult.docPath, customer.id);
      customerId = customer.id;
    } else {
      customerId = upsertCustomer({ name: customerName, industry: params.industry || '', doc_path: writeResult.docPath });
    }

    // Step 5: 创建活动记录
    createActivity({
      type: '客户分析',
      summary: `分析报告：${customerName}`,
      customer_id: customerId,
      doc_path: writeResult.reportPath,
    });

    return {
      ok: true,
      message: `已完成客户分析：${customerName}`,
      data: {
        report: analysisResult.report,
        docPath: writeResult.docPath,
        reportPath: writeResult.reportPath,
      },
    };
  } catch (e: any) {
    return { ok: false, message: `分析失败：${e.message}` };
  }
}

// ============ 工作流2: 商机录入 ============

async function workflowOpportunityIngest(params: Record<string, string>): Promise<WorkflowResult> {
  const opportunityName = params.name || params.opportunity_name;
  const meetingNotes = params.meeting_notes || params.content || params.notes;
  const customerName = params.customer_name;

  if (!opportunityName) {
    return { ok: false, message: '请提供商机名称，例如：「录入商机：思源数字化项目」' };
  }

  try {
    // Step 1: 解析会议纪要/信息
    const parsed = await parseOpportunityInfo(opportunityName, meetingNotes || '', customerName);

    // Step 2: 写入 Obsidian
    const writeResult = await writeOpportunityDocs(opportunityName, parsed);

    // Step 3: 写入 SQLite
    let opportunityId: number | undefined;
    const db = getDb();

    // 查找客户
    let customerId: number | undefined;
    if (customerName || parsed.customerName) {
      const cn = customerName || parsed.customerName;
      const customer = db.prepare('SELECT id FROM customers WHERE name LIKE ?').get(`%${cn}%`) as any;
      if (customer) customerId = customer.id;
    }

    // 创建商机
    const oppResult = db.prepare(
      'INSERT INTO opportunities (name, stage, customer_id, amount, close_date, next_action, doc_path) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      opportunityName,
      parsed.stage || 'S1',
      customerId || null,
      parsed.amount || null,
      parsed.closeDate || null,
      parsed.nextAction || null,
      writeResult.docPath
    );
    opportunityId = oppResult.lastInsertRowid as number;

    // 创建联系人
    if (parsed.contacts && parsed.contacts.length > 0) {
      for (const contact of parsed.contacts) {
        db.prepare(
          'INSERT INTO contacts (name, title, phone, email, role, customer_id, opportunity_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(contact.name, contact.title, contact.phone, contact.email, contact.role, customerId || null, opportunityId);
      }
    }

    // 创建活动记录
    createActivity({
      type: '商机录入',
      summary: `新建商机：${opportunityName}`,
      opportunity_id: opportunityId,
      customer_id: customerId,
    });

    return {
      ok: true,
      message: `已录入商机：${opportunityName}`,
      data: {
        opportunityId,
        docPath: writeResult.docPath,
        parsed,
      },
    };
  } catch (e: any) {
    return { ok: false, message: `录入失败：${e.message}` };
  }
}

// ============ 工作流3: 商机查询 ============

async function workflowOpportunityQuery(params: Record<string, string>): Promise<WorkflowResult> {
  const opportunityName = params.name || params.opportunity_name;
  if (!opportunityName) {
    return { ok: false, message: '请提供商机名称，例如：「查询思源数字化进展」' };
  }

  try {
    const db = getDb();

    // 查 SQLite
    const opp = db.prepare(`
      SELECT o.*, c.name as customer_name
      FROM opportunities o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.name LIKE ?
    `).get(`%${opportunityName}%`) as any;

    // 查 Obsidian
    let docContent = '';
    if (opp?.doc_path) {
      const { readDoc } = await import('@/lib/vault');
      docContent = readDoc(`${opp.doc_path}/00_项目概况.md`) || '';
    }

    // 查活动记录
    const activities = opp
      ? db.prepare('SELECT * FROM activities WHERE opportunity_id = ? ORDER BY date DESC').all(opp.id)
      : [];

    // 查联系人
    const contacts = opp
      ? db.prepare('SELECT * FROM contacts WHERE opportunity_id = ?').all(opp.id)
      : [];

    if (!opp) {
      return { ok: false, message: `未找到商机：${opportunityName}` };
    }

    const summary = await summarizeOpportunity(opp, docContent, activities, contacts);

    return {
      ok: true,
      message: '查询完成',
      data: { summary, opportunity: opp, activities, contacts },
    };
  } catch (e: any) {
    return { ok: false, message: `查询失败：${e.message}` };
  }
}

// ============ 工作流4: 闲聊 ============

async function workflowGeneralChat(message: string): Promise<WorkflowResult> {
  const system = `你是一个B2B销售助手，名字叫「小悦」，服务于销售团队。你可以帮助：
- 回答关于客户分析的问题
- 提供销售策略建议
- 解答CRM使用问题
- 用中文交流

保持简洁、专业、友好的风格。`;

  const result = await callModel(MODEL, [{ role: 'user', content: message }], system, 1000);

  return { ok: true, message: result.content, data: {} };
}

// ============ 辅助函数 ============

async function parseOpportunityInfo(
  name: string,
  notes: string,
  customerName?: string
): Promise<{
  stage?: string;
  amount?: number;
  closeDate?: string;
  nextAction?: string;
  contacts?: { name: string; title?: string; phone?: string; email?: string; role?: string }[];
  customerName?: string;
}> {
  const system = `你是一个销售信息提取助手。用户会提供商机名称和可选的会议纪要/描述。
请提取以下信息并返回JSON：
- stage: 商机阶段（S1/S2/S3/S4/S0），根据描述判断
- amount: 预估金额（元），数字，如没有写null
- closeDate: 预计成交日期，YYYY-MM-DD格式，如没有写null
- nextAction: 下一步行动，简短描述
- contacts: 联系人数组，每人有name(必填)、title、phone、email、role
- customerName: 关联客户名称

只返回JSON，不要其他文字。`;

  const content = `商机名称：${name}\n${customerName ? `客户名称：${customerName}\n` : ''}${notes ? `补充信息：${notes}` : ''}`;

  const result = await callModel(MODEL, [{ role: 'user', content }], system, 1500);

  try {
    return JSON.parse(result.content.trim());
  } catch {
    return { stage: 'S1' };
  }
}

async function summarizeOpportunity(
  opp: any,
  docContent: string,
  activities: any[],
  contacts: any[]
): Promise<string> {
  const system = `你是一个销售汇报助手。根据提供的商机信息，用简洁的中文总结给销售团队看。
包括：商机概况、当前阶段、金额、联系人、最近活动摘要。
控制在200字以内。`;

  const content = `商机名称：${opp.name}
客户：${opp.customer_name || '未知'}
阶段：${opp.stage}
金额：${opp.amount ? `${(opp.amount / 10000).toFixed(0)}万元` : '未评估'}
预计成交：${opp.close_date || '未确定'}
下一步行动：${opp.next_action || '无'}

联系人：${contacts.map((c: any) => `${c.name}(${c.title || c.role || ''})`).join('、') || '暂无'}

最近活动：${activities.slice(0, 3).map((a: any) => `${a.date} ${a.type}: ${a.summary}`).join('\n') || '暂无'}

项目文档内容：${docContent.substring(0, 500)}`;

  const result = await callModel(MODEL, [{ role: 'user', content }], system, 800);
  return result.content;
}
