import { getDb } from '@/lib/db';

export interface CustomerData {
  name: string;
  industry?: string;
  size?: string;
  region?: string;
  website?: string;
  doc_path?: string;
}

export interface OpportunityData {
  name: string;
  stage?: string;
  customer_id?: number;
  amount?: number;
  close_date?: string;
  next_action?: string;
  doc_path?: string;
}

export interface ActivityData {
  type: string;
  date?: string;
  summary: string;
  customer_id?: number;
  opportunity_id?: number;
  doc_path?: string;
}

/**
 * CRM Agent - 写入 SQLite 结构化数据
 */
export function upsertCustomer(data: CustomerData): number {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const existing = db.prepare('SELECT id FROM customers WHERE name = ?').get(data.name) as any;

  if (existing) {
    db.prepare(`
      UPDATE customers
      SET industry = COALESCE(?, industry),
          size = COALESCE(?, size),
          region = COALESCE(?, region),
          website = COALESCE(?, website),
          doc_path = COALESCE(?, doc_path),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(data.industry, data.size, data.region, data.website, data.doc_path, existing.id);
    return existing.id;
  } else {
    const result = db.prepare(`
      INSERT INTO customers (name, industry, size, region, website, doc_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.name, data.industry || null, data.size || null, data.region || null, data.website || null, data.doc_path || null);
    return result.lastInsertRowid as number;
  }
}

export function createOpportunity(data: OpportunityData): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO opportunities (name, stage, customer_id, amount, close_date, next_action, doc_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.stage || 'S1',
    data.customer_id || null,
    data.amount || null,
    data.close_date || null,
    data.next_action || null,
    data.doc_path || null
  );
  return result.lastInsertRowid as number;
}

export function updateOpportunity(id: number, data: Partial<OpportunityData>): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.stage !== undefined) { fields.push('stage = ?'); values.push(data.stage); }
  if (data.amount !== undefined) { fields.push('amount = ?'); values.push(data.amount); }
  if (data.close_date !== undefined) { fields.push('close_date = ?'); values.push(data.close_date); }
  if (data.next_action !== undefined) { fields.push('next_action = ?'); values.push(data.next_action); }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now', 'localtime')");
  values.push(id);

  db.prepare(`UPDATE opportunities SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function createActivity(data: ActivityData): number {
  const db = getDb();
  const date = data.date || new Date().toISOString().split('T')[0];

  const result = db.prepare(`
    INSERT INTO activities (type, date, customer_id, opportunity_id, summary, doc_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.type, date, data.customer_id || null, data.opportunity_id || null, data.summary, data.doc_path || null);

  return result.lastInsertRowid as number;
}

export function createContact(data: {
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  role?: string;
  customer_id?: number;
  opportunity_id?: number;
}): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO contacts (name, title, phone, email, role, customer_id, opportunity_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.name, data.title || null, data.phone || null, data.email || null, data.role || null, data.customer_id || null, data.opportunity_id || null);

  return result.lastInsertRowid as number;
}
