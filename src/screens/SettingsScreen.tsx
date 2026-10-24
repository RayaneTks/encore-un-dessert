import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Target, RotateCcw, Plus, Trash2, AlertTriangle, ChevronDown } from 'lucide-react';
import logo from '../assets/logo.webp';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { SettingsRow } from '../components/SettingsRow';
import { FormLabel } from '../components/FormLabel';
import type { BundleOfferRule, Dessert, DessertProductKind } from '../types';
import { DESSERT_PRODUCT_KIND_OPTIONS } from '../types';
import { findDuplicateDessertIdsInRules, newEmptyBundleRule } from '../lib/bundleOffer';
import { fmt } from '../lib/calculations';

function offerSummaryLine(bo: BundleOfferRule): string {
  const n = bo.bundleSize;
  const price = bo.useFixedBundleTotal
    ? `${n} pièces = ${fmt(bo.fixedBundleTotal)}`
    : `la ${n}ᵉ pièce à ${fmt(bo.discountedUnitPrice)}`;
  const who = bo.appliesTo === 'particulier' ? 'Particuliers' : bo.appliesTo === 'pro' ? 'Pros' : 'Tous les clients';
  return `${price} · ${who}`;
}

interface Props {
  targetMargin: number;
  onChangeTargetMargin: (val: number) => void;
  desserts: Dessert[];
  bundleRules: BundleOfferRule[];
  onChangeBundleRules: (rules: BundleOfferRule[]) => void;
}

