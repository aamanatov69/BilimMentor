"use client";

import { cn } from "@/lib/utils";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
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
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  isBusy = false,
  onConfirm,
  onCancel,
  tone = "danger",
}: ConfirmModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description? (
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        ): null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
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
    </div>
  );
}
