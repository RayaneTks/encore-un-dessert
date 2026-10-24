import React from 'react';
import { motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

/** Pile des modales ouvertes : Échap ne ferme que celle du dessus. */
const openModals: symbol[] = [];

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** Barre d’actions fixe sous le contenu scrollable (ex. commande). */
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ title, children, onClose, footer }) => {
  const reduceMotion = usePrefersReducedMotion();

  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    const id = Symbol('modal');
    openModals.push(id);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === id) onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      openModals.splice(openModals.indexOf(id), 1);
    };
  }, []);

  return createPortal(
    <motion.div
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: reduceMotion ? 1 : 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
      className="fixed inset-0 z-[200] flex max-h-[100dvh] items-end justify-center overflow-x-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pb-8"
    >
      <div className="absolute inset-0 bg-gourmand-chocolate/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div
        initial={{ y: reduceMotion ? 0 : 20 }}
        animate={{ y: 0 }}
        exit={{ y: reduceMotion ? 0 : 20 }}
        transition={
          reduceMotion ? { duration: 0.01 } : { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative flex max-h-[min(92dvh,720px)] w-full max-w-[min(100%,400px)] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="grid shrink-0 grid-cols-[2.75rem_1fr_2.75rem] items-center border-b border-gourmand-border px-3 py-3 sm:px-4">
          <span className="w-11" aria-hidden />
          <h3
            id="modal-title"
            className="min-w-0 px-1 text-center text-base font-bold leading-snug tracking-tight text-gourmand-chocolate sm:text-lg"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="mx-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-gourmand-bg transition-colors hover:bg-gourmand-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gourmand-chocolate/22 active:opacity-80"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-scroll min-h-0 flex-1 overscroll-contain px-4 py-4 sm:px-5">{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-gourmand-border bg-gourmand-bg/40 px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </motion.div>
    </motion.div>,
    document.body,
  );
};
