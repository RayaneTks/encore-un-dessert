import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// En production, Vercel injecte ses propres variables spécifiques au projet relié
const supabaseUrl = 
  (import.meta as any).env.VITE_SUPABASE_URL || 
  (import.meta as any).env.NEXT_PUBLIC_encore1dessert_SUPABASE_URL

const supabaseAnonKey = 
  (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 
  (import.meta as any).env.NEXT_PUBLIC_encore1dessert_SUPABASE_ANON_KEY

type Result = { data: any; error: { message: string } | null }
type Spec = {
  table: string
  action: 'select' | 'insert' | 'upsert' | 'delete'
  payload?: unknown
  filters: { col: string; val: unknown }[]
  order: { col: string; ascending: boolean } | null
  returning: boolean
}

// Sous-ensemble de l'API supabase-js utilisé par db.ts, routé vers /api/db (connexion Postgres directe)
class Query implements PromiseLike<Result> {
  private spec: Spec
  private one = false

  constructor(table: string) {
    this.spec = { table, action: 'select', filters: [], order: null, returning: false }
  }

  select(_columns = '*') {
    this.spec.returning = true
    return this
  }
  insert(payload: unknown) {
    this.spec.action = 'insert'
    this.spec.payload = payload
    return this
  }
  upsert(payload: unknown) {
    this.spec.action = 'upsert'
    this.spec.payload = payload
    return this
  }
  delete() {
    this.spec.action = 'delete'
    return this
  }
  eq(col: string, val: unknown) {
    this.spec.filters.push({ col, val })
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.spec.order = { col, ascending: opts?.ascending ?? true }
    return this
  }
  single() {
    this.one = true
    return this
  }

  private async exec(): Promise<Result> {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.spec),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body.error) {
        return { data: null, error: { message: body.error?.message ?? `HTTP ${res.status}` } }
      }
      let data = body.data
      if (this.one) {
        if (!Array.isArray(data) || data.length !== 1) {
          return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } }
        }
        data = data[0]
      }
      return { data, error: null }
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : 'Network error' } }
    }
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.exec().then(onfulfilled, onrejected)
  }
}

const viaDirectPostgres = (import.meta as any).env.VITE_DATA_BACKEND !== 'rest'

if (!viaDirectPostgres && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn("Supabase credentials missing. Check your .env file.")
}

export const supabase: SupabaseClient = viaDirectPostgres
  ? ({ from: (table: string) => new Query(table) } as unknown as SupabaseClient)
  : createClient(supabaseUrl || '', supabaseAnonKey || '')
