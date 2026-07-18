"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { DB } from "../firebaseConfig";
import { Modal } from "antd";
import ClipLoader from "react-spinners/ClipLoader";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "../app/style.css";

const IRAQ_PROVINCES = [
  "بغداد",
  "البصرة",
  "نينوى",
  "أربيل",
  "النجف",
  "كربلاء",
  "كركوك",
  "الأنبار",
  "بابل",
  "ذي قار",
  "ديالى",
  "واسط",
  "ميسان",
  "المثنى",
  "القادسية",
  "صلاح الدين",
  "دهوك",
  "السليمانية",
];

const OTHER_CITY_OPTION = "أخرى (إدخال يدوي)";

const IRAQ_CITIES_BY_PROVINCE = {
  "بغداد": ["الكرخ", "الرصافة", "الكاظمية", "الأعظمية", "الدورة", "المنصور", "الشعب", "مدينة الصدر", "الحرية"],
  "البصرة": ["مركز البصرة", "الزبير", "أبو الخصيب", "القرنة", "شط العرب", "الفاو", "المدينة", "الدير"],
  "نينوى": ["الموصل", "تلعفر", "سنجار", "الحمدانية", "بعشيقة", "تلكيف", "الشيخان"],
  "أربيل": ["مركز أربيل", "شقلاوة", "سوران", "كويسنجق", "مخمور", "رواندوز"],
  "النجف": ["مركز النجف", "الكوفة", "المناذرة", "أبو صخير"],
  "كربلاء": ["مركز كربلاء", "الهندية (طويريج)", "عين التمر"],
  "كركوك": ["مركز كركوك", "الحويجة", "داقوق", "دبس"],
  "الأنبار": ["الرمادي", "الفلوجة", "هيت", "حديثة", "عنة", "القائم", "راوة"],
  "بابل": ["الحلة", "المسيب", "الهاشمية", "المحاويل", "القاسم"],
  "ذي قار": ["الناصرية", "الشطرة", "سوق الشيوخ", "الرفاعي", "الجبايش"],
  "ديالى": ["بعقوبة", "المقدادية", "خانقين", "بلدروز", "الخالص"],
  "واسط": ["الكوت", "الحي", "النعمانية", "الصويرة", "بدرة"],
  "ميسان": ["العمارة", "الميمونة", "قلعة صالح", "علي الغربي"],
  "المثنى": ["السماوة", "الرميثة", "الخضر", "الوركاء"],
  "القادسية": ["الديوانية", "عفك", "الشامية", "الحمزة"],
  "صلاح الدين": ["تكريت", "بيجي", "سامراء", "الدجيل", "الشرقاط"],
  "دهوك": ["مركز دهوك", "زاخو", "العمادية", "سيميل", "عقرة"],
  "السليمانية": ["مركز السليمانية", "حلبجة", "رانية", "دوكان", "كلار"],
};

const LEAD_SOURCES = [
  "زيارة ميدانية",
  "فيسبوك",
  "انستغرام",
  "معرض",
  "اتصال هاتفي",
  "توصية",
  "موقع الشركة",
  "إحالة من عميل آخر",
  "أخرى",
];

const INSTITUTION_TYPES = [
  "مدرسة حكومية",
  "مدرسة أهلية",
  "جامعة",
  "معهد",
  "روضة أطفال",
  "أخرى",
];

const LEAD_STATUSES = [
  "Lead",
  "Qualified Lead",
  "Negotiation",
  "Contract Signed",
  "Activated",
  "Closed Deal",
];

const LEAD_STATUS_LABELS = {
  "Lead": "عميل محتمل",
  "Qualified Lead": "عميل مؤهَّل",
  "Negotiation": "قيد التفاوض",
  "Contract Signed": "تم توقيع العقد",
  "Activated": "تم التفعيل",
  "Closed Deal": "صفقة مغلقة",
};

