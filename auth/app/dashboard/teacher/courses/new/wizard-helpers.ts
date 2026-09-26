import { defaultUrlTransform } from "react-markdown";
import {
  type FormulaKind,
  type FormulaSearchCard,
  type FormulaTemplate,
  type InternetFormulaResult,
  WIKIPEDIA_HOSTS,
  type WikipediaParseResponse,
  type WikipediaSearchResponse,
} from "./formula-data";

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function filterFormulaTemplates(
  templates: FormulaTemplate[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return templates.slice(0, 4);
  }

  return templates.filter((template) =>
    template.title.toLowerCase().includes(normalizedQuery),
  );
}

export function buildFormulaSearchCards(
  localTemplates: FormulaTemplate[],
  internetResults: InternetFormulaResult[],
  query: string,
) {
  const cards: FormulaSearchCard[] = [];
  const seen = new Set<string>();

  for (const template of filterFormulaTemplates(localTemplates, query)) {
    const key = `${template.title}::${template.latex}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    cards.push({
      title: template.title,
      latex: template.latex,
      source: "local",
    });
  }

  for (const result of internetResults) {
    const key = `${result.title}::${result.latex}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    cards.push({
      title: result.title,
      latex: result.latex,
      snippet: result.snippet,
      url: result.url,
      source: "internet",
    });
  }

  return cards;
}

export function reindexNumericRecord<T>(
  record: Record<number, T>,
  removedIndex: number,
) {
  const next: Record<number, T> = {};

  for (const [key, value] of Object.entries(record)) {
    const index = Number(key);
    if (index < removedIndex) {
      next[index] = value;
      continue;
    }

    if (index > removedIndex) {
      next[index - 1] = value;
    }
  }

  return next;
}

export function normalizeExtractedLatex(value: string) {
  return decodeHtmlEntities(value)
    .replace(/^\s*\{\\displaystyle\s*/, "")
    .replace(/^\s*\{\\textstyle\s*/, "")
    .replace(/^\s*\{\\scriptstyle\s*/, "")
    .replace(/\}\s*$/, "")
    .replace(/\\,/g, "\\,")
    .replace(/\s+/g, " ")
    .trim();
}

export function collectMatches(value: string, expression: RegExp) {
  return Array.from(value.matchAll(expression), (match) => match[1] ?? "");
}

export function extractLatexCandidatesFromWikipediaHtml(html: string) {
  const annotationMatches = collectMatches(
    html,
    /<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>/g,
  );
  const altMatches = collectMatches(html, /alttext="([^"]+)"/g);

  return [...annotationMatches, ...altMatches]
    .map(normalizeExtractedLatex)
    .filter((candidate) => candidate.length >= 3 && candidate.length <= 240);
}

export function scoreLatexCandidate(
  candidate: string,
  kind: FormulaKind,
  query: string,
) {
  const normalizedCandidate = candidate.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let score = 0;

  if (normalizedCandidate.includes(normalizedQuery)) {
    score += 8;
  }

  if (candidate.includes("=")) {
    score += 4;
  }

  if (candidate.includes("\\frac") || candidate.includes("\\sqrt")) {
    score += 4;
  }

  if (candidate.includes("^") || candidate.includes("_")) {
    score += 2;
  }

  if (kind === "chemistry") {
    if (candidate.includes("\\ce")) {
      score += 10;
    }
    if (candidate.includes("->") || candidate.includes("<=>")) {
      score += 6;
    }
  }

  if (kind === "math") {
    if (
      candidate.includes("\\sum") ||
      candidate.includes("\\int") ||
      candidate.includes("\\sin") ||
      candidate.includes("\\cos") ||
      candidate.includes("\\log")
    ) {
      score += 4;
    }
  }

  score -= Math.floor(candidate.length / 80);
  return score;
}

export function pickBestLatexCandidate(
  candidates: string[],
  kind: FormulaKind,
  query: string,
) {
  return [...candidates].sort(
    (left, right) =>
      scoreLatexCandidate(right, kind, query) -
      scoreLatexCandidate(left, kind, query),
  )[0];
}

export async function fetchWikipediaFormulaLatex(
  title: string,
  kind: FormulaKind,
) {
  for (const host of WIKIPEDIA_HOSTS) {
    try {
      const response = await fetch(
        `${host.apiBaseUrl}?action=parse&format=json&origin=*&prop=text&page=${encodeURIComponent(title)}`,
      );

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as WikipediaParseResponse;
      const html = String(data.parse?.text?.["*"] ?? "");
      if (!html) {
        continue;
      }

      const candidates = extractLatexCandidatesFromWikipediaHtml(html);
      const bestCandidate = pickBestLatexCandidate(candidates, kind, title);
      if (bestCandidate) {
        return bestCandidate;
      }
    } catch {
      continue;
    }
  }

  return "";
}

export async function fetchInternetFormulaResults(
  query: string,
  kind: FormulaKind,
): Promise<InternetFormulaResult[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return [];
  }

  let lastSearchError: Error | null = null;

  for (const host of WIKIPEDIA_HOSTS) {
    try {
      const response = await fetch(
        `${host.apiBaseUrl}?action=query&list=search&format=json&utf8=1&origin=*&srlimit=6&srsearch=${encodeURIComponent(host.searchQuery(normalizedQuery, kind))}`,
      );

      if (!response.ok) {
        lastSearchError = new Error("search-request-failed");
        continue;
      }

      const data = (await response.json()) as WikipediaSearchResponse;
      const items = (Array.isArray(data.query?.search) ? data.query.search : [])
        .map((item) => ({
          title: String(item.title ?? "").trim(),
          snippet: stripHtml(String(item.snippet ?? "")),
        }))
        .filter((item) => item.title)
        .slice(0, 4);

      const settledResults = await Promise.allSettled(
        items.map(async (item) => {
          const latex = await fetchWikipediaFormulaLatex(item.title, kind);
          if (!latex) {
            return null;
          }

          return {
            title: item.title,
            latex,
            snippet: item.snippet,
            url: `${host.pageBaseUrl}${encodeURIComponent(item.title.replace(/\s+/g, "_"))}`,
          } satisfies InternetFormulaResult;
        }),
      );

      const results = settledResults
        .filter(
          (
            item,
          ): item is PromiseFulfilledResult<InternetFormulaResult | null> =>
            item.status === "fulfilled",
        )
        .map((item) => item.value)
        .filter((item): item is InternetFormulaResult => item !== null);

      if (results.length > 0 || items.length > 0) {
        return results;
      }
    } catch (error) {
      lastSearchError =
        error instanceof Error ? error : new Error("internet-search-failed");
    }
  }

  if (lastSearchError) {
    throw lastSearchError;
  }

  return [];
}

