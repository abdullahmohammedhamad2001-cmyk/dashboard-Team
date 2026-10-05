"use client";

import React, { useState, useMemo } from "react";
import { supabase, storageName, adminAccounts, imageError } from "../supabaseClient";
import { useGlobalState } from "../globalState";
import { useRouter } from "next/navigation";
import ClipLoader from "react-spinners/ClipLoader";
import { Modal } from "antd";
import '../app/style.css';

const Drivers = () => {
  const { drivers, loading, refresh } = useGlobalState();
  const router = useRouter();

  const [nameFilter, setNameFilter] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [driverPhoneNumber, setDriverPhoneNumber] = useState("");
  const [driverCarType, setDriverCarType] = useState("");
  const [driverCarPlate, setDriverCarPlate] = useState("");
  const [driverCarSeats, setDriverCarSeats] = useState("");
  const [driverPersonalImageFile, setDriverPersonalImageFile] = useState(null);
  const [driverCarImageFile, setDriverCarImageFile] = useState(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [newDriverCredentials, setNewDriverCredentials] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) =>
      !nameFilter || d.name?.includes(nameFilter)
    );
  }, [drivers, nameFilter]);

  const openCreateModal = () => setOpenModal(true);

  const closeCreateModal = () => {
    setOpenModal(false);
    setDriverName("");
  };

  // Normalize Iraqi phone
  const normalizePhone = (phone) => {
    let cleaned = phone.replace(/\D/g, "");

    if (cleaned.startsWith("07")) {
      cleaned = cleaned.slice(1);
    }

    if (!cleaned.startsWith("7") || cleaned.length !== 10) {
      return null;
    }

    return cleaned;
  };

  // Passwords are no longer stored in readable form; this issues a new one
  const handleResetPassword = async (driver) => {
    if (!confirm(`هل تريد إنشاء كلمة مرور جديدة للسائق "${driver.name}"؟`)) return;

    try {
      setDeletingId(driver.id);

      const result = await adminAccounts({
        action: "reset_password",
        profileId: driver.profile_id,
      });

      setNewDriverCredentials({ username: result.username, password: result.password });
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء تغيير كلمة المرور");
    } finally {
      setDeletingId(null);
    }
  };

  // Create driver
  const handleCreateDriver = async () => {
    if (!driverName ||!driverPhoneNumber ||!driverCarType ||!driverCarPlate ||!driverCarSeats ||!driverPersonalImageFile ||!driverCarImageFile) {
      alert("يرجى ملء جميع الحقول");
      return;
    }

    if (Number(driverCarSeats) <= 0) {
      alert("عدد المقاعد يجب أن يكون أكبر من 0");
      return;
    }

    const imageProblem = imageError(driverPersonalImageFile) || imageError(driverCarImageFile);
    if (imageProblem) {
      alert(imageProblem);
      return;
    }

    // ✅ Normalize phone
    const normalizedPhone = normalizePhone(driverPhoneNumber);

    if (!normalizedPhone) {
      alert("رقم الهاتف غير صالح (يجب أن يبدأ بـ 7 ويكون 10 أرقام)");
      return;
    }

    let uploadedPaths = [];

    try {
      setLoadingCreate(true);

      if (drivers.some((d) => d.id === normalizedPhone)) {
        alert("رقم الهاتف مستخدم بالفعل");
        return;
      }

      const media = supabase.storage.from("driver-media");

      const upload = async (prefix, file) => {
        const path = `${normalizedPhone}/${prefix}_${storageName(file)}`;
        const { error } = await media.upload(path, file, { contentType: file.type });
        if (error) throw error;
        uploadedPaths.push(path);
        return path;
      };

      const personalPath = await upload("personal", driverPersonalImageFile);
      const carPath = await upload("car", driverCarImageFile);

      const result = await adminAccounts({
        action: "create_driver",
        name: driverName.trim(),
        phone: normalizedPhone,
        car_type: driverCarType,
        car_plate: driverCarPlate.trim(),
        car_seats: Number(driverCarSeats),
        personal_image_path: personalPath,
        car_image_path: carPath,
      });

      alert("تم إنشاء السائق بنجاح ✅");

      // Show login credentials to the admin (the password cannot be read again later)
      setNewDriverCredentials({ username: result.username, password: result.password });

      closeCreateModal();
      setDriverName("");
      setDriverPhoneNumber("");
      setDriverCarType("");
      setDriverCarPlate("");
      setDriverCarSeats("");
      setDriverPersonalImageFile(null);
      setDriverCarImageFile(null);

      await refresh();
    } catch (error) {
      console.error(error);

      // Do not leave orphaned images behind
      if (uploadedPaths.length) {
        await supabase.storage.from("driver-media").remove(uploadedPaths);
      }

      alert(
        error.message === "phone_in_use" || error.message === "login_in_use"
          ? "رقم الهاتف مستخدم بالفعل"
          : "حدث خطأ أثناء إنشاء السائق"
      );
    } finally {
      setLoadingCreate(false);
    }
  };

  // Delete driver, its login account and images (done server-side)
  const handleDeleteDriver = async (driver) => {
    if (!confirm(`هل تريد حذف السائق "${driver.name}" نهائياً؟ سيتم حذف جميع بياناته وإخراجه من التطبيق`)) return;

    try {
      setDeletingId(driver.id);

      await adminAccounts({ action: "delete_driver", driverId: driver.id });

      alert("تم حذف السائق بنجاح ✅");
      await refresh();
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حذف السائق");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="drivers-container">

      <div className="schools-header">
        <h2>السواق</h2>

        <div className="create-btn" onClick={openCreateModal}>
          <p>+ إنشاء حساب سائق</p>
        </div>
      </div>

      <Modal
        title="إنشاء حساب سائق"
        open={openModal}
        onCancel={closeCreateModal}
        footer={null}
        centered
      >
        <div className="create-school-form">
          <input
            placeholder="الاسم"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
          />

          <input
            placeholder="رقم الهاتف"
            value={driverPhoneNumber}
            onChange={(e) => setDriverPhoneNumber(e.target.value)}
          />

          <div className="driver-image-input">
            <p>صورة السائق</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files[0]) {
                  setDriverPersonalImageFile(e.target.files[0]);
                }
              }}
            />
          </div>

          <select
            value={driverCarType}
            onChange={(e) => setDriverCarType(e.target.value)}
          >
            <option value="">نوع السيارة</option>
            <option value="صالون">صالون</option>
            <option value="ميني باص ١٢ راكب">ميني باص ١٢ راكب</option>
            <option value="ميني باص ١٨ راكب">ميني باص ١٨ راكب</option>
            <option value="٧ راكب (جي ام سي / تاهو)">٧ راكب (جي ام سي / تاهو)</option>
          </select>

          <input
            placeholder="لوحة السيارة"
            value={driverCarPlate}
            onChange={(e) => setDriverCarPlate(e.target.value)}
          />

          <input
            type="number"
            placeholder="عدد المقاعد"
            value={driverCarSeats}
            onChange={(e) => setDriverCarSeats(e.target.value)}
          />
          <div className="driver-image-input">
            <p>صورة السيارة</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files[0]) {
                  setDriverCarImageFile(e.target.files[0]);
                }
              }}
            />
          </div>
      
          {loadingCreate ? (
            <div className="btn-loading">
              <ClipLoader size={15} color="#fff" />
            </div>
          ) : (
            <button className="create-submit" onClick={handleCreateDriver}>
             إنشاء
            </button>
          )}
      
        </div>
      </Modal>

      {/* Credentials Modal */}
      <Modal
        title="بيانات دخول السائق"
        open={!!newDriverCredentials}
        onCancel={() => setNewDriverCredentials(null)}
        footer={null}
        centered
      >
        <div className="driver-credentials">
          <p>رقم الدخول: <strong>{newDriverCredentials?.username}</strong></p>
          <p>كلمة المرور: <strong>{newDriverCredentials?.password}</strong></p>
        </div>
      </Modal>

      {/* Filter */}
      <div className="drivers-filters">
        <input
          placeholder="البحث باسم السائق..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="drivers-table">

        <div className="drivers-table-header">
          <span>الاسم</span>
          <span>الهاتف</span>
          <span>نوع السيارة</span>
          <span>عدد الخطوط</span>
          <span>إجراءات</span>
        </div>

        {loading ? (
          <div className="loader">
            <ClipLoader size={30} color="#8a6115" />
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="empty">لا يوجد سواق</div>
        ) : (
          filteredDrivers.map((driver) => (
            <div 
              key={driver.id} 
              className="drivers-table-row"
              onClick={() => router.push(`/drivers/${driver.id}`)}
            >

              <span>
                {driver.name}
              </span>

              <span className="phone-number">
                {driver.phone_number || "-"}
              </span>

              <span>
                {driver.car_type || "-"}
              </span>

              <span>
                {driver.lines?.length || 0}
              </span>

              <span style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" }}>
                <button
                  className="create-btn"
                  style={{ height: "26px", padding: "0 10px", whiteSpace: "nowrap" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetPassword(driver);
                  }}
                  disabled={deletingId === driver.id}
                >
                  كلمة مرور جديدة
                </button>
                <button
                  className="delete-btn small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDriver(driver);
                  }}
                  disabled={deletingId === driver.id}
                >
                  {deletingId === driver.id ? (
                    <ClipLoader size={12} color="#fff" />
                  ) : (
                    "حذف"
                  )}
                </button>
              </span>

            </div>
          ))
        )}

      </div>
    </div>
  );
};

export default Drivers;