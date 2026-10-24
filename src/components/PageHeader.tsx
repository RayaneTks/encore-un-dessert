import React from 'react';

interface PageHeaderProps {
  brand?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Contenu collé sous le titre (recherche, filtres) */
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ brand, title, description, action, children }) => {
  return (
    <header className="sticky top-0 z-30 bg-gourmand-bg/90 px-4 pb-5 pt-7 backdrop-blur-xl">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 max-w-[min(100%,calc(100%-3.5rem))] flex-1">
          {brand && <p className="text-[11px] font-semibold uppercase tracking-widest text-gourmand-biscuit mb-2">{brand}</p>}
          <h1 className="mb-1 text-3xl font-bold leading-tight tracking-tight text-gourmand-chocolate">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] font-semibold leading-[1.45] text-gourmand-cocoa/72">{description}</p>
          )}
        </div>

        {action}
      </div>
      {children}
    </header>
  );
};
