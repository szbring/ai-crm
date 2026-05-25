/**
 * 客户分析完整工作流
 * 严格遵循 customer-analysis skill v2.8 的 6 Phase 流程
 */
import { callModel } from './client';
import { writeCustomerReport } from './writer';
import { getDb } from '@/lib/db';
import { createActivity } from './crm';

export interface PhaseCallback {
  onPhase: (phase: string, text: string) => void;
  onChunk: (text: string) => void;
  onModuleDone: (module: string, summary: string) => void;
  onDone: (result: WorkflowResult) => void;
  onError: (err: string) => void;
}

export interface WorkflowResult {
  customerId: number;
  docPath: string;
  reportPath: string;
  summary: string; // CP-9 执行摘要
  wordCount: number;
}

// =====================
// PROMPTS（从 skill 提取的核心内容）
// =====================

const SYS_INTAKE = `你是一个B2B销售调研助手。请对目标客户进行初步信息收集与调研规划。

任务：
1. 根据客户名称「{customer}」，生成该客户的初步信息摘要
2. 列出已知的客户信息
3. 列出信息缺口清单（需要进一步调研的内容）
4. 生成后续深度调研的关键词

输出格式（严格按此JSON格式）：
{
  "已知信息": ["..."],
  "信息缺口": ["..."],
  "调研关键词": ["...", "..."],
  "初步判断": "一句话判断客户特征"
}

只返回JSON，不要其他文字。`;

const SYS_CP1 = `你是一个资深的企业分析专家。请分析客户的企业概要。

分析维度：
1. 企业基础信息（成立时间、总部位置、上市情况、员工规模、主营业务）
2. 企业简介（一段话描述企业）
3. 发展历程与里程碑（至少3个里程碑）
4. 股权结构（主要股东及背景）

字数要求：不少于800字
格式：Markdown，标题用###
数据无法核实时标注⚠️待确认`;

const SYS_CP2 = `你是一个行业分析专家。请对客户所在行业进行PEST和竞争格局分析。

分析维度：
1. PEST分析（政治/经济/社会/技术四维度）
2. 行业概览（定义、分类、发展阶段、市场集中度）
3. 市场规模与增长（具体数字+增速）
4. 行业驱动因素（至少3个）
5. 行业发展趋势（至少2个）
6. 行业进入壁垒（资金/技术/资质/渠道/品牌）

字数要求：不少于1500字
格式：Markdown，标题用###
数据无法核实时标注⚠️待确认`;

const SYS_CP3 = `你是一个战略咨询顾问。请分析客户的战略定位和发展战略。

分析维度：
1. 使命与愿景
2. 战略目标（短期/中期/长期）
3. 战略重点与布局
4. 核心竞争力/护城河分析
5. 最新战略动向

字数要求：不少于800字
格式：Markdown，标题用###
数据无法核实时标注⚠️待确认`;

const SYS_CP4 = `你是一个业务分析专家。请分析客户的商业模式和业务表现。

分析维度：
1. 商业模式画布（客户细分/价值主张/渠道/客户关系/收入来源/核心资源/关键活动/成本结构）
2. 产品矩阵（主要产品线及定位）
3. 目标客户（TO B/TO C，行业分布）
4. 渠道布局（直销/经销/线上/线下）
5. 财务表现（营收/利润/增速，如果是非上市公司则基于公开信息估算）

字数要求：不少于1000字
格式：Markdown，标题用###
数据无法核实时标注⚠️待确认`;

const SYS_CP5 = `你是一个竞争战略分析师。请分析客户的竞争格局和SWOT。

分析维度：
1. 主要竞争对手（列出3-5家）
2. 竞争格局分析（市场集中度、梯队分布）
3. 我方竞争优势 vs 主要竞争对手
4. SWOT分析（Strengths/Weaknesses/Opportunities/Threats）

字数要求：不少于800字
格式：Markdown，标题用###
数据无法核实时标注⚠️待确认`;

const SYS_CP6 = `你是一个销售痛点专家。请深入分析客户的痛点和挑战。

分析维度（7大类痛点，每类都要分析）：
1. 经营痛点（增收不增利、份额下滑、增长乏力）
2. 产品痛点（同质化、研发周期长、体验差）
3. 供应链痛点（中断、涨价、积压）
4. 销售痛点（获客成本高、客户流失、效率低）
5. 财务痛点（现金流紧张、融资困难、ROI低）
6. 管理痛点（效率低、人才流失、流程长）
7. IT/数字化痛点（系统割裂、数据孤岛、数字化程度低）

每个痛点需评估：严重程度（高/中/低）、紧迫程度（高/中/低）、与我方关联（能解决/部分解决/不能解决）

字数要求：不少于1500字
格式：Markdown，标题用###
数据无法核实时标注⚠️待确认`;

