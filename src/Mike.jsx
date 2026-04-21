import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Constants ────────────────────────────────────────────────────────────────
const APP_VERSION = "1.0.0";
const TODAY = new Date().toISOString().slice(0, 10);
const THIS_MONTH = new Date().toISOString().slice(0, 7);
const THIS_YEAR = new Date().getFullYear().toString();

const TAX_CATEGORIES = [
  "Advertising", "Auto & Travel", "Bank Charges", "Commissions & Fees",
  "Contract Labor", "Depreciation", "Home Office", "Insurance",
  "Legal & Professional", "Meals (50%)", "Office Supplies", "Rent/Lease",
  "Repairs & Maintenance", "Software & Subscriptions", "Taxes & Licenses",
  "Utilities", "Wages", "Other Business Expense",
];

const RENTAL_CATEGORIES = [
  "Mortgage/Principal", "Mortgage Interest", "Property Tax", "Insurance",
  "Repairs & Maintenance", "HOA Fees", "Property Management", "Utilities",
  "Landscaping", "Capital Improvement", "Depreciation", "Advertising",
  "Legal & Professional", "Other Rental Expense",
];

const INCOME_CATEGORIES = [
  "Options Trading - Premium", "Options Trading - Profit",
  "Rental Income", "Consulting", "Other LLC Income",
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Formatters ────────────────────────────────────────────────────────────────
const f$ = v => v == null ? "—" : "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f$0 = v => v == null ? "—" : "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
const fSign = v => v == null ? "—" : (v >= 0 ? "+" : "-") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fPct = (v, total) => total ? ((v / total) * 100).toFixed(1) + "%" : "0%";

// ── Default users (same as PRI) ──────────────────────────────────────────────
const USERS_DEFAULT = [
  { id:"frank",     name:"Frank M DiMarzio",           initials:"FD", color:"#1a3a5c", pin:"0116" },
  { id:"priscilla", name:"Priscilla Perutti DiMarzio", initials:"PP", color:"#2d6a9f", pin:"4223" },
];

// ── Main App ─────────────────────────────────────────────────────────────────
export default function Mike() {
  // Auth
  const [users, setUsers] = useState(USERS_DEFAULT);
  const [authUser, setAuthUser] = useState(null);
  const [loginStep, setLoginStep] = useState("pick"); // "pick" | "pin"
  const [loginTarget, setLoginTarget] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");

  // Data
  const [tab, setTab] = useState("dashboard");
  const [dbReady, setDbReady] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [optionsData, setOptionsData] = useState({ premiumMTD: 0, profitMTD: 0, premiumYTD: 0, profitYTD: 0, monthly: [] });
  const [yearFilter, setYearFilter] = useState(THIS_YEAR);
  const [monthFilter, setMonthFilter] = useState(THIS_MONTH);

  // Forms
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingIncome, setEditingIncome] = useState(null);
  const EMPTY_EXPENSE = { date: TODAY, description: "", amount: "", category: TAX_CATEGORIES[0], entity: "LLC", isRecurring: false, frequency: "monthly", notes: "" };
  const EMPTY_INCOME = { date: TODAY, description: "", amount: "", category: INCOME_CATEGORIES[0], entity: "LLC", notes: "" };
  const [expenseForm, setExpenseForm] = useState({ ...EMPTY_EXPENSE });
  const [incomeForm, setIncomeForm] = useState({ ...EMPTY_INCOME });

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) return;
    async function load() {
      try {
        // Load users from Supabase (to get current PINs)
        const { data: uData } = await supabase.from("app_users").select("*");
        if (uData?.length) setUsers(uData);
        const { data: expData } = await supabase.from("mike_expenses").select("*").order("date", { ascending: false });
        if (expData) setExpenses(expData);

        // Load manual incomes
        const { data: incData } = await supabase.from("mike_incomes").select("*").order("date", { ascending: false });
        if (incData) setIncomes(incData);

        // Pull options data from PRI contracts table
        const { data: contracts } = await supabase
          .from("contracts")
          .select("premium, profit, date_exec, close_date, status, parent_id")
          .is("parent_id", null);

        if (contracts) {
          const premiumMTD = contracts.filter(c => c.date_exec?.startsWith(THIS_MONTH)).reduce((s, c) => s + Math.abs(c.premium || 0), 0);
          const profitMTD = contracts.filter(c => c.status === "Closed" && c.close_date?.startsWith(THIS_MONTH)).reduce((s, c) => s + (c.profit || 0), 0);
          const premiumYTD = contracts.filter(c => c.date_exec?.startsWith(THIS_YEAR)).reduce((s, c) => s + Math.abs(c.premium || 0), 0);
          const profitYTD = contracts.filter(c => c.status === "Closed" && c.close_date?.startsWith(THIS_YEAR)).reduce((s, c) => s + (c.profit || 0), 0);

          // Monthly breakdown for current year
          const monthly = MONTHS.map((label, idx) => {
            const mo = `${THIS_YEAR}-${String(idx + 1).padStart(2, "0")}`;
            const prem = contracts.filter(c => c.date_exec?.startsWith(mo)).reduce((s, c) => s + Math.abs(c.premium || 0), 0);
            const prof = contracts.filter(c => c.status === "Closed" && c.close_date?.startsWith(mo)).reduce((s, c) => s + (c.profit || 0), 0);
            return { label, premium: prem, profit: prof };
          });
          setOptionsData({ premiumMTD, profitMTD, premiumYTD, profitYTD, monthly });
        }
      } catch (e) { console.error("MIKE load error:", e); }
      setDbReady(true);
    }
    load();
  }, [authed]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => expenses.filter(e => e.date?.startsWith(yearFilter)), [expenses, yearFilter]);
  const filteredIncomes = useMemo(() => incomes.filter(i => i.date?.startsWith(yearFilter)), [incomes, yearFilter]);

  const totalExpensesYTD = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalIncomeYTD = filteredIncomes.reduce((s, i) => s + (i.amount || 0), 0);
  const rentalExpenses = filteredExpenses.filter(e => e.entity === "Rental");
  const llcExpenses = filteredExpenses.filter(e => e.entity === "LLC");
  const rentalIncome = filteredIncomes.filter(i => i.category === "Rental Income");
  const netPL = totalIncomeYTD + optionsData.profitYTD - totalExpensesYTD;

  // Monthly expense chart data
  const monthlyExpenseData = MONTHS.map((label, idx) => {
    const mo = `${yearFilter}-${String(idx + 1).padStart(2, "0")}`;
    const exp = expenses.filter(e => e.date?.startsWith(mo)).reduce((s, e) => s + (e.amount || 0), 0);
    const inc = incomes.filter(i => i.date?.startsWith(mo)).reduce((s, i) => s + (i.amount || 0), 0);
    return { label, expenses: exp, income: inc };
  });

  // Category breakdown for expenses
  const expByCategory = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
    return acc;
  }, {});

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const saveExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.date) return;
    const row = { ...expenseForm, amount: +expenseForm.amount };
    if (editingExpense) {
      await supabase.from("mike_expenses").update(row).eq("id", editingExpense);
      setExpenses(p => p.map(e => e.id === editingExpense ? { ...e, ...row } : e));
    } else {
      const { data } = await supabase.from("mike_expenses").insert(row).select().single();
      if (data) setExpenses(p => [data, ...p]);
    }
    setExpenseForm({ ...EMPTY_EXPENSE });
    setEditingExpense(null);
    setShowExpenseForm(false);
  };

  const saveIncome = async () => {
    if (!incomeForm.description || !incomeForm.amount || !incomeForm.date) return;
    const row = { ...incomeForm, amount: +incomeForm.amount };
    if (editingIncome) {
      await supabase.from("mike_incomes").update(row).eq("id", editingIncome);
      setIncomes(p => p.map(i => i.id === editingIncome ? { ...i, ...row } : i));
    } else {
      const { data } = await supabase.from("mike_incomes").insert(row).select().single();
      if (data) setIncomes(p => [data, ...p]);
    }
    setIncomeForm({ ...EMPTY_INCOME });
    setEditingIncome(null);
    setShowIncomeForm(false);
  };

  const deleteExpense = async id => {
    if (!window.confirm("Delete this expense?")) return;
    await supabase.from("mike_expenses").delete().eq("id", id);
    setExpenses(p => p.filter(e => e.id !== id));
  };

  const deleteIncome = async id => {
    if (!window.confirm("Delete this income entry?")) return;
    await supabase.from("mike_incomes").delete().eq("id", id);
    setIncomes(p => p.filter(i => i.id !== id));
  };

  // ── Auth helpers ──────────────────────────────────────────────────────────
  const selUser = u => { setLoginTarget(u); setPinInput(""); setPinErr(""); setLoginStep("pin"); };
  const pinDigit = d => {
    const np = pinInput + d; setPinInput(np);
    if (np.length === 4) {
      if (np === loginTarget.pin) { setAuthUser(loginTarget); setLoginStep("pick"); setPinInput(""); }
      else { setPinErr("Wrong PIN"); setTimeout(() => { setPinInput(""); setPinErr(""); }, 900); }
    }
  };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (!authUser) return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Source Sans 3',sans-serif", padding: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ width: "100%", maxWidth: 340, animation: "fadeIn .3s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #1a3a5c, #2d6a9f)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 4px 20px rgba(26,58,92,0.2)" }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 20, color: "#fff" }}>M</span>
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: "#1a2a3a" }}>MIKE</div>
          <div style={{ fontSize: 11, color: "#8a9ab0", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>Manage Income & Key Expenses</div>
        </div>

        {loginStep === "pick" ? (
          <div>
            <div style={{ fontSize: 11, color: "#8a9ab0", textAlign: "center", marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase" }}>Select User</div>
            {users.map(u => (
              <button key={u.id} onClick={() => selUser(u)}
                style={{ background: "#fff", border: `1px solid ${u.color}30`, borderRadius: 12, padding: "13px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, width: "100%", marginBottom: 8, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: u.color + "18", border: `2px solid ${u.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display',serif", fontWeight: 700, color: u.color, fontSize: 12, flexShrink: 0 }}>{u.initials}</div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: "#1a2a3a", fontSize: 14, fontWeight: 600 }}>{u.name}</div>
                  <div style={{ color: "#8a9ab0", fontSize: 11, marginTop: 1 }}>Enter PIN to continue</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ animation: "fadeIn .2s ease" }}>
            <button onClick={() => setLoginStep("pick")} style={{ background: "transparent", border: "none", color: "#8a9ab0", fontSize: 11, cursor: "pointer", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>← Back</button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "10px 14px", background: "#fff", borderRadius: 10, border: `1px solid ${loginTarget.color}20`, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: loginTarget.color + "18", border: `2px solid ${loginTarget.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display',serif", fontWeight: 700, color: loginTarget.color, fontSize: 11 }}>{loginTarget.initials}</div>
              <div>
                <div style={{ color: "#1a2a3a", fontSize: 13, fontWeight: 600 }}>{loginTarget.name}</div>
                <div style={{ color: "#8a9ab0", fontSize: 11 }}>Enter 4-digit PIN</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 18 }}>
              {[0, 1, 2, 3].map(i => <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: i < pinInput.length ? loginTarget.color : "transparent", border: `2px solid ${i < pinInput.length ? loginTarget.color : "#d0d5e0"}`, transition: "all .15s" }} />)}
            </div>
            {pinErr && <div style={{ textAlign: "center", color: "#c0392b", fontSize: 12, marginBottom: 10 }}>{pinErr}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((d, i) => (
                <button key={i} disabled={d === ""} onClick={() => d === "⌫" ? setPinInput(p => p.slice(0, -1)) : d !== "" ? pinDigit(String(d)) : null}
                  style={{ background: d === "" ? "transparent" : "#fff", border: d === "" ? "none" : "1px solid #e0e4ec", borderRadius: 10, padding: "13px 0", fontSize: d === "⌫" ? 16 : 18, color: "#1a2a3a", cursor: d === "" ? "default" : "pointer", fontWeight: 500, fontFamily: "'Source Sans 3',sans-serif", boxShadow: d === "" ? "none" : "0 1px 4px rgba(0,0,0,0.04)" }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (!dbReady) return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid #e0e4ec", borderTopColor: "#1a3a5c", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── FIELD COMPONENT ───────────────────────────────────────────────────────
  const Field = ({ label, required, children }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5a6a7a", fontFamily: "'Source Sans 3',sans-serif", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}{required && <span style={{ color: "#c0392b", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );

  const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid #d8dce6", borderRadius: 8, fontSize: 13, fontFamily: "'Source Sans 3',sans-serif", color: "#1a2a3a", background: "#fff", outline: "none" };

  // ── STAT CARD ─────────────────────────────────────────────────────────────
  const StatCard = ({ label, value, sub, color = "#1a3a5c", highlight }) => (
    <div style={{ background: highlight ? "#1a3a5c" : "#fff", border: `1px solid ${highlight ? "#1a3a5c" : "#e8eaf0"}`, borderRadius: 12, padding: "16px 18px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 11, color: highlight ? "rgba(255,255,255,0.6)" : "#8a9ab0", fontFamily: "'Source Sans 3',sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? "#fff" : color, fontFamily: "'Playfair Display',serif", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: highlight ? "rgba(255,255,255,0.5)" : "#aab0bc", marginTop: 4, fontFamily: "'Source Sans 3',sans-serif" }}>{sub}</div>}
    </div>
  );

  // ── CUSTOM TOOLTIP ────────────────────────────────────────────────────────
  const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#fff", border: "1px solid #e0e4ec", borderRadius: 8, padding: "10px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", fontFamily: "'Source Sans 3',sans-serif" }}>
        <div style={{ fontSize: 11, color: "#8a9ab0", marginBottom: 6 }}>{label}</div>
        {payload.map((p, i) => <div key={i} style={{ fontSize: 12, color: p.color, fontWeight: 600 }}>{p.name}: {f$(p.value)}</div>)}
      </div>
    );
  };

  // ── MAIN RENDER ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", fontFamily: "'Source Sans 3',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select,textarea{font-family:'Source Sans 3',sans-serif;outline:none;transition:border .15s}
        input:focus,select:focus,textarea:focus{border-color:#2d6a9f!important;box-shadow:0 0 0 3px rgba(45,106,159,0.1)}
        button{cursor:pointer;font-family:'Source Sans 3',sans-serif}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:#f4f6f9}::-webkit-scrollbar-thumb{background:#d0d5e0;border-radius:4px}
        .row-hover:hover{background:#f8f9fb!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fade-up{animation:fadeUp .3s ease}
      `}</style>

      {/* ── TOPBAR ── */}
      <div style={{ background: "#1a3a5c", padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 56, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(26,58,92,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "rgba(255,255,255,0.12)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>M</span>
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>MIKE</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", textTransform: "uppercase" }}>LLC Financial</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, flex: 1, justifyContent: "center" }}>
          {["dashboard", "income", "expenses", "rentals", "reports"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ background: tab === t ? "rgba(255,255,255,0.15)" : "transparent", color: tab === t ? "#fff" : "rgba(255,255,255,0.5)", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, fontWeight: tab === t ? 600 : 400, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: authUser.color + "30", border: `2px solid ${authUser.color}60`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display',serif", fontWeight: 700, color: "#fff", fontSize: 10 }}>{authUser.initials}</div>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            style={{ ...inputStyle, width: 90, fontSize: 11, padding: "4px 8px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6 }}>
            {["2024", "2025", "2026", "2027"].map(y => <option key={y} value={y} style={{ color: "#1a2a3a", background: "#fff" }}>{y}</option>)}
          </select>
          <button onClick={() => setAuthUser(null)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 20px" }}>

        {/* ══ DASHBOARD ══ */}
        {tab === "dashboard" && (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, color: "#1a2a3a" }}>Financial Overview</h1>
                <p style={{ fontSize: 13, color: "#8a9ab0", marginTop: 2 }}>{yearFilter} · DiMarzio LLC</p>
              </div>
            </div>

            {/* KPI Row */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <StatCard label="Options Premium YTD" value={f$0(optionsData.premiumYTD)} sub="Gross premiums collected" color="#2d6a9f" />
              <StatCard label="Options Profit YTD" value={fSign(optionsData.profitYTD)} sub="Realized P&L" color={optionsData.profitYTD >= 0 ? "#1a7a4a" : "#c0392b"} />
              <StatCard label="Other Income YTD" value={f$0(totalIncomeYTD)} sub={filteredIncomes.length + " entries"} color="#7a4a9a" />
              <StatCard label="Total Expenses YTD" value={f$0(totalExpensesYTD)} sub={filteredExpenses.length + " entries"} color="#c0392b" />
              <StatCard label="Net P&L" value={fSign(netPL)} sub="Income minus expenses" highlight color={netPL >= 0 ? "#27ae60" : "#c0392b"} />
            </div>

            {/* MTD quick stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
              {[
                { label: "Options Premium MTD", value: f$0(optionsData.premiumMTD), color: "#2d6a9f" },
                { label: "Options Profit MTD", value: fSign(optionsData.profitMTD), color: optionsData.profitMTD >= 0 ? "#1a7a4a" : "#c0392b" },
                { label: "Rental Income YTD", value: f$0(rentalIncome.reduce((s, i) => s + (i.amount || 0), 0)), color: "#7a4a9a" },
                { label: "Rental Expenses YTD", value: f$0(rentalExpenses.reduce((s, e) => s + (e.amount || 0), 0)), color: "#c0392b" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: "#8a9ab0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color, fontFamily: "'Playfair Display',serif" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
              <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>Options Income vs Expenses</div>
                <div style={{ fontSize: 12, color: "#8a9ab0", marginBottom: 16 }}>Monthly {yearFilter}</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyExpenseData} barGap={4} barSize={14}>
                    <CartesianGrid strokeDasharray="3 6" stroke="#f0f2f5" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#aab0bc", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#aab0bc", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => "$" + (v / 1000).toFixed(0) + "k"} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="income" name="Income" fill="#2d6a9f" radius={[3, 3, 0, 0]} opacity={0.85} />
                    <Bar dataKey="expenses" name="Expenses" fill="#e74c3c" radius={[3, 3, 0, 0]} opacity={0.75} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>Options Performance</div>
                <div style={{ fontSize: 12, color: "#8a9ab0", marginBottom: 16 }}>Premium vs Profit {yearFilter}</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={optionsData.monthly}>
                    <CartesianGrid strokeDasharray="3 6" stroke="#f0f2f5" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#aab0bc", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#aab0bc", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => "$" + (v / 1000).toFixed(0) + "k"} />
                    <Tooltip content={<ChartTip />} />
                    <Line type="monotone" dataKey="premium" name="Premium" stroke="#2d6a9f" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke="#27ae60" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent transactions */}
            <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f2f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1a2a3a" }}>Recent Transactions</div>
                <button onClick={() => setTab("expenses")} style={{ fontSize: 12, color: "#2d6a9f", background: "none", border: "none", fontWeight: 600 }}>View all →</button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#f8f9fb" }}>
                  {["Date", "Description", "Category", "Entity", "Amount"].map(h => (
                    <th key={h} style={{ padding: "9px 16px", textAlign: h === "Amount" ? "right" : "left", fontSize: 11, color: "#8a9ab0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {expenses.slice(0, 8).map(e => (
                    <tr key={e.id} className="row-hover" style={{ borderTop: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "10px 16px", color: "#8a9ab0", fontSize: 12 }}>{e.date}</td>
                      <td style={{ padding: "10px 16px", color: "#1a2a3a", fontWeight: 500 }}>{e.description}</td>
                      <td style={{ padding: "10px 16px" }}><span style={{ background: "#f0f4f8", color: "#4a6a8a", fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{e.category}</span></td>
                      <td style={{ padding: "10px 16px" }}><span style={{ background: e.entity === "Rental" ? "#f5f0ff" : "#f0f8f4", color: e.entity === "Rental" ? "#7a4a9a" : "#1a7a4a", fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{e.entity}</span></td>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: "#c0392b", fontWeight: 600, fontFamily: "'Playfair Display',serif" }}>({f$(e.amount)})</td>
                    </tr>
                  ))}
                  {expenses.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#aab0bc", fontSize: 13 }}>No expenses yet — add one in the Expenses tab</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ INCOME ══ */}
        {tab === "income" && (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, color: "#1a2a3a" }}>Income</h1>
                <p style={{ fontSize: 13, color: "#8a9ab0", marginTop: 2 }}>{yearFilter} · All income sources</p>
              </div>
              <button onClick={() => { setShowIncomeForm(true); setEditingIncome(null); setIncomeForm({ ...EMPTY_INCOME }); }}
                style={{ background: "#1a3a5c", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600 }}>
                + Add Income
              </button>
            </div>

            {/* Options income pulled from PRI */}
            <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, padding: 20 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1a2a3a", marginBottom: 14 }}>Options Trading Income (from PRI)</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "Premium Collected MTD", value: f$0(optionsData.premiumMTD), color: "#2d6a9f" },
                  { label: "Premium Collected YTD", value: f$0(optionsData.premiumYTD), color: "#2d6a9f" },
                  { label: "Realized Profit MTD", value: fSign(optionsData.profitMTD), color: optionsData.profitMTD >= 0 ? "#1a7a4a" : "#c0392b" },
                  { label: "Realized Profit YTD", value: fSign(optionsData.profitYTD), color: optionsData.profitYTD >= 0 ? "#1a7a4a" : "#c0392b" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "#f8f9fb", border: "1px solid #e8eaf0", borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 150 }}>
                    <div style={{ fontSize: 11, color: "#8a9ab0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'Playfair Display',serif" }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: "8px 12px", background: "#f0f8ff", borderRadius: 8, fontSize: 12, color: "#2d6a9f" }}>
                📊 Live data pulled from PRI options database · Premiums = gross collected · Profit = realized P&L after closing
              </div>
            </div>

            {/* Income form */}
            {showIncomeForm && (
              <div style={{ background: "#fff", border: "1px solid #d0e8ff", borderRadius: 14, padding: 20, animation: "fadeUp .2s" }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1a2a3a", marginBottom: 16 }}>{editingIncome ? "Edit Income" : "Add Income Entry"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                  <Field label="Date" required><input type="date" value={incomeForm.date} onChange={e => setIncomeForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} /></Field>
                  <Field label="Description" required><input type="text" value={incomeForm.description} onChange={e => setIncomeForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} placeholder="e.g. Rental payment Jan" /></Field>
                  <Field label="Amount $" required><input type="number" value={incomeForm.amount} onChange={e => setIncomeForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} placeholder="0.00" /></Field>
                  <Field label="Category">
                    <select value={incomeForm.category} onChange={e => setIncomeForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                      {INCOME_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Entity">
                    <select value={incomeForm.entity} onChange={e => setIncomeForm(p => ({ ...p, entity: e.target.value }))} style={inputStyle}>
                      <option>LLC</option><option>Rental</option><option>Personal</option>
                    </select>
                  </Field>
                </div>
                <Field label="Notes"><textarea rows={2} value={incomeForm.notes} onChange={e => setIncomeForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} /></Field>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={saveIncome} style={{ background: "#1a3a5c", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600 }}>Save</button>
                  <button onClick={() => { setShowIncomeForm(false); setEditingIncome(null); }} style={{ background: "#f4f6f9", color: "#5a6a7a", border: "1px solid #e0e4ec", borderRadius: 8, padding: "9px 16px", fontSize: 13 }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Manual income table */}
            <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f2f5" }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1a2a3a" }}>Manual Income Entries — {yearFilter}</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#f8f9fb" }}>
                  {["Date", "Description", "Category", "Entity", "Amount", ""].map(h => (
                    <th key={h} style={{ padding: "9px 16px", textAlign: h === "Amount" ? "right" : "left", fontSize: 11, color: "#8a9ab0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredIncomes.map(i => (
                    <tr key={i.id} className="row-hover" style={{ borderTop: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "10px 16px", color: "#8a9ab0", fontSize: 12 }}>{i.date}</td>
                      <td style={{ padding: "10px 16px", color: "#1a2a3a", fontWeight: 500 }}>{i.description}</td>
                      <td style={{ padding: "10px 16px" }}><span style={{ background: "#f0f8f4", color: "#1a7a4a", fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{i.category}</span></td>
                      <td style={{ padding: "10px 16px" }}><span style={{ background: i.entity === "Rental" ? "#f5f0ff" : "#f0f8f4", color: i.entity === "Rental" ? "#7a4a9a" : "#1a7a4a", fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{i.entity}</span></td>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: "#1a7a4a", fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{f$(i.amount)}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        <button onClick={() => { setEditingIncome(i.id); setIncomeForm({ ...i }); setShowIncomeForm(true); }} style={{ fontSize: 11, color: "#2d6a9f", background: "none", border: "none", fontWeight: 600, marginRight: 8 }}>Edit</button>
                        <button onClick={() => deleteIncome(i.id)} style={{ fontSize: 11, color: "#c0392b", background: "none", border: "none", fontWeight: 600 }}>Del</button>
                      </td>
                    </tr>
                  ))}
                  {filteredIncomes.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#aab0bc", fontSize: 13 }}>No income entries for {yearFilter} — add one above</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ EXPENSES ══ */}
        {tab === "expenses" && (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, color: "#1a2a3a" }}>Expenses</h1>
                <p style={{ fontSize: 13, color: "#8a9ab0", marginTop: 2 }}>{yearFilter} · {filteredExpenses.length} entries · Total: {f$(totalExpensesYTD)}</p>
              </div>
              <button onClick={() => { setShowExpenseForm(true); setEditingExpense(null); setExpenseForm({ ...EMPTY_EXPENSE }); }}
                style={{ background: "#1a3a5c", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600 }}>
                + Add Expense
              </button>
            </div>

            {/* Expense form */}
            {showExpenseForm && (
              <div style={{ background: "#fff", border: "1px solid #ffe0e0", borderRadius: 14, padding: 20, animation: "fadeUp .2s" }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1a2a3a", marginBottom: 16 }}>{editingExpense ? "Edit Expense" : "Add Expense"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
                  <Field label="Date" required><input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} /></Field>
                  <Field label="Description" required><input type="text" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} placeholder="e.g. Office supplies" /></Field>
                  <Field label="Amount $" required><input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} placeholder="0.00" /></Field>
                  <Field label="Entity">
                    <select value={expenseForm.entity} onChange={e => setExpenseForm(p => ({ ...p, entity: e.target.value, category: e.target.value === "Rental" ? RENTAL_CATEGORIES[0] : TAX_CATEGORIES[0] }))} style={inputStyle}>
                      <option>LLC</option><option>Rental</option><option>Personal</option>
                    </select>
                  </Field>
                  <Field label="Tax Category">
                    <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                      {(expenseForm.entity === "Rental" ? RENTAL_CATEGORIES : TAX_CATEGORIES).map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Recurring?">
                    <select value={expenseForm.isRecurring ? "yes" : "no"} onChange={e => setExpenseForm(p => ({ ...p, isRecurring: e.target.value === "yes" }))} style={inputStyle}>
                      <option value="no">One-time</option><option value="yes">Recurring</option>
                    </select>
                  </Field>
                  {expenseForm.isRecurring && (
                    <Field label="Frequency">
                      <select value={expenseForm.frequency} onChange={e => setExpenseForm(p => ({ ...p, frequency: e.target.value }))} style={inputStyle}>
                        <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
                      </select>
                    </Field>
                  )}
                </div>
                <Field label="Notes"><textarea rows={2} value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} /></Field>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={saveExpense} style={{ background: "#1a3a5c", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600 }}>Save</button>
                  <button onClick={() => { setShowExpenseForm(false); setEditingExpense(null); }} style={{ background: "#f4f6f9", color: "#5a6a7a", border: "1px solid #e0e4ec", borderRadius: 8, padding: "9px 16px", fontSize: 13 }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Category summary */}
            <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, padding: 20 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1a2a3a", marginBottom: 14 }}>By Tax Category</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(expByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} style={{ background: "#f8f9fb", border: "1px solid #e8eaf0", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#4a6a8a", fontWeight: 600 }}>{cat}</span>
                    <span style={{ fontSize: 12, color: "#c0392b", fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{f$(amt)}</span>
                    <span style={{ fontSize: 11, color: "#aab0bc" }}>{fPct(amt, totalExpensesYTD)}</span>
                  </div>
                ))}
                {Object.keys(expByCategory).length === 0 && <span style={{ fontSize: 13, color: "#aab0bc" }}>No expenses yet</span>}
              </div>
            </div>

            {/* Expenses table */}
            <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#f8f9fb" }}>
                  {["Date", "Description", "Category", "Entity", "Recurring", "Amount", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: h === "Amount" ? "right" : "left", fontSize: 11, color: "#8a9ab0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredExpenses.map(e => (
                    <tr key={e.id} className="row-hover" style={{ borderTop: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "10px 16px", color: "#8a9ab0", fontSize: 12 }}>{e.date}</td>
                      <td style={{ padding: "10px 16px", color: "#1a2a3a", fontWeight: 500 }}>{e.description}</td>
                      <td style={{ padding: "10px 16px" }}><span style={{ background: "#f0f4f8", color: "#4a6a8a", fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{e.category}</span></td>
                      <td style={{ padding: "10px 16px" }}><span style={{ background: e.entity === "Rental" ? "#f5f0ff" : "#f0f8f4", color: e.entity === "Rental" ? "#7a4a9a" : "#1a7a4a", fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{e.entity}</span></td>
                      <td style={{ padding: "10px 16px" }}>{e.isRecurring ? <span style={{ background: "#fff8e8", color: "#b8860b", fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{e.frequency}</span> : <span style={{ color: "#aab0bc", fontSize: 12 }}>—</span>}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: "#c0392b", fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>({f$(e.amount)})</td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        <button onClick={() => { setEditingExpense(e.id); setExpenseForm({ ...e }); setShowExpenseForm(true); }} style={{ fontSize: 11, color: "#2d6a9f", background: "none", border: "none", fontWeight: 600, marginRight: 8 }}>Edit</button>
                        <button onClick={() => deleteExpense(e.id)} style={{ fontSize: 11, color: "#c0392b", background: "none", border: "none", fontWeight: 600 }}>Del</button>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "#aab0bc", fontSize: 13 }}>No expenses for {yearFilter} — click + Add Expense to get started</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ RENTALS ══ */}
        {tab === "rentals" && (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, color: "#1a2a3a" }}>Rental Properties</h1>
                <p style={{ fontSize: 13, color: "#8a9ab0", marginTop: 2 }}>{yearFilter} · Separate P&L view</p>
              </div>
            </div>

            {/* Rental summary cards */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(() => {
                const rInc = filteredIncomes.filter(i => i.category === "Rental Income").reduce((s, i) => s + (i.amount || 0), 0);
                const rExp = filteredExpenses.filter(e => e.entity === "Rental").reduce((s, e) => s + (e.amount || 0), 0);
                const rNet = rInc - rExp;
                return [
                  { label: "Rental Income YTD", value: f$(rInc), color: "#1a7a4a" },
                  { label: "Rental Expenses YTD", value: f$(rExp), color: "#c0392b" },
                  { label: "Net Rental P&L", value: fSign(rNet), color: rNet >= 0 ? "#1a7a4a" : "#c0392b" },
                ].map(({ label, value, color }) => <StatCard key={label} label={label} value={value} color={color} />);
              })()}
            </div>

            {/* Rental income */}
            <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f2f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1a7a4a" }}>Rental Income</div>
                <button onClick={() => { setIncomeForm({ ...EMPTY_INCOME, category: "Rental Income", entity: "Rental" }); setShowIncomeForm(true); setTab("income"); }}
                  style={{ fontSize: 12, color: "#1a7a4a", background: "#f0f8f4", border: "1px solid #c0dfd0", borderRadius: 6, padding: "5px 12px", fontWeight: 600 }}>+ Add Rental Income</button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#f8f9fb" }}>
                  {["Date", "Description", "Amount"].map(h => (
                    <th key={h} style={{ padding: "9px 16px", textAlign: h === "Amount" ? "right" : "left", fontSize: 11, color: "#8a9ab0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredIncomes.filter(i => i.category === "Rental Income").map(i => (
                    <tr key={i.id} className="row-hover" style={{ borderTop: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "10px 16px", color: "#8a9ab0", fontSize: 12 }}>{i.date}</td>
                      <td style={{ padding: "10px 16px", color: "#1a2a3a", fontWeight: 500 }}>{i.description}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: "#1a7a4a", fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{f$(i.amount)}</td>
                    </tr>
                  ))}
                  {filteredIncomes.filter(i => i.category === "Rental Income").length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#aab0bc", fontSize: 13 }}>No rental income recorded</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Rental expenses by category */}
            <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f2f5" }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#c0392b" }}>Rental Expenses</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#f8f9fb" }}>
                  {["Date", "Description", "Category", "Amount"].map(h => (
                    <th key={h} style={{ padding: "9px 16px", textAlign: h === "Amount" ? "right" : "left", fontSize: 11, color: "#8a9ab0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {rentalExpenses.map(e => (
                    <tr key={e.id} className="row-hover" style={{ borderTop: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "10px 16px", color: "#8a9ab0", fontSize: 12 }}>{e.date}</td>
                      <td style={{ padding: "10px 16px", color: "#1a2a3a", fontWeight: 500 }}>{e.description}</td>
                      <td style={{ padding: "10px 16px" }}><span style={{ background: "#f5f0ff", color: "#7a4a9a", fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{e.category}</span></td>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: "#c0392b", fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>({f$(e.amount)})</td>
                    </tr>
                  ))}
                  {rentalExpenses.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#aab0bc", fontSize: 13 }}>No rental expenses recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ REPORTS ══ */}
        {tab === "reports" && (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, color: "#1a2a3a" }}>Tax Reports</h1>
              <p style={{ fontSize: 13, color: "#8a9ab0", marginTop: 2 }}>{yearFilter} · LLC Schedule C Summary</p>
            </div>

            {/* Schedule C summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1a7a4a", marginBottom: 16 }}>Income Summary</div>
                {[
                  { label: "Options Premiums Collected", value: optionsData.premiumYTD },
                  { label: "Options Realized Profit", value: optionsData.profitYTD },
                  ...Object.entries(
                    filteredIncomes.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + (i.amount || 0); return acc; }, {})
                  ).map(([label, value]) => ({ label, value })),
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f2f5" }}>
                    <span style={{ fontSize: 13, color: "#4a6a8a" }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: value >= 0 ? "#1a7a4a" : "#c0392b", fontFamily: "'Playfair Display',serif" }}>{fSign(value)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a" }}>Total Income</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#1a7a4a", fontFamily: "'Playfair Display',serif" }}>{fSign(totalIncomeYTD + optionsData.profitYTD)}</span>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e8eaf0", borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#c0392b", marginBottom: 16 }}>LLC Deductions (Schedule C)</div>
                {Object.entries(
                  llcExpenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + (e.amount || 0); return acc; }, {})
                ).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f2f5" }}>
                    <span style={{ fontSize: 13, color: "#4a6a8a" }}>{cat}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#c0392b", fontFamily: "'Playfair Display',serif" }}>({f$(amt)})</span>
                  </div>
                ))}
                {llcExpenses.length === 0 && <div style={{ fontSize: 13, color: "#aab0bc", padding: "8px 0" }}>No LLC expenses recorded</div>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2a3a" }}>Total Deductions</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#c0392b", fontFamily: "'Playfair Display',serif" }}>({f$(totalExpensesYTD)})</span>
                </div>
              </div>
            </div>

            {/* Net LLC profit */}
            <div style={{ background: "linear-gradient(135deg, #1a3a5c, #2d6a9f)", borderRadius: 14, padding: 24, color: "#fff" }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 16, opacity: 0.9 }}>Net LLC Income — {yearFilter}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
                {[
                  { label: "Gross Income", value: fSign(totalIncomeYTD + optionsData.profitYTD) },
                  { label: "Total Deductions", value: "(" + f$(totalExpensesYTD) + ")" },
                  { label: "Net Taxable Income", value: fSign(netPL) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, fontSize: 11, opacity: 0.5 }}>⚠ For reference only. Consult your tax professional for filing.</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
