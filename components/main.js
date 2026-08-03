"use client";

import React, { useState, useMemo } from "react";
import { useGlobalState } from "../globalState";
import { useRouter } from "next/navigation";
import ClipLoader from "react-spinners/ClipLoader";
import {
  MdSchool,
  MdPeople,
  MdDirectionsBus,
  MdRoute,
  MdPersonAdd,
  MdPayments,
} from "react-icons/md";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import '../app/style.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const GOLD = "#8a6115";
const GOLD_LIGHT = "#d4af37";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// Firestore Timestamp, Date, or ISO string -> Date
const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const formatMoney = (value) => Number(value || 0).toLocaleString("en-US");

const Main = () => {
  const { students, schools, drivers, lines, bills = [], loading } = useGlobalState();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);

  //Logout
  const handleLogout = () => {
    setLoggingOut(true);

    // let UI update first
    setTimeout(() => {
      localStorage.removeItem("adminLoggedIn"); 
      localStorage.removeItem("adminDahboardName"); 
      sessionStorage.clear();

      router.push("/login");
    }, 300);
  };

  const stats = [
    {
      title: "إجمالي المدارس",
      value: schools.length,
      icon: MdSchool,
    },
    {
      title: "إجمالي الطلاب",
      value: students.length,
      icon: MdPeople,
    },
    {
      title: "إجمالي السائقين",
      value: drivers.length,
      icon: MdDirectionsBus,
    },
    {
      title: "إجمالي الخطوط",
      value: lines.length,
      icon: MdRoute,
    },
  ];

  // Onboarding funnel completeness
  const registrationProgress = useMemo(() => {
    const total = students.length || 1;

    const linked = students.filter((s) => Boolean(s.linked_parent)).length;
    const withDriver = students.filter((s) => Boolean(s.driver_id)).length;
    const withLine = students.filter((s) => Boolean(s.line_id)).length;

    return [
      { label: "أولياء أمور مرتبطين بالتطبيق", value: linked, percent: Math.round((linked / total) * 100) },
      { label: "طلاب مُسندون لسائق", value: withDriver, percent: Math.round((withDriver / total) * 100) },
      { label: "طلاب مُسندون لخط", value: withLine, percent: Math.round((withLine / total) * 100) },
    ];
  }, [students]);

  const billingStats = useMemo(() => {
    let billed = 0;
    let collected = 0;
    let paidCount = 0;
    let overdueCount = 0;

    const now = new Date();

    bills.forEach((b) => {
      const amount = Number(b.amount) || 0;
      const paid = Number(b.paid_amount) || 0;

      billed += amount;
      collected += paid;

      if (amount > 0 && paid >= amount) {
        paidCount += 1;
      } else {
        const due = toDate(b.due_date);
        if (due && due < now) overdueCount += 1;
      }
    });

    return {
      billed,
      collected,
      remaining: Math.max(billed - collected, 0),
      rate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
      paidCount,
      overdueCount,
      pendingCount: Math.max(bills.length - paidCount - overdueCount, 0),
    };
  }, [bills]);

  const registrationsChart = useMemo(() => {
    const buckets = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: ARABIC_MONTHS[d.getMonth()],
        count: 0,
      });
    }

    const index = new Map(buckets.map((b, i) => [b.key, i]));

    students.forEach((s) => {
      const created = toDate(s.created_at);
      if (!created) return;
      const slot = index.get(`${created.getFullYear()}-${created.getMonth()}`);
      if (slot !== undefined) buckets[slot].count += 1;
    });

    return {
      labels: buckets.map((b) => b.label),
      datasets: [
        {
          label: "طلاب جدد",
          data: buckets.map((b) => b.count),
          backgroundColor: GOLD,
          borderRadius: 6,
          maxBarThickness: 42,
        },
      ],
    };
  }, [students]);

  const topSchoolsChart = useMemo(() => {
    const counts = new Map();
    students.forEach((s) => {
      if (!s.school_id) return;
      counts.set(s.school_id, (counts.get(s.school_id) || 0) + 1);
    });

    const top = schools
      .map((school) => ({ name: school.name || "-", count: counts.get(school.id) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      labels: top.map((t) => (t.name.length > 26 ? `${t.name.slice(0, 26)}…` : t.name)),
      datasets: [
        {
          label: "عدد الطلاب",
          data: top.map((t) => t.count),
          backgroundColor: GOLD_LIGHT,
          borderRadius: 6,
          maxBarThickness: 26,
        },
      ],
    };
  }, [students, schools]);

  const billingChart = useMemo(
    () => ({
      labels: ["مدفوعة", "قيد الاستحقاق", "متأخرة"],
      datasets: [
        {
          data: [billingStats.paidCount, billingStats.pendingCount, billingStats.overdueCount],
          backgroundColor: [GOLD, GOLD_LIGHT, "#b91c1c"],
          borderWidth: 0,
        },
      ],
    }),
    [billingStats]
  );

  const schoolNameById = useMemo(
    () => new Map(schools.map((s) => [s.id, s.name])),
    [schools]
  );

  const recentStudents = useMemo(
    () =>
      students
        .map((s) => ({ ...s, createdDate: toDate(s.created_at) }))
        .filter((s) => s.createdDate)
        .sort((a, b) => b.createdDate - a.createdDate)
        .slice(0, 6),
    [students]
  );

  const recentPayments = useMemo(
    () =>
      bills
        .map((b) => ({ ...b, paidDate: toDate(b.paid_at) }))
        .filter((b) => b.paidDate)
        .sort((a, b) => b.paidDate - a.paidDate)
        .slice(0, 6),
    [bills]
  );

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f1f1f1" } },
      x: { grid: { display: false } },
    },
  };

  const horizontalBarOptions = {
    ...barOptions,
    indexAxis: "y",
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f1f1f1" } },
      y: { grid: { display: false } },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 12 } } } },
  };

  return (
    <div className="main-container">
      <h2 className="main-title">نظرة عامة</h2>

      <div className="logout-btn" onClick={handleLogout}>
       تسجيل الخروج
      </div>

      {loggingOut && (
        <div className="page-loading-overlay">
          <ClipLoader size={40} color="#000" />
          <p>جاري تسجيل الخروج...</p>
        </div>
      )}

      <div className="stats-grid">
        {stats.map((stat, index) => {
          const Icon = stat.icon;

          return (
            <div key={index} className="stat-card">
              <div className="stat-icon">
                <Icon size={22} />
              </div>

              <div className="stat-info">
                <p>{stat.title}</p>

                {loading ? (
                  <ClipLoader size={10} color="#8a6115" />
                ) : (
                  <h3>{stat.value}</h3>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="loader">
          <ClipLoader size={40} color={GOLD} />
        </div>
      ) : (
        <>
          <div className="overview-grid">
            <div className="overview-card overview-card-wide">
              <h4>تسجيل الطلاب خلال آخر 6 أشهر</h4>
              <div className="overview-chart">
                <Bar data={registrationsChart} options={barOptions} />
              </div>
            </div>

            <div className="overview-card">
              <h4>حالة الأقساط</h4>
              <div className="overview-chart">
                <Doughnut data={billingChart} options={doughnutOptions} />
              </div>
            </div>
          </div>

          <div className="overview-grid">
            <div className="overview-card overview-card-wide">
              <h4>أعلى 5 مدارس من حيث عدد الطلاب</h4>
              <div className="overview-chart">
                <Bar data={topSchoolsChart} options={horizontalBarOptions} />
              </div>
            </div>

            <div className="overview-card">
              <h4>تقدّم اكتمال التسجيل</h4>

              {registrationProgress.map((item) => (
                <div key={item.label} className="progress-row">
                  <div className="progress-row-head">
                    <span>{item.label}</span>
                    <strong>{item.percent}%</strong>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${item.percent}%` }} />
                  </div>
                  <small>{item.value} من {students.length} طالب</small>
                </div>
              ))}
            </div>
          </div>

          <div className="overview-card">
            <h4>تحصيل الأقساط</h4>

            <div className="billing-summary">
              <div className="billing-box">
                <p>إجمالي المستحق</p>
                <h3>{formatMoney(billingStats.billed)}</h3>
              </div>
              <div className="billing-box billing-box-paid">
                <p>المبلغ المحصَّل</p>
                <h3>{formatMoney(billingStats.collected)}</h3>
              </div>
              <div className="billing-box billing-box-due">
                <p>المتبقي</p>
                <h3>{formatMoney(billingStats.remaining)}</h3>
              </div>
              <div className="billing-box">
                <p>عدد الأقساط</p>
                <h3>{bills.length}</h3>
              </div>
            </div>

            <div className="progress-row">
              <div className="progress-row-head">
                <span>نسبة التحصيل</span>
                <strong>{billingStats.rate}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${billingStats.rate}%` }} />
              </div>
            </div>
          </div>

          <div className="overview-grid">
            <div className="overview-card">
              <h4><MdPersonAdd size={18} /> آخر عمليات التسجيل</h4>

              {recentStudents.length === 0 ? (
                <p className="activity-empty">لا توجد تسجيلات حديثة</p>
              ) : (
                recentStudents.map((s) => (
                  <div key={s.id} className="activity-row">
                    <div>
                      <strong>{s.name} {s.parent_name}</strong>
                      <small>{schoolNameById.get(s.school_id) || "-"}</small>
                    </div>
                    <span className="activity-date">
                      {s.createdDate.toLocaleDateString("en-GB")}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="overview-card">
              <h4><MdPayments size={18} /> آخر عمليات الدفع</h4>

              {recentPayments.length === 0 ? (
                <p className="activity-empty">لا توجد عمليات دفع حديثة</p>
              ) : (
                recentPayments.map((b) => (
                  <div key={b.id} className="activity-row">
                    <div>
                      <strong>{formatMoney(b.paid_amount)} د.ع</strong>
                      <small>
                        القسط {b.installment_index || "-"} · {schoolNameById.get(b.school_id) || "-"}
                      </small>
                    </div>
                    <span className="activity-date">
                      {b.paidDate.toLocaleDateString("en-GB")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Main;