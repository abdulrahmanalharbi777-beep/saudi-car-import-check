import { useEffect, useMemo, useRef, useState } from "react";
import type { Evaluation, Model, OriginKey, Route, Settings } from "./types";
import {
  BRANDS, BYID, MODELS, ORIGIN_KEYS, SEGMENTS, SEGS, SRC, VERDICT_LABEL,
  checkedOf, evaluate, fmt, freshSettings, offPrice, pct, priceStatus, sar, signed,
} from "./calc";

const LS = "saudi-car-import-app-v1";
type Tab = "compare" | "catalogue" | "settings";

function loadSettings(): Settings {
  const f = freshSettings();
  try {
    const s = JSON.parse(localStorage.getItem(LS) || "null");
    if (s && s.g && s.o) return { g: { ...f.g, ...s.g }, o: { ...f.o, ...s.o }, p: s.p || {} };
  } catch { /* storage unavailable */ }
  return f;
}
const loadSelected = () => {
  const h = location.hash.slice(1);
  if (BYID[h]) return h;
  try { const v = localStorage.getItem(LS + ":sel"); if (v && BYID[v]) return v; } catch { /* ignore */ }
  return "toyota-land-cruiser-300";
};

/* Number input that keeps its own text while typing and commits on blur / Enter. */
function NumField({ id, value, onCommit, placeholder, label }: {
  id: string; value: number | null; onCommit: (v: number | null) => void; placeholder?: string; label?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);
  const commit = () => {
    if (text.trim() === "") return onCommit(null);
    const v = parseFloat(text.replace(/,/g, ""));
    if (!isNaN(v)) onCommit(v); else setText(value == null ? "" : String(value));
  };
  return (
    <input id={id} className="num-input" inputMode="decimal" value={text} placeholder={placeholder} aria-label={label}
      onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [tab, setTab] = useState<Tab>("compare");
  const [selected, setSelected] = useState<string>(loadSelected);
  const [picker, setPicker] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(settings)); } catch { /* ignore */ } }, [settings]);
  useEffect(() => {
    try { localStorage.setItem(LS + ":sel", selected); } catch { /* ignore */ }
    if (location.hash.slice(1) !== selected) history.replaceState(null, "", "#" + selected);
  }, [selected]);
  useEffect(() => {
    const onHash = () => { const h = location.hash.slice(1); if (BYID[h]) { setSelected(h); setTab("compare"); } };
    addEventListener("hashchange", onHash); return () => removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); window.scrollTo({ top: 0 }); }, [tab, selected]);

  const evals = useMemo(() => new Map(MODELS.map((m) => [m.id, evaluate(settings, m)])), [settings]);
  const setPrice = (key: string, v: number | null) =>
    setSettings((s) => {
      const p = { ...s.p };
      if (key.endsWith(":SA")) { if (v == null) delete p[key]; else p[key] = v; }
      else p[key] = v;
      return { ...s, p };
    });
  const open = (id: string) => { setSelected(id); setTab("compare"); setPicker(false); };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="plate" aria-hidden="true"><span>KSA</span><span>Import check</span></div>
        <span className="topbar-title">{tab === "compare" ? "Compare" : tab === "catalogue" ? "Catalogue" : "Settings"}</span>
      </header>

      <main ref={mainRef} className="main">
        {tab === "compare" && (
          <Compare m={BYID[selected]} e={evals.get(selected)!} s={settings} onPick={() => setPicker(true)} setPrice={setPrice} />
        )}
        {tab === "catalogue" && <Catalogue s={settings} evals={evals} current={selected} onOpen={open} />}
        {tab === "settings" && <SettingsScreen s={settings} setS={setSettings} />}
      </main>

      <nav className="tabbar" aria-label="Sections">
        {([["compare", "Compare", "M4 12h10M10 6l6 6-6 6M20 5v14"], ["catalogue", "Catalogue", "M4 6h16M4 12h16M4 18h10"], ["settings", "Settings", "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6"]] as const).map(([k, l, d]) => (
          <button key={k} type="button" className={"tab-btn" + (tab === k ? " on" : "")} aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{l}</span>
          </button>
        ))}
      </nav>

      {picker && <Picker s={settings} evals={evals} current={selected} onOpen={open} onClose={() => setPicker(false)} />}
    </div>
  );
}

