import { RAW, NOTES, SRC_GROUPS, ORIGIN_DEFAULTS, GLOBAL_DEFAULTS } from "./data";
import type { Evaluation, Model, OriginKey, Route, Settings } from "./types";

export const ORIGIN_KEYS = Object.keys(ORIGIN_DEFAULTS) as OriginKey[];
const USD = 3.75;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const MODELS: Model[] = RAW.map(([brand, model, trim, seg, sa, offers]) => {
  const id = slug(brand + " " + model);
  return {
    id, brand, model, name: `${brand} ${model}`, trim, seg, sa, offers,
    note: NOTES[id] || ("CN" in offers ? "China domestic models need SABER approval and may not match GCC specs." : ""),
  };
});
export const BYID: Record<string, Model> = Object.fromEntries(MODELS.map((m) => [m.id, m]));
export const BRANDS = [...new Set(MODELS.map((m) => m.brand))].sort();
export const SEGMENTS = [...new Set(MODELS.map((m) => m.seg))].sort();

export const SRC: Record<string, string> = {};
for (const [src, keys] of Object.entries(SRC_GROUPS))
  for (const k of keys) SRC[k] = SRC[k] ? `${SRC[k]} / ${src}` : src;

export const freshSettings = (): Settings => ({
  g: { ...GLOBAL_DEFAULTS },
  o: JSON.parse(JSON.stringify(ORIGIN_DEFAULTS)),
  p: {},
});

export const saPrice = (s: Settings, m: Model) => s.p[`${m.id}:SA`] ?? m.sa;
export function offPrice(s: Settings, m: Model, k: OriginKey): number | null {
  const key = `${m.id}:${k}`;
  if (key in s.p) return s.p[key];
  return m.offers[k] ?? null;
}
export const routesOf = (s: Settings, m: Model) =>
  ORIGIN_KEYS.filter((k) => { const v = offPrice(s, m, k); return v != null && v > 0; });

export function landed(s: Settings, m: Model, k: OriginKey): Route {
  const o = s.o[k], g = s.g, retail = offPrice(s, m, k) ?? 0;
  const exTaxLocal = retail / (1 + o.refund / 100);
  const refund = (retail - exTaxLocal) * o.fx;
  const markup = (exTaxLocal * o.markup / 100) * o.fx;
  const car = exTaxLocal * (1 + o.markup / 100) * o.fx;
  const freightOnly = o.freight * USD, ins = car * g.ins / 100;
  const cif = car + freightOnly + ins;
  const duty = cif * o.duty / 100;
  const vat = (cif + duty) * g.vat / 100;
  const port = o.dest * USD, feesOnly = g.fees;
  const warr = o.warranty ? saPrice(s, m) * g.warrPct / 100 : 0;
  return {
    k, retail, retailSAR: retail * o.fx, refund, markup, car, freightOnly, ins, freight: freightOnly + ins,
    cif, duty, vat, port, feesOnly, fees: port + feesOnly, warr, total: cif + duty + vat + port + feesOnly + warr,
  };
}

export function evaluate(s: Settings, m: Model): Evaluation {
  const routes = routesOf(s, m).map((k) => landed(s, m, k)).sort((a, b) => a.total - b.total);
  const local = saPrice(s, m);
  if (!routes.length) return { routes, local, best: null, diff: null, verdict: "na" };
  const best = routes[0], diff = ((best.total - local) / local) * 100, b = s.g.band;
  return { routes, local, best, diff, verdict: diff > b ? "local" : diff < -b ? "import" : "even" };
}

export type PriceStatus = "listing" | "edited" | "est.";
export function priceStatus(s: Settings, m: Model, k: OriginKey | "SA"): PriceStatus {
  const key = `${m.id}:${k}`;
  if (key in s.p) return "edited";
  return SRC[key] ? "listing" : "est.";
}
export function checkedOf(s: Settings, m: Model, e: Evaluation) {
  const keys: (OriginKey | "SA")[] = ["SA", ...routesOf(s, m)];
  const ok = (k: OriginKey | "SA") => priceStatus(s, m, k) !== "est.";
  return { n: keys.filter(ok).length, total: keys.length, both: ok("SA") && !!e.best && ok(e.best.k) };
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const sar = (n: number) => "SAR " + fmt(n);
export const pct = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(1) + "%";
export const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n));

export const VERDICT_LABEL = { local: "Buy locally", import: "Import", even: "Too close", na: "No route" } as const;
export const SEGS = [
  ["car", "Car", "--c-car"],
  ["freight", "Freight + insurance", "--c-freight"],
  ["duty", "Duty", "--c-duty"],
  ["vat", "VAT", "--c-vat"],
  ["fees", "Port + local fees", "--c-fees"],
  ["warr", "Warranty lost", "--c-warr"],
] as const;
