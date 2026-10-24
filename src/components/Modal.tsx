"use client";

import { useEffect } from "react";
import { CloseIcon } from "./icons";

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#1b120a]/60 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet max-h-[94dvh] w-full max-w-lg min-w-0 overflow-x-hidden overflow-y-auto rounded-t-[2rem] border border-line bg-card px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem] sm:pt-6"
      >
        <div aria-hidden className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-serif text-3xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Mbyll"
            className="-mr-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-soft text-muted hover:text-ink"
          >
            <CloseIcon className="h-7 w-7" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="text-xl leading-relaxed">{message}</div>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="h-16 rounded-2xl bg-danger text-xl font-semibold text-danger-ink disabled:opacity-60"
        >
          {busy ? "Duke fshirë…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-16 rounded-2xl border-2 border-line text-xl font-semibold"
        >
          Jo, anulo
        </button>
      </div>
    </Modal>
  );
}
