import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, DISCOUNT_CODE } from "../lib/config.js";

const STORAGE_KEY = "outfit_survey_responses";

const pricingQs = [
  { id: "q1", n: "١", text: "أسعار منتجات Outfit مناسبة مقارنة بجودة المنتجات." },
  { id: "q2", n: "٢", text: "أسعار Outfit تمنعني أحياناً من الشراء." },
  { id: "q3", n: "٣", text: "أشعر أن أسعار منتجات Outfit عادلة مقارنة بالعلامات التجارية المنافسة." },
];
const positioningQs = [
  { id: "q4", n: "٤", text: "أستطيع تمييز Outfit بسهولة عن العلامات التجارية الأخرى." },
  { id: "q5", n: "٥", text: "عند التفكير في شراء الملابس، أول علامة تجارية تخطر ببالي هي Outfit." },
  { id: "q6", n: "٦", text: "أعتقد أن Outfit يقدّم صورة مميزة مقارنة بالمنافسين." },
  { id: "q7", n: "٧", text: "أعرف ما الذي يميّز Outfit عن العلامات التجارية الأخرى." },
  { id: "q8", n: "٨", text: "أشعر أن Outfit يقدّم منتجات تناسب أشخاصاً مثلي." },
  { id: "q9", n: "٩", text: "أسلوب وتصاميم منتجات Outfit تناسب اهتماماتي." },
  { id: "q10", n: "١٠", text: "من المحتمل أن أوصي بـ Outfit لأشخاص من نفس فئتي العمرية." },
];
const page1Qs = [...pricingQs, ...positioningQs.slice(0, 2)];
const page2Qs = positioningQs.slice(2);

const incomeOpts = ["أقل من 5,000 ريال", "5,000 - 9,999 ريال", "10,000 - 14,999 ريال", "15,000 - 19,999 ريال", "20,000 ريال أو أكثر", "أفضّل عدم الإجابة"];
const ageOpts = ["أقل من 18 سنة", "18 - 24 سنة", "25 - 34 سنة", "35 - 44 سنة", "45 سنة أو أكثر"];
const genderOpts = ["ذكر", "أنثى", "أفضّل عدم الإجابة"];

const arNum = (n) => "٠١٢٣٤٥٦٧٨٩"[n];
const SUBMITTED_FLAG_KEY = "outfit_survey_submitted";
const DEVICE_TOKEN_KEY = "outfit_survey_device_token";

function getDeviceToken() {
  let token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) {
    token = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "");
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

function LikertQuestion({ q, value, error, onChange }) {
  return (
    <div className={"q" + (error ? " error" : "")}>
      <div className="q-text">
        <span className="qn">{q.n}.</span>
        <span>{q.text}</span>
      </div>
      <div className="likert">
        {[1, 2, 3, 4, 5].map((v) => (
          <label key={v}>
            <input type="radio" name={q.id} checked={value === v} onChange={() => onChange(q.id, v)} />
            <span className="node">{arNum(v)}</span>
          </label>
        ))}
      </div>
      <div className="anchors">
        <span>لا أوافق جداً</span>
        <span>موافق جداً</span>
      </div>
      <div className="err-msg">⚠ الرجاء اختيار درجة</div>
    </div>
  );
}

function ChoiceQuestion({ name, opts, value, error, onChange }) {
  return (
    <div className={"q" + (error ? " error" : "")}>
      <div className="choices">
        {opts.map((o) => (
          <label className="choice" key={o}>
            <input type="radio" name={name} checked={value === o} onChange={() => onChange(name, o)} />
            <span className="radio" />
            <span className="ctext">{o}</span>
          </label>
        ))}
      </div>
      <div className="err-msg">⚠ الرجاء اختيار إجابة</div>
    </div>
  );
}

