import React, { useEffect, useMemo, useState, useRef } from "react";

/*
  Discipline — Pinboard Todo App (single-file)
  - Vite + React app
  - Uses Tailwind via CDN for quick styling
  - Persisted to localStorage
  - Theme editor, calendar, favorites, confetti + victory sound on completion
  Note: This single-file is large. For production, split into modules as needed.
*/

const BUILTIN_THEMES = {
  elegant: {
    id: "elegant",
    display: "Elegant",
    accent: "linear-gradient(90deg,#7c3aed,#ec4899)",
    pageBg: "linear-gradient(180deg,#f8fafc,#ffffff)",
    cardBg: "rgba(255,255,255,0.72)",
    text: "#0f172a",
    muted: "#475569",
  },
  dark: {
    id: "dark",
    display: "Midnight",
    accent: "linear-gradient(90deg,#0ea5e9,#7c3aed)",
    pageBg: "linear-gradient(180deg,#06070a,#0b1220)",
    cardBg: "rgba(10,14,20,0.65)",
    text: "#e6eef6",
    muted: "#94a3b8",
  },
  warm: {
    id: "warm",
    display: "Warm",
    accent: "linear-gradient(90deg,#fb7185,#f59e0b)",
    pageBg: "linear-gradient(180deg,#fff7ed,#fffaf0)",
    cardBg: "rgba(255,255,250,0.85)",
    text: "#3b2f2f",
    muted: "#6b5b5b",
  },
  pastel: {
    id: "pastel",
    display: "Pastel",
    accent: "linear-gradient(90deg,#ffb3c1,#bfe9ff)",
    pageBg: "linear-gradient(180deg,#fbfbff,#fffefb)",
    cardBg: "rgba(255,255,255,0.9)",
    text: "#20232a",
    muted: "#52606d",
  },
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [archived, setArchived] = useState([]);
  const [filterDate, setFilterDate] = useState(getTodayISO());
  const [themeKey, setThemeKey] = useState("elegant");
  const [customThemes, setCustomThemes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("todo_theme_v1");
    const savedCustom = safeParse(localStorage.getItem("todo_custom_themes_v1")) || [];
    if (t && (BUILTIN_THEMES[t] || savedCustom.find((c) => c.id === t))) setThemeKey(t);
    setCustomThemes(savedCustom);

    const raw = localStorage.getItem("todo_tasks_v2");
    const rawArch = localStorage.getItem("todo_archived_v2");
    setTasks(safeParse(raw) || []);
    setArchived(safeParse(rawArch) || []);

    const parsed = safeParse(raw) || [];
    const today = getTodayISO();
    const past = parsed.filter((x) => x.date < today);
    if (past.length) {
      const remaining = parsed.filter((x) => x.date >= today);
      const merged = [...(safeParse(rawArch) || []), ...past];
      setTasks(remaining);
      setArchived(merged);
      localStorage.setItem("todo_tasks_v2", JSON.stringify(remaining));
      localStorage.setItem("todo_archived_v2", JSON.stringify(merged));
    }
  }, []);

  useEffect(() => localStorage.setItem("todo_tasks_v2", JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem("todo_archived_v2", JSON.stringify(archived)), [archived]);
  useEffect(() => localStorage.setItem("todo_theme_v1", themeKey), [themeKey]);
  useEffect(() => localStorage.setItem("todo_custom_themes_v1", JSON.stringify(customThemes)), [customThemes]);

  const themesMap = useMemo(() => ({ ...BUILTIN_THEMES, ...Object.fromEntries(customThemes.map((c) => [c.id, c])) }), [customThemes]);
  const theme = useMemo(() => themesMap[themeKey] || BUILTIN_THEMES.elegant, [themesMap, themeKey]);

  // apply theme via CSS variables with smooth transition
  useEffect(() => {
    applyThemeWithTransition(theme);
  }, [theme]);

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function openAdd() { setEditing(null); setShowModal(true); }
  function openEdit(t) { setEditing(t); setShowModal(true); }

  function addOrUpdateTask(taskObj) {
    if (taskObj.id) {
      setTasks((s) => s.map((t) => (t.id === taskObj.id ? { ...t, ...taskObj, editedAt: Date.now() } : t)));
    } else {
      const newTask = { ...taskObj, id: Date.now() + "_" + Math.floor(Math.random() * 9999), createdAt: Date.now(), editedAt: null, completed: false, favorite: !!taskObj.favorite };
      setTasks((s) => [newTask, ...s]);
    }
    setShowModal(false);
    setEditing(null);
  }

  function toggleComplete(id) {
    setTasks((s) => {
      let triggered = false;
      const out = s.map((t) => {
        if (t.id === id) {
          if (!t.completed) triggered = true; // going from not-complete -> complete
          return { ...t, completed: !t.completed, editedAt: Date.now() };
        }
        return t;
      });
      // celebration after state update
      setTimeout(() => {
        const found = out.find((x) => x.id === id);
        if (found && found.completed && triggered) celebrate();
      }, 60);
      return out;
    });
  }

  function toggleFavorite(id) { setTasks((s) => s.map((t) => (t.id === id ? { ...t, favorite: !t.favorite, editedAt: Date.now() } : t))); }
  function markAllComplete() { setTasks((s) => s.map((t) => (t.date === filterDate ? { ...t, completed: true, editedAt: Date.now() } : t))); }
  function deleteTask(id) { if (!confirm("Delete this task?")) return; setTasks((s) => s.filter((t) => t.id !== id)); }
  function deleteArchived(id) { if (!confirm("Delete this archived task?")) return; setArchived((a) => a.filter((t) => t.id !== id)); }
  function archivePastNow() { const today = getTodayISO(); const past = tasks.filter((t) => t.date < today); if (!past.length) return; setArchived((a) => [...a, ...past]); setTasks((s) => s.filter((t) => t.date >= today)); }
  function clearAll() { if (!confirm("Clear all visible tasks?")) return; setTasks([]); }

  function filteredTasks() {
    const base = tasks.filter((t) => t.date === filterDate);
    const q = query.trim().toLowerCase();
    let res = q ? base.filter((t) => t.title.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q)) : base;
    if (showFavoritesOnly) res = res.filter((t) => t.favorite);
    res.sort((a, b) => (b.favorite === a.favorite ? (a.createdAt < b.createdAt ? 1 : -1) : b.favorite ? 1 : -1));
    return res;
  }

  const visible = filteredTasks();

  /* Theme editor helpers */
  function createCustomTheme(themeData) { const id = 'custom_' + Date.now(); const payload = { id, ...themeData }; setCustomThemes((s) => [payload, ...s]); setThemeKey(id); }
  function updateCustomTheme(id, update) { setCustomThemes((s) => s.map((c) => (c.id === id ? { ...c, ...update } : c))); if (themeKey === id) setThemeKey(id); }
  function deleteCustomTheme(id) { if (!confirm('Delete custom theme?')) return; setCustomThemes((s) => s.filter((c) => c.id !== id)); if (themeKey === id) setThemeKey('elegant'); }

  return (
    <div style={{ minHeight: '100vh' }} className="font-sans">
      {/* root element receives CSS variables; applyThemeWithTransition handles actual variables */}
      <div className="p-6 max-w-7xl mx-auto">
        <Header
          theme={theme}
          themeKey={themeKey}
          setThemeKey={setThemeKey}
          query={query}
          setQuery={setQuery}
          openAdd={openAdd}
          markAll={() => markAllComplete()}
          archivePast={() => archivePastNow()}
          clearAll={() => clearAll()}
          showFavoritesOnly={showFavoritesOnly}
          setShowFavoritesOnly={setShowFavoritesOnly}
        />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <div className="p-4 rounded-2xl" style={{ background: 'var(--cardBg)', border: '1px solid rgba(255,255,255,0.4)' }}>
              <Calendar selected={filterDate} onSelect={(d) => setFilterDate(d)} theme={theme} />

              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--muted)' }}>Theme</h4>
                <div className="flex gap-2 flex-wrap">
                  {Object.values(themesMap).map((th) => (
                    <button key={th.id} onClick={() => setThemeKey(th.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm border ${th.id === themeKey ? 'ring-2 ring-offset-1' : ''}`} style={{ background: th.cardBg }}>
                      <div className="w-8 h-4 rounded" style={{ background: th.accent }} />
                      <div style={{ fontSize: 12 }}>{th.display || 'Custom'}</div>
                    </button>
                  ))}
                </div>

                <ThemeEditor customThemes={customThemes} onCreate={createCustomTheme} onUpdate={updateCustomTheme} onDelete={deleteCustomTheme} />

                <div className="mt-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showFavoritesOnly} onChange={(e) => setShowFavoritesOnly(e.target.checked)} />
                    Show favorites only
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-2xl text-sm" style={{ background: 'transparent' }}>
              <h4 className="font-semibold mb-2" style={{ color: 'var(--muted)' }}>Quick actions</h4>
              <div className="flex gap-2">
                <button onClick={() => markAllComplete()} className="px-3 py-2 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>Mark all</button>
                <button onClick={() => archivePastNow()} className="px-3 py-2 rounded-lg border">Archive past</button>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-3">
            <section className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Top logo: Discipline */}
                <div className="flex items-center gap-3">
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                    D
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Discipline</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Pinboard · {theme.display || 'Custom'}</div>
                  </div>
                </div>
              </div>

              <div className="text-sm" style={{ color: 'var(--muted)' }}>{visible.length} task(s)</div>
            </section>

            <div className="masonry" style={{ columnCount: window.innerWidth > 1280 ? 3 : window.innerWidth > 900 ? 2 : 1, columnGap: '1rem' }}>
              {visible.length === 0 && (
                <div className="text-slate-500 py-10 text-center">No tasks for this date — add one!</div>
              )}

              {visible.map((t) => (
                <article key={t.id} className="break-inside mb-6 p-5 rounded-2xl shadow-lg task-card" style={{ background: 'var(--cardBg)', border: '1px solid rgba(255,255,255,0.45)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleComplete(t.id)} className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.completed ? 'bg-emerald-400 text-white' : 'bg-white'}`}>
                        {t.completed ? '✓' : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                      </button>

                      <div>
                        <h3 className={`text-lg font-semibold ${t.completed ? 'line-through' : ''}`} style={{ color: 'var(--text)' }}>{t.title}</h3>
                        <div className="text-sm" style={{ color: 'var(--muted)' }}>{t.notes || <em>No notes</em>}</div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleFavorite(t.id)} title="Star / Favorite" className={`p-2 rounded-full ${t.favorite ? 'scale-105' : ''}`} style={{ background: t.favorite ? 'rgba(255,215,88,0.15)' : 'transparent' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${t.favorite ? '' : 'text-slate-400'}`} viewBox="0 0 24 24" fill={t.favorite ? '#ffd358' : 'none'} stroke={t.favorite ? 'none' : 'currentColor'}>
                            <path d="M12 17.27L18.18 21 16.54 13.97 22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                        </button>

                        <div className="text-xs" style={{ color: 'var(--muted)' }}>{t.date}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(t)} className="px-3 py-1 rounded-md border">Edit</button>
                        <button onClick={() => deleteTask(t.id)} className="px-3 py-1 rounded-md border text-red-600">Delete</button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <hr className="my-10" />

            <section>
              <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text)' }}>Archive</h3>
              {archived.length === 0 && <div className="text-slate-400">No archived tasks yet.</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {archived.slice().reverse().map((t) => (
                  <div key={t.id} className="p-4 rounded-xl" style={{ background: 'var(--cardBg)', border: '1px solid rgba(255,255,255,0.3)' }}>
                    <div className="flex justify-between">
                      <div>
                        <div className="text-sm font-semibold">{t.title}</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>{t.date}</div>
                      </div>
                      <div className="text-xs text-slate-400">#{t.id.slice(-4)}</div>
                    </div>
                    {t.notes && <p className="mt-2 text-sm">{t.notes}</p>}

                    <div className="mt-3 flex justify-end gap-2">
                      <button onClick={() => deleteArchived(t.id)} className="px-3 py-1 rounded-md border text-red-600">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>

        <footer className="mt-12 text-center text-sm" style={{ color: 'var(--muted)' }}>Made with ♥ — design your theme below.</footer>
      </div>

      {showModal && (<TaskModal onClose={() => setShowModal(false)} onSave={addOrUpdateTask} editing={editing} defaultDate={filterDate} theme={theme} />)}

      {/* CSS variables and transitions */}
      <style>{`
        :root { --accent: ${escapeCssVal(theme.accent)}; --pageBg: ${escapeCssVal(theme.pageBg)}; --cardBg: ${escapeCssVal(theme.cardBg)}; --text: ${escapeCssVal(theme.text)}; --muted: ${escapeCssVal(theme.muted)}; }
        html, body, #root { background: var(--pageBg) !important; transition: background 600ms ease; }
        .task-card { transition: transform 220ms ease, box-shadow 220ms ease, background 400ms ease; }
        .theme-transition * { transition: color 450ms ease, background 450ms ease, border-color 450ms ease !important; }
      `}</style>
    </div>
  );
}

/* ---------- Theme Editor Component (same as previous) ---------- */
function ThemeEditor({ customThemes, onCreate, onUpdate, onDelete }) {
  const [openEditor, setOpenEditor] = useState(false);
  const [form, setForm] = useState({ display: '', accent: 'linear-gradient(90deg,#7c3aed,#ec4899)', pageBg: 'linear-gradient(180deg,#f8fafc,#ffffff)', cardBg: 'rgba(255,255,255,0.72)', text: '#0f172a', muted: '#475569' });
  const [editingId, setEditingId] = useState(null);

  function reset() { setForm({ display: '', accent: 'linear-gradient(90deg,#7c3aed,#ec4899)', pageBg: 'linear-gradient(180deg,#f8fafc,#ffffff)', cardBg: 'rgba(255,255,255,0.72)', text: '#0f172a', muted: '#475569' }); setEditingId(null); }
  function startEdit(theme) { setEditingId(theme.id); setForm({ display: theme.display || 'Custom', accent: theme.accent, pageBg: theme.pageBg, cardBg: theme.cardBg, text: theme.text, muted: theme.muted }); setOpenEditor(true); }
  function submit(e) { e?.preventDefault?.(); if (!form.display.trim()) { alert('Please give the theme a name'); return; } const payload = { display: form.display.trim(), accent: form.accent.trim(), pageBg: form.pageBg.trim(), cardBg: form.cardBg.trim(), text: form.text.trim(), muted: form.muted.trim() }; if (editingId) { onUpdate(editingId, payload); } else { onCreate(payload); } reset(); setOpenEditor(false); }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Custom themes</div>
        <button onClick={() => { reset(); setOpenEditor((s) => !s); }} className="text-sm">{openEditor ? 'Close' : 'Create'}</button>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        {customThemes.length === 0 && <div className="text-xs text-slate-400">No custom themes yet.</div>}
        {customThemes.map((c) => (
          <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded shadow-sm border" style={{ background: c.cardBg }}>
            <div className="w-8 h-4 rounded" style={{ background: c.accent }} />
            <div style={{ fontSize: 12 }}>{c.display}</div>
            <button onClick={() => startEdit(c)} className="ml-2 text-xs">Edit</button>
            <button onClick={() => onDelete(c.id)} className="ml-1 text-xs text-red-600">Delete</button>
          </div>
        ))}
      </div>

      {openEditor && (
        <form onSubmit={submit} className="mt-2 grid grid-cols-1 gap-2">
          <input placeholder="Theme name" value={form.display} onChange={(e) => setForm((s) => ({ ...s, display: e.target.value }))} className="p-2 rounded border" />
          <input placeholder="Accent (CSS gradient or color)" value={form.accent} onChange={(e) => setForm((s) => ({ ...s, accent: e.target.value }))} className="p-2 rounded border" />
          <input placeholder="Page background (gradient or color)" value={form.pageBg} onChange={(e) => setForm((s) => ({ ...s, pageBg: e.target.value }))} className="p-2 rounded border" />
          <input placeholder="Card background (rgba)" value={form.cardBg} onChange={(e) => setForm((s) => ({ ...s, cardBg: e.target.value }))} className="p-2 rounded border" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Text color" value={form.text} onChange={(e) => setForm((s) => ({ ...s, text: e.target.value }))} className="p-2 rounded border" />
            <input placeholder="Muted color" value={form.muted} onChange={(e) => setForm((s) => ({ ...s, muted: e.target.value }))} className="p-2 rounded border" />
          </div>

          <div className="flex items-center gap-3 mt-2">
            <div className="p-3 rounded shadow-sm" style={{ minWidth: 120, background: form.cardBg, border: '1px solid rgba(255,255,255,0.45)' }}>
              <div style={{ background: form.accent, height: 12, borderRadius: 6 }} />
              <div style={{ color: form.text, marginTop: 8 }}>{form.display || 'Preview'}</div>
            </div>

            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => { reset(); setOpenEditor(false); }} className="px-3 py-2 rounded">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded" style={{ background: 'linear-gradient(90deg,#7c3aed,#ec4899)', color: '#fff' }}>{editingId ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------- Other subcomponents (Calendar, TaskModal, Header) ---------- */

function Header({ theme, themeKey, setThemeKey, query, setQuery, openAdd, markAll, archivePast, clearAll, showFavoritesOnly, setShowFavoritesOnly }) {
  return (
    <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div>
        {/* Logo + App name */}
        <div className="flex items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
            D
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Discipline</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Pinboard · {theme.display || 'Custom'}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="flex items-center gap-2 bg-white/40 backdrop-blur-sm px-3 py-2 rounded-full shadow-sm border border-white/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input placeholder="Search tasks..." value={query} onChange={(e) => setQuery(e.target.value)} className="bg-transparent outline-none text-sm w-40 md:w-64" />
        </div>

  
        <button onClick={openAdd} className="px-4 py-2 rounded-full bg-white text-slate-800 font-medium shadow">+ Add</button>
        <button onClick={markAll} className="px-3 py-2 rounded-full border">Mark all</button>
        <button onClick={archivePast} className="px-3 py-2 rounded-full border">Archive</button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showFavoritesOnly} onChange={(e) => setShowFavoritesOnly(e.target.checked)} /> Favorites only
        </label>
      </div>
    </header>
  );
}

function Calendar({ selected, onSelect, theme }) {
  const [cursor, setCursor] = useState(() => selected ? new Date(selected + 'T00:00:00') : new Date());

  useEffect(() => { setCursor(new Date(selected + 'T00:00:00')); }, [selected]);

  function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
  function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); }

  const monthStart = startOfMonth(cursor);
  const firstWeekday = monthStart.getDay();
  const total = daysInMonth(cursor);

  const prev = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const next = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const weeks = [];
  let dayNum = 1 - firstWeekday;
  while (dayNum <= total) {
    const week = Array.from({ length: 7 }).map((_, i) => {
      const dt = new Date(cursor.getFullYear(), cursor.getMonth(), dayNum + i);
      return dt;
    });
    weeks.push(week);
    dayNum += 7;
  }

  function isSameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  return (
    <div>
      <div className="flex items-center justify-between">
        <button onClick={prev} className="p-2 rounded-full border">‹</button>
        <div className="text-center">
          <div className="text-sm font-medium">{cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
        </div>
        <button onClick={next} className="p-2 rounded-full border">›</button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-xs text-center" style={{ color: theme.muted }}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (<div key={d}>{d}</div>))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 text-sm">
        {weeks.flat().map((d, idx) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const iso = d.toISOString().slice(0,10);
          return (
            <button key={idx} onClick={() => onSelect(iso)} disabled={!inMonth} className={`p-2 rounded-lg text-center ${isSameDay(d, new Date(selected + 'T00:00:00')) ? 'ring-2' : ''}`} style={{ background: isSameDay(d, new Date(selected + 'T00:00:00')) ? theme.accent : 'transparent', color: inMonth ? undefined : 'rgba(100,116,139,0.5)' }}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskModal({ onClose, onSave, editing, defaultDate, theme }) {
  const titleRef = useRef(null);
  const notesRef = useRef(null);
  const dateRef = useRef(null);
  const favRef = useRef(null);

  useEffect(() => {
    if (editing) {
      titleRef.current.value = editing.title;
      notesRef.current.value = editing.notes || "";
      dateRef.current.value = editing.date;
      favRef.current.checked = !!editing.favorite;
    } else {
      titleRef.current.value = "";
      notesRef.current.value = "";
      dateRef.current.value = defaultDate;
      favRef.current.checked = false;
    }
    setTimeout(() => titleRef.current.focus(), 80);
  }, [editing, defaultDate]);

  function submit(e) { e.preventDefault(); const t = titleRef.current.value.trim(); if (!t) return; const payload = { id: editing?.id, title: t, notes: notesRef.current.value.trim(), date: dateRef.current.value, favorite: !!favRef.current.checked }; onSave(payload); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form onSubmit={submit} className="relative z-50 p-6 rounded-2xl shadow-2xl w-full max-w-xl" style={{ background: 'var(--cardBg)', border: '1px solid rgba(255,255,255,0.45)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{editing ? 'Edit task' : 'Add task'}</h3>
          <button type="button" onClick={onClose} className="text-sm">Close</button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <input ref={titleRef} placeholder="Title" className="p-3 rounded-lg border" />
          <textarea ref={notesRef} placeholder="Notes" className="p-3 rounded-lg border min-h-[80px]" />
          <div className="flex gap-2">
            <input ref={dateRef} type="date" className="p-2 rounded-lg border" />
            <label className="flex items-center gap-2"><input ref={favRef} type="checkbox" /> Favorite</label>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg" style={{ background: 'var(--accent)', color: '#fff' }}>{editing ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------- Utilities & Effects: theme application and celebration (confetti + melody) ---------- */

function applyThemeWithTransition(theme) {
  try {
    const root = document.documentElement;
    // apply variables
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--pageBg', theme.pageBg);
    root.style.setProperty('--cardBg', theme.cardBg);
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--muted', theme.muted);

    // add transition class to animate many properties smoothly
    root.classList.add('theme-transition');
    clearTimeout((applyThemeWithTransition)._t);
    (applyThemeWithTransition)._t = setTimeout(() => root.classList.remove('theme-transition'), 700);
  } catch (e) {
    /* ignore */
  }
}

// small confetti + music celebration
function celebrate() {
  try {
    runConfetti();
    playVictoryMelody();
  } catch (e) {
    console.warn('Celebrate failed', e);
  }
}

function runConfetti() {
  const count = 120;
  const colors = ['#ffd358', '#ff7ab6', '#7c3aed', '#06b6d4', '#34d399'];
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = 0;
  canvas.style.left = 0;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = 9999;
  document.body.appendChild(canvas);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: window.innerWidth * 0.5 + (Math.random() - 0.5) * 200,
      y: window.innerHeight * 0.3 + (Math.random() - 0.5) * 200,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * -10 - 2,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      life: 0,
      ttl: 140 + Math.random() * 60,
    });
  }

  let rafId = null;
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.vy += 0.35; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    // stop when all particles aged out
    if (particles.every((p) => p.life > p.ttl)) {
      cancelAnimationFrame(rafId);
      canvas.remove();
      return;
    }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  // also remove after 3.5s in case
  setTimeout(() => { if (canvas.parentNode) canvas.remove(); }, 4200);
}

function playVictoryMelody() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.08;
    master.connect(ctx.destination);

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    let t = now;
    for (let i = 0; i < notes.length; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = notes[i];
      g.gain.value = 0;
      o.connect(g);
      g.connect(master);
      o.start(t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.linearRampToValueAtTime(0.0, t + 0.26);
      o.stop(t + 0.28);
      t += 0.28;
    }

    // small arpeggio after
    setTimeout(() => {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'triangle';
      o2.frequency.value = 880;
      g2.gain.value = 0;
      o2.connect(g2);
      g2.connect(master);
      const s = ctx.currentTime;
      o2.start(s);
      g2.gain.linearRampToValueAtTime(0.06, s + 0.01);
      g2.gain.linearRampToValueAtTime(0, s + 0.2);
      o2.stop(s + 0.22);
    }, 900);

    // auto close context after a bit (some browsers require user gesture but we try)
    setTimeout(() => { try { ctx.close(); } catch (e) {} }, 3200);
  } catch (e) {
    // ignore audio failures
  }
}

/* helper to escape CSS values for inline style insertion */
function escapeCssVal(val) {
  if (typeof val === 'string') return `'${val.replace(/'/g, "\\'")}'`;
  return val;
}

/* ---------- Utilities ---------- */
function getTodayISO() { const d = new Date(); const tzOffset = d.getTimezoneOffset() * 60000; return new Date(d - tzOffset).toISOString().slice(0, 10); }
function formatHuman(iso) { if (!iso) return '—'; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
function timeSince(ts) { const seconds = Math.floor((Date.now() - ts) / 1000); const intervals = [{ label: 'yr', s: 31536000 }, { label: 'mo', s: 2592000 }, { label: 'd', s: 86400 }, { label: 'h', s: 3600 }, { label: 'm', s: 60 }]; for (const itv of intervals) { const val = Math.floor(seconds / itv.s); if (val > 0) return `${val}${itv.label} ago`; } return `${seconds}s ago`; }