/* ───────────── Compare ───────────── */
function Compare({ m, e, s, onPick, setPrice }: {
  m: Model; e: Evaluation; s: Settings; onPick: () => void; setPrice: (k: string, v: number | null) => void;
}) {
  const [routeSel, setRouteSel] = useState<OriginKey | null>(null);
  useEffect(() => setRouteSel(null), [m.id]);
  const r = e.routes.find((x) => x.k === routeSel) ?? e.best;
  const maxT = Math.max(e.local, ...e.routes.map((x) => x.total));
  const o = (k: OriginKey) => s.o[k];
  const shortName = (k: OriginKey) => o(k).name.replace(" (GCC spec)", "");
  const d = e.best ? e.best.total - e.local : 0;

  return (
    <div className="stack-col">
      <button type="button" className="vehicle-btn" onClick={onPick}>
        <span className="eyebrow">{m.brand} · {m.seg}</span>
        <span className="vehicle-name">{m.model}</span>
        <span className="vehicle-trim">{m.trim}</span>
        <span className="change">Change vehicle</span>
      </button>

      <section className={"verdict " + e.verdict} aria-live="polite">
        <div className="verdict-call">
          <b>{e.verdict === "even" ? "Too close: buy local" : VERDICT_LABEL[e.verdict]}</b>
          {e.diff != null && <span className="verdict-pct">{pct(e.diff)}</span>}
        </div>
        <p>
          {e.best
            ? d > 0
              ? `Importing from ${o(e.best.k).name} costs ${sar(d)} more than buying from the Saudi distributor.`
              : `Importing from ${o(e.best.k).name} saves ${sar(-d)} against the Saudi distributor.`
            : "No foreign price is set for this model. Add one under Prices below."}
          {e.verdict === "even" && ` That is inside ±${s.g.band}%, so the local warranty and service usually win.`}
        </p>
        <div className="kv-row">
          <div className="kv"><small>Saudi distributor <Badge st={priceStatus(s, m, "SA")} src={SRC[m.id + ":SA"]} /></small><span className="num">{sar(e.local)}</span></div>
          <div className="kv"><small>Best import{e.best ? " · " + shortName(e.best.k) : ""}</small><span className="num">{e.best ? sar(e.best.total) : "n/a"}</span></div>
        </div>
      </section>

      {e.routes.length > 0 && (
        <section className="card">
          <h3>Every route</h3>
          <div className="route static">
            <span className="route-name">Saudi distributor</span>
            <div className="bar"><div style={{ width: `${(e.local / maxT) * 100}%`, background: "var(--local)" }} /></div>
            <span className="num route-total">{fmt(e.local)}</span>
          </div>
          {e.routes.map((x) => (
            <button key={x.k} type="button" className={"route" + (x.k === r?.k ? " sel" : "")} aria-pressed={x.k === r?.k} onClick={() => setRouteSel(x.k)}>
              <span className="route-name">{shortName(x.k)}{x === e.best && <em> cheapest</em>}</span>
              <StackBar r={x} maxT={maxT} />
              <span className="num route-total">{fmt(x.total)}</span>
            </button>
          ))}
          <div className="legend">{SEGS.map(([, l, v]) => <span key={v}><i style={{ background: `var(${v})` }} />{l}</span>)}</div>
        </section>
      )}

      {r && <Breakdown r={r} e={e} s={s} />}

      <section className="card">
        <h3>Prices for this car</h3>
        <p className="muted small">Replace an estimate with a dealer quote. Clear a market if the car is not sold there.</p>
        <div className="price-list">
          <PriceRow id="pp-SA" label="Saudi distributor" cur="SAR incl. VAT" st={priceStatus(s, m, "SA")} src={SRC[m.id + ":SA"]}
            value={e.local} onCommit={(v) => setPrice(m.id + ":SA", v)} />
          {ORIGIN_KEYS.map((k) => {
            const v = offPrice(s, m, k);
            return <PriceRow key={k} id={"pp-" + k} label={o(k).name} cur={o(k).cur} st={v ? priceStatus(s, m, k) : null} src={SRC[m.id + ":" + k]}
              value={v} placeholder="not sold" onCommit={(nv) => setPrice(m.id + ":" + k, nv)} />;
          })}
        </div>
        {m.note && <p className="note">{m.note}</p>}
      </section>
    </div>
  );
}

