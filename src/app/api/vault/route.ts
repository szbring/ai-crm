import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || path.join(process.cwd(), 'vault');

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const vaultPath = url.searchParams.get('path');
  if (!vaultPath) {
    return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
  }
  const fullPath = path.join(VAULT_PATH, vaultPath);
  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return NextResponse.json({ content });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
