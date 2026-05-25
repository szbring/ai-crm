import fs from 'fs';
import path from 'path';

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || path.join(process.cwd(), 'vault');

export function getVaultPath(): string {
  return VAULT_PATH;
}

export function ensureDir(dirPath: string): void {
  const full = path.join(VAULT_PATH, dirPath);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
  }
}

export function writeDoc(relativePath: string, content: string): string {
  const fullPath = path.join(VAULT_PATH, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

export function readDoc(relativePath: string): string | null {
  const fullPath = path.join(VAULT_PATH, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf-8');
}

export function listDocs(dirPath: string): string[] {
  const full = path.join(VAULT_PATH, dirPath);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter(f => f.endsWith('.md'));
}
