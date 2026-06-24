'use client'

import type React from 'react'
import { useEffect, useMemo, useState } from "react";
import {
  ENVS, EnvKey, Market, AERO_TEMPLATE, QUOTE_SYMBOL,
  fmt, rawMmr, rawImpact, rawStepPrice, rawStepSize,
} from "@/src/lib/lovable-risex";
import { cn } from "@/src/lib/utils";
import {
  Activity, AlertTriangle, ArrowRight, Check, ChevronDown, Circle,
  CircleDot, Copy, ExternalLink, FileJson, Github, Hash, Loader2, Lock,
  Plug, Plus, RefreshCw, Search, Shield, Sparkles, Terminal, Unlock,
  Wallet, X, Zap,
} from "lucide-react";

/* ----------------------------- Primitives ------------------------------ */

function RiseLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path d="M3 18 L9 8 L13 14 L21 4" stroke="hsl(var(--primary))" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter" />
        <path d="M16 4 H21 V9" stroke="hsl(var(--primary))" strokeWidth="2.2" strokeLinecap="square" />
      </svg>
      <span className="font-mono text-[13px] tracking-[0.18em] font-semibold">RISE<span className="text-primary">x</span></span>
    </div>
  );
}

function Dot({ color = "primary", pulse = false }: { color?: string; pulse?: boolean }) {
  return <span className={cn("dot", pulse && "animate-pulse-dot")} style={{ background: `hsl(var(--${color}))` }} />;
}

function Chip({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "primary" | "warning" | "destructive" | "accent" | "muted"; className?: string }) {
  const toneCls: Record<string, string> = {
    default: "text-foreground border-border-strong",
    primary: "text-primary border-primary/40 bg-primary/10",
    warning: "text-warning border-warning/40 bg-warning/10",
    destructive: "text-destructive border-destructive/40 bg-destructive/10",
    accent: "text-accent border-accent/40 bg-accent/10",
    muted: "text-muted-foreground",
  };
  return <span className={cn("chip", toneCls[tone], className)}>{children}</span>;
}

function Btn({ children, variant = "default", size = "md", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "outline" | "danger"; size?: "sm" | "md" }) {
  const v: Record<string, string> = {
    default: "bg-surface-2 hover:bg-surface-3 border border-border text-foreground",
    primary: "bg-primary hover:bg-primary-glow text-primary-foreground border border-primary",
    ghost: "hover:bg-surface-2 text-foreground border border-transparent",
    outline: "border border-border-strong hover:bg-surface-2 text-foreground",
    danger: "bg-destructive/15 hover:bg-destructive/25 text-destructive border border-destructive/40",
  };
  const s = size === "sm" ? "h-7 px-2 text-[11px]" : "h-8 px-3 text-[12px]";
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm font-mono uppercase tracking-wider transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        v[variant], s, className,
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label, value, onChange, raw, suffix, helper, mode, type = "number",
}: {
  label: string; value: string | number; onChange: (v: string) => void;
  raw?: string; suffix?: string; helper?: string; mode: "friendly" | "raw";
  type?: "text" | "number";
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{label}</label>
        {suffix && <span className="text-[10px] font-mono text-muted-foreground">{suffix}</span>}
      </div>
      <div className="flex items-stretch border border-border bg-surface-2 focus-within:border-primary/60 rounded-sm overflow-hidden">
        <input
          aria-label={label}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent px-2 py-1.5 font-mono text-[12px] outline-none w-full min-w-0"
        />
        {mode === "raw" && <span className="px-1.5 py-1.5 text-[9px] font-mono text-muted-foreground border-l border-border bg-background/40">RAW</span>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-muted-foreground truncate" title={raw}>
          {raw !== undefined && <>raw: <span className="text-foreground/70">{raw}</span></>}
        </span>
        {helper && <span className="text-[10px] font-mono text-muted-foreground/70">{helper}</span>}
      </div>
    </div>
  );
}

/* ----------------------------- Env Selector ---------------------------- */

function EnvBadge({ env }: { env: EnvKey }) {
  const cfg = ENVS.find(e => e.key === env)!;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
      <Dot color={`env-${env}`} pulse />
      <span className="text-foreground">{cfg.label}</span>
    </span>
  );
}

