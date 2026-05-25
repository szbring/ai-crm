'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  phase?: string;
  docPath?: string;
  reportPath?: string;
  customerName?: string;
  customerId?: number;
}

const STORAGE_KEY = 'ai-crm-chat-history';

export default function ChatWindow() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('');
  const [currentCustomer, setCurrentCustomer] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false); // 防止 React StrictMode 双重调用

  // 加载历史
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // 保存历史
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    // DOM 更新后滚动到底部
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [messages, currentPhase, open]);

  const clearHistory = () => {
    if (!confirm('确定清除所有对话记录？')) return;
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const isAnalysisRequest = (msg: string) => {
    return /^(分析|帮我分析|帮.*分析|分析一下|查.*客户|查下|查询|帮我查询)/.test(msg.trim());
  };

  const handleSend = async () => {
    const userMsg = input.trim();
    if (!userMsg || loading || pendingRef.current) return;

    pendingRef.current = true;
    setLoading(true);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);

    if (isAnalysisRequest(userMsg)) {
      await handleStreamingAnalysis(userMsg);
    } else {
      await handleNormalChat(userMsg);
    }

    setLoading(false);
    pendingRef.current = false;
  };

  const handleNormalChat = async (userMsg: string) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message || data.error || '处理完成' },
      ]);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `网络错误：${errMsg}` },
      ]);
    }
  };

  const handleStreamingAnalysis = async (userMsg: string) => {
    setCurrentPhase('正在解析任务');
    setCurrentCustomer('');

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'start') {
                setCurrentCustomer(event.customerName);
                setCurrentPhase('正在生成报告');
              } else if (event.type === 'phase') {
                setCurrentPhase(event.text);
              } else if (event.type === 'done') {
                const followUp = `✅ 已完成「${event.customerName}」的分析，报告已归档。
接下来可以：
• 「帮我录入商机：XXX项目」- 将本客户与具体商机关联
• 「查一下${event.customerName}的商机进展」- 查看已有商机状态
• 「分析另一家客户」- 继续分析新客户`;
                setMessages((prev) => [
                  ...prev,
                  {
                    role: 'assistant',
                    content: followUp,
                    docPath: event.docPath,
                    reportPath: event.reportPath,
                    customerName: event.customerName,
                    customerId: event.customerId,
                  },
                ]);
                setCurrentPhase('');
                setCurrentCustomer('');
              } else if (event.type === 'error') {
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: `错误：${event.message}` },
                ]);
                setCurrentPhase('');
                setCurrentCustomer('');
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `网络错误：${errMsg}` },
      ]);
    } finally {
      setCurrentPhase('');
      setCurrentCustomer('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getPhaseDisplay = () => {
    if (!currentPhase) return '';
    return currentPhase;
  };

  return (
    <>
      {/* 悬浮按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 flex items-center justify-center text-2xl z-50"
          title="打开 AI 助手"
        >
          💬
        </button>
      )}

      {/* 聊天窗口 */}
      {open && (
        <div className="fixed bottom-6 right-6 w-[26rem] h-[34rem] bg-white rounded-xl shadow-2xl border flex flex-col z-50">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-indigo-600 rounded-t-xl">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="font-semibold text-white">小悦 · AI 销售助手</span>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-indigo-200 hover:text-white text-xs px-2 py-1 rounded hover:bg-indigo-500"
                  title="清除对话记录"
                >
                  清除
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-indigo-200 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="text-center text-gray-400 text-sm mt-8">
                <p>👋 你好！我是小悦，你的 AI 销售助手</p>
                <p className="mt-2 text-xs">可以说：</p>
                <p className="text-xs">「帮我分析思源电气」</p>
                <p className="text-xs">「录入商机：XX项目」</p>
                <p className="text-xs">「查询XX项目进展」</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                {/* 用户消息 */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-indigo-600 text-white rounded-br-none">
                    <pre className="whitespace-pre-wrap font-sans" style={{ fontFamily: 'inherit' }}>
                      {msg.content}
                    </pre>
                  </div>
                </div>
                {/* 助手消息 */}
                <div className="flex justify-start mt-1">
                  <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-800 rounded-bl-none">
                    <pre className="whitespace-pre-wrap font-sans" style={{ fontFamily: 'inherit' }}>
                      {msg.content}
                    </pre>
                    {msg.reportPath && (
                      <div className="mt-2 text-xs text-indigo-600">
                        📄 报告已存至：{msg.reportPath}
                      </div>
                    )}
                    {msg.customerId ? (
                      <div className="mt-2">
                        <a
                          href={`/customers/${msg.customerId}`}
                          className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                        >
                          → 查看「{msg.customerName}」客户详情 →
                        </a>
                      </div>
                    ) : msg.customerName ? (
                      <div className="mt-2">
                        <a
                          href="/customers"
                          className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                        >
                          → 在客户列表中查看「{msg.customerName}」
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {/* 加载中状态 */}
            {loading && (
              <div className="flex flex-col">
                {currentCustomer && (
                  <div className="text-xs text-gray-500 mb-1 px-1">
                    正在分析：{currentCustomer}
                  </div>
                )}
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-lg rounded-bl-none text-sm">
                    <span>{getPhaseDisplay()}</span>
                    <span className="inline-block animate-pulse ml-1">...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 输入框 */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="说点什么..."
                rows={1}
                className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