const SYS_CP7 = `你是一个组织诊断专家。请分析客户的组织架构和关键决策人。

分析维度：
1. 组织架构（整体架构、部门设置）
2. 高管团队（CEO/CFO/COO/CTO等主要高管及背景）
3. 决策链（谁做采购决策、谁影响决策、谁执行）
4. 管理风格与文化
5. 供应商管理特点

字数要求：不少于800字
格式：Markdown，标题用###
数据无法核实时标注⚠️待确认`;

const SYS_CP8 = `你是一个采购战略顾问。请分析客户的采购模式和决策链。

分析维度：
1. 采购模式（集中采购/分散采购/框架协议）
2. 采购流程（需求提出/供应商评估/合同签署/执行验收）
3. 决策链分析（EB/UB/TB视角）
   - Economic Buyer（经济决策人）
   - User Buyer（使用方决策人）
   - Technical Buyer（技术评估人）
4. 决策周期（从需求提出到签约的典型周期）
5. 采购评估标准（技术/价格/服务/关系）
6. 部门利益分析（使用部门vs采购部门vs财务部门的不同诉求）

字数要求：不少于800字
格式：Markdown，标题用###
数据无法核实时标注⚠️待确认`;

const SYS_CP9 = `你是一个销售汇报专家。请基于以下各模块分析，生成客户分析报告的执行摘要。

必须包含：
1. 一句话客户评价（精准有力，一句话概括客户核心特征）
2. 核心数据一览表（成立时间/员工规模/行业地位/年营收/毛利率等）
3. Top 5 关键发现（不是事实罗列，要有洞察）
4. Top 3 风险提示（具体场景+影响程度+发生概率）
5. 信息缺口清单（⚠️标注待确认项）
6. 销售建议（3-5条，具体可操作）

字数要求：不少于500字
格式：Markdown，标题用###
数据无法核实时标注⚠️待确认`;

const SYS_AP = `你是一个销售规划专家。请基于以下分析，制定客户规划和行动策略。

必须包含：
1. 商机关联度评估（需求匹配度/市场价值/竞争位势/决策链复杂度/时间窗口/预算态度，综合评级A/B/C）
2. 我方价值主张（针对识别出的痛点，我方如何帮助客户）
3. 竞争优势（我方 vs 主要竞争对手的3个核心优势）
4. 障碍与风险（进入的主要障碍）
5. 行动计划（按优先级P0/P1/P2列出具体行动项、负责人、截止日期）
6. 成功指标（3个月/6个月/12个月指标）

字数要求：不少于1000字
格式：Markdown，标题用###
数据无法核实时标注⚠️待确认`;

// =====================
// 工作流执行
// =====================