function EnvSwitcher({ env, setEnv }: { env: EnvKey; setEnv: (e: EnvKey) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = ENVS.find(e => e.key === env)!;
  return (
    <div className="relative" role="group" aria-label="Environment">
      <button
        aria-label={`Environment ${cfg.label}`}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 h-8 px-2.5 border border-border-strong bg-surface-2 hover:bg-surface-3 rounded-sm"
      >
        <Dot color={`env-${env}`} pulse />
        <span className="font-mono text-[12px] tracking-wide">{cfg.label}</span>
        <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground">{cfg.mode === "safe" ? "SAFE" : "EOA"}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-40 w-72 panel rounded-sm shadow-2xl">
            <div className="panel-header"><span className="panel-title">Environment</span></div>
            <div>
              {ENVS.map((e) => (
                <button key={e.key} onClick={() => { setEnv(e.key); setOpen(false); }}
                  className={cn("w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-border last:border-b-0 flex items-start gap-2",
                    env === e.key && "bg-surface-2")}>
                  <Dot color={`env-${e.key}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px]">{e.label}</span>
                      <span className={cn("font-mono text-[9px] px-1 rounded-sm border", e.mode === "safe" ? "border-destructive/40 text-destructive bg-destructive/10" : "border-primary/40 text-primary bg-primary/10")}>
                        {e.mode === "safe" ? "SAFE PROPOSAL" : "EOA TX"}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">{e.chain}</div>
                    <div className="text-[10px] font-mono text-muted-foreground/70 truncate">AM {e.access}{e.safe ? ` · ${e.safe}` : ""}</div>
                  </div>
                  {env === e.key && <Check className="h-3 w-3 text-primary mt-1" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------- Header ------------------------------- */

function Header({ env, setEnv, github, setGithub, wallet, setWallet }: {
  env: EnvKey; setEnv: (e: EnvKey) => void;
  github: string | null; setGithub: (v: string | null) => void;
  wallet: string | null; setWallet: (v: string | null) => void;
}) {
  const cfg = ENVS.find(e => e.key === env)!;
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 sm:px-4 h-auto py-2 sm:h-12 sm:py-0">
        <RiseLogo />
        <span className="hidden md:inline text-muted-foreground/40 font-mono text-xs">/</span>
        <div className="font-mono text-[12px] tracking-wide">
          market-admin <span className="text-muted-foreground">·</span> <span className="text-muted-foreground">operator console</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 ml-2">
          <Chip tone="muted"><Hash className="h-3 w-3" /> {cfg.chain.split("·")[1]?.trim()}</Chip>
          <Chip tone={cfg.mode === "safe" ? "destructive" : "primary"}>
            {cfg.mode === "safe" ? <Shield className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
            {cfg.mode === "safe" ? "Safe MultiSend" : "EOA Execute"}
          </Chip>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {github ? (
            <button onClick={() => setGithub(null)} className="inline-flex items-center gap-1.5 h-8 px-2 border border-border bg-surface-2 hover:bg-surface-3 rounded-sm">
              <Github className="h-3.5 w-3.5" /><span className="font-mono text-[11px]">{github}</span>
            </button>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setGithub("@rise-ops")}>
              <Github className="h-3 w-3" /> Sign in
            </Btn>
          )}
          {wallet ? (
            <button onClick={() => setWallet(null)} className="inline-flex items-center gap-1.5 h-8 px-2 border border-border bg-surface-2 hover:bg-surface-3 rounded-sm">
              <Wallet className="h-3.5 w-3.5 text-primary" /><span className="font-mono text-[11px]">{wallet}</span>
            </button>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setWallet("0x9F2c…AeB1")}>
              <Plug className="h-3 w-3" /> Connect
            </Btn>
          )}
          <EnvSwitcher env={env} setEnv={setEnv} />
        </div>
      </div>
    </header>
  );
}

/* ----------------------------- Markets Table --------------------------- */

type LoadState = "loading" | "error" | "empty" | "ok";

function StatusPill({ s }: { s: Market["status"] }) {
  if (s === "unlocked") return <Chip tone="primary"><Unlock className="h-3 w-3" /> unlocked</Chip>;
  return <Chip tone="destructive"><Lock className="h-3 w-3" /> locked</Chip>;
}

function DeferredPill({ enabled }: { enabled: boolean }) {
  if (enabled) return <Chip tone="warning"><CircleDot className="h-3 w-3" /> enabled</Chip>;
  return <Chip tone="muted">sync</Chip>;
}

function MarketsTable({
  env, markets, selectedId, onSelect, onOpenEditor, loadState, error, onRefresh,
}: {
  env: EnvKey; markets: Market[]; selectedId: number | null;
  onSelect: (id: number) => void; onOpenEditor: (id: number) => void;
  loadState: LoadState; error?: string; onRefresh: () => void;
}) {
  const [filter, setFilter] = useState("");
  const state = loadState;

  const filtered = useMemo(
    () => markets.filter(m => m.symbol.toLowerCase().includes(filter.toLowerCase())),
    [markets, filter],
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="panel-title">Live Markets · {env}</span>
          {state === "loading" && <Chip tone="accent"><Loader2 className="h-3 w-3 animate-spin" /> loading</Chip>}
          {state === "error" && <Chip tone="destructive"><X className="h-3 w-3" /> error</Chip>}
          {state === "ok" && <Chip tone="primary"><Activity className="h-3 w-3" /> {markets.length} markets</Chip>}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1.5 px-2 h-6 bg-surface-3 border border-border rounded-sm">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="filter…" className="bg-transparent text-[11px] font-mono w-24 outline-none" />
          </div>
          <Btn variant="ghost" size="sm" onClick={onRefresh}><RefreshCw className="h-3 w-3" /> refresh</Btn>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-background/60 border-b border-border">
            <tr className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
              {["id","market","lock","defer settle","maxLev","mmr %","mmrRaw","stepSize","stepPrice","minStep","maxStep","oiLimit","impact $","band bps",""].map(h => (
                <th key={h} className="px-2 py-1.5 font-normal whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state === "loading" && Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b border-border/60">
                {Array.from({ length: 15 }).map((__, j) => (
                  <td key={j} className="px-2 py-2"><div className="h-3 bg-surface-3 animate-pulse rounded-sm" /></td>
                ))}
              </tr>
            ))}
            {state === "empty" && (
              <tr><td colSpan={15} className="text-center py-8 text-muted-foreground font-mono text-[12px]">
                No markets on {env}.
              </td></tr>
            )}
            {state === "error" && (
              <tr><td colSpan={15} className="text-center py-8 text-destructive font-mono text-[12px]">
                {error ?? "Failed to read live markets."}
              </td></tr>
            )}
            {state === "ok" && filtered.map((m) => (
              <tr key={m.id}
                tabIndex={0}
                onClick={() => onSelect(m.id)}
                onDoubleClick={() => onOpenEditor(m.id)}
                onKeyDown={(e) => { if (e.key === "Enter") onOpenEditor(m.id); }}
                className={cn(
                  "border-b border-border/60 hover:bg-surface-2 cursor-pointer focus:outline-none focus:bg-surface-2 focus:ring-1 focus:ring-primary/40",
                  selectedId === m.id && "bg-primary/5 hover:bg-primary/10",
                )}>
                <td className="px-2 py-1.5 data-cell text-muted-foreground">{m.id}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    {selectedId === m.id && <Dot color="primary" />}
                    <span className="font-mono text-[12px] text-foreground">{m.symbol}/{m.quote}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5"><StatusPill s={m.status} /></td>
                <td className="px-2 py-1.5"><DeferredPill enabled={m.deferredSettlement} /></td>
                <td className="px-2 py-1.5 data-cell">{m.maxLeverage}x</td>
                <td className="px-2 py-1.5 data-cell">{m.mmrPct}%</td>
                <td className="px-2 py-1.5 data-cell text-muted-foreground truncate max-w-[100px]" title={m.mmrRaw}>{m.mmrRaw}</td>
                <td className="px-2 py-1.5 data-cell">{fmt(m.stepSize)}</td>
                <td className="px-2 py-1.5 data-cell">${fmt(m.stepPrice)}</td>
                <td className="px-2 py-1.5 data-cell">{fmt(m.minOrderStep)}</td>
                <td className="px-2 py-1.5 data-cell">{fmt(m.maxOrderStep)}</td>
                <td className="px-2 py-1.5 data-cell">{fmt(m.oiLimitSteps)}</td>
                <td className="px-2 py-1.5 data-cell">${m.impactBaseUsdc}</td>
                <td className="px-2 py-1.5 data-cell">{m.priceBandBps}</td>
                <td className="px-2 py-1.5 text-right">
                  <Btn size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onOpenEditor(m.id); }}>
                    edit <ArrowRight className="h-3 w-3" />
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ----------------------------- Market Editor --------------------------- */

type EditorState = ReturnType<typeof emptyEditor>;

function emptyEditor() {
  return {
    symbol: "",
    quote: QUOTE_SYMBOL,
    status: "unlocked" as Market["status"],
    deferredSettlement: true,
    maxLeverage: 10,
    mmrPct: "5.0",
    stepSize: 1,
    stepPrice: 0.00001,
    minOrderStep: 20,
    maxOrderStep: 200000,
    oiLimitSteps: 2_000_000,
    impactBaseUsdc: 50,
    priceBandBps: 300,
  };
}

function fromMarket(m: Market): EditorState {
  return {
    symbol: m.symbol, quote: QUOTE_SYMBOL, status: m.status,
    deferredSettlement: m.deferredSettlement,
    maxLeverage: m.maxLeverage, mmrPct: m.mmrPct,
    stepSize: m.stepSize, stepPrice: m.stepPrice,
    minOrderStep: m.minOrderStep, maxOrderStep: m.maxOrderStep,
    oiLimitSteps: m.oiLimitSteps, impactBaseUsdc: m.impactBaseUsdc,
    priceBandBps: m.priceBandBps,
  };
}

function DiffRow({ label, before, after, raw }: { label: string; before: string | number; after: string | number; raw?: { b: string; a: string } }) {
  const changed = String(before) !== String(after);
  return (
    <div className={cn("grid grid-cols-12 gap-2 px-2 py-1 border-b border-border/60 items-center", changed && "bg-primary/5")}>
      <div className="col-span-3 text-[11px] font-mono text-muted-foreground">{label}</div>
      <div className="col-span-4 font-mono text-[12px] text-muted-foreground line-through decoration-destructive/60">{String(before)}</div>
      <div className="col-span-1 flex justify-center">{changed ? <ArrowRight className="h-3 w-3 text-primary" /> : <Circle className="h-2 w-2 text-muted-foreground/30 fill-muted-foreground/30" />}</div>
      <div className={cn("col-span-4 font-mono text-[12px]", changed ? "text-primary" : "text-foreground")}>{String(after)}</div>
      {raw && (
        <div className="col-span-12 grid grid-cols-12 gap-2 text-[10px] font-mono text-muted-foreground/70">
          <div className="col-span-3" />
          <div className="col-span-4 truncate" title={raw.b}>raw {raw.b}</div>
          <div className="col-span-1" />
          <div className="col-span-4 truncate" title={raw.a}>raw {raw.a}</div>
        </div>
      )}
    </div>
  );
}

function MarketEditor({
  mode, state, setState, base, rawMode, setRawMode, onLoadAero,
}: {
  mode: "open" | "update";
  state: EditorState; setState: (s: EditorState) => void;
  base?: Market | null;
  rawMode: boolean; setRawMode: (b: boolean) => void;
  onLoadAero: () => void;
}) {
  const s = state;
  const set = <K extends keyof EditorState>(k: K, v: EditorState[K]) => setState({ ...s, [k]: v });

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="panel-title">{mode === "open" ? "Open Market" : `Update Market${base ? ` · #${base.id} ${base.symbol}/${base.quote}` : ""}`}</span>
          {mode === "update" && !base && <Chip tone="warning">no row selected — pick from table</Chip>}
          {mode === "update" && base && <Chip tone="accent"><FileJson className="h-3 w-3" /> loaded</Chip>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className={cn("px-1.5 py-0.5 rounded-sm cursor-pointer", !rawMode ? "bg-primary/15 text-primary" : "text-muted-foreground")} onClick={() => setRawMode(false)}>FRIENDLY</span>
            <span className="text-muted-foreground/40">/</span>
            <span className={cn("px-1.5 py-0.5 rounded-sm cursor-pointer", rawMode ? "bg-accent/15 text-accent" : "text-muted-foreground")} onClick={() => setRawMode(true)}>RAW</span>
          </div>
          {mode === "open" && <Btn size="sm" variant="outline" onClick={onLoadAero}><Sparkles className="h-3 w-3" /> AERO/USDC example</Btn>}
        </div>
      </div>

      {mode === "update" && !base ? (
        <div className="p-8 text-center">
          <Terminal className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <div className="font-mono text-[12px] text-muted-foreground">Select a row in the markets table, then update.</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
            {/* Identity */}
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Market name (base)</label>
                <input value={s.symbol} disabled={mode === "update"} onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                  aria-label="Market name"
                  className="w-full bg-surface-2 border border-border rounded-sm px-2 py-1.5 font-mono text-[12px] outline-none focus:border-primary/60 disabled:opacity-60" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Quote</label>
                <div
                  aria-label="Quote"
                  className="w-full bg-surface-2 border border-border rounded-sm px-2 py-1.5 font-mono text-[12px] text-foreground"
                >
                  {QUOTE_SYMBOL}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Market lock</label>
                <div className="flex border border-border rounded-sm overflow-hidden">
                  {(["unlocked","locked"] as const).map(st => (
                    <button key={st} onClick={() => set("status", st)}
                      className={cn("flex-1 py-1.5 font-mono text-[11px] uppercase tracking-wider",
                        s.status === st ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground hover:text-foreground")}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Deferred settlement</label>
                <button
                  type="button"
                  onClick={() => set("deferredSettlement", !s.deferredSettlement)}
                  className={cn("w-full h-8 border border-border rounded-sm px-2 font-mono text-[11px] uppercase tracking-wider",
                    s.deferredSettlement ? "bg-warning/15 text-warning" : "bg-surface-2 text-muted-foreground hover:text-foreground")}
                >
                  {s.deferredSettlement ? "enabled" : "synchronous"}
                </button>
              </div>
            </div>

            {/* Risk */}
            <div className="space-y-2">
              <Field label="Max leverage" suffix="x" value={s.maxLeverage} onChange={(v) => set("maxLeverage", +v)} mode={rawMode ? "raw" : "friendly"} raw={String(s.maxLeverage)} helper="1–50" />
              <Field label="Maintenance margin ratio" suffix="%" value={s.mmrPct} onChange={(v) => set("mmrPct", v)} mode={rawMode ? "raw" : "friendly"} raw={rawMmr(s.mmrPct) + "  (×1e18)"} helper="exact decimal string" />
              <Field label="Match price band" suffix="bps" value={s.priceBandBps} onChange={(v) => set("priceBandBps", +v)} mode={rawMode ? "raw" : "friendly"} raw={String(s.priceBandBps)} helper="200 bps = 2%" />
              <Field label="Impact notional base" suffix="USDC" value={s.impactBaseUsdc} onChange={(v) => set("impactBaseUsdc", +v)} mode={rawMode ? "raw" : "friendly"} raw={rawImpact(s.impactBaseUsdc) + "  (6)"} helper="USDC (6 decimals)" />
            </div>

            {/* Sizing */}
            <div className="space-y-2">
              <Field label="Step size" suffix={s.symbol || "TOKEN"} value={s.stepSize} onChange={(v) => set("stepSize", +v)} mode={rawMode ? "raw" : "friendly"} raw={rawStepSize(s.stepSize)} helper="18 decimals" />
              <Field label="Step price" suffix={s.quote} value={s.stepPrice} onChange={(v) => set("stepPrice", +v)} mode={rawMode ? "raw" : "friendly"} raw={rawStepPrice(s.stepPrice) + "  (×10^8)"} helper="price precision 8" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Min order step" value={s.minOrderStep} onChange={(v) => set("minOrderStep", +v)} mode={rawMode ? "raw" : "friendly"} raw={String(s.minOrderStep)} />
                <Field label="Max order step" value={s.maxOrderStep} onChange={(v) => set("maxOrderStep", +v)} mode={rawMode ? "raw" : "friendly"} raw={String(s.maxOrderStep)} />
              </div>
              <Field label="OI limit (steps)" value={s.oiLimitSteps} onChange={(v) => set("oiLimitSteps", +v)} mode={rawMode ? "raw" : "friendly"} raw={String(s.oiLimitSteps)} helper="× stepSize for token OI" />
            </div>
          </div>

          {/* Diff for update */}
          {mode === "update" && base && (
            <div className="border-t border-border">
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-border bg-surface-2">
                <span className="panel-title">Before / After</span>
              </div>
              <div>
                <DiffRow label="status" before={base.status} after={s.status} />
                <DiffRow label="deferred settlement" before={base.deferredSettlement ? "enabled" : "sync"} after={s.deferredSettlement ? "enabled" : "sync"} />
                <DiffRow label="maxLeverage" before={`${base.maxLeverage}x`} after={`${s.maxLeverage}x`} />
                <DiffRow label="mmr %" before={`${base.mmrPct}%`} after={`${s.mmrPct}%`} raw={{ b: base.mmrRaw, a: rawMmr(s.mmrPct) }} />
                <DiffRow label="stepSize" before={fmt(base.stepSize)} after={fmt(s.stepSize)} raw={{ b: base.stepSizeRaw, a: rawStepSize(s.stepSize) }} />
                <DiffRow label="stepPrice" before={`$${fmt(base.stepPrice)}`} after={`$${fmt(s.stepPrice)}`} raw={{ b: base.stepPriceRaw, a: rawStepPrice(s.stepPrice) }} />
                <DiffRow label="minOrderStep" before={base.minOrderStep} after={s.minOrderStep} />
                <DiffRow label="maxOrderStep" before={base.maxOrderStep} after={s.maxOrderStep} />
                <DiffRow label="oiLimitSteps" before={base.oiLimitSteps} after={s.oiLimitSteps} />
                <DiffRow label="impact base $" before={base.impactBaseUsdc} after={s.impactBaseUsdc} raw={{ b: base.impactBaseRaw, a: rawImpact(s.impactBaseUsdc) }} />
                <DiffRow label="priceBandBps" before={base.priceBandBps} after={s.priceBandBps} />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ----------------------------- Validation Tape ------------------------- */

type CheckState = "ok" | "warn" | "fail" | "pending";

function ValidationTape({ env, github, wallet, state, mode, marketCount }: { env: EnvKey; github: string | null; wallet: string | null; state: EditorState; mode: "open" | "update"; marketCount: number }) {
  const items: { k: string; label: string; s: CheckState; detail: string }[] = [
    { k: "precision", label: "Numeric precision", s: state.stepSize > 0 && state.stepPrice > 0 ? "ok" : "fail", detail: `stepSize ${state.stepSize} · stepPrice ${state.stepPrice}` },
    { k: "nextId", label: mode === "open" ? "Next market id" : "Existing market id", s: "ok", detail: mode === "open" ? `${marketCount}` : "matched" },
    ...(env === "mainnet"
      ? [{ k: "shadow", label: "Shadow run", s: "warn" as CheckState, detail: "required before Safe" }]
      : []),
    { k: "gh", label: "GitHub session", s: github ? "ok" : "fail", detail: github ?? "sign in to create review link" },
    { k: "wallet", label: "Signer", s: env === "mainnet" ? (github ? "ok" : "warn") : (wallet ? "ok" : "fail"), detail: env === "mainnet" ? "Safe proposer (GitHub)" : (wallet ?? "connect EOA") },
  ];
  return (
    <section className="panel">
      <div className="panel-header"><span className="panel-title">Validation</span></div>
      <div className="divide-y divide-border">
        {items.map(i => (
          <div key={i.k} className="flex items-start gap-2 px-3 py-1.5">
            {i.s === "ok" && <Check className="h-3.5 w-3.5 text-primary mt-0.5" />}
            {i.s === "warn" && <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5" />}
            {i.s === "fail" && <X className="h-3.5 w-3.5 text-destructive mt-0.5" />}
            {i.s === "pending" && <Circle className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[12px]">{i.label}</div>
              <div className="font-mono text-[10px] text-muted-foreground truncate">{i.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------- Shadow Preflight ------------------------ */

function ShadowPreflight({ mode, marketCount }: { mode: "open" | "update"; marketCount: number }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const pre = marketCount;
  const post = mode === "open" ? pre + 1 : pre;
  return (
    <section className="panel">
      <div className="panel-header">
        <span className="panel-title">Shadow preflight</span>
        <div className="flex items-center gap-1.5">
          {done && <Chip tone="primary"><Check className="h-3 w-3" /> healthy</Chip>}
          <Btn size="sm" variant={done ? "outline" : "primary"} onClick={() => { setRunning(true); setDone(false); setTimeout(() => { setRunning(false); setDone(true); }, 1200); }}>
            {running ? <><Loader2 className="h-3 w-3 animate-spin" /> running</> : <><Zap className="h-3 w-3" /> run on shadow</>}
          </Btn>
        </div>
      </div>
      {!done && !running && (
        <div className="p-3 text-[11px] font-mono text-muted-foreground">
          Required for mainnet Safe creation. Forks current state, replays the proposal, and reads post-state.
        </div>
      )}
      {(running || done) && (
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="border border-border bg-surface-2 rounded-sm py-2">
              <div className="text-[9px] uppercase font-mono text-muted-foreground">pre · totalMarkets</div>
              <div className="font-mono text-[16px]">{pre}</div>
            </div>
            <div className="border border-border bg-surface-2 rounded-sm py-2">
              <div className="text-[9px] uppercase font-mono text-muted-foreground">delta</div>
              <div className="font-mono text-[16px] text-primary">{mode === "open" ? "+1" : "Δ config"}</div>
            </div>
            <div className="border border-border bg-surface-2 rounded-sm py-2">
              <div className="text-[9px] uppercase font-mono text-muted-foreground">post · totalMarkets</div>
              <div className="font-mono text-[16px]">{post}</div>
            </div>
          </div>
          {done && <div className="font-mono text-[11px] text-primary">✓ shadow run healthy</div>}
        </div>
      )}
    </section>
  );
}

/* ----------------------------- Proposal Panel -------------------------- */

function ProposalPanel({ env, mode, state, base, github, wallet }: { env: EnvKey; mode: "open" | "update"; state: EditorState; base: Market | null; github: string | null; wallet: string | null }) {
  const isSafe = env === "mainnet";
  const calls: { fn: string; args: string[]; required: boolean }[] = mode === "open" ? [
    { fn: "openMarket", required: true, args: [
      `name="${state.symbol}/${state.quote}"`,
      `maxLeverage=${state.maxLeverage}`,
      `mmr=${rawMmr(state.mmrPct)}`,
      `stepSize=${rawStepSize(state.stepSize)}`,
      `stepPrice=${rawStepPrice(state.stepPrice)}`,
      `minOrderStep=${state.minOrderStep}`,
      `maxOrderStep=${state.maxOrderStep}`,
      `oiLimit=${state.oiLimitSteps}`,
      `priceBandBps=${state.priceBandBps}`,
    ]},
    ...(state.deferredSettlement ? [{ fn: "setDeferredMode", required: false, args: [`marketId=NEXT`, "deferred=true"] }] : []),
    { fn: "setImpactNotionalBaseUsdc", required: false, args: [`marketId=NEXT`, `base=${rawImpact(state.impactBaseUsdc)}`] },
  ] : [
    { fn: "updateMarketConfig", required: true, args: [
      `marketId=${base?.id ?? "?"}`,
      `maxLeverage=${state.maxLeverage}`,
      `mmr=${rawMmr(state.mmrPct)}`,
      `stepSize=${rawStepSize(state.stepSize)}`,
      `stepPrice=${rawStepPrice(state.stepPrice)}`,
      `minOrderStep=${state.minOrderStep}`,
      `maxOrderStep=${state.maxOrderStep}`,
      `oiLimit=${state.oiLimitSteps}`,
      `priceBandBps=${state.priceBandBps}`,
    ]},
    ...(base && base.status !== state.status && (state.status === "locked" || state.status === "unlocked") ? [{ fn: "setMarketLock", required: false, args: [`marketId=${base.id}`, `locked=${state.status === "locked"}`] }] : []),
    ...(base && base.deferredSettlement !== state.deferredSettlement ? [{ fn: "setDeferredMode", required: false, args: [`marketId=${base.id}`, `deferred=${state.deferredSettlement}`] }] : []),
    ...(base && base.impactBaseUsdc !== state.impactBaseUsdc ? [{ fn: "setImpactNotionalBaseUsdc", required: false, args: [`marketId=${base.id}`, `base=${rawImpact(state.impactBaseUsdc)}`] }] : []),
  ];

  const json = JSON.stringify({
    version: "1.0",
    chainId: env === "mainnet" ? 11155930 : 11155931,
    createdAt: new Date().toISOString(),
    meta: { name: `${mode === "open" ? "Open" : "Update"} ${state.symbol}/${state.quote}`, env },
    transactions: calls.map(c => ({ to: ENVS.find(e => e.key === env)!.access, value: "0", data: "0x", contractMethod: c.fn })),
  }, null, 2);

  const canSafe = isSafe && !!github;
  const canEoa = !isSafe && !!wallet;

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="panel-title">Proposal · ordered calls</span>
          <Chip tone={isSafe ? "destructive" : "primary"}>{isSafe ? <><Shield className="h-3 w-3" /> Safe MultiSend</> : <><Zap className="h-3 w-3" /> EOA tx batch</>}</Chip>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{calls.length} call{calls.length === 1 ? "" : "s"}</span>
      </div>

      <ol className="divide-y divide-border">
        {calls.map((c, i) => (
          <li key={i} className="px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] text-muted-foreground">#{i+1}</span>
                <span className="font-mono text-[12px] text-primary">{c.fn}</span>
                {!c.required && <Chip tone="muted">optional</Chip>}
              </div>
              <button className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
            </div>
            <div className="mt-1 grid sm:grid-cols-2 gap-x-3 gap-y-0.5">
              {c.args.map((a, j) => (
                <div key={j} className="font-mono text-[10px] text-muted-foreground truncate" title={a}>· {a}</div>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="border-t border-border">
        <div className="px-3 py-1.5 flex items-center justify-between bg-surface-2">
          <span className="panel-title">{isSafe ? "Safe transaction JSON" : "EOA execution plan"}</span>
          <Btn size="sm" variant="ghost"><Copy className="h-3 w-3" /> copy</Btn>
        </div>
        {isSafe ? (
          <pre className="max-h-56 overflow-auto p-3 text-[10px] font-mono text-muted-foreground bg-background/60">{json}</pre>
        ) : (
          <div className="p-3 space-y-1">
            {calls.map((c, i) => (
              <div key={i} className="flex items-center justify-between border border-border rounded-sm bg-surface-2 px-2 py-1.5">
                <div className="font-mono text-[11px]"><span className="text-muted-foreground">tx{i+1}</span> {c.fn} <span className="text-muted-foreground">→ {ENVS.find(e => e.key === env)!.access}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          {isSafe ? (
            !github ? <Chip tone="warning"><AlertTriangle className="h-3 w-3" /> sign in with GitHub to gate</Chip>
                   : <Chip tone="primary"><Check className="h-3 w-3" /> review link ready</Chip>
          ) : (
            !wallet ? <Chip tone="warning"><AlertTriangle className="h-3 w-3" /> connect wallet to execute</Chip>
                    : <Chip tone="primary"><Check className="h-3 w-3" /> wallet ready</Chip>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" size="sm" disabled={!github}><ExternalLink className="h-3 w-3" /> shareable review link</Btn>
          {isSafe ? (
            <Btn variant="primary" disabled={!canSafe}><Shield className="h-3 w-3" /> create Safe proposal</Btn>
          ) : (
            <Btn variant="primary" disabled={!canEoa}><Zap className="h-3 w-3" /> execute {calls.length} tx</Btn>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- App --------------------------------- */

type Tab = "current" | "open" | "update";

type MarketsResponse = {
  env: EnvKey;
  markets: Market[];
  error?: string;
};

type MarketsState = {
  loadState: LoadState;
  markets: Market[];
  error?: string;
  refreshedAt?: Date;
};

export function MarketAdminConsole({ initialEnv = "staging" }: { initialEnv?: EnvKey } = {}) {
  const [env, setEnv] = useState<EnvKey>(initialEnv);
  const [tab, setTab] = useState<Tab>("current");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openState, setOpenState] = useState<EditorState>(emptyEditor());
  const [updateState, setUpdateState] = useState<EditorState>(emptyEditor());
  const [rawMode, setRawMode] = useState(false);
  const [github, setGithub] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [marketsState, setMarketsState] = useState<MarketsState>({
    loadState: "loading",
    markets: [],
  });

  const markets = marketsState.markets;
  const base = useMemo(() => markets.find(m => m.id === selectedId) ?? null, [markets, selectedId]);

  useEffect(() => {
    const controller = new AbortController();
    setMarketsState({ loadState: "loading", markets: [] });

    fetch(`/api/markets?env=${env}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as MarketsResponse;
        if (!response.ok) {
          throw new Error(body.error ?? `market read failed with ${response.status}`);
        }
        setMarketsState({
          loadState: body.markets.length ? "ok" : "empty",
          markets: body.markets,
          refreshedAt: new Date(),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setMarketsState({
          loadState: "error",
          markets: [],
          error: error instanceof Error ? error.message : "failed to read live markets",
        });
      });

    return () => controller.abort();
  }, [env, refreshNonce]);

  // When env changes, reset selection if absent
  useEffect(() => { if (selectedId !== null && !markets.find(m => m.id === selectedId)) setSelectedId(null); }, [env, markets, selectedId]);
  // When selecting a market for update, prefill the editor
  useEffect(() => { if (base) setUpdateState(fromMarket(base)); }, [base]);

  const tabs: { k: Tab; label: string }[] = [
    { k: "current", label: "Current markets" },
    { k: "open", label: "Open market" },
    { k: "update", label: "Update market" },
  ];

  const editorMode: "open" | "update" = tab === "update" ? "update" : "open";
  const editorState = tab === "update" ? updateState : openState;
  const setEditorState = tab === "update" ? setUpdateState : setOpenState;

  return (
    <div className="min-h-screen bg-background bg-grid">
      <Header env={env} setEnv={setEnv} github={github} setGithub={setGithub} wallet={wallet} setWallet={setWallet} />

      {/* Status bar */}
      <div className="border-b border-border bg-surface/60">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 sm:px-4 py-1.5 text-[10px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5"><EnvBadge env={env} /></span>
          <span>access {ENVS.find(e => e.key === env)!.access}</span>
          {ENVS.find(e => e.key === env)!.safe && <span>safe {ENVS.find(e => e.key === env)!.safe}</span>}
          <span className="ml-auto">
            {marketsState.refreshedAt ? `last refresh ${marketsState.refreshedAt.toLocaleTimeString()}` : "last refresh pending"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 sm:px-4 pt-3">
        <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
          {tabs.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={cn("px-3 h-9 font-mono text-[11px] uppercase tracking-wider border-b-2 -mb-px whitespace-nowrap",
                tab === t.k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
              {t.k === "current" && <span className="ml-1.5 text-muted-foreground">[{markets.length}]</span>}
              {t.k === "update" && base && <span className="ml-1.5 text-primary">#{base.id}</span>}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pb-1">
            <Btn variant="ghost" size="sm" onClick={() => setTab("open")}><Plus className="h-3 w-3" /> new market</Btn>
          </div>
        </div>
      </div>

      <main className="px-3 sm:px-4 py-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {tab === "current" && (
          <div className="lg:col-span-12">
            <MarketsTable env={env} markets={markets} selectedId={selectedId}
              loadState={marketsState.loadState}
              error={marketsState.error}
              onRefresh={() => setRefreshNonce(n => n + 1)}
              onSelect={setSelectedId}
              onOpenEditor={(id) => { setSelectedId(id); setTab("update"); }} />
          </div>
        )}

        {(tab === "open" || tab === "update") && (
          <>
            <div className="lg:col-span-8 space-y-3">
              <MarketsTable env={env} markets={markets} selectedId={selectedId}
                loadState={marketsState.loadState}
                error={marketsState.error}
                onRefresh={() => setRefreshNonce(n => n + 1)}
                onSelect={(id) => { setSelectedId(id); if (tab === "open") setTab("update"); }}
                onOpenEditor={(id) => { setSelectedId(id); setTab("update"); }} />
              <MarketEditor mode={editorMode} state={editorState} setState={setEditorState}
                base={tab === "update" ? base : null}
                rawMode={rawMode} setRawMode={setRawMode}
                onLoadAero={() => setOpenState({ ...emptyEditor(), ...AERO_TEMPLATE })} />
            </div>
            <div className="lg:col-span-4 space-y-3">
              <ValidationTape env={env} github={github} wallet={wallet} state={editorState} mode={editorMode} marketCount={markets.length} />
              {env === "mainnet" && <ShadowPreflight mode={editorMode} marketCount={markets.length} />}
              <ProposalPanel env={env} mode={editorMode} state={editorState} base={tab === "update" ? base : null} github={github} wallet={wallet} />
            </div>
          </>
        )}

      </main>
    </div>
  );
}

export default MarketAdminConsole
