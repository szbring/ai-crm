import { NextRequest } from 'next/server';
import { runCustomerAnalysisWorkflow, PhaseCallback } from '@/lib/agents/workflow';

export const runtime = 'nodejs';

// 客户分析流式接口：使用 skill v2.8 完整工作流
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 直接把原始消息传给 workflow，让 LLM 自己理解意图和提取客户名
    const customerName = message.trim();

    if (!customerName) {
      return new Response(JSON.stringify({ error: '无法提取客户名' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (type: string, data: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n`));
          } catch { /* stream closed */ }
        };

        const cb: PhaseCallback = {
          onPhase: (phase: string, text: string) => {
            sendEvent('phase', { phase, text });
          },
          onChunk: (text: string) => {
            sendEvent('chunk', { text });
          },
          onModuleDone: (module: string, summary: string) => {
            sendEvent('module_done', { module, summary });
          },
          onDone: (result) => {
            sendEvent('done', { customerName, ...result });
          },
          onError: (err: string) => {
            sendEvent('error', { message: err });
          },
        };

        try {
          sendEvent('start', { customerName });

          await runCustomerAnalysisWorkflow(customerName, cb);

        } catch (e: any) {
          sendEvent('error', { message: e.message });
        } finally {
          try { controller.enqueue(encoder.encode('data: [DONE]\n')); } catch { /* closed */ }
          try { controller.close(); } catch { /* already closed */ }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ ok: false, message: `错误：${msg}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
