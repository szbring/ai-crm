"use client";

import { useEffect, useState } from "react";

interface Opportunity {
  id: number;
  name: string;
  stage: string;
  customer_name: string;
  amount: number | null;
  close_date: string | null;
  next_action: string | null;
}

interface Customer {
  id: number;
  name: string;
}

const STAGE_LABELS: Record<string, string> = {
  S1: "线索验证", S2: "需求与方案", S3: "谈判与合同", S4: "交付/关闭", S0: "终止",
};

const STAGES = ["S1", "S2", "S3", "S4", "S0"];

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", stage: "S1", customer_id: "", amount: "", close_date: "", next_action: "" });

  const load = () => {
    fetch("/api/opportunities").then((r) => r.json()).then(setOpportunities);
  };

  useEffect(() => {
    load();
    fetch("/api/customers").then((r) => r.json()).then(setCustomers);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        stage: form.stage,
        customer_id: form.customer_id || null,
        amount: form.amount ? parseFloat(form.amount) * 10000 : null,
        close_date: form.close_date || null,
        next_action: form.next_action || null,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", stage: "S1", customer_id: "", amount: "", close_date: "", next_action: "" });
      load();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">商机列表</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          + 新建商机
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 mb-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商机名称 *</label>
              <input
                type="text" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm" placeholder="例：思源电气数字化项目"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">关联客户</label>
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">— 无 —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">阶段</label>
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm">
                {STAGES.map((s) => <option key={s} value={s}>{s} {STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">预估金额（万元）</label>
              <input type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm" placeholder="例：500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">预计成交日期</label>
              <input type="date" value={form.close_date}
                onChange={(e) => setForm({ ...form, close_date: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">下一步行动</label>
              <input type="text" value={form.next_action}
                onChange={(e) => setForm({ ...form, next_action: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm" placeholder="例：安排技术交流"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">创建</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">商机名称</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">客户</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">阶段</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">预估金额</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">下一步行动</th>
              <th className="px-4 py-3 font-medium text-gray-600 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((o) => (
              <tr key={o.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a href={`/opportunities/${o.id}`} className="text-blue-600 hover:underline font-medium">{o.name}</a>
                </td>
                <td className="px-4 py-3 text-gray-600">{o.customer_name || "—"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                    {o.stage} {STAGE_LABELS[o.stage] || ""}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{o.amount ? `¥${(o.amount / 10000).toFixed(0)}万` : "—"}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{o.next_action || "—"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!confirm(`确定删除「${o.name}」？`)) return;
                      await fetch(`/api/opportunities/${o.id}`, { method: 'DELETE' });
                      setOpportunities(opportunities.filter(x => x.id !== o.id));
                    }}
                    className="text-red-400 hover:text-red-600 text-sm"
                    title="删除"
                  >🗑</button>
                </td>
              </tr>
            ))}
            {opportunities.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">暂无商机，点击「新建商机」开始</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
