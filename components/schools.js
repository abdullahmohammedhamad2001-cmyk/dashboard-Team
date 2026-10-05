"use client";

import React, { useMemo, useState } from "react";
import { useGlobalState } from "../globalState";
import { supabase, storageName, imageError } from "../supabaseClient";
import { useRouter } from "next/navigation";
import ClipLoader from "react-spinners/ClipLoader";
import { Modal } from "antd";
import '../app/style.css';

const Schools = () => {
  const { schools, students, teachers, employees, loading, refresh } = useGlobalState();
  const router = useRouter();

  const [nameFilter, setNameFilter] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [country, setCountry] = useState("iraq");
  const [schoolLogoFile, setSchoolLogoFile] = useState(null);
  const [loadingCreate, setLoadingCreate] = useState(false);

  // ✅ Compute counts
  const enrichedSchools = useMemo(() => {
    return schools.map((school) => {
      return {
        ...school,
        studentsCount: students.filter(s => s.school_id === school.id).length,
        teachersCount: teachers.filter(t => t.school_id === school.id).length,
        employeesCount: employees.filter(e => e.school_id === school.id).length,
      };
    });
  }, [schools, students, teachers, employees]);

  const filtered = enrichedSchools.filter((s) =>
    s.name?.includes(nameFilter)
  );

  const openCreateModal = () => setOpenModal(true);

  const closeCreateModal = () => {
    setOpenModal(false);
    setSchoolName("");
    setLocationInput("");
    setCountry("iraq");
    setSchoolLogoFile(null);
  };

  //Create new school doc
  const handleCreateSchool = async () => {
    if (!schoolName) {
      alert("يرجى إدخال اسم المدرسة");
      return;
    }

    if (!locationInput) {
      alert("يرجى إدخال الموقع");
      return;
    }

    // ✅ Parse location
    const parts = locationInput.split(",");

    if (parts.length !== 2) {
      alert("صيغة الموقع غير صحيحة (lat,lng)");
      return;
    }

    const latitude = parseFloat(parts[0].trim());
    const longitude = parseFloat(parts[1].trim());

    if (isNaN(latitude) || isNaN(longitude)) {
      alert("الموقع غير صالح");
      return;
    }

    try {
      setLoadingCreate(true);

      let logoPath = null;

      // Upload logo
      if (schoolLogoFile) {
        logoPath = storageName(schoolLogoFile);

        const { error: uploadError } = await supabase.storage
          .from("school-logos")
          .upload(logoPath, schoolLogoFile, { contentType: schoolLogoFile.type });

        if (uploadError) throw uploadError;
      }

      const { error } = await supabase.from("schools").insert({
        id: crypto.randomUUID(),
        name: schoolName.trim(),
        location_lat: latitude,
        location_lng: longitude,
        country,
        logo_path: logoPath,
      });

      if (error) throw error;

      await refresh();

      alert("تم إنشاء المدرسة بنجاح ✅");

      closeCreateModal();

    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء إنشاء المدرسة");
    } finally {
      setLoadingCreate(false);
    }
  };

  return (
    <div className="schools-container">

      <div className="schools-header">
        <h2>المدارس</h2>
        <div className="create-btn" onClick={openCreateModal}>
          <p>+ إنشاء مدرسة</p>
        </div>
      </div>

      <Modal
        title="إنشاء مدرسة جديدة"
        open={openModal}
        onCancel={closeCreateModal}
        footer={null}
        centered
      >
        <div className="create-school-form">
          <input
            placeholder="اسم المدرسة"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
          />
          <input
            placeholder="الموقع (lat,lng)"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="iraq">العراق</option>
            <option value="tunisia">تونس</option>
          </select>

          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;

              const invalid = imageError(file);
              if (invalid) {
                alert(invalid);
                e.target.value = "";
                return;
              }

              setSchoolLogoFile(file);
            }}
          />

          {loadingCreate ? (
            <div className="btn-loading">
              <ClipLoader size={15} color="#fff" />
            </div>
          ) : (
            <button className="create-submit" onClick={handleCreateSchool}>
             إنشاء
            </button>
          )}

        </div>
      </Modal>

      {/* Filter */}
      <div style={{direction:'rtl'}}>
      <input
        className="school-search"
        placeholder="البحث باسم المدرسة..."
        value={nameFilter}
        onChange={(e) => setNameFilter(e.target.value)}
      />
      </div>

      {/* Table */}
      <div className="schools-table">

        <div className="table-header school-table-header">
          <span>الصورة</span>
          <span>المدرسة</span>
          <span>الطلاب</span>
          <span>الموظفين</span>
          <span>المعلمين</span>
        </div>

        {loading ? (
          <div className="loader">
            <ClipLoader size={30} />
          </div>
        ) : (
          filtered.map((school) => (
            <div 
              key={school.id} 
              className="table-row school-table-row"
              onClick={() => router.push(`/schools/${school.id}`)}
            >
              <span className="school-row-logo">
                {school.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={school.logo_url} alt={school.name || "شعار المدرسة"} />
                ) : (
                  <div className="school-row-logo-placeholder">
                    {school.name?.trim()?.charAt(0) || "?"}
                  </div>
                )}
              </span>
              <span className="school-name">{school.name}</span>
              <span>{school.studentsCount}</span>
              <span>{school.employeesCount}</span>
              <span>{school.teachersCount}</span>
            </div>
          ))
        )}

      </div>
    </div>
  );
};

export default Schools;