import pg from 'pg';

const TABLES = new Set([
  'raw_ingredients',
  'bases',
  'base_components',
  'desserts',
  'dessert_components',
  'history_entries',
  'commandes',
]);
const IDENT = /^[a-z_][a-z0-9_]*$/;

pg.types.setTypeParser(1082, (v: string) => v);
pg.types.setTypeParser(20, (v: string) => Number(v));

type Req = { method?: string; body?: unknown };
type Res = { status: (code: number) => Res; json: (body: unknown) => void };

type Spec = {
  table: string;
  action: 'select' | 'insert' | 'upsert' | 'delete';
  payload?: Record<string, unknown> | Record<string, unknown>[];
  filters?: { col: string; val: unknown }[];
  order?: { col: string; ascending: boolean } | null;
  returning?: boolean;
};

let pool: pg.Pool | undefined;

function getPool(): pg.Pool {
  if (pool) return pool;
  const raw =
    process.env.encore1dessert_POSTGRES_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error('Postgres connection string missing');
  const url = new URL(raw);
  url.searchParams.delete('sslmode');
  pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

function ident(name: unknown): string {
  if (typeof name !== 'string' || !IDENT.test(name)) throw new Error('Invalid identifier');
  return `"${name}"`;
}

function toParam(v: unknown): unknown {
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

function build(spec: Spec): { sql: string; values: unknown[] } {
  if (!TABLES.has(spec.table)) throw new Error('Unknown table');
  const table = ident(spec.table);
  const values: unknown[] = [];
  const ph = (v: unknown) => {
    values.push(toParam(v));
    return `$${values.length}`;
  };
  const where = () => {
    const f = spec.filters ?? [];
    return f.length ? ` WHERE ${f.map(x => `${ident(x.col)} = ${ph(x.val)}`).join(' AND ')}` : '';
  };
  const returning = spec.returning ? ' RETURNING *' : '';

  if (spec.action === 'select') {
    const order = spec.order ? ` ORDER BY ${ident(spec.order.col)} ${spec.order.ascending ? 'ASC' : 'DESC'}` : '';
    return { sql: `SELECT * FROM ${table}${where()}${order}`, values };
  }

  if (spec.action === 'delete') {
    if (!spec.filters?.length) throw new Error('Delete requires a filter');
    return { sql: `DELETE FROM ${table}${where()}${returning}`, values };
  }

  const rows = Array.isArray(spec.payload) ? spec.payload : spec.payload ? [spec.payload] : [];
  if (!rows.length) throw new Error('Empty payload');
  const cols = Object.keys(rows[0]);
  const colSql = cols.map(ident).join(', ');
  const valSql = rows.map(r => `(${cols.map(c => ph(r[c])).join(', ')})`).join(', ');

  if (spec.action === 'insert') {
    return { sql: `INSERT INTO ${table} (${colSql}) VALUES ${valSql}${returning}`, values };
  }

  if (rows.length !== 1) throw new Error('Upsert supports a single row');
  if (!cols.includes('id')) {
    return { sql: `INSERT INTO ${table} (${colSql}) VALUES ${valSql}${returning}`, values };
  }
  const sets = cols.filter(c => c !== 'id').map(c => `${ident(c)} = EXCLUDED.${ident(c)}`);
  const conflict = sets.length ? `DO UPDATE SET ${sets.join(', ')}` : 'DO NOTHING';
  return {
    sql: `INSERT INTO ${table} (${colSql}) VALUES ${valSql} ON CONFLICT ("id") ${conflict}${returning}`,
    values,
  };
}

function errorMessage(err: unknown, table: string): string {
  const e = err as { code?: string; message?: string };
  if (e.code === '42703') {
    const col = /column "([^"]+)"/.exec(e.message ?? '')?.[1] ?? '';
    return `Could not find the '${col}' column of '${table}' in the schema cache`;
  }
  return e.message ?? 'Database error';
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }
  let spec: Spec | undefined;
  try {
    spec = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Spec;
    const { sql, values } = build(spec);
    const result = await getPool().query(sql, values);
    const returnsRows = spec.action === 'select' || spec.returning;
    res.status(200).json({ data: returnsRows ? result.rows : null });
  } catch (err) {
    res.status(400).json({ error: { message: errorMessage(err, spec?.table ?? '') } });
  }
}
