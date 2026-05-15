"use client";

import React from "react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false,
}) => {
  // Shared styled classes from VideoModals.tsx
  const overlayClasses = "fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity duration-300";
  const modalBase = "bg-card text-card-foreground p-6 rounded-2xl shadow-2xl relative transform transition-all duration-300 border border-border max-w-sm w-full";

  if (!isOpen) return null;

  return (
    <div className={overlayClasses}>
      <div className={`${modalBase} ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDanger ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-primary/10 text-primary'}`}>
              <i className={`fas ${isDanger ? 'fa-trash-alt' : 'fa-exclamation-triangle'}`}></i>
            </div>
            <h3 className="text-lg font-bold text-foreground leading-tight">{title}</h3>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            {message}
          </p>
          
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-secondary-foreground text-sm font-bold transition-all active:scale-95"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 shadow-lg ${
                isDanger 
                  ? "bg-red-600 hover:bg-red-700 shadow-red-500/20" 
                  : "bg-primary hover:bg-primary/90 shadow-primary/20"
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
