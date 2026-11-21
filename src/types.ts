export type OriginKey = "US" | "AE" | "DE" | "KR" | "CN";

export interface Origin {
  name: string;
  cur: string;
  fx: number; // SAR per unit of local currency
  refund: number; // % home tax reclaimable on export
  markup: number; // % export premium / agent fee
  freight: number; // USD
  dest: number; // USD port handling in KSA
  duty: number; // % of CIF
  warranty: boolean; // true = loses local agency warranty
}

export interface Globals {
  vat: number;
  ins: number;
  fees: number;
  warrPct: number;
  band: number;
}

export interface Model {
  id: string;
  brand: string;
  model: string;
  name: string;
  trim: string;
  seg: string;
  sa: number;
  offers: Partial<Record<OriginKey, number>>;
  note: string;
}

export interface Settings {
  g: Globals;
  o: Record<OriginKey, Origin>;
  p: Record<string, number | null>; // price overrides keyed "model-id:SA|US|AE…"; null = not sold
}

export type Verdict = "local" | "import" | "even" | "na";

export interface Route {
  k: OriginKey;
  retail: number;
  retailSAR: number;
  refund: number;
  markup: number;
  car: number;
  freightOnly: number;
  ins: number;
  freight: number;
  cif: number;
  duty: number;
  vat: number;
  port: number;
  feesOnly: number;
  fees: number;
  warr: number;
  total: number;
}

export interface Evaluation {
  routes: Route[];
  local: number;
  best: Route | null;
  diff: number | null;
  verdict: Verdict;
}
