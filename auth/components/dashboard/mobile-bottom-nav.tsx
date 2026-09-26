"use client";

import { MoreHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
type MobileBottomNavProps = {
  navItems: NavItem[];
  isActivePath: (href: string, exact?: boolean) => boolean;
  shouldShowAlertDot: (href: string) => boolean;
  unreadCount: number;
};

export function MobileBottomNav({ navItems, isActivePath, shouldShowAlertDot, unreadCount }: MobileBottomNavProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();
  const primary = navItems.length > 5 ? navItems.slice(0, 4) : navItems;
  const extra = navItems.length > 5 ? navItems.slice(4) : [];
  const hasAlert = (item: NavItem) => shouldShowAlertDot(item.href) || (item.href.endsWith("/notifications") && unreadCount > 0);
  const extraActive = extra.some((item) => isActivePath(item.href, item.exact));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      desktop.removeEventListener("change", resize);
    };
  }, [open]);

  const renderLink = (item: NavItem, expanded = false) => {
    const Icon = item.icon;
    const active = isActivePath(item.href, item.exact);
    return (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
        onClick={() => setOpen(false)}
        className={`${expanded ? "flex min-h-12 items-center gap-3 px-4" : "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center"} rounded-lg text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${active ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}>
        <span className="relative">
          <Icon aria-hidden="true" className="h-5 w-5" />
          {hasAlert(item) ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500"><span className="sr-only">Есть новые события</span></span> : null}
        </span>
        <span className="break-words leading-4">{item.label}</span>
      </Link>
    );
  };

  return (
    <nav ref={container} aria-label="Основная навигация на телефоне" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }} className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white pb-[max(env(safe-area-inset-bottom),0.25rem)] lg:hidden">
      {open ? <div id={panelId} className="absolute bottom-full left-2 right-2 mb-2 max-h-[60dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        {extra.map((item) => renderLink(item, true))}
      </div> : null}
      <div className="mx-auto grid max-w-[1440px] gap-1 px-1 pt-1" style={{ gridTemplateColumns: `repeat(${primary.length + (extra.length ? 1 : 0)}, minmax(0, 1fr))` }}>
        {primary.map((item) => renderLink(item))}
        {extra.length ? <button ref={trigger} type="button" aria-expanded={open} aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((value) => !value)}
          className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${extraActive || open ? "bg-blue-50 text-blue-800" : "text-slate-700"}`}>
          <span className="relative"><MoreHorizontal aria-hidden="true" className="h-5 w-5" />
            {extra.some(hasAlert) ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500"><span className="sr-only">Есть новые события</span></span> : null}
          </span>
          Ещё
        </button> : null}
      </div>
    </nav>
  );
}
