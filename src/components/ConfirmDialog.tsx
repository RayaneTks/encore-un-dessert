import React from 'react';
import { motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Supprimer',
  onConfirm,
  onCancel,
}) => {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] flex max-h-[100dvh] items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-8"
    >
      <div className="absolute inset-0 bg-gourmand-chocolate/50 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-[min(100%,320px)] overflow-hidden rounded-[28px] bg-white shadow-2xl"
      >
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <h3 className="text-lg font-black italic tracking-tight mb-2">{title}</h3>
          <p className="text-sm text-gourmand-cocoa/60 font-medium leading-relaxed">{message}</p>
        </div>
        <div className="flex border-t border-gourmand-border">
          <button
            onClick={onCancel}
            className="flex-1 py-4 text-sm font-black uppercase tracking-widest text-gourmand-cocoa/60 active:bg-gourmand-bg transition-colors"
          >
            Annuler
          </button>
          <div className="w-px bg-gourmand-border" />
          <button
            onClick={onConfirm}
            className="flex-1 py-4 text-sm font-black uppercase tracking-widest text-red-500 active:bg-red-50 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
};
