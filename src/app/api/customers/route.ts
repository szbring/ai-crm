import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const customers = db.prepare('SELECT * FROM customers ORDER BY updated_at DESC').all();
  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { name, industry, size, region, website, status } = body;

  const stmt = db.prepare(
    'INSERT INTO customers (name, industry, size, region, website, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(name, industry || null, size || null, region || null, website || null, status || '线索');

  return NextResponse.json({ id: result.lastInsertRowid, ok: true }, { status: 201 });
}
