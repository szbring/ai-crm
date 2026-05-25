import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(customer);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const fields: string[] = [];
  const values: any[] = [];
  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.industry !== undefined) { fields.push('industry = ?'); values.push(body.industry); }
  if (body.size !== undefined) { fields.push('size = ?'); values.push(body.size); }
  if (body.region !== undefined) { fields.push('region = ?'); values.push(body.region); }
  if (body.website !== undefined) { fields.push('website = ?'); values.push(body.website); }
  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }
  values.push(id);
  db.prepare(`UPDATE customers SET ${fields.join(', ')}, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM activities WHERE customer_id = ?').run(id);
  db.prepare('DELETE FROM contacts WHERE customer_id = ?').run(id);
  db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