export function getCourseLevelLabel(
  level: "beginner" | "intermediate" | "advanced",
) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  return "Продвинутый";
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const payload = result.includes(",") ? result.split(",")[1] : result;
      resolve(payload);
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

export function detectMaterialTypeFromMime(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("pdf")) return "pdf";
  return "file";
}

export function normalizeMarkdownMath(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\[\[(MATH|CHEM):([\s\S]*?)\]\]/g, (_match, _type, formula) => {
      const value = String(formula ?? "").trim();
      return value ? `\n$$\n${value}\n$$\n` : "";
    })
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula) => {
      const value = String(formula ?? "").trim();
      return value ? `\n$$\n${value}\n$$\n` : "";
    })
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula) => {
      const value = String(formula ?? "").trim();
      return value ? `$${value}$` : "";
    })
    .replace(/\$\$([^\n$][^\n]*?[^\n$]?)\$\$/g, (_match, formula) => {
      const value = String(formula ?? "").trim();
      return value ? `$${value}$` : "";
    });
}

export function safeUrlTransform(url: string) {
  if (/^\/uploads\//i.test(url)) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${url}`;
    }
    return url;
  }

  if (/^data:image\//i.test(url)) {
    return url;
  }

  return defaultUrlTransform(url);
}

export function buildAssignmentTitleFromText(value: string) {
  const normalized = value
    .replace(/\[\[(MATH|CHEM):([\s\S]*?)\]\]/g, (_match, _kind, formula) => {
      const safeFormula = String(formula ?? "").trim();
      return safeFormula ? ` ${safeFormula} ` : " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  return normalized.slice(0, 120);
}

export function toDatetimeLocalValue(isoValue: string | null | undefined) {
  if (!isoValue) return "";

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
