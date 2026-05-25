import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const customerId = url.searchParams.get('customer_id');
  const opportunityId = url.searchParams.get('opportunity_id');

  let contacts;
  if (customerId) {
    contacts = db.prepare('SELECT * FROM contacts WHERE customer_id = ?').all(customerId);
  } else if (opportunityId) {
    contacts = db.prepare('SELECT * FROM contacts WHERE opportunity_id = ?').all(opportunityId);
  } else {
    contacts = db.prepare('SELECT * FROM contacts ORDER BY name').all();
  }
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { name, title, phone, email, role, customer_id, opportunity_id } = body;

  const stmt = db.prepare(
    'INSERT INTO contacts (name, title, phone, email, role, customer_id, opportunity_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(name, title || null, phone || null, email || null, role || null, customer_id || null, opportunity_id || null);

  return NextResponse.json({ id: result.lastInsertRowid, ok: true }, { status: 201 });
}