export async function runCustomerAnalysisWorkflow(
  customerName: string,
  cb: PhaseCallback
) {
  const db = getDb();

  try {
    // ===== Phase 1: Intake =====
    cb.onPhase('intake', '正在收集客户初步信息...');

    const intakeResult = await callModel('claude-sonnet-4-6', [{
      role: 'user',
      content: `客户名称：${customerName}`
    }], SYS_INTAKE.replace('{customer}', customerName), 2000);

    let intakeData = { 已知信息: [], 信息缺口: [], 调研关键词: [customerName], 初步判断: '' };
    try {
      intakeData = JSON.parse(intakeResult.content.trim());
    } catch { /* ignore */ }

    cb.onPhase('intake_done', `初步调研完成，发现${intakeData.信息缺口.length}个信息缺口`);

    // ===== Phase 2: 分批分析 =====

    // Batch 1 (并行): CP-1, CP-2, CP-7
    cb.onPhase('batch1', '正在分析企业概况、行业、组织架构...');

    const [cp1, cp2, cp7] = await Promise.all([
      callModel('claude-sonnet-4-6', [{ role: 'user', content: `客户名称：${customerName}\n已知信息：${intakeData.已知信息.join('；')}` }], SYS_CP1, 3000),
      callModel('claude-sonnet-4-6', [{ role: 'user', content: `客户名称：${customerName}\n初步判断：${intakeData.初步判断}` }], SYS_CP2, 4000),
      callModel('claude-sonnet-4-6', [{ role: 'user', content: `客户名称：${customerName}` }], SYS_CP7, 3000),
    ]);

    cb.onModuleDone('CP-1 企业概要', cp1.content.substring(0, 100) + '...');
    cb.onModuleDone('CP-2 行业分析', cp2.content.substring(0, 100) + '...');
    cb.onModuleDone('CP-7 组织分析', cp7.content.substring(0, 100) + '...');

    // Batch 2: CP-3, CP-8 并行（不依赖 cp4）
    cb.onPhase('batch2', '正在分析战略和采购决策链...');

    const [cp3, cp8] = await Promise.all([
      callModel('claude-sonnet-4-6', [{ role: 'user', content: `客户名称：${customerName}\n企业概要：${cp1.content.substring(0, 500)}` }], SYS_CP3, 3000),
      callModel('claude-sonnet-4-6', [{ role: 'user', content: `客户名称：${customerName}\n组织分析：${cp7.content.substring(0, 500)}` }], SYS_CP8, 3000),
    ]);
    cb.onModuleDone('CP-3 客户战略', cp3.content.substring(0, 100) + '...');
    cb.onModuleDone('CP-8 采购决策链', cp8.content.substring(0, 100) + '...');

    // CP-4 和 CP-5 必须串行（CP-5 依赖 CP-4）
    cb.onPhase('batch3', '正在分析业务和竞争格局...');

    const cp4 = await callModel('claude-sonnet-4-6', [{ role: 'user', content: `客户名称：${customerName}\n企业概要：${cp1.content.substring(0, 500)}\n行业分析：${cp2.content.substring(0, 500)}` }], SYS_CP4, 4000);
    cb.onModuleDone('CP-4 业务分析', cp4.content.substring(0, 100) + '...');

    const cp5 = await callModel('claude-sonnet-4-6', [{ role: 'user', content: `客户名称：${customerName}\n行业分析：${cp2.content.substring(0, 500)}\n业务分析：${cp4.content.substring(0, 500)}` }], SYS_CP5, 3000);
    cb.onModuleDone('CP-5 竞争分析', cp5.content.substring(0, 100) + '...');

    // Batch 3 (顺序): CP-6, CP-9
    cb.onPhase('batch4', '正在分析痛点和生成执行摘要...');

    const cp6 = await callModel('claude-sonnet-4-6', [{
      role: 'user',
      content: `客户名称：${customerName}\n战略：${cp3.content.substring(0, 400)}\n业务：${cp4.content.substring(0, 400)}\n竞争：${cp5.content.substring(0, 400)}\n采购：${cp8.content.substring(0, 400)}`
    }], SYS_CP6, 4000);
    cb.onModuleDone('CP-6 痛点分析', cp6.content.substring(0, 100) + '...');

    const cp9 = await callModel('claude-sonnet-4-6', [{
      role: 'user',
      content: `客户名称：${customerName}
CP-1 企业概要：${cp1.content.substring(0, 600)}
CP-2 行业分析：${cp2.content.substring(0, 600)}
CP-3 客户战略：${cp3.content.substring(0, 400)}
CP-4 业务分析：${cp4.content.substring(0, 400)}
CP-5 竞争分析：${cp5.content.substring(0, 400)}
CP-6 痛点分析：${cp6.content.substring(0, 600)}
CP-7 组织分析：${cp7.content.substring(0, 400)}
CP-8 采购决策链：${cp8.content.substring(0, 400)}`
    }], SYS_CP9, 2000);
    cb.onModuleDone('CP-9 执行摘要', cp9.content.substring(0, 100) + '...');

    // AP (客户规划)
    cb.onPhase('ap', '正在生成客户规划...');

    const ap = await callModel('claude-sonnet-4-6', [{
      role: 'user',
      content: `客户名称：${customerName}
CP-1 企业概要：${cp1.content.substring(0, 400)}
CP-3 客户战略：${cp3.content.substring(0, 400)}
CP-4 业务分析：${cp4.content.substring(0, 400)}
CP-5 竞争分析：${cp5.content.substring(0, 400)}
CP-6 痛点分析：${cp6.content.substring(0, 600)}
CP-8 采购决策链：${cp8.content.substring(0, 400)}
CP-9 执行摘要：${cp9.content}`
    }], SYS_AP, 4000);
    cb.onModuleDone('AP 客户规划', ap.content.substring(0, 100) + '...');

    // ===== Phase 3: 组装完整报告 + 流式输出 =====
    cb.onPhase('report', '正在组装完整报告...');

    const fullReport = `# ${customerName} 客户分析报告

> 报告日期：${new Date().toISOString().split('T')[0]}
> 分析框架：华为 CP/VP/AP + McKinsey 方法论
> ⚠️ 数据无法核实的标注待确认

---

## 执行摘要
${cp9.content}

---

## 一、企业概况

### CP-1 企业概要
${cp1.content}

---

### CP-7 组织分析
${cp7.content}

---

## 二、行业分析

### CP-2 宏观与行业分析
${cp2.content}

---

## 三、客户战略

### CP-3 战略定位与发展战略
${cp3.content}

---

## 四、业务分析

### CP-4 商业模式与业务表现
${cp4.content}

---

## 五、竞争分析

### CP-5 竞争格局与SWOT
${cp5.content}

---

## 六、痛点分析

### CP-6 客户痛点与挑战
${cp6.content}

---

## 七、采购与决策链

### CP-8 采购模式与决策链
${cp8.content}

---

## 八、客户规划

### AP 客户规划与行动策略
${ap.content}

---

## 九、信息缺口

| 信息缺口 | 重要性 | 获取方式 |
|---------|--------|---------|
${intakeData.信息缺口.map((g: string) => `| ${g} | 中 | 待调研 |`).join('\n')}

---

*报告由小悦 AI 助手生成 · ${new Date().toLocaleDateString('zh-CN')}*
`;

    const wordCount = fullReport.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').length;

    // 从报告中提取结构化字段
    cb.onPhase('extract', '正在提取客户字段...');
    const extracted = await extractCustomerFields(customerName, fullReport);

    // ===== Phase 4: 归档 =====
    cb.onPhase('archive', '正在归档报告到 Obsidian...');

    // 写入 Obsidian
    const writeResult = await writeCustomerReport(customerName, {
      report: fullReport,
      currentPosition: intakeData.初步判断 || '待评估',
      valueProposition: '待评估',
      actionPlan: '待评估',
    });

    // 写入 SQLite
    let customer = db.prepare('SELECT * FROM customers WHERE name LIKE ?').get(`%${customerName}%`) as any;
    let customerId: number;
    if (customer) {
      db.prepare(`
        UPDATE customers
        SET doc_path = ?, updated_at = datetime('now', 'localtime'),
            industry = COALESCE(?, industry),
            size = COALESCE(?, size),
            region = COALESCE(?, region),
            website = COALESCE(?, website)
        WHERE id = ?
      `).run(writeResult.docPath, extracted.industry, extracted.size, extracted.region, extracted.website, customer.id);
      customerId = customer.id;
    } else {
      const { upsertCustomer } = await import('./crm');
      customerId = upsertCustomer({
        name: customerName,
        doc_path: writeResult.docPath,
        industry: extracted.industry,
        size: extracted.size,
        region: extracted.region,
        website: extracted.website,
      });
    }

    // 创建活动记录
    createActivity({
      type: '客户分析',
      summary: `分析报告：${customerName}`,
      customer_id: customerId,
      doc_path: writeResult.reportPath,
    });

    // 验证写入结果
    const verify = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    console.log('[workflow] 客户写入结果:', customerName, {
      industry: verify.industry,
      size: verify.size,
      region: verify.region,
      website: verify.website,
    });

    // ===== Phase 5: 完成 =====
    cb.onDone({
      customerId,
      docPath: writeResult.docPath,
      reportPath: writeResult.reportPath,
      summary: cp9.content.substring(0, 200),
      wordCount,
    });

  } catch (e: any) {
    cb.onError(e.message);
  }
}