export const SettingsScreen: React.FC<Props> = ({
  targetMargin,
  onChangeTargetMargin,
  desserts,
  bundleRules,
  onChangeBundleRules,
}) => {
  const marginPct = Math.round(targetMargin * 100);
  const [rules, setRules] = useState<BundleOfferRule[]>(bundleRules);
  const [dessertFilter, setDessertFilter] = useState<Record<string, string>>({});
  /** Préférence replier/déplier par offre. Absence de clé = replié. */
  const [rulePanelOpen, setRulePanelOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setRules(bundleRules);
  }, [bundleRules]);

  const duplicateIds = useMemo(() => findDuplicateDessertIdsInRules(rules), [rules]);

  const commit = (next: BundleOfferRule[]) => {
    setRules(next);
    onChangeBundleRules(next);
  };

  const patchRule = (id: string, p: Partial<BundleOfferRule>) => {
    commit(rules.map(r => (r.id === id ? { ...r, ...p } : r)));
  };

  const isRuleOpen = useCallback(
    (id: string) => rulePanelOpen[id] === true,
    [rulePanelOpen],
  );

  const setRuleOpen = (id: string, open: boolean) => {
    setRulePanelOpen(p => ({ ...p, [id]: open }));
  };

  const addRule = () => {
    const nr = newEmptyBundleRule();
    const withNew = [...rules, nr];
    commit(withNew);
    setRulePanelOpen(() =>
      Object.fromEntries(withNew.map(r => [r.id, r.id === nr.id] as const)) as Record<string, boolean>,
    );
  };

  const removeRule = (id: string) => {
    if (rules.length <= 1) return;
    commit(rules.filter(r => r.id !== id));
    setRulePanelOpen(p => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  };

  const toggleProductKind = (ruleId: string, k: DessertProductKind) => {
    const r = rules.find(x => x.id === ruleId);
    if (!r) return;
    const s = new Set(r.productKinds);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    patchRule(ruleId, { productKinds: [...s] });
  };

  const toggleDessertInRule = (ruleId: string, dessertId: string) => {
    const r = rules.find(x => x.id === ruleId);
    if (!r) return;
    const s = new Set(r.dessertIds);
    if (s.has(dessertId)) s.delete(dessertId);
    else s.add(dessertId);
    patchRule(ruleId, { dessertIds: [...s] });
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-2 pb-32">
      <PageHeader title="Réglages" brand="Encore 1 Dessert" />

      <div className="px-4 pt-3 space-y-8">
        <section>
          <SectionCard title="Mon bénéfice" padding={false}>
            <div className="divide-y divide-gourmand-border/60">
              <SettingsRow
                icon={<Target size={18} strokeWidth={2} />}
                label="Marge visée"
                showChevron={false}
                trailing={
                  <div className="flex items-center gap-1 rounded-lg border border-gourmand-border bg-white px-2.5 py-1.5 shadow-sm">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      step={1}
                      value={marginPct}
                      onChange={e => {
                        const v = Math.min(99, Math.max(0, parseInt(e.target.value, 10) || 0));
                        onChangeTargetMargin(v / 100);
                      }}
                      className="w-10 min-w-0 bg-transparent text-right text-sm font-semibold text-gourmand-chocolate outline-none tabular-nums"
                      aria-label="Marge visée en pourcentage"
                    />
                    <span className="text-xs font-medium text-gourmand-biscuit tabular-nums">%</span>
                  </div>
                }
              />
            </div>
          </SectionCard>
          <p className="mt-2 px-1 text-xs text-gourmand-biscuit">Part du prix de vente qui reste après les ingrédients.</p>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="px-0.5 text-sm font-bold uppercase tracking-wide text-gourmand-biscuit">Prix de groupe</h2>
            <button
              type="button"
              onClick={addRule}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-gourmand-chocolate px-3 py-1.5 text-xs font-bold text-white shadow-sm"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>

          {duplicateIds.length > 0 && (
            <div className="mb-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="shrink-0" size={16} />
              <p>
                Ces desserts sont dans plusieurs offres, c’est celle du haut qui s’applique :{' '}
                {duplicateIds
                  .map(id => desserts.find(d => d.id === id)?.name ?? id)
                  .join(', ')}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {rules.map((bo, ruleIdx) => {
              const displayTitle = bo.name.trim() || `Offre ${ruleIdx + 1}`;
              const open = isRuleOpen(bo.id);
              return (
                <div key={bo.id} className="gourmand-card overflow-hidden p-0">
                  <div className="flex min-h-[3.5rem] items-stretch">
                    <button
                      type="button"
                      onClick={() => setRuleOpen(bo.id, !open)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
                      aria-expanded={open}
                      aria-controls={`bundle-panel-${bo.id}`}
                    >
                      <ChevronDown
                        size={20}
                        className={`shrink-0 text-gourmand-biscuit transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-bold text-gourmand-chocolate">{displayTitle}</span>
                          {!bo.enabled && (
                            <span className="shrink-0 rounded-full bg-gourmand-border/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gourmand-biscuit">
                              En pause
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-gourmand-biscuit">{offerSummaryLine(bo)}</p>
                      </div>
                    </button>
                    {rules.length > 1 && (
                      <div className="flex items-center pr-1">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (confirm(`Supprimer « ${displayTitle} » ?`)) removeRule(bo.id);
                          }}
                          className="min-h-11 min-w-11 rounded-lg p-2.5 text-red-500 transition-colors hover:bg-red-50"
                          aria-label="Supprimer l'offre"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>

                  {open ? (
                    <div
                      id={`bundle-panel-${bo.id}`}
                      className="space-y-4 border-t border-gourmand-border/50 p-4"
                    >
                      <div>
                        <FormLabel>Nom de l’offre</FormLabel>
                        <input
                          type="text"
                          value={bo.name}
                          onChange={e => patchRule(bo.id, { name: e.target.value })}
                          className="gourmand-input mt-1.5 w-full text-sm"
                          placeholder="ex. 5 tartes = 15 €"
                        />
                      </div>

                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gourmand-border/60 bg-gourmand-bg/30 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={bo.enabled}
                          onChange={e => patchRule(bo.id, { enabled: e.target.checked })}
                          className="h-5 w-5 rounded border-gourmand-border text-gourmand-chocolate"
                        />
                        <span className="text-sm font-semibold text-gourmand-chocolate">Offre active</span>
                      </label>

                      <div>
                        <FormLabel>Nombre de pièces du lot</FormLabel>
                        <input
                          type="number"
                          min={2}
                          max={50}
                          step={1}
                          disabled={!bo.enabled}
                          value={bo.bundleSize}
                          onChange={e =>
                            patchRule(bo.id, { bundleSize: Math.min(50, Math.max(2, parseInt(e.target.value, 10) || 5)) })
                          }
                          className="gourmand-input mt-1.5 w-full text-base disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <FormLabel>Le prix</FormLabel>
                        <div className="mt-2 space-y-2">
                          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gourmand-border bg-white p-3.5">
                            <input
                              type="radio"
                              name={`bundle-mode-${bo.id}`}
                              checked={bo.useFixedBundleTotal}
                              disabled={!bo.enabled}
                              onChange={() => patchRule(bo.id, { useFixedBundleTotal: true })}
                              className="mt-0.5 shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold leading-snug text-gourmand-chocolate">
                                Un prix pour tout le lot
                              </span>
                              <span className="mt-1 block text-xs text-gourmand-biscuit">
                                Ex. {bo.bundleSize} pièces = 15 €
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gourmand-border bg-white p-3.5">
                            <input
                              type="radio"
                              name={`bundle-mode-${bo.id}`}
                              checked={!bo.useFixedBundleTotal}
                              disabled={!bo.enabled}
                              onChange={() => patchRule(bo.id, { useFixedBundleTotal: false })}
                              className="mt-0.5 shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold leading-snug text-gourmand-chocolate">
                                La dernière pièce à prix réduit
                              </span>
                              <span className="mt-1 block text-xs text-gourmand-biscuit">
                                Ex. la {bo.bundleSize}ᵉ à 1 €, les autres au prix normal
                              </span>
                            </span>
                          </label>
                        </div>
                      </div>

                      {bo.useFixedBundleTotal ? (
                        <div>
                          <FormLabel>Prix du lot (€)</FormLabel>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            disabled={!bo.enabled}
                            value={bo.fixedBundleTotal}
                            onChange={e => patchRule(bo.id, { fixedBundleTotal: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="gourmand-input mt-1.5 w-full text-base disabled:opacity-50"
                          />
                        </div>
                      ) : (
                        <div>
                          <FormLabel>Prix de la pièce réduite (€)</FormLabel>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            disabled={!bo.enabled}
                            value={bo.discountedUnitPrice}
                            onChange={e =>
                              patchRule(bo.id, { discountedUnitPrice: Math.max(0, parseFloat(e.target.value) || 0) })
                            }
                            className="gourmand-input mt-1.5 w-full text-base disabled:opacity-50"
                          />
                        </div>
                      )}

                      <div>
                        <FormLabel>Pour quels clients ?</FormLabel>
                        <select
                          disabled={!bo.enabled}
                          value={bo.appliesTo}
                          onChange={e => patchRule(bo.id, { appliesTo: e.target.value as BundleOfferRule['appliesTo'] })}
                          className="gourmand-input mt-1.5 w-full text-base disabled:opacity-50"
                        >
                          <option value="particulier">Particuliers</option>
                          <option value="pro">Pros</option>
                          <option value="both">Tous les clients</option>
                        </select>
                      </div>

                      <div>
                        <FormLabel>Pour quels desserts ?</FormLabel>
                        <div className="mt-2 flex flex-col gap-2">
                          {DESSERT_PRODUCT_KIND_OPTIONS.map(opt => (
                            <label
                              key={opt.value}
                              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gourmand-border bg-white px-3 py-2"
                            >
                              <input
                                type="checkbox"
                                disabled={!bo.enabled}
                                checked={bo.productKinds.includes(opt.value)}
                                onChange={() => toggleProductKind(bo.id, opt.value)}
                                className="h-4 w-4 rounded border-gourmand-border text-gourmand-chocolate"
                              />
                              <span className="text-sm font-medium text-gourmand-chocolate">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                        {desserts.length > 0 && (
                          <>
                            <p className="mb-1 mt-3 text-xs font-semibold text-gourmand-biscuit">Ou des desserts précis</p>
                            <input
                              type="search"
                              placeholder="Rechercher…"
                              value={dessertFilter[bo.id] ?? ''}
                              onChange={e => setDessertFilter(f => ({ ...f, [bo.id]: e.target.value }))}
                              className="gourmand-input mb-2 w-full text-sm"
                            />
                            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gourmand-border/80 bg-gourmand-bg/40 p-2">
                              {desserts
                                .filter(d => {
                                  const q = (dessertFilter[bo.id] ?? '').toLowerCase();
                                  if (!q) return true;
                                  return d.name.toLowerCase().includes(q) || d.emoji.includes(q);
                                })
                                .map(d => (
                                  <label
                                    key={d.id}
                                    className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/80"
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={!bo.enabled}
                                      checked={bo.dessertIds.includes(d.id)}
                                      onChange={() => toggleDessertInRule(bo.id, d.id)}
                                      className="h-4 w-4 rounded border-gourmand-border text-gourmand-chocolate"
                                    />
                                    <span className="text-sm text-gourmand-chocolate">
                                      {d.emoji} {d.name}
                                    </span>
                                  </label>
                                ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="pt-4 pb-6 text-center border-t border-gourmand-border/40">
          <img src={logo} alt="Encore 1 Dessert" className="mx-auto h-auto w-44" />
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  'Remettre les réglages d’origine ?\n\nMarge, prix de groupe et rappels reviennent à zéro.\nVos recettes, commandes et ventes ne sont pas touchées.',
                )
              ) {
                localStorage.removeItem('e1d_target_margin');
                localStorage.removeItem('e1d_bundle_offer_v1');
                localStorage.removeItem('e1d_bundle_rules_v2');
                localStorage.removeItem('e1d_notif_schedule_v1');
                window.location.reload();
              }
            }}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50/80 px-4 py-2.5 text-xs font-semibold text-red-500 active:scale-[0.98] transition-transform"
          >
            <RotateCcw size={14} strokeWidth={2} />
            Remettre les réglages d’origine
          </button>
        </footer>
      </div>
    </div>
  );
};
