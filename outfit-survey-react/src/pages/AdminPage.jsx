import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { API_BASE } from "../lib/config.js";

const QUESTION_LABELS = {
  q1: "سعر مناسب للجودة", q2: "السعر يمنعني من الشراء", q3: "عادل مقابل المنافسين",
  q4: "أميّزه بسهولة", q5: "أول ما يخطر ببالي", q6: "صورة مميزة",
  q7: "أعرف ما يميّزه", q8: "يناسب أشخاص مثلي", q9: "تصاميم تناسبني", q10: "أوصي به",
};
const PRICING_QS = ["q1", "q2", "q3"];
const POSITIONING_QS = ["q4", "q5", "q6", "q7", "q8", "q9", "q10"];
const CHART_COLORS = ["#F05322", "#2A9D8F", "#D9A441", "#3B4B66", "#8E5A9E", "#4C9F70"];

function scoreColor(v) {
  if (v >= 4) return "#1D8A4C";
  if (v >= 3) return "#D9A441";
  return "#C0472B";
}

const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

function RefreshIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}
function CsvIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
      <path d="M8 13h8" /><path d="M8 17h5" />
    </svg>
  );
}
function PdfIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
      <path d="M9 15v-3h1.5a1.5 1.5 0 0 1 0 3H9z" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
    </svg>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem("outfit_admin_key") || "");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginErr, setLoginErr] = useState(false);
  const [loading, setLoading] = useState(false);

  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [list, setList] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");

  const [search, setSearch] = useState("");
  const [incomeF, setIncomeF] = useState("");
  const [ageF, setAgeF] = useState("");
  const [genderF, setGenderF] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const trendRef = useRef(null);
  const npsRef = useRef(null);
  const radarRef = useRef(null);
  const incomeRef = useRef(null);
  const ageRef = useRef(null);
  const genderRef = useRef(null);
  const chartsRef = useRef({});
  const dashRef = useRef(null);

  async function loadAll(base = API_BASE, key = adminKey, d = days) {
    setLoading(true);
    const res1 = await fetch(base.replace(/\/$/, "") + "/api/survey/stats" + (d ? "?days=" + d : ""), { headers: { "X-Admin-Key": key } });
    if (!res1.ok) throw new Error("bad key or server");
    const statsData = await res1.json();
    const res2 = await fetch(base.replace(/\/$/, "") + "/api/survey/list?limit=500" + (d ? "&days=" + d : ""), { headers: { "X-Admin-Key": key } });
    const listData = res2.ok ? await res2.json() : [];
    setStats(statsData);
    setList(listData);
    setUpdatedAt(new Date().toLocaleString("ar-SA"));
    setLoading(false);
  }

  async function handleLogin() {
    setLoginErr(false);
    if (!adminKey.trim()) return;
    sessionStorage.setItem("outfit_admin_key", adminKey);
    try {
      await loadAll(API_BASE, adminKey, days);
      setLoggedIn(true);
    } catch {
      setLoginErr(true);
      sessionStorage.removeItem("outfit_admin_key");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("outfit_admin_key");
    setLoggedIn(false);
  }

  useEffect(() => {
    const key = sessionStorage.getItem("outfit_admin_key");
    if (key) {
      loadAll(API_BASE, key, days).then(() => setLoggedIn(true)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loggedIn) loadAll(API_BASE, adminKey, days).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  function destroy(key) {
    if (chartsRef.current[key]) { chartsRef.current[key].destroy(); delete chartsRef.current[key]; }
  }

  useEffect(() => {
    if (!stats || !loggedIn) return;

    destroy("trend");
    if (trendRef.current) {
      chartsRef.current.trend = new Chart(trendRef.current, {
        type: "line",
        data: {
          labels: stats.daily.map((d) => d.date.slice(5)),
          datasets: [{
            label: "ردود", data: stats.daily.map((d) => d.count),
            borderColor: "#F05322", backgroundColor: "rgba(240,83,34,0.12)",
            fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: "#F05322",
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
      });
    }

    destroy("nps");
    const recommendAvg = stats.averages.q10 ?? 0;
    if (npsRef.current) {
      const pct = Math.max(0, Math.min(100, (recommendAvg / 5) * 100));
      chartsRef.current.nps = new Chart(npsRef.current, {
        type: "doughnut",
        data: { labels: ["النتيجة", "الباقي"], datasets: [{ data: [pct, 100 - pct], backgroundColor: [scoreColor(recommendAvg), "#F0F0F1"], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: "75%", circumference: 180, rotation: 270, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
        plugins: [{
          id: "centerText",
          afterDraw(chart) {
            const { ctx, chartArea: { width, height, top } } = chart;
            ctx.save();
            ctx.font = "800 26px 'IBM Plex Sans Arabic'";
            ctx.fillStyle = "#1C1E23";
            ctx.textAlign = "center";
            ctx.fillText(recommendAvg.toFixed(1), width / 2, top + height * 0.72);
            ctx.restore();
          },
        }],
      });
    }

    destroy("radar");
    if (radarRef.current) {
      const pricingVals = PRICING_QS.map((q) => stats.averages[q]).filter((v) => v != null);
      const positioningVals = POSITIONING_QS.map((q) => stats.averages[q]).filter((v) => v != null);
      const pricingAvg = pricingVals.length ? pricingVals.reduce((a, b) => a + b, 0) / pricingVals.length : 0;
      const positioningAvg = positioningVals.length ? positioningVals.reduce((a, b) => a + b, 0) / positioningVals.length : 0;
      chartsRef.current.radar = new Chart(radarRef.current, {
        type: "radar",
        data: {
          labels: ["التسعير", "التموضع العام", "التمييز عن المنافسين", "يناسبني شخصياً", "الاستعداد للتوصية"],
          datasets: [{
            label: "المتوسط",
            data: [pricingAvg, positioningAvg, stats.averages.q4 ?? 0, stats.averages.q8 ?? 0, recommendAvg],
            backgroundColor: "rgba(240,83,34,0.18)", borderColor: "#F05322", pointBackgroundColor: "#F05322",
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { min: 0, max: 5, ticks: { stepSize: 1 } } } },
      });
    }

    const pie = (key, ref, data) => {
      destroy(key);
      if (!ref.current) return;
      const entries = Object.entries(data || {});
      chartsRef.current[key] = new Chart(ref.current, {
        type: "doughnut",
        data: { labels: entries.map((e) => e[0]), datasets: [{ data: entries.map((e) => e[1]), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: "#fff" }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } } },
      });
    };
    pie("income", incomeRef, stats.income);
    pie("age", ageRef, stats.age_group);
    pie("gender", genderRef, stats.gender);

    return () => { Object.keys(chartsRef.current).forEach(destroy); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, loggedIn]);

  const kpis = useMemo(() => {
    if (!stats) return [];
    const overallAvg = Object.values(stats.averages).filter((v) => v != null);
    const overall = overallAvg.length ? overallAvg.reduce((a, b) => a + b, 0) / overallAvg.length : 0;
    const last2 = stats.daily.slice(-2);
    const today = last2[1]?.count ?? 0, yesterday = last2[0]?.count ?? 0;
    let trend = { cls: "flat", label: "— بدون تغيير" };
    if (today > yesterday) trend = { cls: "up", label: "▲ أعلى من الأمس" };
    else if (today < yesterday) trend = { cls: "down", label: "▼ أقل من الأمس" };
    const recommendAvg = stats.averages.q10 ?? 0;
    const topIncome = Object.entries(stats.income || {}).sort((a, b) => b[1] - a[1])[0];

    const cards = [
      { n: stats.total, l: "إجمالي الردود", accent: "var(--brand)", trend },
      { n: overall.toFixed(1) + " / 5", l: "المتوسط العام للرضا", accent: "var(--teal)" },
      { n: recommendAvg.toFixed(1) + " / 5", l: "الاستعداد للتوصية", accent: "var(--gold)" },
      { n: today, l: "ردود اليوم", accent: "var(--navy)" },
    ];
    if (topIncome) cards.push({ n: topIncome[1], l: "الأكثر تكراراً: " + topIncome[0], accent: "#8E5A9E" });
    return cards;
  }, [stats]);

  const filteredList = useMemo(() => {
    const s = search.trim().toLowerCase();
    return list.filter((r) => {
      if (incomeF && r.income !== incomeF) return false;
      if (ageF && r.age_group !== ageF) return false;
      if (genderF && r.gender !== genderF) return false;
      if (s) {
        const text = ((r.feedback_general || "") + " " + (r.feedback_notes || "")).toLowerCase();
        if (!text.includes(s)) return false;
      }
      return true;
    });
  }, [list, search, incomeF, ageF, genderF]);

  const feedbackRows = useMemo(() => list.filter((r) => r.feedback_general || r.feedback_notes), [list]);
  const uniq = (arr) => [...new Set(arr)].sort();

  async function handleExportCSV() {
    const res = await fetch(API_BASE.replace(/\/$/, "") + "/api/survey/export", { headers: { "X-Admin-Key": adminKey } });
    if (!res.ok) { alert("تعذر التصدير"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "outfit_survey_export_" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
  }

  async function handleExportPDF() {
    if (!dashRef.current) return;
    setPdfBusy(true);
    try {
      const canvas = await html2canvas(dashRef.current, { scale: 2, backgroundColor: "#F5F5F6", useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      const pageWidth = canvas.width;
      const pageHeight = canvas.width * 1.414;
      let heightLeft = canvas.height;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, pageWidth, canvas.height);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage([pageWidth, pageHeight]);
        pdf.addImage(imgData, "PNG", 0, position, pageWidth, canvas.height);
        heightLeft -= pageHeight;
      }
      pdf.save("outfit_survey_report_" + new Date().toISOString().slice(0, 10) + ".pdf");
    } catch {
      alert("تعذر إنشاء ملف PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  if (!loggedIn) {
    return (
      <div className="admin-page" dir="rtl">
        <div className="adm-wrap">
          <div className="adm-login-card">
            <img src="/logo.png" alt="OUTFIT" className="adm-logo" />
            <h1>تقرير استبيان</h1>
            <label>كلمة المرور</label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="ادخل كلمة المرور"
              onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
            />
            {loginErr && <div className="adm-err">كلمة المرور غير صحيحة أو تعذر الاتصال بالسيرفر.</div>}
            <button className="adm-btn adm-btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? "جارٍ التحميل…" : "دخول"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page" dir="rtl">
      <div className="adm-wrap" ref={dashRef}>
        <div className="adm-topbar">
          <div className="adm-brand">
            <img src="/logo.png" alt="OUTFIT" className="adm-logo" />
            <div>
              <h1>تقرير استبيان</h1>
              <div className="adm-sub">آخر تحديث: {updatedAt}</div>
            </div>
          </div>
          <div className="adm-actions">
            <select className="adm-select" value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))}>
              <option value={7}>آخر 7 أيام</option>
              <option value={30}>آخر 30 يوم</option>
              <option value={0}>كل الفترة</option>
            </select>
            <button className="adm-btn adm-btn-ghost" onClick={() => loadAll()}><RefreshIcon /> تحديث</button>
            <button className="adm-btn adm-btn-ghost" onClick={handleExportCSV}><CsvIcon /> تصدير CSV</button>
            <button className="adm-btn adm-btn-ghost" onClick={handleExportPDF} disabled={pdfBusy}>
              <PdfIcon /> {pdfBusy ? "جارٍ التجهيز…" : "تحميل PDF"}
            </button>
            <button className="adm-btn adm-btn-ghost" onClick={handleLogout}><LogoutIcon /> خروج</button>
          </div>
        </div>

        <div className="adm-kpis">
          {kpis.map((c, i) => (
            <div className="adm-kpi" key={i} style={{ "--kpi-accent": c.accent }}>
              <div className="adm-n">{c.n}</div>
              <div className="adm-l">{c.l}</div>
              {c.trend && <div className={"adm-trend " + c.trend.cls}>{c.trend.label}</div>}
            </div>
          ))}
        </div>

        <div className="adm-grid-2">
          <div className="adm-section">
            <h2>الردود خلال {days ? `آخر ${days} يوم` : "كل الفترة"}</h2>
            <div className="adm-hint">عدد الاستبيانات المكتملة يومياً</div>
            <div className="adm-chart-box"><canvas ref={trendRef} /></div>
          </div>
          <div className="adm-section">
            <h2>هل يوصي بـ Outfit؟ (متوسط السؤال الأخير)</h2>
            <div className="adm-hint">من 5 — كلما اقترب من 5 زاد الاستعداد للتوصية</div>
            <div className="adm-chart-box short"><canvas ref={npsRef} /></div>
          </div>
        </div>

        <div className="adm-grid-2">
          <div className="adm-section">
            <h2>متوسط الإجابات لكل سؤال</h2>
            <div className="adm-hint">من 5 — مقسّمة حسب المحور</div>
            <div className="adm-legend-row">
              <span><i className="adm-legend-dot" style={{ background: "var(--brand)" }} />التسعير</span>
              <span><i className="adm-legend-dot" style={{ background: "var(--teal)" }} />التموضع</span>
            </div>
            {stats && Object.keys(QUESTION_LABELS).map((q) => {
              const val = stats.averages[q] ?? 0;
              const pct = (val / 5) * 100;
              const color = PRICING_QS.includes(q) ? "var(--brand)" : "var(--teal)";
              return (
                <div className="adm-qbar-row" key={q}>
                  <span className="adm-tag" style={{ background: color }} />
                  <div className="adm-lbl">{QUESTION_LABELS[q]}</div>
                  <div className="adm-qbar-track"><div className="adm-qbar-fill" style={{ width: pct + "%", background: color }} /></div>
                  <div className="adm-qbar-val">{stats.averages[q] ?? "-"}</div>
                </div>
              );
            })}
          </div>
          <div className="adm-section">
            <h2>مقارنة المحاور الرئيسية</h2>
            <div className="adm-hint">متوسط عام لكل محور</div>
            <div className="adm-chart-box tall"><canvas ref={radarRef} /></div>
          </div>
        </div>

        <div className="adm-grid-3">
          <div className="adm-section"><h2>الدخل الشهري</h2><div className="adm-chart-box short"><canvas ref={incomeRef} /></div></div>
          <div className="adm-section"><h2>الفئة العمرية</h2><div className="adm-chart-box short"><canvas ref={ageRef} /></div></div>
          <div className="adm-section"><h2>الجنس</h2><div className="adm-chart-box short"><canvas ref={genderRef} /></div></div>
        </div>

        <div className="adm-section" style={{ marginTop: 16 }}>
          <h2>آراء وملاحظات العملاء</h2>
          <div className="adm-hint">آخر التعليقات المكتوبة (الأسئلة الاختيارية)</div>
          <div className="adm-feedback-scroll">
            {feedbackRows.length === 0 && <div className="adm-empty-note">لا توجد تعليقات مكتوبة بعد</div>}
            {feedbackRows.map((r) => {
              const text = [r.feedback_general, r.feedback_notes].filter(Boolean).join(" — ");
              const date = r.created_at ? new Date(r.created_at).toLocaleDateString("ar-SA") : "";
              return (
                <div className="adm-feedback-item" key={r.id}>
                  {text}
                  <div className="adm-meta">#{r.id} · {date} · {r.age_group} · {r.gender}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="adm-section" style={{ marginTop: 16 }}>
          <h2>كل الردود</h2>
          <div className="adm-filters">
            <input placeholder="بحث في الملاحظات…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={incomeF} onChange={(e) => setIncomeF(e.target.value)}>
              <option value="">كل الدخل</option>
              {uniq(list.map((r) => r.income)).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={ageF} onChange={(e) => setAgeF(e.target.value)}>
              <option value="">كل الأعمار</option>
              {uniq(list.map((r) => r.age_group)).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={genderF} onChange={(e) => setGenderF(e.target.value)}>
              <option value="">كل الجنس</option>
              {uniq(list.map((r) => r.gender)).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="adm-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>التاريخ</th>
                  <th>q1</th><th>q2</th><th>q3</th><th>q4</th><th>q5</th>
                  <th>q6</th><th>q7</th><th>q8</th><th>q9</th><th>q10</th>
                  <th>الدخل</th><th>العمر</th><th>الجنس</th><th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 && (
                  <tr><td colSpan={16} className="adm-empty-note">لا توجد نتائج مطابقة</td></tr>
                )}
                {filteredList.map((r) => {
                  const date = r.created_at ? new Date(r.created_at).toLocaleString("ar-SA") : "";
                  const notes = [r.feedback_general, r.feedback_notes].filter(Boolean).join(" / ");
                  return (
                    <tr key={r.id}>
                      <td>{r.id}</td><td>{date}</td>
                      {["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"].map((q) => (
                        <td key={q}>
                          <span className="adm-score-pill" style={{ background: scoreColor(r[q]) + "22", color: scoreColor(r[q]) }}>{r[q]}</span>
                        </td>
                      ))}
                      <td>{r.income}</td><td>{r.age_group}</td><td>{r.gender}</td>
                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{notes || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
