import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { analyzeCustomer } from '@/lib/claude';
import { writeDoc, ensureDir } from '@/lib/vault';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer_id, industry, special_requirements } = body;

    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id) as any;
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // 调用 Claude API 分析
    const report = await analyzeCustomer(customer.name, industry || customer.industry, special_requirements);

    // 写入 vault
    const today = new Date().toISOString().split('T')[0];
    const shortName = customer.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    const dirPath = `客户分析/${shortName}`;
    ensureDir(dirPath);

    const reportPath = `${dirPath}/客户分析报告_${today}.md`;
    const frontmatter = `---\ntype: customer-analysis\ncustomer: "${customer.name}"\nindustry: "${customer.industry || ''}"\nanalysis_date: "${today}"\n---\n\n`;
    writeDoc(reportPath, frontmatter + report);

    // 更新客户 doc_path
    db.prepare("UPDATE customers SET doc_path = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(`客户分析/${shortName}`, customer_id);

    // 创建活动记录
    db.prepare(
      'INSERT INTO activities (type, date, customer_id, summary, doc_path) VALUES (?, ?, ?, ?, ?)'
    ).run('客户分析', today, customer_id, `${customer.name}客户分析报告`, reportPath);

    return NextResponse.json({ ok: true, report_path: reportPath, report });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