function Badge({ st, src }: { st: string | null; src?: string }) {
  if (!st) return null;
  return <span className={"badge " + (st === "listing" ? "ok" : st === "edited" ? "ed" : "")} title={st === "listing" ? src : undefined}>{st}</span>;
}

function PriceRow({ id, label, cur, st, src, value, placeholder, onCommit }: {
  id: string; label: string; cur: string; st: string | null; src?: string; value: number | null; placeholder?: string; onCommit: (v: number | null) => void;
}) {
  return (
    <div className="price-row">
      <label htmlFor={id}>
        <span>{label} <Badge st={st} src={src} /></span>
        <small>{cur}{st === "listing" && src ? " · " + src : ""}</small>
      </label>
      <NumField id={id} value={value} placeholder={placeholder} onCommit={onCommit} />
    </div>
  );
}

function StackBar({ r, maxT }: { r: Route; maxT: number }) {
  return (
    <div className="bar">
      {SEGS.map(([k, , v]) => r[k] > 0 ? <div key={k} style={{ width: `${(r[k] / maxT) * 100}%`, background: `var(${v})` }} /> : null)}
    </div>
  );
}

function Breakdown({ r, e, s }: { r: Route; e: Evaluation; s: Settings }) {
  const o = s.o[r.k], g = s.g;
  type Row = { label: string; hint?: string; v: number; sw?: string; sub?: boolean };
  const rows: Row[] = [
    { label: `Retail price in ${o.name}`, hint: `${fmt(r.retail)} ${o.cur} × ${o.fx}`, v: r.retailSAR },
    { label: "Home tax refunded on export", hint: `${o.refund}%`, v: -r.refund },
    { label: "Export markup / agent", hint: `${o.markup}%`, v: r.markup },
    { label: "Car price (FOB)", v: r.car, sw: "--c-car", sub: true },
    { label: "Freight", hint: `$${fmt(o.freight)}`, v: r.freightOnly, sw: "--c-freight" },
    { label: "Marine insurance", hint: `${g.ins}% of car`, v: r.ins, sw: "--c-freight" },
    { label: "Customs value (CIF)", v: r.cif, sub: true },
    { label: "Customs duty", hint: `${o.duty}% of CIF`, v: r.duty, sw: "--c-duty" },
    { label: "VAT", hint: `${g.vat}% of CIF + duty`, v: r.vat, sw: "--c-vat" },
    { label: "Port handling", hint: `$${fmt(o.dest)}`, v: r.port, sw: "--c-fees" },
    { label: "Clearance, SABER, Fahas, plates", hint: "flat", v: r.feesOnly, sw: "--c-fees" },
    { label: "Warranty and resale lost", hint: o.warranty ? `${g.warrPct}% of local price` : "kept (GCC spec)", v: r.warr, sw: "--c-warr" },
  ];
  const diff = r.total - e.local;
  return (
    <section className="card">
      <h3>Breakdown · {o.name.replace(" (GCC spec)", "")}</h3>
      <table className="wf">
        <tbody>
          {rows.map((x) => (
            <tr key={x.label} className={x.sub ? "sub" : ""}>
              <td><span className="sw" style={{ background: x.sw ? `var(${x.sw})` : "transparent" }} />{x.label}{x.hint && <small>{x.hint}</small>}</td>
              <td>{x.v < 0 ? "−" : ""}{fmt(Math.abs(x.v))}</td>
            </tr>
          ))}
          <tr className="total"><td>Landed in Saudi Arabia</td><td>{sar(r.total)}</td></tr>
          <tr className="cmp"><td>Saudi distributor</td><td>{sar(e.local)}</td></tr>
          <tr className="cmp"><td>Difference</td><td style={{ color: `var(--${diff > 0 ? "local" : "import"})` }}>{signed(diff)} ({pct((diff / e.local) * 100)})</td></tr>
        </tbody>
      </table>
    </section>
  );
}

