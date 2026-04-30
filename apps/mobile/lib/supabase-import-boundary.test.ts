import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = join(__dirname, '..');

async function listSourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.expo' || e.name === 'dist') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listSourceFiles(p)));
    } else if (/\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function isTypeOnlySupabaseImport(line: string): boolean {
  const t = line.trim();
  if (!t.includes('@supabase/supabase-js')) return false;
  if (t.startsWith('//')) return true;
  if (t.startsWith('*')) return true;

  if (/^\s*import\s+type\s+/.test(t)) return true;

  const m = t.match(/import\s*\{([^}]+)\}\s*from\s*['"]@supabase\/supabase-js['"]/);
  if (!m) return false;
  const specs = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  return specs.every((s) => s.startsWith('type ') || /^type\s+\w/.test(s));
}

describe('supabase-js import boundary (mobile)', () => {
  it('allows value imports from @supabase/supabase-js only in lib/supabase-auth.ts', async () => {
    const allowedRel = join('lib', 'supabase-auth.ts');
    const files = await listSourceFiles(mobileRoot);
    const violations: string[] = [];

    for (const file of files) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const rel = relative(mobileRoot, file);
      const text = await readFile(file, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!line.includes('@supabase/supabase-js')) continue;
        if (isTypeOnlySupabaseImport(line)) continue;
        if (rel === allowedRel) continue;
        violations.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
