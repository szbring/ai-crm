import { ensureDir, writeDoc } from '@/lib/vault';
import { AnalysisResult } from './analysis';

export interface WriteResult {
  docPath: string;     // 目录路径，如 "客户分析/思源电气"
  reportPath: string;   // 完整文件路径，如 "客户分析/思源电气/客户分析报告_2026-04-17.md"
}

/**
 * 写作 Agent - 将分析结果写入 Obsidian
 */
export async function writeCustomerReport(
  customerName: string,
  analysis: AnalysisResult
): Promise<WriteResult> {
  const today = new Date().toISOString().split('T')[0];
  const shortName = customerName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const dirPath = `客户分析/${shortName}`;
  ensureDir(dirPath);

  // 提取报告正文（去掉可能的JSON部分）
  let reportContent = analysis.report;
  const jsonMatch = reportContent.match(/\{[\s\S]*"currentPosition"[\s\S]*\}/);
  if (jsonMatch) {
    reportContent = reportContent.replace(jsonMatch[0], '').trim();
  }

  // 生成 frontmatter
  const frontmatter = `---
type: customer-analysis
customer: "${customerName}"
analysis_date: "${today}"
cp: "${analysis.currentPosition.replace(/"/g, '\\"')}"
vp: "${analysis.valueProposition.replace(/"/g, '\\"')}"
ap: "${analysis.actionPlan.replace(/"/g, '\\"')}"
---\n\n`;

  const reportPath = `${dirPath}/客户分析报告_${today}.md`;
  writeDoc(reportPath, frontmatter + reportContent);

  // 同时写一份客户画像（单页摘要）
  const portrait = `---
type: customer-portrait
customer: "${customerName}"
date: "${today}"
---

# ${customerName} 客户画像

## 一句话评价
${extractOneLiner(analysis.report)}

## CP（当前位置）
${analysis.currentPosition}

## VP（我们的价值）
${analysis.valueProposition}

## AP（行动计划）
${analysis.actionPlan}
`;
  writeDoc(`${dirPath}/客户画像.md`, portrait);

  return { docPath: dirPath, reportPath };
}

function extractOneLiner(report: string): string {
  // 尝试从报告开头提取"一句话评价"
  const match = report.match(/\*\*[^*]+\*\*/);
  return match ? match[0].replace(/\*\*/g, '') : '待评估';
}

/**
 * 商机文档写入
 */
export async function writeOpportunityDocs(
  opportunityName: string,
  parsed: {
    stage?: string;
    amount?: number;
    closeDate?: string;
    nextAction?: string;
    contacts?: { name: string; title?: string; phone?: string; email?: string; role?: string }[];
  }
): Promise<WriteResult> {
  const shortName = opportunityName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const dirPath = `商机/${shortName}`;
  ensureDir(dirPath);

  const today = new Date().toISOString().split('T')[0];

  // 00_项目概况
  const overview = `---
type: opportunity-overview
name: "${opportunityName}"
stage: "${parsed.stage || 'S1'}"
amount: ${parsed.amount || 0}
close_date: "${parsed.closeDate || ''}"
created: "${today}"
---

# ${opportunityName}

## 基本信息
| 字段 | 值 |
|------|-----|
| 商机名称 | ${opportunityName} |
| 阶段 | ${parsed.stage || 'S1'} |
| 预估金额 | ${parsed.amount ? `${(parsed.amount / 10000).toFixed(0)}万元` : '待评估'} |
| 预计成交 | ${parsed.closeDate || '待确定'} |
| 下一步行动 | ${parsed.nextAction || '待跟进'} |

## 项目概况
（待补充）

## 关键里程碑
（待补充）

## 风险与挑战
（待补充）
`;
  writeDoc(`${dirPath}/00_项目概况.md`, overview);

  // 联系人
  if (parsed.contacts && parsed.contacts.length > 0) {
    const contactsContent = `---
type: contacts
opportunity: "${opportunityName}"
---

# ${opportunityName} - 联系人

${parsed.contacts.map((c, i) => `
## ${i + 1}. ${c.name}
- 职位：${c.title || '未知'}
- 角色：${c.role || '未知'}
- 电话：${c.phone || '未知'}
- 邮箱：${c.email || '未知'}
`).join('\n')}
`;
    writeDoc(`${dirPath}/01_联系人.md`, contactsContent);
  }

  return { docPath: dirPath, reportPath: `${dirPath}/00_项目概况.md` };
}
