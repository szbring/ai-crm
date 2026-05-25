import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || path.join(process.cwd(), 'vault');

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const vaultPath = url.searchParams.get('path');

  const fullPath = vaultPath ? path.join(VAULT_PATH, vaultPath) : VAULT_PATH;

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ files: [], dirs: [] });
  }

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const files = entries.filter(e => e.isFile()).map(e => e.name);
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  return NextResponse.json({ files, dirs });
}
