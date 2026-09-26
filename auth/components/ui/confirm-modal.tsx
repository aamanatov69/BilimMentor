"use client";

import { cn } from "@/lib/utils";
import { useEffect, useId, useRef } from "react";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  error?: string;
  confirmText?: string;
  cancelText?: string;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "danger" | "default";
};

export function ConfirmModal({
  isOpen,
  title,
  description,
  error,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  isBusy = false,
  onConfirm,
  onCancel,
  tone = "danger",
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;
    const previouslyFocused = document.activeElement;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={isBusy}
      onCancel={(event) => {
        event.preventDefault();
        if (!isBusy) onCancel();
      }}
      className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-950/50"
    >
      <div className="p-5">
        <h3 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h3>
        {description? (
          <p id={descriptionId} className="mt-2 break-words text-sm text-slate-600">{description}</p>
        ): null}

        {error ? <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            autoFocus
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={onCancel}
            disabled={isBusy}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={cn(
              "rounded px-3 py-1.5 text-sm text-white disabled:opacity-60",
              tone === "danger"? "bg-rose-700 hover:bg-rose-800": "bg-blue-700 hover:bg-blue-800",
            )}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy? "Подтверждение...": confirmText}
          </button>
        </div>
      </div>
    </dialog>
  );
}
