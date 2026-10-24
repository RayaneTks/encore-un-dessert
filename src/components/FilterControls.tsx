import React from 'react';
import { ChevronDown } from 'lucide-react';

/** Tri / filtre client (liste déroulante) — Compta / Ordres */
export const CUSTOMER_SORT_OPTIONS = [
  { value: 'all' as const, label: 'Tous' },
  { value: 'particulier' as const, label: 'Particulier' },
  { value: 'pro' as const, label: 'Pro' },
];

/** Encaissement : choix binaire (pas de « tous ») */
export const CUSTOMER_TYPE_VALIDATE_OPTIONS = [
  { value: 'particulier' as const, label: 'Particulier' },
  { value: 'pro' as const, label: 'Pro' },
];

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
}

const chipBase =
  'min-h-11 w-full rounded-xl border px-2 text-center text-xs font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gourmand-chocolate/22 focus-visible:ring-offset-1';

const chipActive = 'border-gourmand-chocolate bg-gourmand-chocolate text-white shadow-sm';
const chipIdle = 'border-gourmand-border bg-white text-gourmand-biscuit';

function gridColsClass(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  return 'grid-cols-2';
}

const pillBase =
  'shrink-0 rounded-full border px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gourmand-chocolate/22 focus-visible:ring-offset-1';
const pillActive = 'border-gourmand-chocolate bg-gourmand-chocolate text-white';
const pillIdle = 'border-gourmand-border bg-white text-gourmand-biscuit';

/**
 * Pastilles horizontales (scroll) — période Compta, statut Ordres (style capsule).
 */
export function FilterPillRow<T extends string>({
  options,
  value,
  onChange,
  className = '',
  'aria-label': ariaLabel,
}: {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex min-w-0 gap-2 overflow-x-auto scrollbar-hide pb-0.5 ${className}`.trim()}
    >
      {options.map(opt => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`${pillBase} ${value === opt.value ? pillActive : pillIdle}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Pastilles en grille — encaissement / formulaires (2 ou 3 choix).
 */
export function FilterChipRow<T extends string>({
  options,
  value,
  onChange,
  className = '',
  'aria-label': ariaLabel,
}: {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`grid min-w-0 gap-2 ${gridColsClass(options.length)} ${className}`.trim()}
    >
      {options.map(opt => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`${chipBase} ${value === opt.value ? chipActive : chipIdle}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const filterGroupLabelClass =
  'px-0.5 text-[10px] font-semibold uppercase tracking-wide text-gourmand-cocoa/70';

/**
 * « Trier par » + liste compacte à droite (même hauteur de ligne que les groupes Période / Statut).
 */
export function FilterSortByCustomer({
  value,
  onChange,
}: {
  value: 'all' | 'particulier' | 'pro';
  onChange: (next: 'all' | 'particulier' | 'pro') => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 pt-0.5">
      <span className={`${filterGroupLabelClass} shrink-0`}>Clients</span>
      <div className="relative ml-auto min-w-0 shrink">
        <select
          className="h-9 min-h-9 w-full min-w-[7.25rem] max-w-[11rem] cursor-pointer appearance-none rounded-lg border border-gourmand-border bg-white px-2.5 pr-8 text-sm font-semibold text-gourmand-chocolate shadow-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-gourmand-chocolate focus-visible:ring-2 focus-visible:ring-gourmand-chocolate/18"
          value={value}
          onChange={e => onChange(e.target.value as 'all' | 'particulier' | 'pro')}
          aria-label="Filtrer par type de client"
        >
          {CUSTOMER_SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gourmand-biscuit" aria-hidden>
          <ChevronDown size={16} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

/** Titre de groupe + contenu (+ optionnel : ligne sous les pastilles, ex. tri client) */
export function FilterField({
  label,
  children,
  footer,
}: {
  label: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className={filterGroupLabelClass}>{label}</p>
      {children}
      {footer != null ? <div className="pt-0.5">{footer}</div> : null}
    </div>
  );
}
