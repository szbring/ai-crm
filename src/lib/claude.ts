import https from 'https';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: { type: string; text: string }[];
}

async function anthropicRequest(
  model: string,
  maxTokens: number,
  messages: AnthropicMessage[],
  system?: string
): Promise<AnthropicResponse> {
  const body: Record<string, unknown> = { model, max_tokens: maxTokens, messages };
  if (system) body.system = system;

  const data = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      `${ANTHROPIC_BASE_URL}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => (body += chunk.toString()));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Anthropic API error (${res.statusCode}): ${JSON.stringify(parsed)}`));
            } else {
              resolve(parsed);
            }
          } catch {
            reject(new Error(`Failed to parse Anthropic response: ${body.substring(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

export async function analyzeCustomer(
  customerName: string,
  industry?: string,
  specialRequirements?: string
): Promise<string> {
  const prompt = `你是一位资深的B2B销售分析师，请对以下客户进行深度分析。

客户名称：${customerName}
${industry ? `行业：${industry}` : ''}
${specialRequirements ? `特别要求：${specialRequirements}` : ''}

请按以下结构输出分析报告（markdown格式）：

# ${customerName} 客户分析报告

## 一句话客户评价

## 核心数据一览
| 维度 | 数据 |
|------|------|
| 成立时间 | — |
| 员工规模 | — |
| 行业地位 | — |
| 年营收 | — |

## 企业概况
### 基础信息
### 发展历程
### 股权结构

## 行业分析
### PEST 分析
### 行业规模与增速
### 竞争格局

## 客户战略
### 使命愿景
### 战略目标
### 护城河

## 业务分析
### 商业模式
### 产品矩阵
### 财务表现

## 竞争分析
### 主要竞争对手
### SWOT 分析

## 痛点分析

## 组织分析

## 采购与决策链

## 销售建议

## 风险提示

## 信息缺口

注意：
- 所有数据必须标注来源，如 [来源：公司年报,2023]
- 无法核实的信息标注 ⚠️待确认
- 报告至少 3000 字`;

  const message = await anthropicRequest(
    'claude-sonnet-4-6',
    8000,
    [{ role: 'user', content: prompt }]
  );

  if (!message.content || message.content.length === 0) {
    throw new Error('Empty response from Claude API');
  }

  const block = message.content[0];
  if (block.type !== 'text') {
    throw new Error(`Unexpected response type: ${block.type}`);
  }

  return block.text;
}
