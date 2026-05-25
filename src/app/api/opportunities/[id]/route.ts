import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const opp = db.prepare(`
    SELECT o.*, c.name as customer_name
    FROM opportunities o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.id = ?
  `).get(id);
  if (!opp) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(opp);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.stage !== undefined) { fields.push('stage = ?'); values.push(body.stage); }
  if (body.amount !== undefined) { fields.push('amount = ?'); values.push(body.amount); }
  if (body.close_date !== undefined) { fields.push('close_date = ?'); values.push(body.close_date); }
  if (body.next_action !== undefined) { fields.push('next_action = ?'); values.push(body.next_action); }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  fields.push("updated_at = datetime('now', 'localtime')");
  values.push(id);

  db.prepare(`UPDATE opportunities SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM activities WHERE opportunity_id = ?').run(id);
  db.prepare('DELETE FROM contacts WHERE opportunity_id = ?').run(id);
  db.prepare('DELETE FROM opportunities WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