const emptyForm = {
  lead_date: new Date().toISOString().split("T")[0],
  lead_source: LEAD_SOURCES[0],
  assigned_marketer: "",
  province: IRAQ_PROVINCES[0],
  city: IRAQ_CITIES_BY_PROVINCE[IRAQ_PROVINCES[0]][0],
  institution_name: "",
  type: INSTITUTION_TYPES[0],
  contact_person: "",
  position: "",
  phone: "",
  email: "",
  student_count: "",
  lead_status: "Lead",
  qualified_date: "",
  meeting_date: "",
  proposal_sent: "",
  contract_signed: "",
  first_payment: "",
  activation_date: "",
  notes: "",
};

// Generates the next CRM ID, e.g. SS-26-0001
const generateCrmId = (existingLeads) => {
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const prefix = `SS-${yearSuffix}-`;

  const sameYearCount = existingLeads.filter((l) =>
    (l.crm_id || "").startsWith(prefix)
  ).length;

  const nextNumber = (sameYearCount + 1).toString().padStart(4, "0");
  return `${prefix}${nextNumber}`;
};

// A deal is "closed" once contract, first payment and activation are all set
const isClosedDeal = (lead) =>
  Boolean(lead.contract_signed && lead.first_payment && lead.activation_date);

const Crm = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("الكل");

  const [openAddModal, setOpenAddModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [manualCity, setManualCity] = useState(false);

  // 🔹 Fetch all leads
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const q = query(collection(DB, "crm_leads"), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    if (statusFilter === "الكل") return leads;
    return leads.filter((l) => l.lead_status === statusFilter);
  }, [leads, statusFilter]);

  const stats = useMemo(() => {
    const total = leads.length;
    const closed = leads.filter(isClosedDeal).length;
    const inNegotiation = leads.filter((l) => l.lead_status === "Negotiation").length;
    const totalStudents = leads.reduce(
      (sum, l) => sum + (Number(l.student_count) || 0),
      0
    );
    return { total, closed, inNegotiation, totalStudents };
  }, [leads]);

  // 🔹 Create a new lead
  const handleAddLead = async () => {
    if (!form.institution_name || !form.assigned_marketer || !form.phone) {
      alert("يرجى تعبئة اسم المؤسسة، اسم المسوق، ورقم الهاتف على الأقل");
      return;
    }

    try {
      setSaving(true);

      const crm_id = generateCrmId(leads);

      await addDoc(collection(DB, "crm_leads"), {
        ...form,
        crm_id,
        created_at: serverTimestamp(),
      });

      setForm(emptyForm);
      setOpenAddModal(false);
      fetchLeads();
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء إضافة العميل المحتمل");
    } finally {
      setSaving(false);
    }
  };

  // 🔹 Open edit modal with existing lead data
  const handleOpenEdit = (lead) => {
    setSelectedLead(lead);
    setForm({ ...emptyForm, ...lead });
    setOpenEditModal(true);
  };

  // 🔹 Save edits (pipeline stage/dates/status)
  const handleSaveEdit = async () => {
    if (!selectedLead) return;

    try {
      setSaving(true);

      const { id, crm_id, created_at, ...rest } = form;

      await updateDoc(doc(DB, "crm_leads", selectedLead.id), rest);

      setOpenEditModal(false);
      setSelectedLead(null);
      fetchLeads();
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء تحديث بيانات العميل");
    } finally {
      setSaving(false);
    }
  };

  // 🔹 Delete a lead
  const handleDeleteLead = async (lead) => {
    if (!confirm(`هل تريد حذف "${lead.institution_name}" من CRM؟`)) return;

    try {
      await deleteDoc(doc(DB, "crm_leads", lead.id));
      fetchLeads();
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  // 🔹 Export the currently filtered leads to a professionally styled Excel file
  const handleExportExcel = async () => {
    const GOLD = "FFD4AF37";
    const DARK_GOLD = "FFB8860B";
    const CREAM = "FFFDF6E3";

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Safe Student - CRM";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("CRM Leads", {
      views: [{ rightToLeft: true }],
    });

    const columns = [
      { header: "CRM ID", key: "crm_id", width: 14 },
      { header: "تاريخ التسجيل", key: "lead_date", width: 14 },
      { header: "مصدر العميل", key: "lead_source", width: 16 },
      { header: "المسوق المسؤول", key: "assigned_marketer", width: 18 },
      { header: "المحافظة", key: "province", width: 14 },
      { header: "اسم المؤسسة", key: "institution_name", width: 26 },
      { header: "النوع", key: "type", width: 14 },
      { header: "الشخص المسؤول", key: "contact_person", width: 18 },
      { header: "المنصب", key: "position", width: 16 },
      { header: "الهاتف", key: "phone", width: 16 },
      { header: "البريد الإلكتروني", key: "email", width: 22 },
      { header: "عدد الطلاب", key: "student_count", width: 12 },
      { header: "المرحلة", key: "lead_status", width: 16 },
      { header: "تاريخ التأهيل", key: "qualified_date", width: 14 },
      { header: "تاريخ الاجتماع", key: "meeting_date", width: 14 },
      { header: "تاريخ إرسال العرض", key: "proposal_sent", width: 16 },
      { header: "تاريخ توقيع العقد", key: "contract_signed", width: 16 },
      { header: "تاريخ أول دفعة", key: "first_payment", width: 14 },
      { header: "تاريخ التشغيل", key: "activation_date", width: 14 },
      { header: "الصفقة", key: "closed_deal", width: 14 },
      { header: "استحقاق العمولة", key: "commission_eligible", width: 16 },
      { header: "ملاحظات", key: "notes", width: 30 },
    ];

    sheet.columns = columns;

    filteredLeads.forEach((lead) => {
      const closed = isClosedDeal(lead);
      sheet.addRow({
        ...lead,
        lead_status: LEAD_STATUS_LABELS[lead.lead_status] || lead.lead_status,
        closed_deal: closed ? "مكتملة" : "جارية",
        commission_eligible: closed ? "مستحق" : "غير مستحق",
      });
    });

    // Header row styling (gold, bold, white text)
    const headerRow = sheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: DARK_GOLD } },
        bottom: { style: "thin", color: { argb: DARK_GOLD } },
        left: { style: "thin", color: { argb: DARK_GOLD } },
        right: { style: "thin", color: { argb: DARK_GOLD } },
      };
    });

    // Body rows styling (alternating cream / white, gold borders)
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const isEven = rowNumber % 2 === 0;
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? CREAM : "FFFFFFFF" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5D9B0" } },
          bottom: { style: "thin", color: { argb: "FFE5D9B0" } },
          left: { style: "thin", color: { argb: "FFE5D9B0" } },
          right: { style: "thin", color: { argb: "FFE5D9B0" } },
        };
      });
    });

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
    sheet.views = [{ state: "frozen", ySplit: 1, rightToLeft: true }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const fileName = `CRM_Leads_${new Date().toISOString().split("T")[0]}.xlsx`;
    saveAs(blob, fileName);
  };

  if (loading) {
    return (
      <div className="loader">
        <ClipLoader size={40} color="#3b82f6" />
      </div>
    );
  }

  return (
    <div className="main-container">
      <h2 className="main-title">CRM - إدارة العملاء المحتملين</h2>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <p>إجمالي العملاء المحتملين</p>
            <h3>{stats.total}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <p>صفقات مغلقة</p>
            <h3>{stats.closed}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <p>قيد التفاوض</p>
            <h3>{stats.inNegotiation}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <p>إجمالي عدد الطلاب المقدَّر</p>
            <h3>{stats.totalStudents}</h3>
          </div>
        </div>
      </div>

      {/* Section */}
      <div className="section">
        <div className="section-header">
          <h3>قائمة العملاء المحتملين</h3>
          <div style={{ display: "flex", gap: 10 }}>
            <div
              className="create-btn"
              style={{
                height: "25px",
                background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onClick={handleExportExcel}
            >
              <p>⬇ تصدير Excel</p>
            </div>
            <div
              className="create-btn"
              style={{ height: "25px" }}
              onClick={() => {
                setForm(emptyForm);
                setManualCity(false);
                setOpenAddModal(true);
              }}
            >
              <p>+ إضافة عميل محتمل</p>
            </div>
          </div>
        </div>

        {/* Status filter */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {["الكل", ...LEAD_STATUSES].map((s) => (
            <div
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                fontSize: 13,
                cursor: "pointer",
                border: "1px solid #e5e7eb",
                background: statusFilter === s ? "#111827" : "#fff",
                color: statusFilter === s ? "#fff" : "#111827",
              }}
            >
              {s === "الكل" ? s : LEAD_STATUS_LABELS[s]}
            </div>
          ))}
        </div>

        <div className="school-details-table">
          <div className="school-details-table-header">
            <span>CRM ID</span>
            <span>المؤسسة</span>
            <span>المسوق</span>
            <span>المرحلة</span>
            <span>الهاتف</span>
            <span>الصفقة</span>
            <span>حذف</span>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="empty">لا يوجد عملاء محتملون</div>
          ) : (
            filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className="school-details-table-row"
                style={{ cursor: "pointer" }}
                onClick={() => handleOpenEdit(lead)}
              >
                <span>{lead.crm_id}</span>
                <span>{lead.institution_name}</span>
                <span>{lead.assigned_marketer}</span>
                <span>{LEAD_STATUS_LABELS[lead.lead_status] || lead.lead_status}</span>
                <span className="phone-number">{lead.phone}</span>
                <span>
                  {isClosedDeal(lead) ? (
                    <span style={{ color: "#15803d", fontWeight: "bold" }}>مكتملة ✅</span>
                  ) : (
                    <span style={{ color: "#b45309" }}>جارية</span>
                  )}
                </span>
                <span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLead(lead);
                    }}
                    style={{
                      background: "#fee2e2",
                      color: "#b91c1c",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: "bold",
                    }}
                  >
                    حذف
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Lead Modal */}
      <Modal
        title="إضافة عميل محتمل جديد"
        open={openAddModal}
        onCancel={() => setOpenAddModal(false)}
        footer={null}
        centered
        width={600}
      >
        <div className="create-school-form">
          <input
            placeholder="اسم المؤسسة التعليمية"
            value={form.institution_name}
            onChange={(e) => setForm({ ...form, institution_name: e.target.value })}
          />
          <input
            placeholder="اسم المسوق المسؤول"
            value={form.assigned_marketer}
            onChange={(e) => setForm({ ...form, assigned_marketer: e.target.value })}
          />
          <select
            value={form.province}
            onChange={(e) => {
              const newProvince = e.target.value;
              setManualCity(false);
              setForm({
                ...form,
                province: newProvince,
                city: IRAQ_CITIES_BY_PROVINCE[newProvince]?.[0] || "",
              });
            }}
          >
            {IRAQ_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {manualCity ? (
            <input
              placeholder="اكتب اسم المدينة يدويًا"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          ) : (
            <select
              value={form.city}
              onChange={(e) => {
                if (e.target.value === OTHER_CITY_OPTION) {
                  setManualCity(true);
                  setForm({ ...form, city: "" });
                } else {
                  setForm({ ...form, city: e.target.value });
                }
              }}
            >
              {(IRAQ_CITIES_BY_PROVINCE[form.province] || []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={OTHER_CITY_OPTION}>{OTHER_CITY_OPTION}</option>
            </select>
          )}

          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {INSTITUTION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={form.lead_source}
            onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
          >
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            placeholder="اسم الشخص المسؤول (جهة الاتصال)"
            value={form.contact_person}
            onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
          />
          <input
            placeholder="المسمى الوظيفي (مدير، مالك...)"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          />
          <input
            placeholder="رقم الهاتف"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            placeholder="البريد الإلكتروني"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            placeholder="العدد التقريبي للطلاب"
            type="number"
            value={form.student_count}
            onChange={(e) => setForm({ ...form, student_count: e.target.value })}
          />
          <textarea
            placeholder="ملاحظات"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {saving ? (
            <div className="btn-loading">
              <ClipLoader size={15} color="#fff" />
            </div>
          ) : (
            <button className="create-submit" onClick={handleAddLead}>
              إضافة
            </button>
          )}
        </div>
      </Modal>

      {/* Edit Lead Modal - full pipeline management */}
      <Modal
        title={`تحديث بيانات العميل - ${selectedLead?.crm_id || ""}`}
        open={openEditModal}
        onCancel={() => setOpenEditModal(false)}
        footer={null}
        centered
        width={650}
      >
        <div className="create-school-form">
          <label style={labelStyle}>مرحلة العميل</label>
          <select
            value={form.lead_status}
            onChange={(e) => setForm({ ...form, lead_status: e.target.value })}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
            ))}
          </select>

          <label style={labelStyle}>تاريخ التأهيل (Qualified Date)</label>
          <input
            type="date"
            value={form.qualified_date}
            onChange={(e) => setForm({ ...form, qualified_date: e.target.value })}
          />

          <label style={labelStyle}>تاريخ الاجتماع (Meeting Date)</label>
          <input
            type="date"
            value={form.meeting_date}
            onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
          />

          <label style={labelStyle}>تاريخ إرسال العرض (Proposal Sent)</label>
          <input
            type="date"
            value={form.proposal_sent}
            onChange={(e) => setForm({ ...form, proposal_sent: e.target.value })}
          />

          <label style={labelStyle}>تاريخ توقيع العقد (Contract Signed)</label>
          <input
            type="date"
            value={form.contract_signed}
            onChange={(e) => setForm({ ...form, contract_signed: e.target.value })}
          />

          <label style={labelStyle}>تاريخ أول دفعة (First Payment)</label>
          <input
            type="date"
            value={form.first_payment}
            onChange={(e) => setForm({ ...form, first_payment: e.target.value })}
          />

          <label style={labelStyle}>تاريخ التشغيل الفعلي (Activation Date)</label>
          <input
            type="date"
            value={form.activation_date}
            onChange={(e) => setForm({ ...form, activation_date: e.target.value })}
          />

          <div
            style={{
              padding: "10px",
              borderRadius: 8,
              background: isClosedDeal(form) ? "#e5f8ec" : "#fff7e6",
              color: isClosedDeal(form) ? "#15803d" : "#b45309",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            {isClosedDeal(form)
              ? "✅ الصفقة مكتملة (Closed Deal) — المسوق مستحق للعمولة"
              : "⏳ الصفقة لم تكتمل بعد (يلزم توقيع العقد + أول دفعة + تاريخ تشغيل)"}
          </div>

          <label style={labelStyle}>ملاحظات</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {saving ? (
            <div className="btn-loading">
              <ClipLoader size={15} color="#fff" />
            </div>
          ) : (
            <button className="create-submit" onClick={handleSaveEdit}>
              حفظ التحديثات
            </button>
          )}

          <button
            style={{
              marginTop: 8,
              background: "#fee2e2",
              color: "#b91c1c",
              border: "none",
              borderRadius: 8,
              padding: "10px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
            onClick={() => {
              setOpenEditModal(false);
              handleDeleteLead(selectedLead);
            }}
          >
            حذف هذا العميل
          </button>
        </div>
      </Modal>
    </div>
  );
};

const labelStyle = {
  fontSize: 13,
  color: "#6b7280",
  marginTop: 4,
};

export default Crm;
