"use client";

import katex from "katex";
import "katex/contrib/mhchem";
import {
  ChevronRight,
  Code2,
  FlaskConical,
  Link2,
  Paperclip,
  Save,
  Sigma,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseLevel = "beginner" | "intermediate" | "advanced";
type FormulaKind = "math" | "chemistry";

type LessonUploadFile = {
  name: string;
  type: string;
  size: number;
  dataBase64: string;
};

type LessonRecord = {
  id: string;
  title: string;
  description: string;
  materials: Array<Record<string, unknown>>;
};

type TeacherCourseDetailsResponse = {
  course?: {
    id?: string;
    title?: string;
    description?: string;
    level?: CourseLevel;
    modules?: Array<Record<string, unknown>>;
  };
  message?: string;
};

type FormulaTemplate = {
  title: string;
  latex: string;
};

type FormulaSearchCard = {
  title: string;
  latex: string;
  snippet?: string;
  url?: string;
  source: "local" | "internet";
};

type InternetFormulaResult = {
  title: string;
  latex: string;
  snippet: string;
  url: string;
};

type WikipediaSearchResponse = {
  query?: {
    search?: Array<{
      title?: string;
      snippet?: string;
    }>;
  };
};

type WikipediaParseResponse = {
  parse?: {
    text?: {
      "*"?: string;
    };
  };
};

type WikipediaHostConfig = {
  apiBaseUrl: string;
  pageBaseUrl: string;
  searchQuery: (query: string, kind: FormulaKind) => string;
};

const WIKIPEDIA_HOSTS: WikipediaHostConfig[] = [
  {
    apiBaseUrl: "https://ru.wikipedia.org/w/api.php",
    pageBaseUrl: "https://ru.wikipedia.org/wiki/",
    searchQuery: (query, kind) =>
      kind === "math"
        ? `${query} математическая формула`
        : `${query} химическая формула`,
  },
  {
    apiBaseUrl: "https://en.wikipedia.org/w/api.php",
    pageBaseUrl: "https://en.wikipedia.org/wiki/",
    searchQuery: (query, kind) =>
      kind === "math" ? `${query} formula` : `${query} chemical formula`,
  },
];

const MATH_FORMULA_TEMPLATES: FormulaTemplate[] = [
  { title: "Теорема Пифагора", latex: "c^2 = a^2 + b^2" },
  {
    title: "Квадратное уравнение",
    latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
  },
  { title: "Площадь круга", latex: "S = \\pi r^2" },
  { title: "Длина окружности", latex: "L = 2\\pi r" },
  { title: "Разность квадратов", latex: "a^2 - b^2 = (a-b)(a+b)" },
  { title: "Квадрат суммы", latex: "(a+b)^2 = a^2 + 2ab + b^2" },
  { title: "Квадрат разности", latex: "(a-b)^2 = a^2 - 2ab + b^2" },
  { title: "Сумма кубов", latex: "a^3 + b^3 = (a+b)(a^2 - ab + b^2)" },
  { title: "Производная степени", latex: "\\frac{d}{dx}x^n = nx^{n-1}" },
  {
    title: "Интеграл степени",
    latex: "\\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C",
  },
  {
    title: "Синус суммы",
    latex:
      "\\sin(\\alpha + \\beta) = \\sin\\alpha \\cos\\beta + \\cos\\alpha \\sin\\beta",
  },
  {
    title: "Косинус суммы",
    latex:
      "\\cos(\\alpha + \\beta) = \\cos\\alpha \\cos\\beta - \\sin\\alpha \\sin\\beta",
  },
  { title: "Основное тождество", latex: "\\sin^2 x + \\cos^2 x = 1" },
  { title: "Арифметическая прогрессия", latex: "a_n = a_1 + (n-1)d" },
  { title: "Геометрическая прогрессия", latex: "b_n = b_1 q^{n-1}" },
  {
    title: "Сумма геометрической прогрессии",
    latex: "S_n = b_1 \\frac{q^n - 1}{q - 1}",
  },
  {
    title: "Бином Ньютона",
    latex: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k",
  },
  {
    title: "Логарифм произведения",
    latex: "\\log_a(xy) = \\log_a x + \\log_a y",
  },
  {
    title: "Формула расстояния",
    latex: "d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}",
  },
  { title: "Наклон прямой", latex: "k = \\frac{y_2-y_1}{x_2-x_1}" },
  {
    title: "Сумма арифметической прогрессии",
    latex: "S_n = \\frac{(a_1 + a_n)n}{2}",
  },
  {
    title: "Сумма первых n натуральных чисел",
    latex: "1 + 2 + \\dots + n = \\frac{n(n+1)}{2}",
  },
  {
    title: "Сумма квадратов",
    latex: "1^2 + 2^2 + \\dots + n^2 = \\frac{n(n+1)(2n+1)}{6}",
  },
  {
    title: "Сумма кубов",
    latex: "1^3 + 2^3 + \\dots + n^3 = \\left(\\frac{n(n+1)}{2}\\right)^2",
  },
  { title: "Дискриминант", latex: "D = b^2 - 4ac" },
  { title: "Вершина параболы", latex: "x_0 = -\\frac{b}{2a}" },
  {
    title: "Корни приведенного квадратного",
    latex: "x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{\\frac{p^2}{4} - q}",
  },
  { title: "Формула Герона", latex: "S = \\sqrt{p(p-a)(p-b)(p-c)}" },
  { title: "Полупериметр треугольника", latex: "p = \\frac{a+b+c}{2}" },
  {
    title: "Площадь треугольника через синус",
    latex: "S = \\frac{1}{2}ab\\sin\\gamma",
  },
  { title: "Теорема косинусов", latex: "c^2 = a^2 + b^2 - 2ab\\cos\\gamma" },
  {
    title: "Теорема синусов",
    latex:
      "\\frac{a}{\\sin\\alpha} = \\frac{b}{\\sin\\beta} = \\frac{c}{\\sin\\gamma}",
  },
  { title: "Площадь трапеции", latex: "S = \\frac{(a+b)h}{2}" },
  { title: "Площадь ромба", latex: "S = \\frac{d_1 d_2}{2}" },
  { title: "Объем куба", latex: "V = a^3" },
  { title: "Объем прямоугольного параллелепипеда", latex: "V = abc" },
  { title: "Объем цилиндра", latex: "V = \\pi r^2 h" },
  { title: "Площадь боковой поверхности цилиндра", latex: "S = 2\\pi r h" },
  { title: "Объем конуса", latex: "V = \\frac{1}{3}\\pi r^2 h" },
  { title: "Объем шара", latex: "V = \\frac{4}{3}\\pi r^3" },
  { title: "Площадь поверхности шара", latex: "S = 4\\pi r^2" },
  { title: "Перестановки", latex: "P_n = n!" },
  { title: "Размещения", latex: "A_n^k = \\frac{n!}{(n-k)!}" },
  { title: "Сочетания", latex: "C_n^k = \\frac{n!}{k!(n-k)!}" },
  { title: "Вероятность", latex: "P(A) = \\frac{m}{n}" },
  { title: "Математическое ожидание", latex: "M(X) = \\sum_{i=1}^{n} x_i p_i" },
  { title: "Дисперсия", latex: "D(X) = M(X^2) - (M(X))^2" },
  {
    title: "Среднее арифметическое",
    latex: "\\overline{x} = \\frac{x_1 + x_2 + \\dots + x_n}{n}",
  },
  { title: "Модуль комплексного числа", latex: "|z| = \\sqrt{a^2 + b^2}" },
  {
    title: "Форма Эйлера",
    latex: "e^{i\\varphi} = \\cos\\varphi + i\\sin\\varphi",
  },
  {
    title: "Формула Муавра",
    latex:
      "(\\cos\\varphi + i\\sin\\varphi)^n = \\cos(n\\varphi) + i\\sin(n\\varphi)",
  },
  { title: "Синус двойного угла", latex: "\\sin 2x = 2\\sin x \\cos x" },
  { title: "Косинус двойного угла", latex: "\\cos 2x = \\cos^2 x - \\sin^2 x" },
  {
    title: "Тангенс двойного угла",
    latex: "\\tan 2x = \\frac{2\\tan x}{1-\\tan^2 x}",
  },
  {
    title: "Сумма синусов",
    latex: "\\sin a + \\sin b = 2\\sin\\frac{a+b}{2}\\cos\\frac{a-b}{2}",
  },
  {
    title: "Разность косинусов",
    latex: "\\cos a - \\cos b = -2\\sin\\frac{a+b}{2}\\sin\\frac{a-b}{2}",
  },
  { title: "Основное логарифмическое тождество", latex: "a^{\\log_a b} = b" },
  {
    title: "Смена основания логарифма",
    latex: "\\log_a b = \\frac{\\log_c b}{\\log_c a}",
  },
  { title: "Производная синуса", latex: "\\frac{d}{dx}\\sin x = \\cos x" },
  { title: "Производная косинуса", latex: "\\frac{d}{dx}\\cos x = -\\sin x" },
  { title: "Производная экспоненты", latex: "\\frac{d}{dx}e^x = e^x" },
  {
    title: "Производная логарифма",
    latex: "\\frac{d}{dx}\\ln x = \\frac{1}{x}",
  },
  { title: "Интеграл экспоненты", latex: "\\int e^x \\, dx = e^x + C" },
  { title: "Интеграл синуса", latex: "\\int \\sin x \\, dx = -\\cos x + C" },
  { title: "Интеграл косинуса", latex: "\\int \\cos x \\, dx = \\sin x + C" },
  {
    title: "Интегрирование по частям",
    latex: "\\int u \\, dv = uv - \\int v \\, du",
  },
  {
    title: "Формула Ньютона-Лейбница",
    latex: "\\int_a^b f(x) \\, dx = F(b) - F(a)",
  },
  { title: "Уравнение окружности", latex: "(x-a)^2 + (y-b)^2 = R^2" },
  { title: "Уравнение прямой", latex: "Ax + By + C = 0" },
  {
    title: "Расстояние от точки до прямой",
    latex: "d = \\frac{|Ax_0 + By_0 + C|}{\\sqrt{A^2 + B^2}}",
  },
];

const CHEMISTRY_FORMULA_TEMPLATES: FormulaTemplate[] = [
  { title: "Нейтрализация", latex: "\\ce{H2SO4 + 2NaOH -> Na2SO4 + 2H2O}" },
  { title: "Образование воды", latex: "\\ce{2H2 + O2 -> 2H2O}" },
  { title: "Фотосинтез", latex: "\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}" },
  { title: "Горение глюкозы", latex: "\\ce{C6H12O6 + 6O2 -> 6CO2 + 6H2O}" },
  { title: "Разложение карбоната", latex: "\\ce{CaCO3 -> CaO + CO2}" },
  { title: "Аммиак", latex: "\\ce{N2 + 3H2 <=> 2NH3}" },
  { title: "Хлорид натрия", latex: "\\ce{2Na + Cl2 -> 2NaCl}" },
  { title: "Окисление железа", latex: "\\ce{4Fe + 3O2 -> 2Fe2O3}" },
  { title: "Степень окисления", latex: "\\ce{Fe^{3+} + 3OH^- -> Fe(OH)3 v}" },
  { title: "Диссоциация кислоты", latex: "\\ce{HCl -> H+ + Cl-}" },
  { title: "Закон Авогадро", latex: "V_m = 22.4\\,\\text{л/моль}" },
  { title: "Количество вещества", latex: "n = \\frac{m}{M}" },
  { title: "Молярная концентрация", latex: "C = \\frac{n}{V}" },
  {
    title: "Массовая доля",
    latex:
      "\\omega = \\frac{m_{\\text{вещества}}}{m_{\\text{раствора}}} \\cdot 100\\%",
  },
  { title: "Горение метана", latex: "\\ce{CH4 + 2O2 -> CO2 + 2H2O}" },
  { title: "Горение углерода", latex: "\\ce{C + O2 -> CO2}" },
  { title: "Горение серы", latex: "\\ce{S + O2 -> SO2}" },
  { title: "Горение магния", latex: "\\ce{2Mg + O2 -> 2MgO}" },
  { title: "Разложение воды электролизом", latex: "\\ce{2H2O -> 2H2 + O2}" },
  { title: "Получение водорода", latex: "\\ce{Zn + 2HCl -> ZnCl2 + H2}" },
  { title: "Получение кислорода", latex: "\\ce{2KClO3 -> 2KCl + 3O2}" },
  {
    title: "Получение углекислого газа",
    latex: "\\ce{CaCO3 + 2HCl -> CaCl2 + CO2 + H2O}",
  },
  { title: "Окисление меди", latex: "\\ce{2Cu + O2 -> 2CuO}" },
  { title: "Восстановление оксида меди", latex: "\\ce{CuO + H2 -> Cu + H2O}" },
  { title: "Реакция железа с серой", latex: "\\ce{Fe + S -> FeS}" },
  {
    title: "Реакция кальция с водой",
    latex: "\\ce{Ca + 2H2O -> Ca(OH)2 + H2}",
  },
  { title: "Реакция натрия с водой", latex: "\\ce{2Na + 2H2O -> 2NaOH + H2}" },
  { title: "Известковая вода", latex: "\\ce{Ca(OH)2 + CO2 -> CaCO3 v + H2O}" },
  {
    title: "Термическое разложение перманганата",
    latex: "\\ce{2KMnO4 -> K2MnO4 + MnO2 + O2}",
  },
  {
    title: "Соляная кислота и карбонат натрия",
    latex: "\\ce{Na2CO3 + 2HCl -> 2NaCl + H2O + CO2}",
  },
  { title: "Серная кислота и цинк", latex: "\\ce{Zn + H2SO4 -> ZnSO4 + H2}" },
  {
    title: "Нитрат серебра и хлорид натрия",
    latex: "\\ce{AgNO3 + NaCl -> AgCl v + NaNO3}",
  },
  {
    title: "Барий и сульфат",
    latex: "\\ce{BaCl2 + Na2SO4 -> BaSO4 v + 2NaCl}",
  },
  {
    title: "Амфотерность алюминия",
    latex: "\\ce{2Al + 2NaOH + 6H2O -> 2Na[Al(OH)4] + 3H2}",
  },
  {
    title: "Степень диссоциации",
    latex: "\\alpha = \\frac{n_{\\text{распавшихся молекул}}}{n_{\\text{общ}}}",
  },
  {
    title: "Константа равновесия",
    latex: "K = \\frac{[C]^c[D]^d}{[A]^a[B]^b}",
  },
  { title: "Скорость реакции", latex: "v = \\frac{\\Delta c}{\\Delta t}" },
  { title: "Уравнение Менделеева-Клапейрона", latex: "pV = nRT" },
  { title: "Плотность газа", latex: "\\rho = \\frac{m}{V}" },
  { title: "Относительная плотность газа", latex: "D = \\frac{M_1}{M_2}" },
  { title: "Количество частиц", latex: "N = n N_A" },
  {
    title: "Число Авогадро",
    latex: "N_A = 6.02 \\cdot 10^{23} \\, \\text{моль}^{-1}",
  },
  { title: "Молярный объем газа", latex: "V = nV_m" },
  { title: "Тепловой эффект реакции", latex: "Q = cm\\Delta t" },
  {
    title: "Массовая доля элемента",
    latex: "w(\\text{элемента}) = \\frac{A_r \\cdot n}{M_r} \\cdot 100\\%",
  },
  {
    title: "Выход продукта реакции",
    latex: "\\eta = \\frac{m_{\\text{практ}}}{m_{\\text{теор}}} \\cdot 100\\%",
  },
  { title: "Водородный показатель", latex: "\\mathrm{pH} = -\\log[\\ce{H+}]" },
  { title: "Гидроксид-ион", latex: "\\mathrm{pOH} = -\\log[\\ce{OH-}]" },
  { title: "Ионное произведение воды", latex: "K_w = [\\ce{H+}][\\ce{OH-}]" },
  { title: "Диссоциация воды", latex: "\\ce{H2O <=> H+ + OH-}" },
  { title: "Сульфат меди и железо", latex: "\\ce{Fe + CuSO4 -> FeSO4 + Cu}" },
  { title: "Получение аммиака", latex: "\\ce{N2 + 3H2 <=> 2NH3}" },
  { title: "Окисление аммиака", latex: "\\ce{4NH3 + 5O2 -> 4NO + 6H2O}" },
  {
    title: "Получение азотной кислоты",
    latex: "\\ce{4NO2 + O2 + 2H2O -> 4HNO3}",
  },
  { title: "Сернистый газ в серную кислоту", latex: "\\ce{2SO2 + O2 -> 2SO3}" },
  {
    title: "Получение фосфорной кислоты",
    latex: "\\ce{P2O5 + 3H2O -> 2H3PO4}",
  },
];

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function filterFormulaTemplates(templates: FormulaTemplate[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return templates.slice(0, 4);
  }

  return templates.filter((template) =>
    template.title.toLowerCase().includes(normalizedQuery),
  );
}

function buildFormulaSearchCards(
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

function reindexNumericRecord<T>(
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

function normalizeExtractedLatex(value: string) {
  return decodeHtmlEntities(value)
    .replace(/^\s*\{\\displaystyle\s*/, "")
    .replace(/^\s*\{\\textstyle\s*/, "")
    .replace(/^\s*\{\\scriptstyle\s*/, "")
    .replace(/\}\s*$/, "")
    .replace(/\\,/g, "\\,")
    .replace(/\s+/g, " ")
    .trim();
}

function collectMatches(value: string, expression: RegExp) {
  return Array.from(value.matchAll(expression), (match) => match[1] ?? "");
}

function extractLatexCandidatesFromWikipediaHtml(html: string) {
  const annotationMatches = collectMatches(
    html,
    /<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>/g,
  );
  const altMatches = collectMatches(html, /alttext="([^"]+)"/g);

  return [...annotationMatches, ...altMatches]
    .map(normalizeExtractedLatex)
    .filter((candidate) => candidate.length >= 3 && candidate.length <= 240);
}

function scoreLatexCandidate(
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

function pickBestLatexCandidate(
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

async function fetchWikipediaFormulaLatex(title: string, kind: FormulaKind) {
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

async function fetchInternetFormulaResults(
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

function getCourseLevelLabel(level: CourseLevel) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  return "Продвинутый";
}

function fileToBase64(file: File): Promise<string> {
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

function detectMaterialTypeFromMime(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("pdf")) return "pdf";
  return "file";
}

function normalizeFormulaForPreview(formula: string, kind: FormulaKind) {
  const trimmed = formula.trim();
  if (!trimmed) {
    return "";
  }

  if (kind === "chemistry" && !trimmed.includes("\\ce{")) {
    return `\\ce{${trimmed}}`;
  }

  return trimmed;
}

function renderFormulaHtml(
  formula: string,
  kind: FormulaKind,
  displayMode = true,
) {
  const normalized = normalizeFormulaForPreview(formula, kind);
  if (!normalized) {
    return "";
  }

  return katex.renderToString(normalized, {
    throwOnError: false,
    displayMode,
    strict: "ignore",
  });
}

export default function NewTeacherCoursePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"course" | "lesson">("course");
  const editingCourseId = useMemo(
    () => searchParams.get("courseId")?.trim() ?? "",
    [searchParams],
  );
  const requestedLessonId = useMemo(
    () => searchParams.get("lessonId")?.trim() ?? "",
    [searchParams],
  );
  const requestedStep = useMemo(
    () => searchParams.get("step")?.trim() ?? "",
    [searchParams],
  );
  const isEditMode = Boolean(editingCourseId);
  const [targetLessonId, setTargetLessonId] = useState("");
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseLevel, setCourseLevel] = useState<CourseLevel>("beginner");

  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonLecture, setLessonLecture] = useState("");
  const [mathFormulaFields, setMathFormulaFields] = useState<string[]>([]);
  const [chemistryFormulaFields, setChemistryFormulaFields] = useState<
    string[]
  >([]);
  const [codeFields, setCodeFields] = useState<string[]>([]);
  const [lessonLinks, setLessonLinks] = useState<string[]>([]);
  const [lessonFiles, setLessonFiles] = useState<File[]>([]);
  const [assignmentText, setAssignmentText] = useState("");
  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [showLinks, setShowLinks] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showAssignmentInput, setShowAssignmentInput] = useState(false);

  const [mathFormulaSearches, setMathFormulaSearches] = useState<
    Record<number, string>
  >({});
  const [chemistryFormulaSearches, setChemistryFormulaSearches] = useState<
    Record<number, string>
  >({});
  const [mathInternetResults, setMathInternetResults] = useState<
    Record<number, InternetFormulaResult[]>
  >({});
  const [chemistryInternetResults, setChemistryInternetResults] = useState<
    Record<number, InternetFormulaResult[]>
  >({});
  const [mathInternetLoading, setMathInternetLoading] = useState<
    Record<number, boolean>
  >({});
  const [chemistryInternetLoading, setChemistryInternetLoading] = useState<
    Record<number, boolean>
  >({});
  const [mathInternetErrors, setMathInternetErrors] = useState<
    Record<number, string>
  >({});
  const [chemistryInternetErrors, setChemistryInternetErrors] = useState<
    Record<number, string>
  >({});

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const mapLessons = (modules: Array<Record<string, unknown>> | undefined) => {
    const list = Array.isArray(modules) ? modules : [];
    return list
      .filter(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          String(item.type ?? "").toLowerCase() === "lesson",
      )
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          id: String(record.id ?? ""),
          title: String(record.title ?? ""),
          description: String(record.description ?? ""),
          materials: Array.isArray(record.materials)
            ? (record.materials as Array<Record<string, unknown>>)
            : [],
        } satisfies LessonRecord;
      })
      .filter((lesson) => Boolean(lesson.id));
  };

  useEffect(() => {
    if (!isEditMode) {
      // For create mode, check if step=lesson is specified in URL
      if (requestedStep === "lesson") {
        setStep("lesson");
      }
      return;
    }

    const loadExistingData = async () => {
      setIsLoadingInitial(true);
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/api/teacher/courses/${editingCourseId}/details`,
          {
            credentials: "include",
          },
        );

        const data = (await response.json()) as TeacherCourseDetailsResponse;

        if (!response.ok) {
          setError(
            data.message ?? "Не удалось загрузить курс для редактирования",
          );
          return;
        }

        setCourseTitle(data.course?.title ?? "");
        setCourseDescription(data.course?.description ?? "");
        setCourseLevel(data.course?.level ?? "beginner");

        // If URL specifies step=lesson, go to lesson step
        if (requestedStep === "lesson") {
          setStep("lesson");
        }
        // If editing a specific lesson, load it and go to lesson step
        else if (requestedLessonId) {
          const lessons = mapLessons(data.course?.modules);
          const selectedLesson =
            lessons.find((lesson) => lesson.id === requestedLessonId) ??
            lessons[0] ??
            null;

          if (selectedLesson) {
            setTargetLessonId(selectedLesson.id);
            setLessonTitle(selectedLesson.title);
            setLessonLecture(selectedLesson.description);

            const existingLinks = selectedLesson.materials
              .filter((material) => String(material.type ?? "") === "link")
              .map((material) => String(material.url ?? "").trim())
              .filter((item) => item.length > 0);

            setLessonLinks(existingLinks);
            setShowLinks(existingLinks.length > 0);
          }

          setStep("lesson");
        }
        // Otherwise stay on course editing step
      } catch {
        setError("Ошибка сети при загрузке курса");
      } finally {
        setIsLoadingInitial(false);
      }
    };

    void loadExistingData();
  }, [isEditMode, editingCourseId, requestedLessonId, requestedStep]);

  useEffect(() => {
    const timers: number[] = [];

    for (const [rawIndex, rawQuery] of Object.entries(mathFormulaSearches)) {
      const index = Number(rawIndex);
      const query = rawQuery.trim();

      if (query.length < 2) {
        setMathInternetLoading((prev) => ({ ...prev, [index]: false }));
        setMathInternetErrors((prev) => ({ ...prev, [index]: "" }));
        setMathInternetResults((prev) => ({ ...prev, [index]: [] }));
        continue;
      }

      const timer = window.setTimeout(() => {
        setMathInternetLoading((prev) => ({ ...prev, [index]: true }));
        setMathInternetErrors((prev) => ({ ...prev, [index]: "" }));

        void fetchInternetFormulaResults(query, "math")
          .then((results) => {
            setMathInternetResults((prev) => ({ ...prev, [index]: results }));
          })
          .catch(() => {
            setMathInternetErrors((prev) => ({
              ...prev,
              [index]: "Не удалось загрузить результаты из интернета",
            }));
            setMathInternetResults((prev) => ({ ...prev, [index]: [] }));
          })
          .finally(() => {
            setMathInternetLoading((prev) => ({ ...prev, [index]: false }));
          });
      }, 450);

      timers.push(timer);
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [mathFormulaSearches]);

  useEffect(() => {
    const timers: number[] = [];

    for (const [rawIndex, rawQuery] of Object.entries(
      chemistryFormulaSearches,
    )) {
      const index = Number(rawIndex);
      const query = rawQuery.trim();

      if (query.length < 2) {
        setChemistryInternetLoading((prev) => ({ ...prev, [index]: false }));
        setChemistryInternetErrors((prev) => ({ ...prev, [index]: "" }));
        setChemistryInternetResults((prev) => ({ ...prev, [index]: [] }));
        continue;
      }

      const timer = window.setTimeout(() => {
        setChemistryInternetLoading((prev) => ({ ...prev, [index]: true }));
        setChemistryInternetErrors((prev) => ({ ...prev, [index]: "" }));

        void fetchInternetFormulaResults(query, "chemistry")
          .then((results) => {
            setChemistryInternetResults((prev) => ({
              ...prev,
              [index]: results,
            }));
          })
          .catch(() => {
            setChemistryInternetErrors((prev) => ({
              ...prev,
              [index]: "Не удалось загрузить результаты из интернета",
            }));
            setChemistryInternetResults((prev) => ({ ...prev, [index]: [] }));
          })
          .finally(() => {
            setChemistryInternetLoading((prev) => ({
              ...prev,
              [index]: false,
            }));
          });
      }, 450);

      timers.push(timer);
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [chemistryFormulaSearches]);

  const updateFieldByIndex = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => {
    setter((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removeFieldByIndex = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLessonLink = (index: number, value: string) => {
    updateFieldByIndex(setLessonLinks, index, value);
  };

  const insertTemplateToField = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    template: FormulaTemplate,
  ) => {
    setter((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const trimmed = item.trim();
        if (!trimmed) {
          return template.latex;
        }

        return `${item}\n${template.latex}`;
      }),
    );
  };

  const removeLessonLink = (index: number) => {
    removeFieldByIndex(setLessonLinks, index);
  };

  const removeFormulaField = (kind: FormulaKind, index: number) => {
    if (kind === "math") {
      removeFieldByIndex(setMathFormulaFields, index);
      setMathFormulaSearches((prev) => reindexNumericRecord(prev, index));
      setMathInternetResults((prev) => reindexNumericRecord(prev, index));
      setMathInternetLoading((prev) => reindexNumericRecord(prev, index));
      setMathInternetErrors((prev) => reindexNumericRecord(prev, index));
      return;
    }

    removeFieldByIndex(setChemistryFormulaFields, index);
    setChemistryFormulaSearches((prev) => reindexNumericRecord(prev, index));
    setChemistryInternetResults((prev) => reindexNumericRecord(prev, index));
    setChemistryInternetLoading((prev) => reindexNumericRecord(prev, index));
    setChemistryInternetErrors((prev) => reindexNumericRecord(prev, index));
  };

  const removeLessonFile = (targetIndex: number) => {
    setLessonFiles((prev) => prev.filter((_, index) => index !== targetIndex));
  };

  const handleLessonFilesChange = (files: FileList | null) => {
    const picked = files ? Array.from(files) : [];
    setError("");
    setLessonFiles((prev) => [...prev, ...picked]);
  };

  const goToLessonStep = async () => {
    if (!courseTitle.trim()) {
      setError("Введите название курса");
      return;
    }

    if (!courseDescription.trim()) {
      setError("Введите описание курса");
      return;
    }

    setError("");

    // If editing course only (no lesson), save and return to lessons list
    if (isEditMode && !requestedLessonId) {
      setIsSaving(true);
      try {
        const updateCourseResponse = await fetch(
          `${API_URL}/api/teacher/courses/${editingCourseId}`,
          {
            credentials: "include",
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: courseTitle.trim(),
              description: courseDescription.trim(),
              level: courseLevel,
            }),
          },
        );

        const updateCourseData = (await updateCourseResponse.json()) as {
          message?: string;
        };

        if (!updateCourseResponse.ok) {
          setError(updateCourseData.message ?? "Не удалось обновить курс");
          return;
        }

        // Redirect back to lessons list
        router.push(
          `/dashboard/teacher/courses?course=${editingCourseId}&updated=1`,
        );
      } catch {
        setError("Ошибка сети при сохранении курса");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // If creating new course or editing course+lesson, move to lesson step
    if (isEditMode && requestedLessonId) {
      // Editing course with lesson - just move to lesson step
      setStep("lesson");
    } else if (!isEditMode) {
      // Creating new course - move to lesson step
      setStep("lesson");
    }
  };

  const addMaterialToLesson = async (
    courseId: string,
    lessonId: string,
    payload: Record<string, unknown>,
  ) => {
    const response = await fetch(
      `${API_URL}/api/teacher/courses/${courseId}/lessons/${lessonId}/materials`,
      {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message ?? "Не удалось добавить материал");
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!lessonTitle.trim()) {
      setError("Введите название урока");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      let courseId = editingCourseId;
      if (isEditMode) {
        const updateCourseResponse = await fetch(
          `${API_URL}/api/teacher/courses/${editingCourseId}`,
          {
            credentials: "include",
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: courseTitle.trim(),
              description: courseDescription.trim(),
              level: courseLevel,
            }),
          },
        );

        const updateCourseData = (await updateCourseResponse.json()) as {
          message?: string;
        };

        if (!updateCourseResponse.ok) {
          setError(updateCourseData.message ?? "Не удалось обновить курс");
          return;
        }
      } else {
        const createCourseResponse = await fetch(
          `${API_URL}/api/teacher/courses`,
          {
            credentials: "include",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: courseTitle.trim(),
              description: courseDescription.trim(),
              level: courseLevel,
              publishNow: false,
            }),
          },
        );

        const createCourseData = (await createCourseResponse.json()) as {
          message?: string;
          course?: { id?: string };
        };

        if (!createCourseResponse.ok) {
          setError(createCourseData.message ?? "Не удалось создать курс");
          return;
        }

        courseId = String(createCourseData.course?.id ?? "");
        if (!courseId) {
          setError("Курс создан, но не получен его идентификатор");
          return;
        }
      }

      let lessonId = targetLessonId;
      if (isEditMode && lessonId) {
        const updateLessonResponse = await fetch(
          `${API_URL}/api/teacher/courses/${courseId}/lessons/${lessonId}`,
          {
            credentials: "include",
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: lessonTitle.trim(),
              description: lessonLecture.trim(),
            }),
          },
        );

        const updateLessonData = (await updateLessonResponse.json()) as {
          message?: string;
        };

        if (!updateLessonResponse.ok) {
          setError(updateLessonData.message ?? "Не удалось обновить урок");
          return;
        }
      } else {
        const createLessonResponse = await fetch(
          `${API_URL}/api/teacher/courses/${courseId}/lessons`,
          {
            credentials: "include",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: lessonTitle.trim(),
              description: lessonLecture.trim(),
            }),
          },
        );

        const createLessonData = (await createLessonResponse.json()) as {
          message?: string;
          lesson?: { id?: string };
        };

        if (!createLessonResponse.ok) {
          setError(
            createLessonData.message ?? "Курс сохранен, но урок не создан",
          );
          return;
        }

        lessonId = String(createLessonData.lesson?.id ?? "");
        if (!lessonId) {
          setError("Урок сохранен, но не получен его идентификатор");
          return;
        }

        setTargetLessonId(lessonId);
      }

      if (!isEditMode && lessonLecture.trim()) {
        await addMaterialToLesson(courseId, lessonId, {
          type: "lecture",
          title: `Лекция: ${lessonTitle.trim()}`,
          text: lessonLecture.trim(),
        });
      }

      const mathFormulas = mathFormulaFields
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      for (const [index, formula] of mathFormulas.entries()) {
        await addMaterialToLesson(courseId, lessonId, {
          type: "lecture",
          title: `Формула по математике ${index + 1}`,
          text: formula,
        });
      }

      const chemistryFormulas = chemistryFormulaFields
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      for (const [index, formula] of chemistryFormulas.entries()) {
        await addMaterialToLesson(courseId, lessonId, {
          type: "lecture",
          title: `Формула по химии ${index + 1}`,
          text: formula,
        });
      }

      const codeSnippets = codeFields
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      for (const [index, snippet] of codeSnippets.entries()) {
        await addMaterialToLesson(courseId, lessonId, {
          type: "lecture",
          title: `Кодовый блок ${index + 1}`,
          text: snippet,
        });
      }

      const links = lessonLinks
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      for (const [index, link] of links.entries()) {
        await addMaterialToLesson(courseId, lessonId, {
          type: "link",
          title: `Ссылка ${index + 1}`,
          url: link,
        });
      }

      for (const file of lessonFiles) {
        const dataBase64 = await fileToBase64(file);
        const payloadFile: LessonUploadFile = {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataBase64,
        };

        await addMaterialToLesson(courseId, lessonId, {
          type: detectMaterialTypeFromMime(payloadFile.type),
          title: file.name,
          file: payloadFile,
        });
      }

      if (showAssignmentInput && assignmentText.trim()) {
        if (!assignmentDueAt.trim()) {
          throw new Error("Укажите дедлайн для задания");
        }

        const assignmentResponse = await fetch(
          `${API_URL}/api/teacher/courses/${courseId}/assignments`,
          {
            credentials: "include",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: assignmentText.trim().slice(0, 120),
              description: assignmentText.trim(),
              lessonId,
              dueAt: assignmentDueAt,
            }),
          },
        );

        const assignmentData = (await assignmentResponse.json()) as {
          message?: string;
        };

        if (!assignmentResponse.ok) {
          throw new Error(
            assignmentData.message ?? "Урок создан, но задание не сохранено",
          );
        }
      }

      if (isEditMode) {
        router.push(`/dashboard/teacher/courses?course=${courseId}&updated=1`);
      } else {
        router.push("/dashboard/teacher/courses?created=1");
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Ошибка сети при сохранении курса",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold sm:text-2xl">
            Конструктор курса и урока
          </h1>
          <Link
            href="/dashboard/teacher/courses"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Назад
          </Link>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {isLoadingInitial ? (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm text-slate-600">Загрузка данных курса...</p>
          </section>
        ) : null}

        {!isLoadingInitial && step === "course" ? (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">Шаг 1 из 2</p>
              {isEditMode ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                  Редактирование курса
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  Курс
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-700">Название курса</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Например: Базовая алгебра"
                  value={courseTitle}
                  onChange={(event) => setCourseTitle(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-slate-700">Описание курса</label>
                <textarea
                  className="mt-1 min-h-32 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Кратко опишите, чему научится студент"
                  value={courseDescription}
                  onChange={(event) => setCourseDescription(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-slate-700">Уровень курса</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  value={courseLevel}
                  onChange={(event) =>
                    setCourseLevel(event.target.value as CourseLevel)
                  }
                >
                  <option value="beginner">
                    {getCourseLevelLabel("beginner")}
                  </option>
                  <option value="intermediate">
                    {getCourseLevelLabel("intermediate")}
                  </option>
                  <option value="advanced">
                    {getCourseLevelLabel("advanced")}
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void goToLessonStep()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-400 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {isSaving
                  ? isEditMode
                    ? "Сохранение..."
                    : "Загрузка..."
                  : isEditMode
                    ? "Сохранить изменения"
                    : "Дальше"}
                {!isEditMode && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </section>
        ) : null}

        {!isLoadingInitial && step === "lesson" ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-slate-600">Шаг 2 из 2</p>
                {isEditMode ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    Редактирование урока
                  </span>
                ) : (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    Урок
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-700">
                    Название урока
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                    placeholder="Введите название урока"
                    value={lessonTitle}
                    onChange={(event) => setLessonTitle(event.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-700">
                    Основной текст урока
                  </label>
                  <textarea
                    className="mt-1 min-h-36 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                    placeholder="Теория, объяснение, шаги и примеры"
                    value={lessonLecture}
                    onChange={(event) => setLessonLecture(event.target.value)}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-sm text-slate-700">
                    Специальные поля
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMathFormulaFields((prev) => [...prev, ""])
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
                    >
                      <Sigma className="h-4 w-4" />
                      Формулы математики
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setChemistryFormulaFields((prev) => [...prev, ""])
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-sm text-cyan-700 hover:bg-cyan-100"
                    >
                      <FlaskConical className="h-4 w-4" />
                      Формулы химии
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodeFields((prev) => [...prev, ""])}
                      className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100"
                    >
                      <Code2 className="h-4 w-4" />
                      Код программирования
                    </button>
                  </div>
                </div>

                {mathFormulaFields.map((item, index) => (
                  <div
                    key={`math-formula-${index + 1}`}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-emerald-800">
                        Формула математики {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFormulaField("math", index)}
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                        aria-label={`Удалить поле формулы математики ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mb-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="Найти формулу"
                          value={mathFormulaSearches[index] ?? ""}
                          onChange={(event) =>
                            setMathFormulaSearches((prev) => ({
                              ...prev,
                              [index]: event.target.value,
                            }))
                          }
                          className="h-9 w-full max-w-xs rounded-md border border-emerald-300 bg-white px-3 text-sm text-emerald-900 outline-none transition focus:border-emerald-500"
                        />
                        <p className="text-xs text-emerald-700">
                          Локальный и интернет-поиск по названию
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                            Результаты поиска
                          </p>
                          {mathFormulaSearches[index]?.trim().length >= 2 &&
                          mathInternetLoading[index] ? (
                            <p className="text-xs text-slate-500">
                              Ищу в интернете...
                            </p>
                          ) : null}
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {buildFormulaSearchCards(
                            MATH_FORMULA_TEMPLATES,
                            mathInternetResults[index] ?? [],
                            mathFormulaSearches[index] ?? "",
                          ).map((card) => (
                            <div
                              key={`${card.source}-${card.title}-${card.latex}-${index}`}
                              className="rounded-xl border border-emerald-300 bg-white p-3"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  insertTemplateToField(
                                    setMathFormulaFields,
                                    index,
                                    {
                                      title: card.title,
                                      latex: card.latex,
                                    },
                                  )
                                }
                                className="w-full text-left"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                    {card.title}
                                  </p>
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                    {card.source === "local"
                                      ? "Локально"
                                      : "Интернет"}
                                  </span>
                                </div>
                                <div
                                  className="mt-2 overflow-x-auto text-emerald-950"
                                  dangerouslySetInnerHTML={{
                                    __html: renderFormulaHtml(
                                      card.latex,
                                      "math",
                                    ),
                                  }}
                                />
                                {card.snippet ? (
                                  <p className="mt-2 text-sm text-slate-600">
                                    {card.snippet}
                                  </p>
                                ) : null}
                              </button>
                              {card.url ? (
                                <a
                                  href={card.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900"
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  Источник
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {buildFormulaSearchCards(
                          MATH_FORMULA_TEMPLATES,
                          mathInternetResults[index] ?? [],
                          mathFormulaSearches[index] ?? "",
                        ).length === 0 ? (
                          mathInternetErrors[index] ? (
                            <p className="text-sm text-slate-500">
                              Внешние формулы временно недоступны. Попробуйте
                              другой запрос или выберите локальную формулу.
                            </p>
                          ) : (
                            <p className="text-sm text-emerald-600">
                              По этому запросу формулы не найдены.
                            </p>
                          )
                        ) : null}
                      </div>
                    </div>
                    <textarea
                      className="min-h-24 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 font-mono text-sm text-emerald-900"
                      placeholder="Введите формулу в LaTeX-виде, например: \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
                      value={item}
                      onChange={(event) =>
                        updateFieldByIndex(
                          setMathFormulaFields,
                          index,
                          event.target.value,
                        )
                      }
                    />
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Предпросмотр как в учебнике
                      </p>
                      {item.trim() ? (
                        <div
                          className="mt-2 overflow-x-auto text-slate-900"
                          dangerouslySetInnerHTML={{
                            __html: renderFormulaHtml(item, "math"),
                          }}
                        />
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          Выберите шаблон или введите формулу вручную.
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {chemistryFormulaFields.map((item, index) => (
                  <div
                    key={`chem-formula-${index + 1}`}
                    className="rounded-xl border border-cyan-300 bg-cyan-50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-cyan-800">
                        Формула химии {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFormulaField("chemistry", index)}
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                        aria-label={`Удалить поле формулы химии ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mb-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="Найти формулу"
                          value={chemistryFormulaSearches[index] ?? ""}
                          onChange={(event) =>
                            setChemistryFormulaSearches((prev) => ({
                              ...prev,
                              [index]: event.target.value,
                            }))
                          }
                          className="h-9 w-full max-w-xs rounded-md border border-cyan-300 bg-white px-3 text-sm text-cyan-900 outline-none transition focus:border-cyan-500"
                        />
                        <p className="text-xs text-cyan-700">
                          Локальный и интернет-поиск по названию
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                            Результаты поиска
                          </p>
                          {chemistryFormulaSearches[index]?.trim().length >=
                            2 && chemistryInternetLoading[index] ? (
                            <p className="text-xs text-slate-500">
                              Ищу в интернете...
                            </p>
                          ) : null}
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {buildFormulaSearchCards(
                            CHEMISTRY_FORMULA_TEMPLATES,
                            chemistryInternetResults[index] ?? [],
                            chemistryFormulaSearches[index] ?? "",
                          ).map((card) => (
                            <div
                              key={`${card.source}-${card.title}-${card.latex}-${index}`}
                              className="rounded-xl border border-cyan-300 bg-white p-3"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  insertTemplateToField(
                                    setChemistryFormulaFields,
                                    index,
                                    {
                                      title: card.title,
                                      latex: card.latex,
                                    },
                                  )
                                }
                                className="w-full text-left"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                                    {card.title}
                                  </p>
                                  <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                                    {card.source === "local"
                                      ? "Локально"
                                      : "Интернет"}
                                  </span>
                                </div>
                                <div
                                  className="mt-2 overflow-x-auto text-cyan-950"
                                  dangerouslySetInnerHTML={{
                                    __html: renderFormulaHtml(
                                      card.latex,
                                      "chemistry",
                                    ),
                                  }}
                                />
                                {card.snippet ? (
                                  <p className="mt-2 text-sm text-slate-600">
                                    {card.snippet}
                                  </p>
                                ) : null}
                              </button>
                              {card.url ? (
                                <a
                                  href={card.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-700 hover:text-cyan-900"
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  Источник
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {buildFormulaSearchCards(
                          CHEMISTRY_FORMULA_TEMPLATES,
                          chemistryInternetResults[index] ?? [],
                          chemistryFormulaSearches[index] ?? "",
                        ).length === 0 ? (
                          chemistryInternetErrors[index] ? (
                            <p className="text-sm text-slate-500">
                              Внешние формулы временно недоступны. Попробуйте
                              другой запрос или выберите локальную формулу.
                            </p>
                          ) : (
                            <p className="text-sm text-cyan-600">
                              По этому запросу формулы не найдены.
                            </p>
                          )
                        ) : null}
                      </div>
                    </div>
                    <textarea
                      className="min-h-24 w-full rounded-lg border border-cyan-300 bg-white px-3 py-2 font-mono text-sm text-cyan-900"
                      placeholder="Введите формулу, например: \ce{H2SO4 + 2NaOH -> Na2SO4 + 2H2O}"
                      value={item}
                      onChange={(event) =>
                        updateFieldByIndex(
                          setChemistryFormulaFields,
                          index,
                          event.target.value,
                        )
                      }
                    />
                    <div className="mt-3 rounded-lg border border-cyan-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                        Предпросмотр как в учебнике
                      </p>
                      {item.trim() ? (
                        <div
                          className="mt-2 overflow-x-auto text-slate-900"
                          dangerouslySetInnerHTML={{
                            __html: renderFormulaHtml(item, "chemistry"),
                          }}
                        />
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          Выберите шаблон или введите формулу вручную.
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {codeFields.map((item, index) => (
                  <div
                    key={`code-field-${index + 1}`}
                    className="rounded-xl border border-violet-300 bg-violet-50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-violet-800">
                        Кодовый блок {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFieldByIndex(setCodeFields, index)}
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                        aria-label={`Удалить кодовый блок ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      className="min-h-28 w-full rounded-lg border border-violet-300 bg-white px-3 py-2 font-mono text-sm text-violet-900"
                      placeholder="Введите код"
                      value={item}
                      onChange={(event) =>
                        updateFieldByIndex(
                          setCodeFields,
                          index,
                          event.target.value,
                        )
                      }
                    />
                  </div>
                ))}

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMaterials((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-100"
                    >
                      <Paperclip className="h-4 w-4" />
                      Добавить материалы
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowLinks(true);
                        setLessonLinks((prev) => [...prev, ""]);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-100"
                    >
                      <Link2 className="h-4 w-4" />
                      Добавить ссылки
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAssignmentInput((prev) => !prev)}
                      className="rounded-lg border border-lime-300 bg-lime-50 px-3 py-1.5 text-sm text-lime-700 hover:bg-lime-100"
                    >
                      Добавить задание
                    </button>
                  </div>

                  {showMaterials ? (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/50 p-3">
                      <p className="text-xs text-slate-700">
                        Можно прикрепить любые типы файлов без ограничения по
                        типу.
                      </p>
                      <input
                        type="file"
                        className="mt-2 w-full text-sm text-slate-700"
                        multiple
                        onChange={(event) =>
                          handleLessonFilesChange(event.target.files)
                        }
                      />

                      {lessonFiles.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-sm text-slate-700">
                          {lessonFiles.map((file, index) => (
                            <li
                              key={`${file.name}-${file.size}-${index}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeLessonFile(index)}
                                className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                              >
                                Удалить
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {showLinks ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-sky-300 bg-sky-50/40 p-3">
                      {lessonLinks.map((link, index) => (
                        <div
                          key={`new-link-${index + 1}`}
                          className="flex gap-2"
                        >
                          <input
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            placeholder={`Ссылка ${index + 1}`}
                            value={link}
                            onChange={(event) =>
                              updateLessonLink(index, event.target.value)
                            }
                          />
                          <button
                            type="button"
                            onClick={() => removeLessonLink(index)}
                            className="rounded-md border border-rose-300 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100"
                          >
                            Удалить
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {showAssignmentInput ? (
                    <div className="mt-3 rounded-lg border border-lime-300 bg-lime-50/40 p-3">
                      <textarea
                        className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        placeholder="Текст задания"
                        value={assignmentText}
                        onChange={(event) =>
                          setAssignmentText(event.target.value)
                        }
                      />
                      <div className="mt-2">
                        <label className="text-sm text-slate-700">
                          Дедлайн задания
                        </label>
                        <input
                          type="datetime-local"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          value={assignmentDueAt}
                          onChange={(event) =>
                            setAssignmentDueAt(event.target.value)
                          }
                          required={
                            showAssignmentInput &&
                            Boolean(assignmentText.trim())
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("course")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Назад к курсу
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-400 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving
                  ? "Сохранение..."
                  : isEditMode
                    ? "Сохранить изменения"
                    : "Сохранить"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
