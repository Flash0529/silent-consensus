"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { Check } from "../icons";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  const Tag = htmlFor ? "label" : "p";
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Tag {...(htmlFor ? { htmlFor } : {})} className="block text-lead font-semibold text-porcelain">
          {label}
        </Tag>
        {hint && <p className="mt-0.5 text-body-sm text-ash">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  maxLength = 24,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      id={id}
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-media bg-porcelain/[.04] px-4 text-lead text-porcelain shadow-[inset_0_0_0_1px_#6e6e73] outline-offset-1 transition placeholder:text-slate focus:outline focus:outline-1 focus:outline-galaxy"
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-carbon p-1"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="relative min-h-11 cursor-pointer rounded-full px-2 py-2 text-[15px] font-medium"
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-steel"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className={`relative block transition-colors ${on ? "text-porcelain" : "text-ash"}`}>{o.label}</span>
            {o.sub && <span className="relative block text-micro font-normal text-ash">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ChipGroup({
  options,
  value,
  onToggle,
  label,
}: {
  options: string[];
  value: string[];
  onToggle: (option: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <motion.button
            key={o}
            type="button"
            aria-pressed={on}
            whileTap={{ scale: 0.94 }}
            onClick={() => onToggle(o)}
            className={`flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition-colors duration-200 ${
              on
                ? "border-porcelain bg-porcelain text-obsidian"
                : "border-slate bg-transparent text-porcelain hover:border-ash"
            }`}
          >
            <motion.span
              initial={false}
              animate={{ width: on ? 16 : 0, opacity: on ? 1 : 0 }}
              className="inline-flex overflow-hidden"
            >
              <Check size={16} />
            </motion.span>
            {o}
          </motion.button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  sub,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-[16px] font-medium text-porcelain">{label}</span>
        {sub && <span className="block text-body-sm text-ash">{sub}</span>}
      </span>
      <span
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ${checked ? "bg-[#30d158]" : "bg-[#39393d]"}`}
      >
        <motion.span
          className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.15)]"
          animate={{ left: checked ? 22 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      </span>
    </button>
  );
}

export function Slider({
  id,
  min,
  max,
  step,
  value,
  onChange,
  format,
  label,
}: {
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  label: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-body-sm text-ash">{format(min)}</span>
        <output htmlFor={id} className="text-stat tabular-nums text-porcelain">
          {format(value)}
        </output>
        <span className="text-body-sm text-ash">{format(max)}</span>
      </div>
      <input
        id={id}
        type="range"
        aria-label={label}
        aria-valuetext={format(value)}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="qc-range mt-3 w-full cursor-pointer"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}
