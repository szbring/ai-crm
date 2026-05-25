"use client";

import { useEffect, useState } from "react";

interface Opportunity {
  id: number;
  name: string;
  stage: string;
  customer_name: string;
  amount: number | null;
  next_action: string | null;
}

const STAGES = [
  { key: "S1", label: "S1 线索验证", color: "bg-blue-50 border-blue-200" },
  { key: "S2", label: "S2 需求与方案", color: "bg-yellow-50 border-yellow-200" },
  { key: "S3", label: "S3 谈判与合同", color: "bg-orange-50 border-orange-200" },
  { key: "S4", label: "S4 交付/关闭", color: "bg-green-50 border-green-200" },
  { key: "S0", label: "S0 终止", color: "bg-gray-50 border-gray-200" },
];

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/init").then(() => {
      fetch("/api/opportunities").then((r) => r.json()).then(setOpportunities);
      fetch("/api/activities").then((r) => r.json()).then(setActivities);
    });
  }, []);

  const getByStage = (stage: string) =>
    opportunities.filter((o) => o.stage === stage);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">商机管道</h1>
        <div className="flex gap-2">
          <a href="/customers" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            + 新客户
          </a>
          <a href="/opportunities" className="px-4 py-2 bg-white text-gray-700 border rounded-lg text-sm hover:bg-gray-50">
            + 新商机
          </a>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {STAGES.map((stage) => (
          <div key={stage.key} className={`rounded-lg border p-4 ${stage.color}`}>
            <h2 className="font-semibold text-sm text-gray-700 mb-3">
              {stage.label}
              <span className="ml-2 text-gray-400">{getByStage(stage.key).length}</span>
            </h2>
            <div className="space-y-2">
              {getByStage(stage.key).map((opp) => (
                <a key={opp.id} href={`/opportunities/${opp.id}`}
                   className="block bg-white rounded-md p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="font-medium text-sm text-gray-900 truncate">{opp.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{opp.customer_name}</div>
                  {opp.amount && <div className="text-xs text-gray-400 mt-1">¥{(opp.amount / 10000).toFixed(0)}万</div>}
                </a>
              ))}
              {getByStage(stage.key).length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4">暂无商机</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">最近活动</h2>
        {activities.length === 0 ? (
          <div className="text-sm text-gray-400">暂无活动记录</div>
        ) : (
          <div className="space-y-2">
            {activities.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 w-20">{a.date}</span>
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{a.type}</span>
                <span className="text-gray-700">{a.summary}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
