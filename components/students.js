"use client";

import React, { useState, useMemo } from "react";
import { useGlobalState } from "../globalState";
import ClipLoader from "react-spinners/ClipLoader";
import '../app/style.css'

const Students = () => {
  const { students, schools, loading } = useGlobalState();

  const [nameFilter, setNameFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");

  // Map school id → name
  const schoolMap = useMemo(() => {
    const map = {};
    schools.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [schools]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (nameFilter && !s.name?.includes(nameFilter)) return false;
      if (schoolFilter !== "all" && s.school_id !== schoolFilter) return false;

      if (driverFilter === "yes" && !s.linked_parent) return false;
      if (driverFilter === "no" && s.linked_parent) return false;

      return true;
    });
  }, [students, nameFilter, schoolFilter, driverFilter]);

  return (
    <div className="students-container">

      <h2 className="students-title">الطلاب</h2>

      {/* Filters */}
      <div className="students-filters">
        <input
          placeholder="البحث بالاسم..."
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
          <option value="all">ولي الأمر</option>
          <option value="yes">نعم</option>
          <option value="no">لا</option>
        </select>
      </div>

      {/* Table */}
      <div className="students-table">
        <div className="table-header students-table-grid">
          <span>الصورة</span>
          <span>الاسم</span>
          <span>المدرسة</span>
          <span>الهاتف</span>
          <span>ولي الأمر</span>
        </div>

        {loading ? (
          <div className="loader">
            <ClipLoader size={30} color="#8a6115" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="empty">لا يوجد طلاب</div>
        ) : (
          filteredStudents.map((student) => (
            <div key={student.id} className="table-row students-table-grid">
              <span className="student-row-photo">
                {student.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={student.photo_url} alt={student.name || "صورة الطالب"} />
                ) : (
                  <div className="student-row-photo-placeholder">
                    {student.name?.trim()?.charAt(0) || "?"}
                  </div>
                )}
              </span>
              <span>{student.name} {student.parent_name}</span>
              <span>{schoolMap[student.school_id] || "-"}</span>
              <span className="phone-number">{student.phone_number || "-"}</span>
              <span className={student.linked_parent ? "status yes" : "status no"}>
                {student.linked_parent ? "نعم" : "لا"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Students;