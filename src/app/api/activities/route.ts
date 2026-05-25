import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const customerId = url.searchParams.get('customer_id');
  const opportunityId = url.searchParams.get('opportunity_id');

  let query = `
    SELECT a.*, o.name as opportunity_name, c.name as customer_name
    FROM activities a
    LEFT JOIN opportunities o ON a.opportunity_id = o.id
    LEFT JOIN customers c ON a.customer_id = c.id
  `;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (customerId) {
    conditions.push('a.customer_id = ?');
    params.push(customerId);
  }
  if (opportunityId) {
    conditions.push('a.opportunity_id = ?');
    params.push(opportunityId);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY a.date DESC';

  const activities = db.prepare(query).all(...params);
  return NextResponse.json(activities);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { type, date, opportunity_id, customer_id, summary, doc_path } = body;

  const stmt = db.prepare(
    'INSERT INTO activities (type, date, opportunity_id, customer_id, summary, doc_path) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(type, date, opportunity_id || null, customer_id || null, summary || null, doc_path || null);

  return NextResponse.json({ id: result.lastInsertRowid, ok: true }, { status: 201 });
}
