"use client";

import { useEffect, useId, useRef } from "react";
import { Copy, Download, MessageCircle, QrCode, Send, X } from "lucide-react";

type ShareCourseModalProps = {
  shareCourseId: string;
  shareCourseTitle: string;
  shareLink: string;
  shareInviteExpiresAt: string;
  isShareLoading: boolean;
  shareError: string;
  isShareCopied: boolean;
  qrCodeDataUrl: string;
  isQrGenerating: boolean;
  onClose: () => void;
  onCopyShareLink: () => void;
  onDownloadQrCode: () => void;
  onRetry: () => void;
};

export function ShareCourseModal({
  shareCourseId,
  shareCourseTitle,
  shareLink,
  shareInviteExpiresAt,
  isShareLoading,
  shareError,
  isShareCopied,
  qrCodeDataUrl,
  isQrGenerating,
  onClose,
  onCopyShareLink,
  onDownloadQrCode,
  onRetry,
}: ShareCourseModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const courseTitleId = useId();
  const isOpen = Boolean(shareCourseId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    dialog.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!shareCourseId) {
    return null;
  }

  const shareText = shareCourseTitle
    ? `Присоединяйтесь к курсу \"${shareCourseTitle}\" в BilimMentor`
    : "Присоединяйтесь к курсу в BilimMentor";
  const whatsappShareUrl = shareLink
    ? `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareLink}`)}`
    : "#";
  const telegramShareUrl = shareLink
    ? `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareText)}`
    : "#";

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-describedby={shareCourseTitle ? courseTitleId : undefined}
      aria-busy={isShareLoading}
      onCancel={(event) => {
        event.preventDefault();
        if (!isShareLoading) onClose();
      }}
      className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-950/45"
    >
      <div className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-semibold text-slate-900">
              Поделиться курсом
            </h3>
            <p id={courseTitleId} className="mt-1 break-words text-sm text-slate-600">
              {shareCourseTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isShareLoading}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {shareError ? (
          <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {shareError}
            {!shareLink ? (
              <button type="button" onClick={onRetry} disabled={isShareLoading} className="mt-2 block min-h-11 rounded-lg border border-rose-300 bg-white px-3 font-semibold disabled:opacity-50">
                Повторить создание ссылки
              </button>
            ) : null}
          </div>
        ) : null}

        {isShareLoading ? (
          <p role="status" className="mt-4 text-sm text-slate-600">
            Подготавливаем ссылку приглашения...
          </p>
        ) : shareLink ? (
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_240px]">
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                Отправьте ссылку или QR-код. После регистрации по ним студент
                автоматически получит доступ к курсу.
              </p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ссылка для регистрации
                </p>
                <p className="break-all text-sm text-slate-800">
                  {shareLink}
                </p>
                <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row">
                  <button
                    type="button"
                    onClick={onCopyShareLink}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 min-[420px]:w-auto min-[420px]:justify-start"
                  >
                    <Copy className="h-4 w-4" />
                    {isShareCopied ? "Скопировано" : "Копировать ссылку"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 min-[420px]:flex-row">
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 min-[420px]:w-auto min-[420px]:justify-start"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <a
                  href={telegramShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 min-[420px]:w-auto min-[420px]:justify-start"
                >
                  <Send className="h-4 w-4" />
                  Telegram
                </a>
              </div>

              {shareInviteExpiresAt ? (
                <p className="text-xs text-slate-500">
                  Ссылка действует до{" "}
                  {new Date(shareInviteExpiresAt).toLocaleString("ru-RU")}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <QrCode className="h-4 w-4" />
                QR код курса
              </p>
              {isQrGenerating ? (
                <div className="mx-auto flex aspect-square w-full max-w-[208px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
                  Генерация QR...
                </div>
              ) : qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR-код приглашения на курс"
                  className="mx-auto aspect-square w-full max-w-[208px] rounded-lg border border-slate-200 bg-white object-contain"
                />
              ) : (
                <div className="mx-auto flex aspect-square w-full max-w-[208px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
                  QR недоступен
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onDownloadQrCode}
                  disabled={!qrCodeDataUrl || isQrGenerating}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Скачать QR
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
