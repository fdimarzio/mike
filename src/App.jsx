import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Config ────────────────────────────────────────────────────────────────────
const PIN         = import.meta.env.VITE_MIKE_PIN || "1234";
const ENTITY      = "FD Trading LLC";
const CURRENT_YEAR = new Date().getFullYear();

// ── Schedule C expense categories ────────────────────────────────────────────
const EXPENSE_CATS = [
  "Data & Subscriptions",
  "Software & Tools",
  "Home Office",
  "Education & Research",
  "Professional Services",
  "Bank & Brokerage Fees",
  "Equipment",
  "Internet & Phone",
  "Travel & Meals",
  "Insurance",
  "Rental - Maintenance",
  "Rental - Property Tax",
  "Rental - Insurance",
  "Rental - Management",
  "Rental - Utilities",
  "Rental - Mortgage Interest",
  "Rental - Other",
  "Other",
];

const RENTAL_EXPENSE_CATS = EXPENSE_CATS.filter(c => c.startsWith("Rental"));
const TRADING_EXPENSE_CATS = EXPENSE_CATS.filter(c => !c.startsWith("Rental"));

const INCOME_CATS = [
  "Options Premium",
  "Options Profit",
  "Dividends",
  "Rental Income",
  "Other Income",
];

// ── Formatters ────────────────────────────────────────────────────────────────
const f$ = v => v == null ? "—" : "$" + Math.abs(+v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fSign = v => v == null ? "—" : (v >= 0 ? "+" : "-") + "$" + Math.abs(+v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fMo = d => { const [y, m] = d.split("-"); return new Date(+y, +m - 1).toLocaleString("en-US", { month: "short", year: "2-digit" }); };
const TODAY = new Date().toISOString().slice(0, 10);
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  // layout
  page:   { minHeight: "100vh", background: "#010409", color: "#e6edf3", fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13 },
  wrap:   { maxWidth: 960, margin: "0 auto", padding: "16px 14px" },
  // card
  card:   { background: "#0a0e14", border: "1px solid #1c2128", borderRadius: 10, padding: 14, marginBottom: 12 },
  cardSm: { background: "#080c12", border: "1px solid #1c2128", borderRadius: 8, padding: 11 },
  // text
  label:  { fontSize: 7, color: "#2a3040", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 3 },
  val:    { fontSize: 11, fontFamily: "monospace", color: "#c9d1d9" },
  muted:  { color: "#3a4050", fontSize: 10, fontFamily: "monospace" },
  // inputs
  input:  { background: "#0d1117", border: "1px solid #21262d", color: "#e6edf3", fontFamily: "monospace", fontSize: 11, padding: "5px 8px", borderRadius: 5, outline: "none", width: "100%" },
  select: { background: "#0d1117", border: "1px solid #21262d", color: "#e6edf3", fontFamily: "monospace", fontSize: 11, padding: "5px 8px", borderRadius: 5, outline: "none", width: "100%" },
  // buttons
  btn:    { background: "transparent", border: "1px solid #21262d", color: "#8b949e", fontFamily: "monospace", fontSize: 10, padding: "5px 12px", borderRadius: 5, cursor: "pointer" },
  btnG:   { background: "#00ff8814", border: "1px solid #00ff8830", color: "#00ff88", fontFamily: "monospace", fontSize: 10, padding: "5px 12px", borderRadius: 5, cursor: "pointer" },
  btnR:   { background: "#ff456014", border: "1px solid #ff456030", color: "#ff4560", fontFamily: "monospace", fontSize: 10, padding: "5px 12px", borderRadius: 5, cursor: "pointer" },
  btnB:   { background: "#58a6ff14", border: "1px solid #58a6ff30", color: "#58a6ff", fontFamily: "monospace", fontSize: 10, padding: "5px 12px", borderRadius: 5, cursor: "pointer" },
};

// ── KPI box ───────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, color = "#e6edf3" }) {
  return (
    <div style={{ ...S.cardSm }}>
      <div style={S.label}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color, marginBottom: sub ? 2 : 0 }}>{value}</div>
      {sub && <div style={{ ...S.muted }}>{sub}</div>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SecHdr({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <span style={{ fontSize: 8, color: "#2a3040", fontFamily: "monospace", letterSpacing: "0.1em" }}>{children}</span>
      {action}
    </div>
  );
}

// ── Row form (add/edit expense or income) ─────────────────────────────────────
function EntryForm({ initial, cats, onSave, onCancel, title }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div style={{ ...S.cardSm, border: "1px solid #00ff8820", animation: "fadeIn .15s", marginBottom: 10 }}>
      <div style={{ fontSize: 9, color: "#00ff88", fontFamily: "monospace", marginBottom: 10, letterSpacing: "0.07em" }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 8 }}>
        <div><div style={S.label}>DATE</div><input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={S.input} /></div>
        <div><div style={S.label}>DESCRIPTION</div><input value={form.description} onChange={e => set("description", e.target.value)} placeholder="e.g. Bloomberg Terminal" style={S.input} /></div>
        <div><div style={S.label}>AMOUNT $</div><input type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" style={S.input} /></div>
        <div><div style={S.label}>CATEGORY</div>
          <select value={form.category} onChange={e => set("category", e.target.value)} style={S.select}>
            <option value="">— select —</option>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {"is_recurring" in form && <>
          <div><div style={S.label}>RECURRING</div>
            <select value={form.is_recurring ? "yes" : "no"} onChange={e => set("is_recurring", e.target.value === "yes")} style={S.select}>
              <option value="no">No</option><option value="yes">Yes</option>
            </select>
          </div>
          {form.is_recurring && (
            <div><div style={S.label}>FREQUENCY</div>
              <select value={form.frequency || ""} onChange={e => set("frequency", e.target.value)} style={S.select}>
                <option value="">—</option><option>Monthly</option><option>Quarterly</option><option>Annual</option>
              </select>
            </div>
          )}
        </>}
        <div><div style={S.label}>NOTES</div><input value={form.notes || ""} onChange={e => set("notes", e.target.value)} placeholder="optional" style={S.input} /></div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onSave(form)} style={S.btnG}>Save</button>
        <button onClick={onCancel} style={S.btn}>Cancel</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [authed, setAuthed]     = useState(() => sessionStorage.getItem("mike_auth") === "ok");
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr]     = useState(false);

  const tryPin = () => {
    if (pinInput === PIN) { setAuthed(true); sessionStorage.setItem("mike_auth", "ok"); }
    else { setPinErr(true); setTimeout(() => setPinErr(false), 1200); }
  };

  if (!authed) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...S.card, width: 280, textAlign: "center" }}>
        <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 22, color: "#e6edf3", marginBottom: 4 }}>MIKE</div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#3a4050", marginBottom: 20 }}>Financial Dashboard</div>
        <input
          type="password" value={pinInput} onChange={e => setPinInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && tryPin()}
          placeholder="Enter PIN"
          style={{ ...S.input, textAlign: "center", fontSize: 18, letterSpacing: 8, marginBottom: 10, borderColor: pinErr ? "#ff4560" : "#21262d" }}
          autoFocus
        />
        <button onClick={tryPin} style={{ ...S.btnG, width: "100%", padding: "8px" }}>Unlock</button>
        {pinErr && <div style={{ color: "#ff4560", fontSize: 10, fontFamily: "monospace", marginTop: 8 }}>Incorrect PIN</div>}
      </div>
    </div>
  );

  return <Dashboard />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD (authenticated)
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard() {
  const [tab, setTab]           = useState("dashboard");
  const [year, setYear]         = useState(CURRENT_YEAR);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes]   = useState([]);
  const [contracts, setContracts] = useState([]); // from PRI
  const [loading, setLoading]   = useState(true);

  // ── Load all data ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const [expRes, incRes, conRes] = await Promise.all([
      supabase.from("mike_expenses").select("*").order("date", { ascending: false }),
      supabase.from("mike_incomes").select("*").order("date", { ascending: false }),
      supabase.from("contracts").select("id,stock,type,opt_type,premium,profit,date_exec,close_date,status,qty")
        .not("premium", "is", null),
    ]);
    if (expRes.data) setExpenses(expRes.data);
    if (incRes.data) setIncomes(incRes.data);
    if (conRes.data) setContracts(conRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived numbers ───────────────────────────────────────────────────────
  // Options income from contracts table (STO/BTO closed positions)
  const closedContracts = contracts.filter(c =>
    c.status === "Closed" && c.profit != null &&
    new Date(c.close_date || c.date_exec).getFullYear() === year
  );
  const optionsProfit = closedContracts.reduce((s, c) => s + (+c.profit || 0), 0);
  const optionsPremium = contracts.filter(c =>
    c.opt_type === "STO" && c.premium != null &&
    new Date(c.date_exec).getFullYear() === year
  ).reduce((s, c) => s + Math.abs(+c.premium || 0), 0);

  // Manual income (excluding Options — those come from contracts)
  const yearIncomes   = incomes.filter(i => i.date?.startsWith(String(year)));
  const rentalIncome  = yearIncomes.filter(i => i.category === "Rental Income").reduce((s, i) => s + (+i.amount || 0), 0);
  const otherIncome   = yearIncomes.filter(i => i.category !== "Rental Income").reduce((s, i) => s + (+i.amount || 0), 0);

  const yearExpenses  = expenses.filter(e => e.date?.startsWith(String(year)));
  const tradingExp    = yearExpenses.filter(e => !e.category?.startsWith("Rental")).reduce((s, e) => s + (+e.amount || 0), 0);
  const rentalExp     = yearExpenses.filter(e => e.category?.startsWith("Rental")).reduce((s, e) => s + (+e.amount || 0), 0);

  const grossIncome   = optionsProfit + optionsPremium + rentalIncome + otherIncome;
  const totalExp      = tradingExp + rentalExp;
  const netIncome     = grossIncome - totalExp;

  // Monthly chart data
  const monthlyData = MONTHS.map((mo, i) => {
    const m = String(i + 1).padStart(2, "0");
    const prefix = `${year}-${m}`;
    const opts = closedContracts.filter(c => (c.close_date || c.date_exec || "").startsWith(prefix))
      .reduce((s, c) => s + (+c.profit || 0), 0);
    const exp  = yearExpenses.filter(e => e.date?.startsWith(prefix)).reduce((s, e) => s + (+e.amount || 0), 0);
    const inc  = yearIncomes.filter(i => i.date?.startsWith(prefix)).reduce((s, i) => s + (+i.amount || 0), 0);
    return { mo, opts: +opts.toFixed(2), exp: +exp.toFixed(2), inc: +inc.toFixed(2), net: +(opts + inc - exp).toFixed(2) };
  });

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "income",    label: "Income" },
    { id: "expenses",  label: "Expenses" },
    { id: "rentals",   label: "Rentals" },
    { id: "reports",   label: "Reports" },
  ];

  const ctx = { year, setYear, expenses, setExpenses, incomes, setIncomes, contracts, closedContracts, reload: load, yearExpenses, yearIncomes, tradingExp, rentalExp, rentalIncome, otherIncome, optionsProfit, optionsPremium };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fadeIn { from { opacity:0;transform:translateY(-3px) } to { opacity:1;transform:none } }
        input:focus, select:focus { border-color: #58a6ff !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #21262d; border-radius: 2px; }
        table { border-collapse: collapse; width: 100%; }
        tr.rh:hover { background: #ffffff06 !important; cursor: pointer; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1c2128", padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, background: "#010409" }}>
        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 16, color: "#e6edf3" }}>MIKE</span>
        <span style={{ fontSize: 9, color: "#3a4050", fontFamily: "monospace" }}>{ENTITY}</span>
        <div style={{ flex: 1 }} />
        {/* Year selector */}
        <select value={year} onChange={e => setYear(+e.target.value)}
          style={{ ...S.select, width: 80, fontSize: 11 }}>
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => <option key={y}>{y}</option>)}
        </select>
        <button onClick={() => { sessionStorage.removeItem("mike_auth"); window.location.reload(); }}
          style={{ ...S.btn, fontSize: 9 }}>Sign out</button>
      </div>

      {/* Nav */}
      <div style={{ borderBottom: "1px solid #1c2128", display: "flex", gap: 2, padding: "0 14px", background: "#010409" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: tab === t.id ? "#00ff8814" : "transparent", color: tab === t.id ? "#00ff88" : "#444",
              border: "none", borderBottom: tab === t.id ? "2px solid #00ff88" : "2px solid transparent",
              fontFamily: "monospace", fontSize: 10, padding: "9px 12px", cursor: "pointer", letterSpacing: "0.05em" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#3a4050", fontFamily: "monospace", fontSize: 11 }}>Loading…</div>
      ) : (
        <div style={S.wrap}>
          {tab === "dashboard" && <TabDashboard {...ctx} monthlyData={monthlyData} grossIncome={grossIncome} totalExp={totalExp} netIncome={netIncome} />}
          {tab === "income"    && <TabIncome    {...ctx} />}
          {tab === "expenses"  && <TabExpenses  {...ctx} />}
          {tab === "rentals"   && <TabRentals   {...ctx} />}
          {tab === "reports"   && <TabReports   {...ctx} grossIncome={grossIncome} totalExp={totalExp} netIncome={netIncome} />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function TabDashboard({ year, monthlyData, optionsProfit, optionsPremium, rentalIncome, otherIncome, tradingExp, rentalExp, grossIncome, totalExp, netIncome, closedContracts }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "8px 10px", fontFamily: "monospace", fontSize: 10 }}>
        <div style={{ color: "#8b949e", marginBottom: 4 }}>{label}</div>
        {payload.map(p => <div key={p.name} style={{ color: p.color }}>{p.name}: {f$(p.value)}</div>)}
      </div>
    );
  };

  return (
    <div>
      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        <KPI label="OPTIONS PROFIT YTD" value={fSign(optionsProfit)} color={optionsProfit >= 0 ? "#00ff88" : "#ff4560"} sub={`${closedContracts.length} closed trades`} />
        <KPI label="OPTIONS PREMIUM COLLECTED" value={f$(optionsPremium)} color="#58a6ff" sub="STO gross premiums" />
        <KPI label="RENTAL INCOME" value={f$(rentalIncome)} color="#c084fc" />
        <KPI label="TOTAL EXPENSES" value={"(" + f$(totalExp) + ")"} color="#ffd166" sub={`Trading ${f$(tradingExp)} · Rental ${f$(rentalExp)}`} />
        <KPI label="GROSS INCOME" value={f$(grossIncome)} color="#e6edf3" />
        <KPI label="NET LLC INCOME" value={fSign(netIncome)} color={netIncome >= 0 ? "#00ff88" : "#ff4560"} sub={`${year} YTD`} />
      </div>

      {/* Monthly chart */}
      <div style={S.card}>
        <SecHdr>MONTHLY P&L — {year}</SecHdr>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2128" />
            <XAxis dataKey="mo" tick={{ fill: "#3a4050", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#3a4050", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={v => "$" + (Math.abs(v) >= 1000 ? (v/1000).toFixed(0)+"k" : v)} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="opts" name="Options P&L" fill="#00ff8870" radius={[3,3,0,0]} />
            <Bar dataKey="inc"  name="Other Income" fill="#58a6ff70" radius={[3,3,0,0]} />
            <Bar dataKey="exp"  name="Expenses" fill="#ff456070" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Net line */}
      <div style={S.card}>
        <SecHdr>CUMULATIVE NET — {year}</SecHdr>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={monthlyData.reduce((acc, d, i) => {
            const prev = i > 0 ? acc[i-1].cum : 0;
            return [...acc, { ...d, cum: +(prev + d.net).toFixed(2) }];
          }, [])} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2128" />
            <XAxis dataKey="mo" tick={{ fill: "#3a4050", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#3a4050", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={v => "$" + (Math.abs(v)>=1000?(v/1000).toFixed(0)+"k":v)} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="cum" name="Cumulative Net" stroke="#00ff88" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: INCOME
// ═══════════════════════════════════════════════════════════════════════════════
function TabIncome({ year, incomes, setIncomes, contracts, closedContracts, reload, yearIncomes }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const blankIncome = { date: TODAY, description: "", amount: "", category: "Other Income", notes: "" };

  const saveIncome = async (form) => {
    if (!form.description || !form.amount) return;
    const row = { date: form.date, description: form.description, amount: +form.amount, category: form.category, notes: form.notes || null };
    if (form.id) {
      await supabase.from("mike_incomes").update(row).eq("id", form.id);
    } else {
      await supabase.from("mike_incomes").insert(row);
    }
    setAdding(false); setEditing(null); reload();
  };

  const deleteIncome = async (id) => {
    if (!confirm("Delete this income entry?")) return;
    await supabase.from("mike_incomes").delete().eq("id", id);
    reload();
  };

  // Options income from contracts — read only
  const optionsByMonth = {};
  closedContracts.forEach(c => {
    const mo = (c.close_date || c.date_exec || "").slice(0, 7);
    if (!optionsByMonth[mo]) optionsByMonth[mo] = { premium: 0, profit: 0, count: 0 };
    optionsByMonth[mo].profit += +c.profit || 0;
    optionsByMonth[mo].count++;
  });

  const totalManual = yearIncomes.reduce((s, i) => s + (+i.amount||0), 0);
  const totalOptions = closedContracts.reduce((s, c) => s + (+c.profit||0), 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <KPI label="OPTIONS PROFIT" value={fSign(totalOptions)} color={totalOptions>=0?"#00ff88":"#ff4560"} sub={`${closedContracts.length} closed trades`} />
        <KPI label="OTHER INCOME" value={f$(totalManual)} color="#58a6ff" sub="manual entries" />
      </div>

      {/* Options section — read-only from contracts */}
      <div style={S.card}>
        <SecHdr>OPTIONS INCOME — from Options Tracker (read-only)</SecHdr>
        {Object.keys(optionsByMonth).sort().reverse().slice(0,6).map(mo => {
          const d = optionsByMonth[mo];
          return (
            <div key={mo} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderTop:"1px solid #1c2128", fontFamily:"monospace", fontSize:11 }}>
              <span style={{ color:"#8b949e" }}>{fMo(mo)}</span>
              <span>{d.count} trades</span>
              <span style={{ color: d.profit>=0?"#00ff88":"#ff4560", fontWeight:700 }}>{fSign(d.profit)}</span>
            </div>
          );
        })}
        {Object.keys(optionsByMonth).length === 0 && <div style={S.muted}>No closed trades in {year}</div>}
      </div>

      {/* Manual income */}
      <div style={S.card}>
        <SecHdr action={<button onClick={() => setAdding(true)} style={S.btnG}>+ Add Income</button>}>
          MANUAL INCOME — {year}
        </SecHdr>

        {adding && (
          <EntryForm title="ADD INCOME" initial={blankIncome} cats={INCOME_CATS}
            onSave={saveIncome} onCancel={() => setAdding(false)} />
        )}
        {editing && (
          <EntryForm title="EDIT INCOME" initial={editing} cats={INCOME_CATS}
            onSave={saveIncome} onCancel={() => setEditing(null)} />
        )}

        <table>
          <thead>
            <tr style={{ borderBottom: "1px solid #1c2128" }}>
              {["Date","Description","Category","Amount","Notes",""].map(h => (
                <th key={h} style={{ padding:"5px 8px", textAlign:"left", color:"#3a4050", fontFamily:"monospace", fontSize:9 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yearIncomes.map(i => (
              <tr key={i.id} className="rh" style={{ borderTop:"1px solid #0d1117" }}>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:10, color:"#555" }}>{i.date}</td>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:11, color:"#e6edf3" }}>{i.description}</td>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:10, color:"#8b949e" }}>{i.category}</td>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:11, color:"#58a6ff", textAlign:"right" }}>{f$(i.amount)}</td>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:10, color:"#555", fontStyle:"italic" }}>{i.notes}</td>
                <td style={{ padding:"5px 8px" }}>
                  <div style={{ display:"flex", gap:4 }}>
                    <button onClick={() => setEditing(i)} style={{ ...S.btn, fontSize:9, padding:"2px 7px" }}>Edit</button>
                    <button onClick={() => deleteIncome(i.id)} style={{ ...S.btnR, fontSize:9, padding:"2px 7px" }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {yearIncomes.length === 0 && (
              <tr><td colSpan={6} style={{ padding:20, textAlign:"center", color:"#2a3040", fontFamily:"monospace", fontSize:10 }}>No income entries for {year}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: EXPENSES
// ═══════════════════════════════════════════════════════════════════════════════
function TabExpenses({ year, expenses, reload, yearExpenses, tradingExp }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("all");

  const blankExp = { date: TODAY, description: "", amount: "", category: "", is_recurring: false, frequency: "", notes: "" };

  const saveExp = async (form) => {
    if (!form.description || !form.amount) return;
    const row = { date: form.date, description: form.description, amount: +form.amount,
      category: form.category, entity: "LLC", is_recurring: !!form.is_recurring,
      frequency: form.frequency || null, notes: form.notes || null };
    if (form.id) {
      await supabase.from("mike_expenses").update(row).eq("id", form.id);
    } else {
      await supabase.from("mike_expenses").insert(row);
    }
    setAdding(false); setEditing(null); reload();
  };

  const deleteExp = async (id) => {
    if (!confirm("Delete this expense?")) return;
    await supabase.from("mike_expenses").delete().eq("id", id);
    reload();
  };

  const tradingExpenses = yearExpenses.filter(e => !e.category?.startsWith("Rental"));
  const displayed = filter === "all" ? tradingExpenses
    : filter === "recurring" ? tradingExpenses.filter(e => e.is_recurring)
    : tradingExpenses.filter(e => e.category === filter);

  // Category totals
  const catTotals = {};
  tradingExpenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + (+e.amount || 0);
  });

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
        <KPI label="TRADING EXPENSES YTD" value={"("+f$(tradingExp)+")"} color="#ffd166" />
        <KPI label="CATEGORIES" value={Object.keys(catTotals).length} color="#8b949e" sub={`${tradingExpenses.length} entries`} />
      </div>

      {/* Category breakdown */}
      {Object.keys(catTotals).length > 0 && (
        <div style={S.card}>
          <SecHdr>BY CATEGORY</SecHdr>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat, amt]) => (
              <div key={cat} onClick={() => setFilter(filter === cat ? "all" : cat)}
                style={{ ...S.cardSm, cursor:"pointer", borderColor: filter===cat ? "#ffd16650":"#1c2128", background: filter===cat?"#ffd16608":"#080c12" }}>
                <div style={{ ...S.label, marginBottom:4 }}>{cat}</div>
                <div style={{ fontFamily:"monospace", fontWeight:700, color:"#ffd166", fontSize:13 }}>{f$(amt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={S.card}>
        <SecHdr action={
          <div style={{ display:"flex", gap:5 }}>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...S.select, width:140, fontSize:10 }}>
              <option value="all">All trading</option>
              <option value="recurring">Recurring only</option>
              {Object.keys(catTotals).map(c => <option key={c}>{c}</option>)}
            </select>
            <button onClick={() => setAdding(true)} style={S.btnG}>+ Add</button>
          </div>
        }>TRADING EXPENSES — {year}</SecHdr>

        {adding && <EntryForm title="ADD EXPENSE" initial={blankExp} cats={TRADING_EXPENSE_CATS} onSave={saveExp} onCancel={() => setAdding(false)} />}
        {editing && <EntryForm title="EDIT EXPENSE" initial={editing} cats={TRADING_EXPENSE_CATS} onSave={saveExp} onCancel={() => setEditing(null)} />}

        <table>
          <thead>
            <tr style={{ borderBottom:"1px solid #1c2128" }}>
              {["Date","Description","Category","Recurring","Amount","Notes",""].map(h => (
                <th key={h} style={{ padding:"5px 8px", textAlign:"left", color:"#3a4050", fontFamily:"monospace", fontSize:9 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map(e => (
              <tr key={e.id} className="rh" style={{ borderTop:"1px solid #0d1117" }}>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:10, color:"#555" }}>{e.date}</td>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:11, color:"#e6edf3" }}>{e.description}</td>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:10, color:"#8b949e" }}>{e.category}</td>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:10, color: e.is_recurring?"#00ff88":"#2a3040" }}>
                  {e.is_recurring ? `✓ ${e.frequency||""}` : "—"}
                </td>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:11, color:"#ffd166", textAlign:"right" }}>{f$(e.amount)}</td>
                <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:10, color:"#555", fontStyle:"italic" }}>{e.notes}</td>
                <td style={{ padding:"5px 8px" }}>
                  <div style={{ display:"flex", gap:4 }}>
                    <button onClick={() => setEditing(e)} style={{ ...S.btn, fontSize:9, padding:"2px 7px" }}>Edit</button>
                    <button onClick={() => deleteExp(e.id)} style={{ ...S.btnR, fontSize:9, padding:"2px 7px" }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr><td colSpan={7} style={{ padding:20, textAlign:"center", color:"#2a3040", fontFamily:"monospace", fontSize:10 }}>No expenses{filter!=="all"?" in this filter":""} for {year}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: RENTALS
// ═══════════════════════════════════════════════════════════════════════════════
function TabRentals({ year, expenses, incomes, reload, yearExpenses, yearIncomes, rentalIncome, rentalExp }) {
  const [addingInc, setAddingInc] = useState(false);
  const [addingExp, setAddingExp] = useState(false);
  const [editingInc, setEditingInc] = useState(null);
  const [editingExp, setEditingExp] = useState(null);

  const blankInc = { date: TODAY, description: "", amount: "", category: "Rental Income", notes: "" };
  const blankExp = { date: TODAY, description: "", amount: "", category: "Rental - Maintenance", is_recurring: false, frequency: "", notes: "" };

  const saveInc = async (form) => {
    if (!form.description || !form.amount) return;
    const row = { date: form.date, description: form.description, amount: +form.amount, category: form.category, notes: form.notes||null };
    if (form.id) { await supabase.from("mike_incomes").update(row).eq("id", form.id); }
    else { await supabase.from("mike_incomes").insert(row); }
    setAddingInc(false); setEditingInc(null); reload();
  };

  const saveExp = async (form) => {
    if (!form.description || !form.amount) return;
    const row = { date: form.date, description: form.description, amount: +form.amount,
      category: form.category, entity: "LLC", is_recurring: !!form.is_recurring,
      frequency: form.frequency||null, notes: form.notes||null };
    if (form.id) { await supabase.from("mike_expenses").update(row).eq("id", form.id); }
    else { await supabase.from("mike_expenses").insert(row); }
    setAddingExp(false); setEditingExp(null); reload();
  };

  const delInc = async (id) => { if (!confirm("Delete?")) return; await supabase.from("mike_incomes").delete().eq("id", id); reload(); };
  const delExp = async (id) => { if (!confirm("Delete?")) return; await supabase.from("mike_expenses").delete().eq("id", id); reload(); };

  const rentalIncEntries = yearIncomes.filter(i => i.category === "Rental Income");
  const rentalExpEntries = yearExpenses.filter(e => e.category?.startsWith("Rental"));
  const rentalNet = rentalIncome - rentalExp;

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
        <KPI label="RENTAL INCOME" value={f$(rentalIncome)} color="#c084fc" />
        <KPI label="RENTAL EXPENSES" value={"("+f$(rentalExp)+")"} color="#ffd166" />
        <KPI label="RENTAL NET" value={fSign(rentalNet)} color={rentalNet>=0?"#00ff88":"#ff4560"} />
      </div>

      {/* Rental income */}
      <div style={S.card}>
        <SecHdr action={<button onClick={() => setAddingInc(true)} style={S.btnG}>+ Income</button>}>RENTAL INCOME — {year}</SecHdr>
        {addingInc && <EntryForm title="ADD RENTAL INCOME" initial={blankInc} cats={["Rental Income"]} onSave={saveInc} onCancel={() => setAddingInc(false)} />}
        {editingInc && <EntryForm title="EDIT RENTAL INCOME" initial={editingInc} cats={["Rental Income"]} onSave={saveInc} onCancel={() => setEditingInc(null)} />}
        <table>
          <thead><tr style={{ borderBottom:"1px solid #1c2128" }}>
            {["Date","Description","Amount","Notes",""].map(h=><th key={h} style={{ padding:"5px 8px",textAlign:"left",color:"#3a4050",fontFamily:"monospace",fontSize:9 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rentalIncEntries.map(i => (
              <tr key={i.id} className="rh" style={{ borderTop:"1px solid #0d1117" }}>
                <td style={{ padding:"5px 8px",fontFamily:"monospace",fontSize:10,color:"#555" }}>{i.date}</td>
                <td style={{ padding:"5px 8px",fontFamily:"monospace",fontSize:11,color:"#e6edf3" }}>{i.description}</td>
                <td style={{ padding:"5px 8px",fontFamily:"monospace",fontSize:11,color:"#c084fc",textAlign:"right" }}>{f$(i.amount)}</td>
                <td style={{ padding:"5px 8px",fontFamily:"monospace",fontSize:10,color:"#555",fontStyle:"italic" }}>{i.notes}</td>
                <td style={{ padding:"5px 8px" }}><div style={{ display:"flex",gap:4 }}>
                  <button onClick={()=>setEditingInc(i)} style={{ ...S.btn,fontSize:9,padding:"2px 7px" }}>Edit</button>
                  <button onClick={()=>delInc(i.id)} style={{ ...S.btnR,fontSize:9,padding:"2px 7px" }}>Del</button>
                </div></td>
              </tr>
            ))}
            {rentalIncEntries.length===0 && <tr><td colSpan={5} style={{ padding:16,textAlign:"center",color:"#2a3040",fontFamily:"monospace",fontSize:10 }}>No rental income for {year}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Rental expenses */}
      <div style={S.card}>
        <SecHdr action={<button onClick={() => setAddingExp(true)} style={S.btnG}>+ Expense</button>}>RENTAL EXPENSES — {year}</SecHdr>
        {addingExp && <EntryForm title="ADD RENTAL EXPENSE" initial={blankExp} cats={RENTAL_EXPENSE_CATS} onSave={saveExp} onCancel={() => setAddingExp(false)} />}
        {editingExp && <EntryForm title="EDIT RENTAL EXPENSE" initial={editingExp} cats={RENTAL_EXPENSE_CATS} onSave={saveExp} onCancel={() => setEditingExp(null)} />}
        <table>
          <thead><tr style={{ borderBottom:"1px solid #1c2128" }}>
            {["Date","Description","Category","Amount","Notes",""].map(h=><th key={h} style={{ padding:"5px 8px",textAlign:"left",color:"#3a4050",fontFamily:"monospace",fontSize:9 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rentalExpEntries.map(e => (
              <tr key={e.id} className="rh" style={{ borderTop:"1px solid #0d1117" }}>
                <td style={{ padding:"5px 8px",fontFamily:"monospace",fontSize:10,color:"#555" }}>{e.date}</td>
                <td style={{ padding:"5px 8px",fontFamily:"monospace",fontSize:11,color:"#e6edf3" }}>{e.description}</td>
                <td style={{ padding:"5px 8px",fontFamily:"monospace",fontSize:10,color:"#8b949e" }}>{e.category}</td>
                <td style={{ padding:"5px 8px",fontFamily:"monospace",fontSize:11,color:"#ffd166",textAlign:"right" }}>{f$(e.amount)}</td>
                <td style={{ padding:"5px 8px",fontFamily:"monospace",fontSize:10,color:"#555",fontStyle:"italic" }}>{e.notes}</td>
                <td style={{ padding:"5px 8px" }}><div style={{ display:"flex",gap:4 }}>
                  <button onClick={()=>setEditingExp(e)} style={{ ...S.btn,fontSize:9,padding:"2px 7px" }}>Edit</button>
                  <button onClick={()=>delExp(e.id)} style={{ ...S.btnR,fontSize:9,padding:"2px 7px" }}>Del</button>
                </div></td>
              </tr>
            ))}
            {rentalExpEntries.length===0 && <tr><td colSpan={6} style={{ padding:16,textAlign:"center",color:"#2a3040",fontFamily:"monospace",fontSize:10 }}>No rental expenses for {year}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: REPORTS (Schedule C / LLC Summary)
// ═══════════════════════════════════════════════════════════════════════════════
function TabReports({ year, yearExpenses, yearIncomes, closedContracts, optionsProfit, optionsPremium, rentalIncome, tradingExp, rentalExp, grossIncome, totalExp, netIncome }) {
  const catTotals = {};
  yearExpenses.filter(e => !e.category?.startsWith("Rental")).forEach(e => {
    catTotals[e.category||"Other"] = (catTotals[e.category||"Other"]||0) + (+e.amount||0);
  });

  const rentalCatTotals = {};
  yearExpenses.filter(e => e.category?.startsWith("Rental")).forEach(e => {
    rentalCatTotals[e.category||"Rental - Other"] = (rentalCatTotals[e.category||"Rental - Other"]||0) + (+e.amount||0);
  });

  const otherIncome = yearIncomes.filter(i => i.category !== "Rental Income").reduce((s,i) => s+(+i.amount||0), 0);

  return (
    <div>
      {/* Main summary card */}
      <div style={{ ...S.card, background:"linear-gradient(135deg,#0a0e1a,#0a1a0e)", borderColor:"#00ff8830", marginBottom:16 }}>
        <div style={{ fontFamily:"'Georgia',serif", fontSize:13, color:"#00ff8890", letterSpacing:"0.1em", marginBottom:16 }}>LLC INCOME SUMMARY — {year}</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {[
            { label:"Gross Income", value:f$(grossIncome) },
            { label:"Total Deductions", value:"("+f$(totalExp)+")" },
            { label:"Net Taxable Income", value:fSign(netIncome) },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize:9, color:"#ffffff50", fontFamily:"monospace", letterSpacing:"0.07em", marginBottom:6 }}>{label}</div>
              <div style={{ fontSize:22, fontWeight:700, fontFamily:"monospace", color:"#e6edf3" }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:14, fontSize:10, color:"#2a3040", fontFamily:"monospace" }}>⚠ For reference only. Consult your tax professional for filing.</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {/* Income breakdown */}
        <div style={S.card}>
          <SecHdr>GROSS INCOME</SecHdr>
          {[
            ["Options Profit (closed trades)", optionsProfit],
            ["Options Premium Collected (STO)", optionsPremium],
            ["Rental Income", rentalIncome],
            ["Other Income", otherIncome],
          ].map(([label, val]) => val > 0 && (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderTop:"1px solid #1c2128", fontFamily:"monospace", fontSize:11 }}>
              <span style={{ color:"#8b949e", fontSize:10 }}>{label}</span>
              <span style={{ color:"#58a6ff" }}>{f$(val)}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 0 0", borderTop:"1px solid #21262d", fontFamily:"monospace", fontSize:12, marginTop:4 }}>
            <span style={{ fontWeight:700, color:"#e6edf3" }}>TOTAL</span>
            <span style={{ fontWeight:700, color:"#00ff88" }}>{f$(grossIncome)}</span>
          </div>
        </div>

        {/* Expense breakdown */}
        <div style={S.card}>
          <SecHdr>DEDUCTIONS</SecHdr>
          {Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat, amt]) => (
            <div key={cat} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderTop:"1px solid #1c2128", fontFamily:"monospace", fontSize:11 }}>
              <span style={{ color:"#8b949e", fontSize:10 }}>{cat}</span>
              <span style={{ color:"#ffd166" }}>{f$(amt)}</span>
            </div>
          ))}
          {Object.keys(rentalCatTotals).length > 0 && <>
            <div style={{ fontSize:8, color:"#2a3040", fontFamily:"monospace", letterSpacing:"0.07em", padding:"8px 0 4px" }}>RENTAL DEDUCTIONS</div>
            {Object.entries(rentalCatTotals).sort((a,b)=>b[1]-a[1]).map(([cat, amt]) => (
              <div key={cat} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderTop:"1px solid #1c2128", fontFamily:"monospace", fontSize:11 }}>
                <span style={{ color:"#8b949e", fontSize:10 }}>{cat}</span>
                <span style={{ color:"#ffd166" }}>{f$(amt)}</span>
              </div>
            ))}
          </>}
          <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 0 0", borderTop:"1px solid #21262d", fontFamily:"monospace", fontSize:12, marginTop:4 }}>
            <span style={{ fontWeight:700, color:"#e6edf3" }}>TOTAL</span>
            <span style={{ fontWeight:700, color:"#ffd166" }}>({f$(totalExp)})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
