"use client";

import React, { useState, useMemo } from "react";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { DB } from "../firebaseConfig";
import { useGlobalState } from "../globalState";
import { useRouter } from "next/navigation";
import ClipLoader from "react-spinners/ClipLoader";
import { Modal } from "antd";
import '../app/style.css';

const Drivers = () => {
  const { drivers, loading } = useGlobalState();
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
      !nameFilter || d.full_name?.includes(nameFilter)
    );
  }, [drivers, nameFilter]);

  const openCreateModal = () => setOpenModal(true);

  const closeCreateModal = () => {
    setOpenModal(false);
    setDriverName("");
  };

  // 🔐 Generate password
  const generatePassword = (length = 8) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
  };

  // 📱 Normalize Iraqi phone
  const normalizePhone = (phone) => {
    let cleaned = phone.replace(/\D/g, ""); // remove non-numbers

    if (cleaned.startsWith("07")) {
      cleaned = cleaned.slice(1); // remove leading 0 → 7XXXXXXXXX
    }

    if (!cleaned.startsWith("7")) {
      return null;
    }

    if (cleaned.length !== 10) {
      return null;
    }

    return cleaned;
  };

  // 🚀 Create driver
  const handleCreateDriver = async () => {
    if (!driverName ||!driverPhoneNumber ||!driverCarType ||!driverCarPlate ||!driverCarSeats ||!driverPersonalImageFile ||!driverCarImageFile) {
      alert("يرجى ملء جميع الحقول");
      return;
    }

    if (Number(driverCarSeats) <= 0) {
      alert("عدد المقاعد يجب أن يكون أكبر من 0");
      return;
    }

    // ✅ Normalize phone
    const normalizedPhone = normalizePhone(driverPhoneNumber);

    if (!normalizedPhone) {
      alert("رقم الهاتف غير صالح (يجب أن يبدأ بـ 7 ويكون 10 أرقام)");
      return;
    }

    try {
      setLoadingCreate(true);

      // ✅ Check uniqueness (doc id)
      const driverRef = doc(DB, "drivers", normalizedPhone);
      const existingDoc = await getDoc(driverRef);

      if (existingDoc.exists()) {
        alert("رقم الهاتف مستخدم بالفعل");
        return;
      }

      const password = generatePassword();

      const storage = getStorage();

      // ✅ Upload personal image
      const personalRef = ref(
        storage,
        `drivers/personal_${Date.now()}_${driverPersonalImageFile.name}`
      );
      await uploadBytes(personalRef, driverPersonalImageFile);
      const personalURL = await getDownloadURL(personalRef);

      // ✅ Upload car image
      const carRef = ref(
        storage,
        `drivers/car_${Date.now()}_${driverCarImageFile.name}`
      );
      await uploadBytes(carRef, driverCarImageFile);
      const carURL = await getDownloadURL(carRef);

      // ✅ Default Baghdad location
      const defaultLocation = {
        latitude: 33.3152,
        longitude: 44.3661,
      };

      // ✅ Create driver with phone as ID
      await setDoc(driverRef, {
        name: driverName,
        phone_number: normalizedPhone,
        username: normalizedPhone,
        password,
        personal_image: personalURL,
        car_type: driverCarType,
        car_plate: driverCarPlate,
        car_seats: Number(driverCarSeats),
        car_image: carURL,
        lines: [],
        location: defaultLocation,
        is_active: true,
        created_at: new Date(),
      });

      alert("تم إنشاء السائق بنجاح ✅");

      // ✅ Show login credentials to the admin
      setNewDriverCredentials({ username: normalizedPhone, password });

      // ✅ Reset
      closeCreateModal();
      setDriverName("");
      setDriverPhoneNumber("");
      setDriverCarType("");
      setDriverCarPlate("");
      setDriverCarSeats("");
      setDriverPersonalImageFile(null);
      setDriverCarImageFile(null);

    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء إنشاء السائق");
    } finally {
      setLoadingCreate(false);
    }
  };

  // 🗑️ Delete driver and all related data
  const handleDeleteDriver = async (driver) => {
    if (!confirm(`هل تريد حذف السائق "${driver.name}" نهائياً؟ سيتم حذف جميع بياناته وإخراجه من التطبيق`)) return;

    try {
      setDeletingId(driver.id);

      // ✅ Unassign driver from any lines
      const linesQuery = query(collection(DB, "lines"), where("driver_id", "==", driver.id));
      const linesSnap = await getDocs(linesQuery);
      await Promise.all(
        linesSnap.docs.map((lineDoc) => updateDoc(doc(DB, "lines", lineDoc.id), { driver_id: null }))
      );

      // ✅ Delete stored images (ignore errors if already missing)
      const storage = getStorage();
      await Promise.all(
        [driver.personal_image, driver.car_image].map(async (url) => {
          if (!url) return;
          try {
            await deleteObject(ref(storage, url));
          } catch (e) {
            console.warn("Could not delete image:", e);
          }
        })
      );

      // ✅ Delete driver document (revokes app login)
      await deleteDoc(doc(DB, "drivers", driver.id));

      alert("تم حذف السائق بنجاح ✅");
      window.location.reload();
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
          <span>حذف</span>
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

              <span>
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