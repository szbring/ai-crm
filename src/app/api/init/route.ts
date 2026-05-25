import { NextResponse } from 'next/server';
import { initDb, getDb } from '@/lib/db';

export async function GET() {
  try {
    initDb();
    return NextResponse.json({ ok: true, message: 'Database initialized' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
