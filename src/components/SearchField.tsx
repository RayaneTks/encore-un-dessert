import React from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

/** Barre de recherche collée sous le titre : toujours à portée de pouce dans une longue liste. */
export const SearchField: React.FC<Props> = ({ value, onChange, placeholder }) => (
  <div className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-gourmand-border bg-white px-3 shadow-sm focus-within:border-gourmand-chocolate/40 focus-within:ring-2 focus-within:ring-gourmand-chocolate/15">
    <Search size={18} className="shrink-0 text-gourmand-biscuit" aria-hidden />
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      autoComplete="off"
      className="min-w-0 flex-1 bg-transparent py-2 text-base font-medium text-gourmand-chocolate outline-none placeholder:text-gourmand-biscuit/60 [&::-webkit-search-cancel-button]:hidden"
    />
    {value && (
      <button type="button" onClick={() => onChange('')} aria-label="Effacer la recherche" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gourmand-biscuit active:bg-gourmand-bg">
        <X size={16} />
      </button>
    )}
  </div>
);
