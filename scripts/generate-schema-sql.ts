/**
 * Generate the SQLite CREATE TABLE statements directly from the Prisma schema.
 * Used as a fallback for Vercel serverless where `prisma db push` can't run.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

const models: string[] = [];

// Parse models
const modelRegex = /model\s+(\w+)\s+\{([^}]+)\}/g;
let m: RegExpExecArray | null;
while ((m = modelRegex.exec(schema)) !== null) {
  const name = m[1];
  const body = m[2];
  const fields: string[] = [];
  const indexes: string[] = [];
  let idField: string | null = null;
  const uniqueConstraints: string[] = [];

  for (const lineRaw of body.split('\n')) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) {
      // Handle @@unique and @@index
      const uniqueMatch = line.match(/@@unique\(\[([^\]]+)\]\)/);
      if (uniqueMatch) {
        const cols = uniqueMatch[1].split(',').map((c) => c.trim());
        uniqueConstraints.push(`UNIQUE(${cols.join(', ')})`);
      }
      const indexMatch = line.match(/@@index\(\[([^\]]+)\](?:,\s*\{\})?\)/);
      if (indexMatch) {
        const cols = indexMatch[1].split(',').map((c) => c.trim());
        indexes.push(`CREATE INDEX IF NOT EXISTS idx_${name}_${cols.join('_').replace(/\s/g, '_')} ON "${name}"(${cols.join(', ')});`);
      }
      continue;
    }
    if (line.startsWith('@')) continue;

    // Match: fieldName Type @attributes
    const fm = line.match(/^(\w+)\s+(\S+)(.*)$/);
    if (!fm) continue;
    const [, fieldName, fieldTypeRaw, rest] = fm;
    const fieldType = mapType(fieldTypeRaw);

    const isId = rest.includes('@id');
    const isUnique = rest.includes('@unique') || isId;
    const hasDefault = rest.match(/@default\(([^)]+)\)/);

    let colDef = `"${fieldName}" ${fieldType}`;
    if (isId) {
      colDef += ' PRIMARY KEY';
      idField = fieldName;
    }
    if (hasDefault) {
      let dv = hasDefault[1].trim();
      // Handle cuid() / uuid() / now()
      dv = dv.replace(/^cuid\(\)$/i, "lower(hex(randomblob(12)))");
      dv = dv.replace(/^uuid\(\)$/i, "lower(hex(randomblob(16)))");
      dv = dv.replace(/^now\(\)$/i, "(datetime('now'))");
      dv = dv.replace(/^true$/i, '1');
      dv = dv.replace(/^false$/i, '0');
      // Keep quoted strings as-is
      colDef += ` DEFAULT ${dv}`;
    }
    if (rest.includes('@updatedAt')) {
      colDef += ` ON UPDATE (datetime('now'))`;
    }
    fields.push(colDef);
  }

  // Add composite unique constraints
  for (const u of uniqueConstraints) fields.push(u);

  const sql = `CREATE TABLE IF NOT EXISTS "${name}" (\n  ${fields.join(',\n  ')}\n);`;
  models.push(sql);
  for (const idx of indexes) models.push(idx);
}

function mapType(prismaType: string): string {
  const t = prismaType.toLowerCase();
  if (t === 'string') return 'TEXT';
  if (t === 'int') return 'INTEGER';
  if (t === 'bigint') return 'INTEGER';
  if (t === 'boolean') return 'INTEGER';
  if (t === 'datetime') return 'DATETIME';
  if (t === 'float' || t === 'decimal') return 'REAL';
  if (t === 'json') return 'TEXT';
  return 'TEXT';
}

const fullSql = `-- Auto-generated SQLite schema for Study Vault
-- Generated from prisma/schema.prisma

${models.join('\n\n')}
`;

writeFileSync(join(process.cwd(), 'prisma/schema.sql'), fullSql);
console.log(`Wrote ${models.length} statements to prisma/schema.sql`);