function AdminPanel({ open, count, onClose, onExport, onClear }) {
  return (
    <div className={"admin" + (open ? " show" : "")}>
      <div className="admin-card">
        <h3>لوحة النتائج</h3>
        <div className="admin-count"><span>{count}</span><span>ردّ محفوظ على هذا الجهاز</span></div>
        <div className="actions">
          <button className="btn btn-primary" style={{ fontSize: 15, padding: 13 }} onClick={onExport}>تصدير كل الردود (Excel/CSV)</button>
          <button className="btn btn-ghost" onClick={onClose}>إغلاق</button>
          <button className="btn btn-danger" onClick={onClear}>مسح كل الردود المحفوظة</button>
        </div>
        <div className="admin-hint">تُحفظ الردود على هذا الجهاز فقط (مناسبة لجهاز في الفرع). اضغط شعار OUTFIT ٥ مرات لفتح هذه اللوحة.</div>
      </div>
    </div>
  );
}

export default function SurveyPage() {
  const [page, setPage] = useState(1);
  const [answers, setAnswers] = useState({
    q1: null, q2: null, q3: null, q4: null, q5: null,
    q6: null, q7: null, q8: null, q9: null, q10: null,
    feedback_general: "", feedback_notes: "",
    income: "", age: "", gender: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [copyLabel, setCopyLabel] = useState("نسخ الكود");
  const [adminOpen, setAdminOpen] = useState(false);
  const [respCount, setRespCount] = useState(0);

  const logoClicks = useRef(0);
  const clickTimer = useRef(null);

  useEffect(() => {
    if (localStorage.getItem(SUBMITTED_FLAG_KEY) === "1") setDone(true);
  }, []);

  const requiredIds = useMemo(
    () => ({
      1: page1Qs.map((q) => q.id),
      2: page2Qs.map((q) => q.id),
      3: ["income", "age", "gender"],
    }),
    []
  );

  function setAnswer(name, value) {
    setAnswers((a) => ({ ...a, [name]: value }));
    setErrors((e) => ({ ...e, [name]: false }));
  }

  function validatePage(n) {
    const ids = requiredIds[n];
    const newErrors = {};
    let firstErrId = null;
    ids.forEach((id) => {
      if (!answers[id]) {
        newErrors[id] = true;
        if (!firstErrId) firstErrId = id;
      }
    });
    setErrors((e) => ({ ...e, ...newErrors }));
    if (firstErrId) {
      document.getElementById("q-" + firstErrId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function goNext(n) {
    if (validatePage(page)) {
      setPage(n);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  function goBack(n) {
    setPage(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!validatePage(3)) return;

    setSubmitting(true);

    const val = (id) => answers[id];
    const L = {
      q1: pricingQs[0].text, q2: pricingQs[1].text, q3: pricingQs[2].text,
      q4: positioningQs[0].text, q5: positioningQs[1].text, q6: positioningQs[2].text,
      q7: positioningQs[3].text, q8: positioningQs[4].text, q9: positioningQs[5].text, q10: positioningQs[6].text,
    };
    const localRecord = {
      timestamp: new Date().toISOString(),
      "التسعير": { [L.q1]: val("q1"), [L.q2]: val("q2"), [L.q3]: val("q3") },
      "التموضع": { [L.q4]: val("q4"), [L.q5]: val("q5"), [L.q6]: val("q6"), [L.q7]: val("q7"), [L.q8]: val("q8"), [L.q9]: val("q9"), [L.q10]: val("q10") },
      "انطباع_عام": answers.feedback_general.trim(),
      "ملاحظات": answers.feedback_notes.trim(),
      "الدخل_الشهري": answers.income,
      "الفئة_العمرية": answers.age,
      "الجنس": answers.gender,
    };
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      all.push(localRecord);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch { /* noop */ }

    const payload = {
      device_token: getDeviceToken(),
      q1: answers.q1, q2: answers.q2, q3: answers.q3, q4: answers.q4, q5: answers.q5,
      q6: answers.q6, q7: answers.q7, q8: answers.q8, q9: answers.q9, q10: answers.q10,
      feedback_general: answers.feedback_general.trim(),
      feedback_notes: answers.feedback_notes.trim(),
      income: answers.income, age_group: answers.age, gender: answers.gender,
    };

    try {
      const res = await fetch(API_BASE + "/api/survey/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 429) {
        setSubmitting(false);
        alert("وصلنا عدد كبير من الردود من نفس الشبكة اليوم. جرّب لاحقاً من فضلك.");
        return;
      }
      // 409 (already submitted) is treated the same as success from the visitor's perspective
    } catch (e) {
      // network error — still let them see the thank-you screen, nothing lost locally
    }

    localStorage.setItem(SUBMITTED_FLAG_KEY, "1");
    setSubmitting(false);
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getAllLocal() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  }

  function bumpLogo() {
    logoClicks.current++;
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { logoClicks.current = 0; }, 1200);
    if (logoClicks.current >= 5) {
      logoClicks.current = 0;
      setRespCount(getAllLocal().length);
      setAdminOpen(true);
    }
  }

  function handleExportCSV() {
    const all = getAllLocal();
    if (!all.length) { alert("لا توجد ردود محفوظة بعد."); return; }
    const headers = ["الوقت", "q1_سعر مناسب للجودة", "q2_السعر يمنعني", "q3_عادل مقابل المنافسين",
      "q4_أميّزه بسهولة", "q5_أول ما يخطر", "q6_صورة مميزة", "q7_أعرف ما يميّزه", "q8_يناسب أشخاص مثلي", "q9_تصاميم تناسبني", "q10_أوصي به",
      "انطباع عام", "ملاحظات", "الدخل الشهري", "الفئة العمرية", "الجنس"];
    const rows = all.map((r) => {
      const p = Object.values(r["التسعير"] || {});
      const m = Object.values(r["التموضع"] || {});
      const cells = [r.timestamp].concat(p, m, [r["انطباع_عام"], r["ملاحظات"], r["الدخل_الشهري"], r["الفئة_العمرية"], r["الجنس"]]);
      return cells.map((c) => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(",");
    });
    const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ردود_استبيان_Outfit_" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
  }

  function handleClearLocal() {
    if (confirm("متأكد من مسح كل الردود المحفوظة على هذا الجهاز؟ لا يمكن التراجع.")) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SUBMITTED_FLAG_KEY);
      localStorage.removeItem(DEVICE_TOKEN_KEY);
      setRespCount(0);
    }
  }

  function copyCode() {
    const done = () => {
      setCopyLabel("تم النسخ ✓");
      setTimeout(() => setCopyLabel("نسخ الكود"), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(DISCOUNT_CODE).then(done).catch(() => {});
    } else {
      const ta = document.createElement("textarea");
      ta.value = DISCOUNT_CODE;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  }

  if (done) {
    return (
      <div className="survey-page">
        <div className="thanks show">
          <div className="mark">
            <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h2>شكراً لك</h2>
          <p>وصلتنا إجاباتك بنجاح. رأيك بيساعدنا نقدّم لك تجربة أفضل في Outfit.</p>

          <div className="coupon-card" aria-hidden="true">
            <svg width="320" height="470" viewBox="0 0 400 640" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="كوبون خصم OUTFIT بقيمة 15%">
              <path d="M30,190 C30,166 50,150 78,150 C110,150 130,175 160,168 C190,161 190,150 220,150 C250,150 250,164 280,168 C310,172 330,158 352,166 C362,170 370,178 370,190 L370,582 C370,598 358,610 342,610 L58,610 C42,610 30,598 30,582 Z" fill="#F05322" />
              <rect x="208" y="34" width="150" height="270" rx="18" fill="#DCDDDF" transform="rotate(7 283 169)" />
              <path d="M76,40 H324 A16,16 0 0 1 340,56 V292 C296,320 254,258 210,290 C168,320 124,256 60,292 V56 A16,16 0 0 1 76,40 Z" fill="#FDEEE8" />
              <circle cx="60" cy="122" r="15" fill="#F05322" />
              <circle cx="340" cy="122" r="15" fill="#F05322" />
              <line x1="80" y1="122" x2="320" y2="122" stroke="#E3B79E" strokeWidth="2" strokeDasharray="6 7" />
              <path d="M355,92 a20,20 0 0 1 12,20" fill="none" stroke="#D8431A" strokeWidth="4" strokeLinecap="round" />
              <path d="M366,168 a18,18 0 0 1 -6,20" fill="none" stroke="#D8431A" strokeWidth="4" strokeLinecap="round" />
              <path d="M42,190 a16,16 0 0 0 -6,18" fill="none" stroke="#D8431A" strokeWidth="4" strokeLinecap="round" />
              <text x="200" y="90" textAnchor="middle" fontFamily="'IBM Plex Sans Arabic',sans-serif" fontWeight="800" fontSize="24" fill="#1C1E23">خصم</text>
              <text x="200" y="180" textAnchor="middle" fontFamily="'IBM Plex Sans Arabic',sans-serif" fontWeight="900" fontSize="48" fill="#1C1E23">15%</text>
              <text x="200" y="210" textAnchor="middle" fontFamily="'IBM Plex Sans Arabic',sans-serif" fontWeight="400" fontSize="15" fill="#6E7278">على طلبك من المتجر الإلكتروني</text>
              <g className="hanger-icon" transform="translate(200,262)">
                <path d="M0,-30 q0,-12 10,-12 q10,0 10,12 q0,7 -10,12" fill="none" stroke="#D8431A" strokeWidth="5" strokeLinecap="round" />
                <line x1="0" y1="-18" x2="0" y2="-6" stroke="#D8431A" strokeWidth="5" strokeLinecap="round" />
                <path d="M0,-6 L-46,20 L-34,30 L0,10 L34,30 L46,20 Z" fill="#F05322" />
                <line x1="-30" y1="24" x2="30" y2="24" stroke="#D8431A" strokeWidth="5" strokeLinecap="round" />
              </g>
              <text x="200" y="352" textAnchor="middle" fontFamily="'IBM Plex Sans Arabic',sans-serif" fontWeight="900" fontSize="20" letterSpacing="6" fill="#FFFFFF">OUTFIT</text>
              <text x="200" y="382" textAnchor="middle" fontFamily="'IBM Plex Sans Arabic',sans-serif" fontWeight="600" fontSize="17" fill="#FFFFFF">كوبون ترحيبي خاص</text>
              <text x="200" y="405" textAnchor="middle" fontFamily="'IBM Plex Sans Arabic',sans-serif" fontWeight="600" fontSize="17" fill="#FFFFFF">تم فتحه لك الآن!</text>
              <rect className="code-pill" x="98" y="432" width="204" height="42" rx="21" fill="none" stroke="#FBD9C9" strokeWidth="1.6" strokeDasharray="5 5" />
              <text x="200" y="459" textAnchor="middle" fontFamily="'IBM Plex Sans Arabic',sans-serif" fontWeight="400" fontSize="15" fill="#FFFFFF">
                استخدم الكود : <tspan fontWeight="700">{DISCOUNT_CODE}</tspan>
              </text>
            </svg>
          </div>

          <div className="discount-box">
            <button className="btn btn-primary" onClick={copyCode}>{copyLabel}</button>
          </div>

          <div className="actions">
            <button className="btn btn-ghost" onClick={() => { localStorage.removeItem(SUBMITTED_FLAG_KEY); setDone(false); setPage(1); }}>
              تعبئة استبيان جديد
            </button>
          </div>
        </div>
        <AdminPanel
          open={adminOpen}
          count={respCount}
          onClose={() => setAdminOpen(false)}
          onExport={handleExportCSV}
          onClear={handleClearLocal}
        />
      </div>
    );
  }

  return (
    <div className="survey-page">
      <div className="wrap">
        <div className="hero">
          <div className="brand-banner" onClick={bumpLogo}>
            <img src="/logo.png" alt="OUTFIT أوت فيت" />
          </div>
          <span className="eyebrow">استبيان رأي العملاء</span>
          <h1>شاركنا رأيك</h1>
          <p>دقيقتان من وقتك تساعدنا نطوّر أسعارنا وتشكيلتنا لتناسبك أكثر.</p>
          <div className="scale-bar">
            <span className="s-item"><span className="s-badge">١</span> لا أوافق جداً</span>
            <span className="s-sep" />
            <span className="s-item"><span className="s-badge">٣</span> محايد</span>
            <span className="s-sep" />
            <span className="s-item"><span className="s-badge">٥</span> موافق جداً</span>
          </div>
        </div>

        {page === 1 && (
          <div className="page active">
            <div className="section">
              <div className="section-head">
                <div className="section-num">١</div>
                <div><div className="section-sub">الأسئلة ١ - ٥</div></div>
              </div>
              {page1Qs.map((q) => (
                <div id={"q-" + q.id} key={q.id}>
                  <LikertQuestion q={q} value={answers[q.id]} error={errors[q.id]} onChange={setAnswer} />
                </div>
              ))}
            </div>
            <div className="page-actions">
              <button className="btn btn-primary" onClick={() => goNext(2)}>التالي</button>
            </div>
          </div>
        )}

        {page === 2 && (
          <div className="page active">
            <div className="section">
              <div className="section-head">
                <div className="section-num">٢</div>
                <div><div className="section-sub">الأسئلة ٦ - ١٠</div></div>
              </div>
              {page2Qs.map((q) => (
                <div id={"q-" + q.id} key={q.id}>
                  <LikertQuestion q={q} value={answers[q.id]} error={errors[q.id]} onChange={setAnswer} />
                </div>
              ))}
            </div>
            <div className="page-actions">
              <button className="btn btn-ghost" onClick={() => goBack(1)}>رجوع</button>
              <button className="btn btn-primary" onClick={() => goNext(3)}>التالي</button>
            </div>
          </div>
        )}

        {page === 3 && (
          <div className="page active">
            <div className="section">
              <div className="section-head">
                <div className="section-num">١</div>
                <div>
                  <div className="section-title">رأيك يهمنا</div>
                  <div className="section-sub">كلامك بحرّيتك — هذي الأسئلة اختيارية</div>
                </div>
              </div>
              <div className="q">
                <div className="q-text">
                  <span className="qn">١١.</span>
                  <span>ماذا يخطر في بالك عند سماع أو رؤية براند أوت فيت؟ <span className="opt">(اختياري)</span></span>
                </div>
                <textarea placeholder="اكتب أول شي يجي في بالك…" value={answers.feedback_general} onChange={(e) => setAnswer("feedback_general", e.target.value)} />
              </div>
              <div className="q">
                <div className="q-text">
                  <span className="qn">١٢.</span>
                  <span>أي ملاحظات أو اقتراحات تحب تشاركها معنا حول Outfit؟ <span className="opt">(اختياري)</span></span>
                </div>
                <textarea placeholder="نرحّب بكل ملاحظة تساعدنا نتحسّن…" value={answers.feedback_notes} onChange={(e) => setAnswer("feedback_notes", e.target.value)} />
              </div>
            </div>

            <div className="section">
              <div className="section-head">
                <div className="section-num">٢</div>
                <div>
                  <div className="section-title">معلومات عنك</div>
                  <div className="section-sub">تساعدنا نفهم عملاءنا — تبقى سرية تماماً</div>
                </div>
              </div>
              <div id="q-income">
                <div className="q-text"><span className="qn">١٣.</span><span>ما هو متوسط إجمالي الدخل الشهري؟</span></div>
                <ChoiceQuestion name="income" opts={incomeOpts} value={answers.income} error={errors.income} onChange={setAnswer} />
              </div>
              <div id="q-age">
                <div className="q-text"><span className="qn">١٤.</span><span>إلى أي فئة عمرية تنتمي؟</span></div>
                <ChoiceQuestion name="age" opts={ageOpts} value={answers.age} error={errors.age} onChange={setAnswer} />
              </div>
              <div id="q-gender">
                <div className="q-text"><span className="qn">١٥.</span><span>الجنس</span></div>
                <ChoiceQuestion name="gender" opts={genderOpts} value={answers.gender} error={errors.gender} onChange={setAnswer} />
              </div>
            </div>

            <div className="submit-zone">
              <div className="page-actions">
                <button className="btn btn-ghost" onClick={() => goBack(2)}>رجوع</button>
                <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? "جارٍ الإرسال…" : "إرسال إجاباتي"}
                </button>
              </div>
              <div className="submit-note">
                <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                بيانات هذا الاستبيان سرية وتُستخدم لأغراض تطوير الخدمة فقط
              </div>
            </div>
          </div>
        )}

        <footer>© {new Date().getFullYear()} OUTFIT · لاروش التجارية</footer>
      </div>
      <AdminPanel
        open={adminOpen}
        count={respCount}
        onClose={() => setAdminOpen(false)}
        onExport={handleExportCSV}
        onClear={handleClearLocal}
      />
    </div>
  );
}
