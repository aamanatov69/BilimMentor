"use client";
import { useId } from "react";

const fieldClass = "mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base font-normal focus-visible:outline focus-visible:outline-blue-600";
export function SearchFilter({ label = "Поиск", value, onChange, placeholder }: { label?: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const id = useId();
  return <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}<input id={id} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={fieldClass} /></label>;
}
export function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: ReadonlyArray<{ value: string; label: string }> }) {
  const id = useId();
  return <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}<select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
