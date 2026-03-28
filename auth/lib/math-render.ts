import katex from "katex";
import "katex/contrib/mhchem";

type FormulaKind = "math" | "chemistry";

type RenderFormulaOptions = {
  displayMode?: boolean;
  kind?: FormulaKind;
};

function normalizeHumanMathToLatex(input: string) {
  let value = input
    .replace(/[\u200B\u200C\u200D\u2060\u2061\u2062\u2063\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) {
    return "";
  }

  const symbolMap: Array<[RegExp, string]> = [
    [/∞/g, "\\\\infty"],
    [/∫/g, "\\\\int"],
    [/∑/g, "\\\\sum"],
    [/∏/g, "\\\\prod"],
    [/√/g, "\\\\sqrt"],
    [/≤/g, "\\\\le"],
    [/≥/g, "\\\\ge"],
    [/≠/g, "\\\\ne"],
    [/≈/g, "\\\\approx"],
    [/→/g, "\\\\to"],
    [/×/g, "\\\\cdot"],
    [/÷/g, "\\\\div"],
    [/−/g, "-"],
  ];

  for (const [pattern, replacement] of symbolMap) {
    value = value.replace(pattern, replacement);
  }

  value = value
    .replace(
      /\\int\s+([^\s]+)\s+([^\s]+)\s+(.+?)\s+d\s*([a-zA-Zа-яА-Я])/i,
      "\\\\int_{$1}^{$2} $3 \\\\, d$4",
    )
    .replace(/\\sum\s+([^\s]+)\s+([^\s]+)\s+(.+)/i, "\\\\sum_{$1}^{$2} $3")
    .replace(/\\prod\s+([^\s]+)\s+([^\s]+)\s+(.+)/i, "\\\\prod_{$1}^{$2} $3")
    .replace(/\\infty(?=\d)/g, "\\\\infty ")
    .replace(/\bd\s+([a-zA-Zа-яА-Я])/g, "d$1")
    .trim();

  return value;
}

function looksLikeMathText(value: string) {
  return /[∞∫∑∏√≤≥≠≈]|\\(int|sum|prod|sqrt|frac|lim|infty|ce|pu)|\^|_|\b(dx|dy|dz)\b/i.test(
    value,
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeFormula(formula: string, kind: FormulaKind) {
  const trimmed = formula.trim();
  if (!trimmed) {
    return "";
  }

  if (kind === "chemistry") {
    const hasChem = /\\ce\{|\\pu\{/.test(trimmed);
    return hasChem ? trimmed : `\\ce{${trimmed}}`;
  }

  return normalizeHumanMathToLatex(trimmed);
}

export function renderFormulaAsMathTypeHtml(
  formula: string,
  options: RenderFormulaOptions = {},
) {
  const kind = options.kind ?? "math";
  const normalized = normalizeFormula(formula, kind);
  if (!normalized) {
    return "";
  }

  try {
    return katex.renderToString(normalized, {
      throwOnError: false,
      displayMode: options.displayMode ?? true,
      strict: "ignore",
    });
  } catch {
    const secondTry = normalizeHumanMathToLatex(formula);
    if (secondTry && secondTry !== normalized) {
      try {
        return katex.renderToString(secondTry, {
          throwOnError: false,
          displayMode: options.displayMode ?? true,
          strict: "ignore",
        });
      } catch {
        return escapeHtml(formula).replace(/\n/g, "<br />");
      }
    }
    return escapeHtml(formula).replace(/\n/g, "<br />");
  }
}

export function renderTextWithMathTypeTokensHtml(value: string) {
  const tokenPattern = /\[\[(MATH|CHEM):([\s\S]*?)\]\]/g;
  let html = "";
  let lastIndex = 0;

  for (const match of value.matchAll(tokenPattern)) {
    const matchIndex = match.index ?? 0;
    html += escapeHtml(value.slice(lastIndex, matchIndex)).replace(
      /\n/g,
      "<br />",
    );

    const tokenType = (match[1] ?? "MATH").toUpperCase();
    const tokenFormula = (match[2] ?? "").trim();

    if (tokenFormula) {
      const displayMode =
        tokenType === "CHEM" ? true : looksLikeMathText(tokenFormula);
      html += `<span class="inline-block align-middle">${renderFormulaAsMathTypeHtml(
        tokenFormula,
        {
          kind: tokenType === "CHEM" ? "chemistry" : "math",
          displayMode,
        },
      )}</span>`;
    }

    lastIndex = matchIndex + match[0].length;
  }

  html += escapeHtml(value.slice(lastIndex)).replace(/\n/g, "<br />");
  return html;
}
