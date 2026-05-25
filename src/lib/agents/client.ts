import https from 'https';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  content: string;
  thinking?: string;
}

async function anthropicRequest(
  model: string,
  maxTokens: number,
  messages: Message[],
  system?: string
): Promise<AgentResponse> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
  };
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
              return;
            }

            // 提取文本内容
            const textBlock = parsed.content?.find((c: any) => c.type === 'text');
            const thinkingBlock = parsed.content?.find((c: any) => c.type === 'thinking');

            resolve({
              content: textBlock?.text || '',
              thinking: thinkingBlock?.thinking,
            });
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

export async function callModel(
  model: string,
  messages: Message[],
  system?: string,
  maxTokens = 8000
): Promise<AgentResponse> {
  return anthropicRequest(model, maxTokens, messages, system);
}

/**
 * 流式调用模型，返回 ReadableStream
 */
export function streamModel(
  model: string,
  messages: Message[],
  system?: string,
  maxTokens = 8000
): ReadableStream {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
    stream: true,
  };
  if (system) body.system = system;

  const data = JSON.stringify(body);

  const https = require('https');
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
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
        (res: any) => {
          res.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') {
                  try { controller.close(); } catch { /* already closed */ }
                  return;
                }
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.type === 'content_block_delta') {
                    const text = parsed.delta?.text;
                    if (text) {
                      // 包装成 SSE 事件
                      const sse = `data: ${JSON.stringify({ type: 'text', text })}\n`;
                      controller.enqueue(encoder.encode(sse));
                    }
                  }
                } catch {
                  // ignore parse errors for keep-alive frames
                }
              }
            }
          });
          res.on('end', () => {
            try { controller.close(); } catch { /* already closed */ }
          });
          res.on('error', (err: Error) => {
            try { controller.error(err); } catch { /* already closed */ }
          });
        }
      );
      req.on('error', (err: Error) => {
        try { controller.error(err); } catch { /* already closed */ }
      });
      req.write(data);
      req.end();
    },
  });
}

export const MODEL = 'claude-sonnet-4-6';
export const MODEL_THINKING = 'claude-opus-4-6';
