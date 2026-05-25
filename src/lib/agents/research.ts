import { callModel, MODEL, Message } from './client';

export interface ResearchResult {
  customerInfo: string;
  industryInfo: string;
  competitorInfo: string;
}

/**
 * 调研 Agent - 收集客户、行业、竞品信息
 */
export async function researchCustomer(customerName: string, industry?: string): Promise<ResearchResult> {
  // 用 Claude 的深度思考能力来"模拟"搜索+分析
  // 实际生产中这里可以接天眼查、行业协会网站等数据源
  const system = `你是一个B2B销售调研助手。请对目标客户进行深度调研，生成一份结构化的调研简报。

调研维度：
1. 企业基本信息（成立时间、注册资本、总部、股东背景）
2. 主营业务与产品矩阵
3. 行业地位与市场份额
4. 最新动态与战略动向
5. 主要竞争对手
6. 潜在痛点与需求

请基于你对中国商业环境的了解，提供合理的信息（如果是假设的，用⚠️标注）。
格式要求：用清晰的markdown结构输出，每条信息标注来源或置信度。`;

  const result = await callModel(MODEL, [{
    role: 'user',
    content: `请调研客户：${customerName}${industry ? `，行业：${industry}` : ''}`
  }], system, 4000);

  return {
    customerInfo: result.content,
    industryInfo: '',  // 可以后续扩展
    competitorInfo: '', // 可以后续扩展
  };
}

/**
 * 市场调研 Agent
 */
export async function researchMarket(industry: string): Promise<string> {
  const system = `你是一个行业分析专家。请分析以下行业的：
1. 行业规模与增速
2. 政策环境（PEST）
3. 竞争格局（头部玩家、市场集中度）
4. 发展趋势与机会

用简洁的markdown格式输出。`;

  const result = await callModel(MODEL, [{ role: 'user', content: `行业：${industry}` }], system, 3000);
  return result.content;
}
