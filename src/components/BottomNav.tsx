import React from 'react';
import { motion, LayoutGroup } from 'motion/react';
import { ChefHat, ClipboardList, LayoutDashboard, Settings, Store } from 'lucide-react';
import { Tab } from '../types';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface BottomNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

type NavItem = { id: Tab; label: string; icon: React.FC<any>; also?: Tab[]; primary?: boolean };

/**
 * 5 emplacements, la Caisse au centre et en relief (c'est l'action de tous les jours).
 * « Atelier » regroupe la conception : desserts, préparations, ingrédients.
 */
const items: NavItem[] = [
  { id: 'commandes', label: 'Commandes', icon: ClipboardList },
  { id: 'desserts', label: 'Atelier', icon: ChefHat, also: ['bases', 'ingredients'] },
  { id: 'calculate', label: 'Caisse', icon: Store, primary: true },
  { id: 'history', label: 'Ventes', icon: LayoutDashboard },
  { id: 'settings', label: 'Réglages', icon: Settings },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <nav
      aria-label="Navigation principale"
      className="nav-blur h-[88px] fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto px-1 flex justify-between items-start pt-2 z-[100] safe-area-bottom"
    >
      <LayoutGroup>
        {items.map(item => {
          const isActive = activeTab === item.id || Boolean(item.also?.includes(activeTab));
          const common = {
            onClick: () => { if (!isActive) setActiveTab(item.id); },
            'aria-current': isActive ? ('page' as const) : undefined,
            'aria-label': `Ouvrir ${item.label}`,
          };

          if (item.primary) {
            return (
              <button
                key={item.id}
                {...common}
                className="relative -mt-6 flex min-w-0 flex-1 flex-col items-center gap-1 focus-visible:outline-none"
              >
                <motion.span
                  animate={reduceMotion ? undefined : { scale: isActive ? 1.06 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                  className={`flex h-16 w-16 items-center justify-center rounded-full bg-gourmand-chocolate text-white shadow-[0_8px_20px_rgba(36,19,9,0.35)] ring-4 ${
                    isActive ? 'ring-gourmand-caramel' : 'ring-gourmand-bg'
                  } transition-[box-shadow] duration-200 active:scale-95`}
                >
                  <item.icon size={28} strokeWidth={2.25} />
                </motion.span>
                <span className={`text-[11px] font-bold tracking-tight ${isActive ? 'text-gourmand-chocolate' : 'text-gourmand-cocoa'}`}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              {...common}
              className={`relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gourmand-chocolate/20 ${
                isActive ? 'text-gourmand-chocolate' : 'text-gourmand-biscuit'
              }`}
            >
              <motion.div
                animate={reduceMotion ? { scale: 1, y: 0 } : { scale: isActive ? 1.05 : 1, y: isActive ? -2 : 0 }}
                transition={reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 400, damping: 28 }}
              >
                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className={`text-[11px] font-semibold tracking-tight transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </LayoutGroup>
    </nav>
  );
};