// 从完整报告文本中提取结构化客户字段
async function extractCustomerFields(customerName: string, report: string): Promise<{
  industry: string | undefined;
  size: string | undefined;
  region: string | undefined;
  website: string | undefined;
}> {
  const system = `你是一个数据提取助手。从以下客户分析报告中提取关键字段。
只返回JSON，如果某字段在报告中找不到对应信息则返回 null：

{
  "industry": "行业，如：人工智能、软件、制造业等",
  "size": "规模，如：200-500人、上市公司、民营企业等",
  "region": "地区/总部，如：上海、北京、广东深圳等",
  "website": "官网URL，如果没有则 null"
}

只返回JSON。`;

  try {
    const result = await callModel('claude-sonnet-4-6', [{
      role: 'user',
      content: `客户名称：${customerName}\n\n报告内容：\n${report.substring(0, 4000)}`
    }], system, 500);

    const parsed = JSON.parse(result.content.trim());
    const extracted = {
      industry: parsed.industry || undefined,
      size: parsed.size || undefined,
      region: parsed.region || undefined,
      website: parsed.website || undefined,
    };
    console.log('[extractCustomerFields]', customerName, extracted);
    return extracted;
  } catch (e) {
    console.error('[extractCustomerFields] failed:', e);
    return { industry: undefined, size: undefined, region: undefined, website: undefined };
  }
}
