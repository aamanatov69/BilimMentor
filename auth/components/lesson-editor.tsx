"use client";

import "katex/dist/katex.min.css";
import { type ClipboardEvent, useRef } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

type LessonEditorProps = {
  lessonTitle: string;
  lessonContent: string;
  onLessonTitleChange: (value: string) => void;
  onLessonContentChange: (value: string) => void;
  onPastedImages?: (files: File[]) => void;
};

function normalizeMarkdownMath(input: string) {
  return (
    input
      .replace(/\r\n/g, "\n")
      .replace(/\[\[(MATH|CHEM):([\s\S]*?)\]\]/g, (_match, _type, formula) => {
        const value = String(formula ?? "").trim();
        if (!value) {
          return "";
        }

        return `\n$$\n${value}\n$$\n`;
      })
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula) => {
        const value = String(formula ?? "").trim();
        return value ? `\n$$\n${value}\n$$\n` : "";
      })
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula) => {
        const value = String(formula ?? "").trim();
        return value ? `$${value}$` : "";
      })
      // Support common authoring style: $$y = x^2$$ in one line.
      .replace(/\$\$([^\n$][^\n]*?[^\n$]?)\$\$/g, (_match, formula) => {
        const value = String(formula ?? "").trim();
        return value ? `$${value}$` : "";
      })
  );
}

export function LessonEditor({
  lessonTitle,
  lessonContent,
  onLessonTitleChange,
  onLessonContentChange,
  onPastedImages,
}: LessonEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const placeholder =
    "Введите текст... используйте $$y = x^2$$, [ссылка](https://example.com), вставляйте фото через Ctrl+V";
  const normalizedContent = normalizeMarkdownMath(lessonContent);

  const safeUrlTransform = (url: string) => {
    if (/^data:image\//i.test(url)) {
      return url;
    }

    return defaultUrlTransform(url);
  };

  const toAttachmentFile = (file: File) => {
    const baseRawName = file.name?.trim();
    const extension =
      (baseRawName && /\.[^.]+$/.exec(baseRawName)?.[0]) ||
      `.${file.type.split("/")[1] || "png"}`;
    const baseName = (baseRawName || `image${extension}`).replace(
      /\.[^.]+$/,
      "",
    );

    let candidateName = `${baseName}${extension}`;
    let suffix = 1;
    while (
      lessonContent.includes(`(${encodeURI(`/uploads/${candidateName}`)})`)
    ) {
      candidateName = `${baseName}-${suffix}${extension}`;
      suffix += 1;
    }

    if (candidateName === baseRawName && baseRawName) {
      return file;
    }

    return new File([file], candidateName, {
      type: file.type || "image/png",
      lastModified: file.lastModified || Date.now(),
    });
  };

  const uploadPastedImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file, file.name || "pasted-image.png");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const payload = (await response.json()) as {
      url?: string;
      message?: string;
    };

    if (!response.ok || !payload.url) {
      throw new Error(payload.message || "Не удалось загрузить изображение");
    }

    return payload.url;
  };

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(event.clipboardData?.items ?? []);
    const imageFiles = items
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (!imageFiles.length) {
      return;
    }

    event.preventDefault();

    const preparedFiles = imageFiles.map(toAttachmentFile);
    const uploadedUrls = await Promise.all(
      preparedFiles.map((file) => uploadPastedImage(file)),
    );

    const markdownImages = uploadedUrls.map((url) => `![image](${url})`);

    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? lessonContent.length;
    const end = textarea?.selectionEnd ?? lessonContent.length;
    const insertion = `\n${markdownImages.join("\n\n")}\n`;
    const nextValue =
      lessonContent.slice(0, start) + insertion + lessonContent.slice(end);

    onLessonContentChange(nextValue);

    window.requestAnimationFrame(() => {
      const nextTextarea = textareaRef.current;
      if (!nextTextarea) {
        return;
      }
      const cursor = start + insertion.length;
      nextTextarea.focus();
      nextTextarea.setSelectionRange(cursor, cursor);
    });

    onPastedImages?.(preparedFiles);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-slate-700">Название урока</label>
        <input
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
          placeholder="Например: Квадратичная функция"
          value={lessonTitle}
          onChange={(event) => onLessonTitleChange(event.target.value)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Редактор
          </p>
          <textarea
            ref={textareaRef}
            className="min-h-[320px] w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:bg-white focus:outline-none"
            placeholder={placeholder}
            value={lessonContent}
            onChange={(event) => onLessonContentChange(event.target.value)}
            onPaste={(event) => {
              void handlePaste(event);
            }}
          />
          <p className="mt-2 text-xs text-slate-500">
            Поддержка: Markdown-ссылки, Markdown-изображения и вставка фото из
            буфера обмена.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </p>
          {lessonContent.trim() ? (
            <div className="prose prose-slate max-w-none break-words text-sm leading-6">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                urlTransform={safeUrlTransform}
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noreferrer" />
                  ),
                  img: ({ node, ...props }) => (
                    <img
                      {...props}
                      className="my-3 max-h-[360px] w-auto max-w-full rounded-lg border border-slate-200 object-contain"
                      loading="lazy"
                    />
                  ),
                }}
              >
                {normalizedContent}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Предпросмотр появится после ввода текста.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
