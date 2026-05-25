import { callModel, MODEL, MODEL_THINKING, Message } from './client';
import { ResearchResult } from './research';

export interface AnalysisResult {
  report: string;
  // CP/VP/AP 结构
  currentPosition: string;  // CP：当前位置
  valueProposition: string; // VP：价值主张
  actionPlan: string;       // AP：行动计划
}

/**
 * 分析 Agent - 基于调研结果，生成 CP/VP/AP 结构化分析
 */
export async function analyzeCustomer(
  customerName: string,
  research: ResearchResult,
  params: Record<string, string>
): Promise<AnalysisResult> {
  const specialReq = params.special_requirements || params.requirements || '';

  const system = `你是一个资深的B2B销售分析师，擅长华为系的客户分析方法论。
请基于调研信息，对目标客户进行深度分析，输出结构化的客户分析报告。

## 必须包含以下结构

### 一、客户分析报告（完整版）
用markdown格式，3000字以上，包括：
1. 一句话客户评价
2. 核心数据一览（表格）
3. 企业概况
4. 行业分析（PEST、竞争格局）
5. 客户战略（使命愿景、护城河）
6. 业务分析（商业模式、产品矩阵）
7. 竞争分析（SWOT）
8. 痛点分析
9. 组织分析
10. 采购与决策链
11. 销售建议
12. 风险提示

### 二、CP/VP/AP 摘要（用于CRM系统）
用JSON格式输出：
{
  "currentPosition": "CP - 当前状态定位（客户目前在哪里、面临什么挑战）",
  "valueProposition": "VP - 我们能提供什么价值（我能帮客户解决什么问题）",
  "actionPlan": "AP - 接下来的行动建议（下一步应该做什么）"
}

所有数据必须标注来源。无法核实的信息标注⚠️待确认。`;

  const content = `## 客户名称
${customerName}

## 行业
${params.industry || '未知'}

## 特别要求
${specialReq || '无'}

## 调研结果
${research.customerInfo}

---
请生成完整的客户分析报告。`;

  const result = await callModel(MODEL_THINKING, [{
    role: 'user',
    content
  }], system, 8000);

  // 从报告中提取 CP/VP/AP
  let cpvpap: { currentPosition: string; valueProposition: string; actionPlan: string } = {
    currentPosition: '待分析',
    valueProposition: '待分析',
    actionPlan: '待分析',
  };

  // 尝试从返回内容中提取 JSON
  const jsonMatch = result.content.match(/\{[\s\S]*"currentPosition"[\s\S]*"actionPlan"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      cpvpap = JSON.parse(jsonMatch[0]);
    } catch { /* ignore */ }
  }

  return {
    report: result.content,
    currentPosition: cpvpap.currentPosition,
    valueProposition: cpvpap.valueProposition,
    actionPlan: cpvpap.actionPlan,
  };
}

/**
 * 商机分析 - 判断商机价值和推进策略
 */
export async function analyzeOpportunity(opportunityName: string, description: string): Promise<{
  stage: string;
  amount: number;
  closeDate: string;
  nextAction: string;
  keyInsights: string;
}> {
  const system = `你是一个销售机会评估专家。请分析商机信息，判断：
1. stage: 当前阶段（S1-S4），根据描述判断
2. amount: 预估金额（元），合理估算
3. closeDate: 预计成交日期（YYYY-MM-DD），根据项目周期估算
4. nextAction: 下一步最应该做的事（一句简短的话）
5. keyInsights: 关键洞察（2-3句话）

只返回JSON：{"stage":"S2","amount":500000,"closeDate":"2026-06-30","nextAction":"安排技术交流","keyInsights":"..."}`;

  const result = await callModel(MODEL, [{
    role: 'user',
    content: `商机：${opportunityName}\n描述：${description}`
  }], system, 1500);

  try {
    return JSON.parse(result.content.trim());
  } catch {
    return {
      stage: 'S1',
      amount: 0,
      closeDate: '',
      nextAction: '待跟进',
      keyInsights: '信息不足，待补充',
    };
  }
}
