"use client";

import React, { useState, useMemo } from "react";
import { query, collection, orderBy, limit, getDocs,addDoc } from "firebase/firestore";
import { DB } from "../firebaseConfig";
import { useGlobalState } from "../globalState";
import ClipLoader from "react-spinners/ClipLoader";
import { useRouter } from "next/navigation";
import { Modal } from "antd";
import "../app/style.css";

const Lines = () => {
  const { lines, schools, drivers, loading } = useGlobalState();
  const router = useRouter();

  const [nameFilter, setNameFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [openModal, setOpenModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [newLineName, setNewLineName] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);

  const driverById = useMemo(
    () => new Map((drivers || []).map((d) => [d.id, d])),
    [drivers]
  );

  const schoolById = useMemo(
    () => new Map((schools || []).map((s) => [s.id, s])),
    [schools]
  );

  // ✅ Filter + Sort
  const filteredLines = useMemo(() => {
  const term = nameFilter.trim();

  const filtered = lines.filter((line) => {
    if (term) {
      const driverName = driverById.get(line.driver_id)?.name || "";
      const matches =
        line.line_number?.includes(term) ||
        line.line_name?.includes(term) ||
        line.destination?.includes(term) ||
        driverName.includes(term);
      if (!matches) return false;
    }
    if (schoolFilter !== "all" && line.school_id !== schoolFilter) return false;

    if (driverFilter === "yes" && !line.driver_id) return false;
    if (driverFilter === "no" && line.driver_id) return false;

    return true;
  });

  // ✅ SORT BY LINE NUMBER
  return filtered.sort((a, b) => {
    const numA = parseInt(a.line_number?.replace("L", "")) || 0;
    const numB = parseInt(b.line_number?.replace("L", "")) || 0;
    return numA - numB;
  });
}, [lines, nameFilter, schoolFilter, driverFilter, driverById]);

  const linesWithDriver = useMemo(
    () => lines.filter((l) => l.driver_id).length,
    [lines]
  );

  const openCreateModal = () => setOpenModal(true);

  const closeCreateModal = () => {
    setOpenModal(false);
  };

  //Get next line number
  const getNextLineNumber = async () => {
    const q = query(
      collection(DB, "lines"),
      orderBy("line_number", "desc"),
      limit(1)
    );

    const snap = await getDocs(q);

    if (snap.empty) return "L001";

    const last = snap.docs[0].data().line_number;
    const number = parseInt(last.replace("L", ""));

    const next = number + 1;

    return `L${String(next).padStart(3, "0")}`;
  };

  //Create new line
  const handleCreateLine = async () => {
    if (!selectedSchool) {
      alert("يرجى اختيار المدرسة");
      return;
    }

    try {
      setLoadingCreate(true);

      // ✅ Find selected school
      const school = schools.find((s) => s.id === selectedSchool);

      if (!school) {
        alert("خطأ في اختيار المدرسة");
        return;
      }

      const formattedNumber = await getNextLineNumber();

      // A school may own any number of lines, each with its own driver
      const schoolLinesCount = lines.filter((l) => l.school_id === school.id).length;

      // ✅ Create doc
      await addDoc(collection(DB, "lines"), {
        line_number: formattedNumber,
        line_name: newLineName.trim() || `خط ${schoolLinesCount + 1}`,
        destination: school.name,
        destination_location: school.location || null,
        school_id: school.id,
        driver_id: null,
        driver_name: null,
        car_type: null,
        riders: [],
        created_at: new Date(),
      });

      alert(`تم إنشاء الخط ${formattedNumber} ✅`);

      // reset
      setSelectedSchool("");
      setNewLineName("");
      closeCreateModal();

    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء إنشاء الخط");
    } finally {
      setLoadingCreate(false);
    }
  };

  return (
    <div className="lines-container">
      <div className="schools-header">
        <h2>الخطوط</h2>

        <div className="create-btn" onClick={openCreateModal}>
          <p>+ إنشاء خط جديد</p>
        </div>
      </div>

      <Modal
        title="إنشاء خط جديد"
        open={openModal}
        onCancel={closeCreateModal}
        footer={null}
        centered
      >
        <div className="create-school-form">
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
          >
            <option value="">اختر المدرسة</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {" "}
                ({lines.filter((l) => l.school_id === s.id).length} خط)
              </option>
            ))}
          </select>

          <input
            placeholder="اسم الخط (مثال: الخط الشمالي) - اختياري"
            value={newLineName}
            onChange={(e) => setNewLineName(e.target.value)}
          />

          <p className="modal-hint">
            يمكن للمدرسة الواحدة امتلاك عدد غير محدود من الخطوط، ولكل خط سائق خاص به.
          </p>

          {loadingCreate ? (
            <div className="btn-loading">
              <ClipLoader size={15} color="#fff" />
            </div>
          ) : (
            <button className="create-submit" onClick={handleCreateLine}>
             إنشاء
            </button>
          )}
        </div>
      </Modal>

      <div className="lines-summary">
        <span>إجمالي الخطوط: <strong>{lines.length}</strong></span>
        <span>لها سائق: <strong>{linesWithDriver}</strong></span>
        <span>بلا سائق: <strong>{lines.length - linesWithDriver}</strong></span>
      </div>

      {/* Filter */}
      <div className="lines-filters">
        <input
          placeholder="البحث برقم الخط أو المدرسة أو السائق..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
        />
        <select
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
        >
          <option value="all">كل المدارس</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
        >
          <option value="all">السائق</option>
          <option value="yes">نعم</option>
          <option value="no">لا</option>
        </select>
      </div>

      {/* Table */}
      <div className="lines-table">

        <div className="lines-table-header">
          <span>رقم الخط</span>
          <span>الوجهة</span>
          <span>السائق</span>
          <span>عدد الطلاب</span>
          <span>الحالة</span>
        </div>

        {loading ? (
          <div className="loader">
            <ClipLoader size={30} color="#8a6115" />
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="empty">لا يوجد خطوط</div>
        ) : (
          filteredLines.map((line) => {
            const lineDriver = driverById.get(line.driver_id);
            const school = schoolById.get(line.school_id);

            return (
              <div
                key={line.id}
                className="lines-table-row"
                onClick={() => router.push(`/lines/${line.id}`)}
              >
                <span className="line-number-cell">{line.line_number}</span>

                <span className="line-destination-cell">
                  <strong>{school?.name || line.destination || "-"}</strong>
                  <small>{line.line_name || line.destination}</small>
                </span>

                <span>
                  {lineDriver ? (
                    <span className="driver-chip">
                      {lineDriver.personal_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={lineDriver.personal_image} alt={lineDriver.name} />
                      ) : (
                        <span className="driver-avatar-placeholder small">
                          {lineDriver.name?.trim()?.charAt(0) || "؟"}
                        </span>
                      )}
                      <span className="driver-chip-text">
                        <strong>{lineDriver.name}</strong>
                        <small>{lineDriver.car_type || lineDriver.phone_number}</small>
                      </span>
                    </span>
                  ) : (
                    <span className="no-driver-text">بدون سائق</span>
                  )}
                </span>

                <span>{line.riders?.length || 0}</span>

                <span>
                  {line.driver_id ? (
                    <span className="assigned-badge">نشط</span>
                  ) : (
                    <span className="pending-badge">بانتظار سائق</span>
                  )}
                </span>
              </div>
            );
          })
        )}

      </div>
    </div>
  );
};

export default Lines;