/* ───────────── Picker sheet ───────────── */
function Picker({ s, evals, current, onOpen, onClose }: {
  s: Settings; evals: Map<string, Evaluation>; current: string; onOpen: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { inp.current?.focus(); const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return MODELS.filter((m) => !t || `${m.name} ${m.trim} ${m.seg}`.toLowerCase().includes(t));
  }, [q]);
  const groups = BRANDS.map((b) => [b, list.filter((m) => m.brand === b)] as const).filter(([, l]) => l.length);
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Choose a vehicle">
      <div className="sheet-head">
        <input ref={inp} id="picker-search" className="search" type="search" placeholder={`Search ${MODELS.length} models`} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="link-btn" onClick={onClose}>Done</button>
      </div>
      <div className="sheet-body">
        {groups.length === 0 && <p className="muted pad">No model matches “{q}”.</p>}
        {groups.map(([b, l]) => (
          <div key={b} className="group">
            <div className="group-head">{b}</div>
            {l.map((m) => <ModelRow key={m.id} m={m} e={evals.get(m.id)!} s={s} cur={m.id === current} onClick={() => onOpen(m.id)} showBrand={false} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelRow({ m, e, s, cur, onClick, showBrand = true }: { m: Model; e: Evaluation; s: Settings; cur: boolean; onClick: () => void; showBrand?: boolean }) {
  const ch = checkedOf(s, m, e);
  return (
    <button type="button" className={"row" + (cur ? " cur" : "")} onClick={onClick}>
      <span className="row-main">
        <span className="row-name">{showBrand ? m.name : m.model}</span>
        <span className="row-sub">{m.trim} · {m.seg} · {ch.n}/{ch.total} prices checked</span>
      </span>
      <span className="row-side">
        <span className="num small">{fmt(e.local)}</span>
        <span className={"chip " + e.verdict}>{e.diff != null ? pct(e.diff) : "n/a"}</span>
      </span>
    </button>
  );
}

/* ───────────── Catalogue ───────────── */
function Catalogue({ s, evals, current, onOpen }: { s: Settings; evals: Map<string, Evaluation>; current: string; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [seg, setSeg] = useState("");
  const [verdict, setVerdict] = useState<"" | "local" | "even" | "import">("");
  const [checkedOnly, setCheckedOnly] = useState(false);
  const [sort, setSort] = useState<"diff" | "name" | "price">("diff");
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return MODELS.filter((m) => {
      const e = evals.get(m.id)!;
      return (!t || `${m.name} ${m.trim}`.toLowerCase().includes(t)) && (!brand || m.brand === brand) && (!seg || m.seg === seg)
        && (!verdict || e.verdict === verdict) && (!checkedOnly || checkedOf(s, m, e).both);
    }).sort((a, b) => {
      const A = evals.get(a.id)!, B = evals.get(b.id)!;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "price") return A.local - B.local;
      return (A.diff ?? 1e9) - (B.diff ?? 1e9);
    });
  }, [q, brand, seg, verdict, checkedOnly, sort, evals, s]);
  const counts = { local: 0, even: 0, import: 0 } as Record<string, number>;
  rows.forEach((m) => { const v = evals.get(m.id)!.verdict; if (v in counts) counts[v]++; });

  return (
    <div className="stack-col">
      <input className="search" type="search" id="cat-search" placeholder="Search models" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="seg-ctl" role="group" aria-label="Verdict">
        {([["", "All"], ["import", "Import"], ["even", "Close"], ["local", "Local"]] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={verdict === k} className={verdict === k ? "on" : ""} onClick={() => setVerdict(k)}>{l}</button>
        ))}
      </div>
      <div className="filter-row">
        <select id="cat-brand" aria-label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">All brands</option>{BRANDS.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select id="cat-seg" aria-label="Segment" value={seg} onChange={(e) => setSeg(e.target.value)}>
          <option value="">All segments</option>{SEGMENTS.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select id="cat-sort" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="diff">Sort: biggest saving</option><option value="name">Sort: name</option><option value="price">Sort: Saudi price</option>
        </select>
      </div>
      <label className="check"><input id="cat-checked" type="checkbox" checked={checkedOnly} onChange={(e) => setCheckedOnly(e.target.checked)} /> Only cars with both prices checked</label>
      <div className="summary">
        <span><b className="c-import">{counts.import}</b> import</span>
        <span><b className="c-even">{counts.even}</b> too close</span>
        <span><b className="c-local">{counts.local}</b> buy locally</span>
      </div>
      <div className="list">
        {rows.map((m) => <ModelRow key={m.id} m={m} e={evals.get(m.id)!} s={s} cur={m.id === current} onClick={() => onOpen(m.id)} />)}
        {rows.length === 0 && <p className="muted pad">No models match these filters.</p>}
      </div>
    </div>
  );
}

/* ───────────── Settings ───────────── */
function SettingsScreen({ s, setS }: { s: Settings; setS: React.Dispatch<React.SetStateAction<Settings>> }) {
  const [confirm, setConfirm] = useState(false);
  const edits = Object.keys(s.p).length;
  const gf = [["vat", "Saudi VAT", "%"], ["ins", "Marine insurance", "% of car"], ["fees", "Clearance, SABER, Fahas, plates", "SAR"], ["warrPct", "Warranty and resale lost", "% of local price"], ["band", "Call it a tie within", "± %"]] as const;
  const cols = [["fx", "SAR per unit"], ["refund", "Refundable tax %"], ["markup", "Markup %"], ["freight", "Freight USD"], ["dest", "Port charges USD"], ["duty", "Duty %"]] as const;
  return (
    <div className="stack-col">
      <section className="card">
        <h3>Saudi side</h3>
        <div className="form-grid">
          {gf.map(([k, l, u]) => (
            <div className="field" key={k}>
              <label htmlFor={"g-" + k}>{l} <small>{u}</small></label>
              <NumField id={"g-" + k} value={s.g[k]} onCommit={(v) => v != null && setS((p) => ({ ...p, g: { ...p.g, [k]: v } }))} />
            </div>
          ))}
        </div>
      </section>

      {ORIGIN_KEYS.map((k) => {
        const o = s.o[k];
        return (
          <section className="card" key={k}>
            <h3>{o.name} <small className="muted">{o.cur}</small></h3>
            <div className="form-grid">
              {cols.map(([c, l]) => (
                <div className="field" key={c}>
                  <label htmlFor={`o-${k}-${c}`}>{l}</label>
                  <NumField id={`o-${k}-${c}`} value={o[c]} onCommit={(v) => v != null && setS((p) => ({ ...p, o: { ...p.o, [k]: { ...p.o[k], [c]: v } } }))} />
                </div>
              ))}
            </div>
            <label className="check"><input id={`o-${k}-warranty`} type="checkbox" checked={o.warranty} onChange={(e) => setS((p) => ({ ...p, o: { ...p.o, [k]: { ...p.o[k], warranty: e.target.checked } } }))} /> Cars from here lose the local agency warranty</label>
          </section>
        );
      })}

      <section className="card">
        <h3>Reset</h3>
        <p className="muted small">{edits ? `You have edited ${edits} price${edits > 1 ? "s" : ""}.` : "No prices edited."} Reset puts every price and assumption back to the November 2026 defaults.</p>
        {!confirm
          ? <button type="button" className="btn" onClick={() => setConfirm(true)}>Reset everything</button>
          : <div className="btn-row">
              <button type="button" className="btn danger" onClick={() => { setS(freshSettings()); setConfirm(false); }}>Yes, reset</button>
              <button type="button" className="btn" onClick={() => setConfirm(false)}>Cancel</button>
            </div>}
      </section>

      <section className="card">
        <h3>Rules that decide it for you</h3>
        <ul className="rules">
          <li><b>Left-hand drive only.</b> Right-hand-drive cars are refused, so Japan, the UK, Thailand and Australia are out.</li>
          <li><b>SABER conformity.</b> Every car needs a SASO certificate. Some US, Korean and Chinese domestic specs need changes or cannot be registered.</li>
          <li><b>No agency warranty.</b> Non-GCC imports usually lose the 3–5 year warranty and free service, and resell for less.</li>
          <li><b>Same name, different car.</b> The US Land Cruiser is the 250 (Prado), the Patrol is the US Armada, the X-Trail is the Rogue.</li>
          <li><b>Customs revalues.</b> Duty is charged on the value customs assesses, not only your invoice.</li>
          <li><b>UAE duty.</b> Set to 0% because GCC duty is collected at the first point of entry. Confirm with ZATCA.</li>
        </ul>
        <p className="muted small">Prices tagged “listing” were checked against CarSwitch, Syarah, Yallamotor, Halacarly, ArabWheels, ZigWheels, DriveArabia, KBB, Edmunds, TrueCar, Cars.com, DubiCars, Getcha and CarNewsChina in November 2026. Prices tagged “est.” are base-trim estimates. Indicative only: get a dealer quote before you buy.</p>
      </section>
    </div>
  );
}
