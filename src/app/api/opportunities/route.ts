import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const opportunities = db.prepare(`
    SELECT o.*, c.name as customer_name
    FROM opportunities o
    LEFT JOIN customers c ON o.customer_id = c.id
    ORDER BY o.updated_at DESC
  `).all();
  return NextResponse.json(opportunities);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { name, stage, customer_id, amount, close_date, next_action } = body;

  const stmt = db.prepare(
    'INSERT INTO opportunities (name, stage, customer_id, amount, close_date, next_action) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(name, stage || 'S1', customer_id || null, amount || null, close_date || null, next_action || null);

  return NextResponse.json({ id: result.lastInsertRowid, ok: true }, { status: 201 });
}
