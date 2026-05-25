"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Customer {
  id: number;
  name: string;
  industry: string | null;
  size: string | null;
  region: string | null;
  website: string | null;
  status: string;
  doc_path: string | null;
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", industry: "", size: "", region: "", website: "" });
  const [id, setId] = useState<string>("");

  useEffect(() => {
    params.then((p) => {
      setId(p.id);
      fetch(`/api/customers/${p.id}`).then((r) => r.json()).then((c) => {
        setCustomer(c);
        // 如果已有 doc_path，加载已有报告
        if (c.doc_path) {
          loadReport(c.doc_path);
        }
      });
      fetch(`/api/contacts?customer_id=${p.id}`).then((r) => r.json()).then(setContacts);
      fetch(`/api/activities?customer_id=${p.id}`).then((r) => r.json()).then(setActivities);
    });
  }, [params]);

  const loadReport = async (docPath: string) => {
    setReportLoading(true);
    try {
      // 查找最新的分析报告文件
      const resp = await fetch(`/api/vault?path=${encodeURIComponent(docPath)}`);
      const data = await resp.json();
      if (data.content) {
        // 找到最新的报告文件
        const filesResp = await fetch(`/api/vault/list?path=${encodeURIComponent(docPath)}`);
        const filesData = await filesResp.json();
        const reportFiles = (filesData.files || []).filter((f: string) => f.includes('客户分析报告'));
        if (reportFiles.length > 0) {
          const latest = reportFiles.sort().reverse()[0];
          const reportResp = await fetch(`/api/vault?path=${encodeURIComponent(docPath + '/' + latest)}`);
          const reportData = await reportResp.json();
          if (reportData.content) {
            setReport(reportData.content);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load report:', e);
    } finally {
      setReportLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!customer) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `帮我分析${customer.name}` }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === "done") {
                // 分析完成，重新加载报告和客户信息
                fetch(`/api/customers/${id}`).then((r) => r.json()).then(setCustomer);
                fetch(`/api/activities?customer_id=${id}`).then((r) => r.json()).then(setActivities);
              }
              if (event.type === "error") {
                alert("分析失败: " + event.message);
              }
            } catch { /* ignore */ }
          }
        }
      }
    } finally {
      setAnalyzing(false);
    }
  };

  if (!customer) return <div className="text-gray-400">加载中...</div>;

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* 左侧：客户信息 */}
      <div className="col-span-1 space-y-4">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
            {!editing ? (
              <button
                onClick={() => {
                  setEditForm({
                    name: customer.name || "",
                    industry: customer.industry || "",
                    size: customer.size || "",
                    region: customer.region || "",
                    website: customer.website || "",
                  });
                  setEditing(true);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                ✏️ 编辑
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/customers/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(editForm),
                    });
                    if (res.ok) {
                      const updated = await res.json();
                      setCustomer(updated);
                      setEditing(false);
                    }
                  }}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  ✓ 保存
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  取消
                </button>
              </div>
            )}
          </div>
          {editing ? (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <dt className="text-gray-500 w-16 shrink-0">名称</dt>
                <dd className="flex-1"><input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" placeholder="公司名称" /></dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-gray-500 w-16 shrink-0">行业</dt>
                <dd className="flex-1"><input value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" placeholder="如：人工智能" /></dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-gray-500 w-16 shrink-0">规模</dt>
                <dd className="flex-1"><input value={editForm.size} onChange={e => setEditForm(f => ({ ...f, size: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" placeholder="如：200-500人" /></dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-gray-500 w-16 shrink-0">地区</dt>
                <dd className="flex-1"><input value={editForm.region} onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" placeholder="如：上海" /></dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-gray-500 w-16 shrink-0">官网</dt>
                <dd className="flex-1"><input value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" placeholder="如：https://..." /></dd>
              </div>
            </dl>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">行业</dt><dd>{customer.industry || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">规模</dt><dd>{customer.size || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">地区</dt><dd>{customer.region || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">官网</dt><dd>{customer.website || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">状态</dt><dd>{customer.status}</dd></div>
              {customer.doc_path && <div className="flex justify-between"><dt className="text-gray-500">报告</dt><dd className="text-green-600">✓ 已生成</dd></div>}
            </dl>
          )}
        </div>

        {/* 联系人 */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-gray-900 mb-3">联系人</h2>
          {contacts.length === 0 ? (
            <div className="text-sm text-gray-400">暂无</div>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="text-sm">
                  <div className="font-medium">{c.name} <span className="text-gray-400">{c.title}</span></div>
                  <div className="text-gray-500">{c.role} {c.phone && `· ${c.phone}`}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 分析按钮 */}
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {analyzing ? "正在分析中..." : "🔍 启动客户分析"}
        </button>

        {/* 删除按钮 */}
        <button
          onClick={async () => {
            if (!confirm("确定删除该客户？关联的商机、联系人和活动记录也会一并删除。")) return;
            const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
            if (res.ok) window.location.href = '/customers';
          }}
          className="w-full px-4 py-3 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
        >
          🗑 删除客户
        </button>
      </div>

      {/* 右侧：报告 + 活动记录 */}
      <div className="col-span-2 space-y-4">
        {/* 分析报告 */}
        {(report || reportLoading || customer.doc_path) && (
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">客户分析报告</h2>
              {report && (
                <a
                  href={`/api/vault?path=${encodeURIComponent(customer.doc_path || '')}`}
                  target="_blank"
                  className="text-xs text-indigo-600 hover:underline"
                >
                  在 Obsidian 中打开 →
                </a>
              )}
            </div>
            {reportLoading ? (
              <div className="text-sm text-gray-400 py-4">报告加载中...</div>
            ) : report ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-sm text-gray-400 py-4">
                点击「启动客户分析」生成报告
              </div>
            )}
          </div>
        )}

        {/* 活动记录 */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">活动记录</h2>
          {activities.length === 0 ? (
            <div className="text-sm text-gray-400">暂无活动记录</div>
          ) : (
            <div className="space-y-2">
              {activities.map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
                  <span className="text-gray-400 w-20">{a.date}</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{a.type}</span>
                  <span className="text-gray-700">{a.summary}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
