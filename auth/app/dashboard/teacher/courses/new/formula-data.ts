export type FormulaKind = "math" | "chemistry";

export type FormulaTemplate = {
  title: string;
  latex: string;
};

export type FormulaSearchCard = {
  title: string;
  latex: string;
  snippet?: string;
  url?: string;
  source: "local" | "internet";
};

export type InternetFormulaResult = {
  title: string;
  latex: string;
  snippet: string;
  url: string;
};

export type WikipediaSearchResponse = {
  query?: {
    search?: Array<{
      title?: string;
      snippet?: string;
    }>;
  };
};

export type WikipediaParseResponse = {
  parse?: {
    text?: {
      "*"?: string;
    };
  };
};

export type WikipediaHostConfig = {
  apiBaseUrl: string;
  pageBaseUrl: string;
  searchQuery: (query: string, kind: FormulaKind) => string;
};

export const WIKIPEDIA_HOSTS: WikipediaHostConfig[] = [
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

export const MATH_FORMULA_TEMPLATES: FormulaTemplate[] = [
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

export const CHEMISTRY_FORMULA_TEMPLATES: FormulaTemplate[] = [
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
