import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, type Ref } from "react";

type SearchResultItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  kind: "course" | "lesson" | "user";
};

type SearchDropdownProps = {
  containerRef: Ref<HTMLDivElement>;
  searchOpen: boolean;
  onToggleOpen: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchLoading: boolean;
  filteredSearch: SearchResultItem[];
  onSelectResult: () => void;
};

export function SearchDropdown({
  containerRef,
  searchOpen,
  onToggleOpen,
  searchQuery,
  onSearchQueryChange,
  searchLoading,
  filteredSearch,
  onSelectResult,
}: SearchDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key !== "/" || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
        (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [role=textbox]")))) return;
      if (!triggerRef.current?.getClientRects().length) return;
      event.preventDefault();
      if (!searchOpen) onToggleOpen();
      else inputRef.current?.focus();
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [searchOpen, onToggleOpen]);
  return (
    <div ref={containerRef} className="relative hidden md:block" onKeyDown={(event) => {
      if (searchOpen && event.key === "Escape") {
        event.preventDefault();
        onToggleOpen();
        triggerRef.current?.focus();
      }
      if (!searchOpen || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
      const links = Array.from(resultsRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
      if (!links.length) return;
      event.preventDefault();
      const index = links.indexOf(document.activeElement as HTMLAnchorElement);
      if (event.key === "ArrowUp" && index === 0) inputRef.current?.focus();
      else links[event.key === "ArrowDown" ? (index + 1) % links.length : index < 0 ? links.length - 1 : index - 1]?.focus();
    }}>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={searchOpen}
        aria-controls={searchOpen ? panelId : undefined}
        aria-keyshortcuts="/"
        onClick={onToggleOpen}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-sm text-slate-600 shadow-sm hover:bg-white"
      >
        <Search className="h-4 w-4" />
        Поиск
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
          /
        </span>
      </button>

      {searchOpen ? (
        <div id={panelId} className="absolute right-0 top-12 w-[min(520px,calc(100vw_-_2rem))] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              ref={inputRef}
              aria-label="Поиск курсов, уроков и пользователей"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Курсы, уроки и пользователи"
              className="h-10 w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <div ref={resultsRef} aria-busy={searchLoading} className="mt-3 max-h-[320px] space-y-1 overflow-y-auto">
            {searchLoading ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                Загрузка результатов…
              </p>
            ) : filteredSearch.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                Ничего не найдено
              </p>
            ) : (
              filteredSearch.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2 hover:border-slate-200 hover:bg-slate-50"
                  onClick={onSelectResult}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.label}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {item.description}
                    </p>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                    {item.kind === "user"
                      ? "Пользователь"
                      : item.kind === "lesson"
                        ? "Урок"
                        : "Курс"}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
