"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Opportunity {
  id: number;
  name: string;
  stage: string;
  customer_name: string;
  customer_id: number | null;
  amount: number | null;
  close_date: string | null;
  next_action: string | null;
  doc_path: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  S1: "线索验证", S2: "需求与方案", S3: "谈判与合同", S4: "交付/关闭", S0: "终止",
};

const STAGE_COLORS: Record<string, string> = {
  S1: "bg-blue-100 text-blue-700", S2: "bg-yellow-100 text-yellow-700",
  S3: "bg-orange-100 text-orange-700", S4: "bg-green-100 text-green-700",
  S0: "bg-gray-100 text-gray-600",
};

const STAGES = ["S1", "S2", "S3", "S4", "S0"];

export default function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [overview, setOverview] = useState<string | null>(null);
  const [id, setId] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ stage: "", amount: "", close_date: "", next_action: "" });

  useEffect(() => {
    params.then((p) => {
      setId(p.id);
      loadOpp(p.id);
      fetch(`/api/contacts?opportunity_id=${p.id}`).then((r) => r.json()).then(setContacts);
      fetch(`/api/activities?opportunity_id=${p.id}`).then((r) => r.json()).then(setActivities);
    });
  }, [params]);

  const loadOpp = (oid: string) => {
    fetch(`/api/opportunities/${oid}`).then((r) => r.json()).then((data) => {
      setOpp(data);
      setEditForm({
        stage: data.stage,
        amount: data.amount ? (data.amount / 10000).toString() : "",
        close_date: data.close_date || "",
        next_action: data.next_action || "",
      });
    });
  };

  // 读取 Obsidian vault 中的项目概况
  useEffect(() => {
    if (opp?.doc_path) {
      fetch(`/api/vault?path=${encodeURIComponent(opp.doc_path + "/00_项目概况.md")}`)
        .then((r) => r.json())
        .then((data) => { if (data.content) setOverview(data.content); });
    }
  }, [opp?.doc_path]);

  const handleSave = async () => {
    await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage: editForm.stage,
        amount: editForm.amount ? parseFloat(editForm.amount) * 10000 : null,
        close_date: editForm.close_date || null,
        next_action: editForm.next_action || null,
      }),
    });
    setEditing(false);
    loadOpp(id);
  };

  const handleAddActivity = async () => {
    const summary = prompt("活动摘要：");
    if (!summary) return;
    const type = prompt("活动类型（如：会议、电话、邮件）：", "会议") || "会议";
    await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        date: new Date().toISOString().split("T")[0],
        opportunity_id: parseInt(id),
        customer_id: opp?.customer_id || null,
        summary,
      }),
    });
    fetch(`/api/activities?opportunity_id=${id}`).then((r) => r.json()).then(setActivities);
  };

  if (!opp) return <div className="text-gray-400">加载中...</div>;

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* 左侧：商机信息 */}
      <div className="col-span-1 space-y-4">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">{opp.name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs ${STAGE_COLORS[opp.stage] || "bg-gray-100"}`}>
              {opp.stage} {STAGE_LABELS[opp.stage]}
            </span>
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">阶段</label>
                <select value={editForm.stage} onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm">
                  {STAGES.map((s) => <option key={s} value={s}>{s} {STAGE_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">预估金额（万元）</label>
                <input type="number" value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">预计成交日期</label>
                <input type="date" value={editForm.close_date}
                  onChange={(e) => setEditForm({ ...editForm, close_date: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">下一步行动</label>
                <input type="text" value={editForm.next_action}
                  onChange={(e) => setEditForm({ ...editForm, next_action: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">保存</button>
                <button onClick={() => setEditing(false)} className="flex-1 px-3 py-2 text-gray-600 border rounded-md text-sm">取消</button>
              </div>
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">客户</dt><dd>{opp.customer_name || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">预估金额</dt><dd>{opp.amount ? `¥${(opp.amount / 10000).toFixed(0)}万` : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">预计成交</dt><dd>{opp.close_date || "—"}</dd></div>
              <div className="mt-3 pt-3 border-t"><dt className="text-gray-500 mb-1">下一步行动</dt><dd className="text-gray-900">{opp.next_action || "—"}</dd></div>
            </dl>
          )}

          {!editing && (
            <button onClick={() => setEditing(true)}
              className="w-full mt-4 px-3 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50">
              编辑商机
            </button>
          )}
        </div>

        {/* 联系人 */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-gray-900 mb-3">关键联系人</h2>
          {contacts.length === 0 ? (
            <div className="text-sm text-gray-400">暂无</div>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="text-sm">
                  <div className="font-medium">{c.name} <span className="text-gray-400">{c.title}</span></div>
                  <div className="text-gray-500">{c.role}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleAddActivity}
          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + 记录活动
        </button>

        <button onClick={async () => {
          if (!confirm("确定删除该商机？关联的联系人、活动记录也会一并删除。")) return;
          const res = await fetch(`/api/opportunities/${id}`, { method: 'DELETE' });
          if (res.ok) window.location.href = '/opportunities';
        }}
          className="w-full px-4 py-3 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">
          🗑 删除商机
        </button>
      </div>

      {/* 右侧：项目概况文档 + 活动记录 */}
      <div className="col-span-2 space-y-4">
        {overview && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">项目概况</h2>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{overview}</ReactMarkdown>
            </div>
          </div>
        )}

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
