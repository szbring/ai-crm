"use client";

import { useEffect, useState } from "react";

interface Customer {
  id: number;
  name: string;
  industry: string | null;
  size: string | null;
  region: string | null;
  status: string;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", size: "", region: "", website: "" });

  useEffect(() => {
    fetch("/api/customers").then((r) => r.json()).then(setCustomers);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", industry: "", size: "", region: "", website: "" });
      fetch("/api/customers").then((r) => r.json()).then(setCustomers);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">客户列表</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          {showForm ? "取消" : "+ 新客户"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">客户名称 *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">行业</label>
              <input type="text" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">规模</label>
              <select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="">选择</option>
                <option value="<100">&lt;100人</option>
                <option value="100-500">100-500人</option>
                <option value="500-1000">500-1000人</option>
                <option value=">1000">&gt;1000人</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">地区</label>
              <input type="text" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">官网</label>
              <input type="text" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
            创建客户
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">客户名称</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">行业</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">规模</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">地区</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
              <th className="px-4 py-3 font-medium text-gray-600 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a href={`/customers/${c.id}`} className="text-blue-600 hover:underline font-medium">{c.name}</a>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.industry || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{c.size || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{c.region || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    c.status === "已转化" ? "bg-green-100 text-green-700" :
                    c.status === "跟进中" ? "bg-blue-100 text-blue-700" :
                    c.status === "已终止" ? "bg-gray-100 text-gray-600" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>{c.status}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!confirm(`确定删除「${c.name}」？`)) return;
                      await fetch(`/api/customers/${c.id}`, { method: 'DELETE' });
                      setCustomers(customers.filter(x => x.id !== c.id));
                    }}
                    className="text-red-400 hover:text-red-600 text-sm"
                    title="删除"
                  >🗑</button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">暂无客户，点击右上角添加</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
