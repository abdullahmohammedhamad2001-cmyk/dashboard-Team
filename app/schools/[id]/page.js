"use client";

import React, { useMemo,useRef,useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, storageName, adminAccounts, createLine, imageError } from "../../../supabaseClient";
import {useGlobalState} from '../../../globalState';
import { Modal } from "antd";
import ClipLoader from "react-spinners/ClipLoader";
import { IoArrowBackCircle } from "react-icons/io5";
import "../../style.css";

const SchoolDetails = () => {
    const { id } = useParams();
    const router = useRouter();
    const { schools, employees, students, lines, drivers, loading, refresh } = useGlobalState();

    const [credentials, setCredentials] = useState(null);
    const [resettingId, setResettingId] = useState(null);
    const [uploadingPhotoId, setUploadingPhotoId] = useState(null);
    const photoInputRef = useRef(null);
    const photoTargetRef = useRef(null);

    const [openOwnerModal, setOpenOwnerModal] = useState(false);
    const [ownerName, setOwnerName] = useState("");
    const [ownerPhone, setOwnerPhone] = useState("");
    const [loadingOwner, setLoadingOwner] = useState(false);

    const [openNameModal, setOpenNameModal] = useState(false);
    const [newSchoolName, setNewSchoolName] = useState("");
    const [loadingName, setLoadingName] = useState(false);
    const [loadingLogo, setLoadingLogo] = useState(false);
    const logoInputRef = useRef(null);

    const [studentSearch, setStudentSearch] = useState("");
    const [assignStudent, setAssignStudent] = useState(null);
    const [selectedLine, setSelectedLine] = useState(null);
    const [loadingAssign, setLoadingAssign] = useState(false);

    const [openLineModal, setOpenLineModal] = useState(false);
    const [newLineName, setNewLineName] = useState("");
    const [loadingLine, setLoadingLine] = useState(false);

    const school = schools.find((s) => s.id === id);

    const driverById = useMemo(
        () => new Map((drivers || []).map((d) => [d.id, d])),
        [drivers]
    );

    // Every line that belongs to this school (a school may have many)
    const schoolLines = useMemo(
        () => (lines || []).filter((l) => l.school_id === id),
        [lines, id]
    );

    const lineById = useMemo(
        () => new Map(schoolLines.map((l) => [l.id, l])),
        [schoolLines]
    );

    const schoolStudents = useMemo(() => {
        const list = (students || []).filter((s) => s.school_id === id);
        const term = studentSearch.trim();
        if (!term) return list;
        return list.filter(
            (s) =>
                s.name?.includes(term) ||
                s.parent_name?.includes(term) ||
                s.phone_number?.includes(term)
        );
    }, [students, id, studentSearch]);

    const withDriverCount = useMemo(
        () => schoolStudents.filter((s) => s.driver_id).length,
        [schoolStudents]
    );

    // A student may only join a line once its parent account and home location exist
    const canAssignStudent = (student) =>
        Boolean(student.linked_parent && student.home_location);

    // A school can hold an unlimited number of lines, each with its own driver
    const handleCreateLine = async () => {
        if (!school) return;

        try {
            setLoadingLine(true);

            const lineNumber = await createLine({
                schoolId: school.id,
                name: newLineName.trim() || `خط ${schoolLines.length + 1}`,
            });

            alert(`تم إنشاء الخط ${lineNumber} ✅`);

            setNewLineName("");
            setOpenLineModal(false);
            await refresh();
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء إنشاء الخط");
        } finally {
            setLoadingLine(false);
        }
    };

    const handleAssignStudentToLine = async () => {
        if (!assignStudent || !selectedLine) {
            alert("اختر الخط");
            return;
        }

        try {
            setLoadingAssign(true);

            // Only a student without a line is updated; the driver follows from the line
            const { data, error } = await supabase
                .from("students")
                .update({ line_id: selectedLine.id })
                .eq("id", assignStudent.id)
                .is("line_id", null)
                .select("id");

            if (error) throw error;

            if (!data?.length) {
                alert("هذا الطالب مضاف لخط بالفعل");
                return;
            }

            alert("تم تعيين السائق للطالب ✅");

            setAssignStudent(null);
            setSelectedLine(null);
            await refresh();
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء التعيين");
        } finally {
            setLoadingAssign(false);
        }
    };

    // ✅ Group employees by job_title
    const groupedEmployees = useMemo(() => {
        if (!employees || !school) return {};

        const order = [
            "المشرف العام",
            "المدير",
            "مدير الحسابات",
            "محاسب",
            "موظف معاون",
        ];

        const grouped = {};

        order.forEach((title) => {
            grouped[title] = employees.filter(
                (e) => e.school_id === id && e.job_title === title
            );
        });

        return grouped;
    }, [employees, id, school]);

    // 📱 Normalize phone based on country
    const normalizePhoneByCountry = (phone, country) => {
        let cleaned = phone.replace(/\D/g, "");

        // 🇮🇶 IRAQ
        if (country === "iraq") {
            if (cleaned.startsWith("07")) {
                cleaned = cleaned.slice(1);
            }

            if (!cleaned.startsWith("7")) return null;
            if (cleaned.length !== 10) return null;

            return cleaned;
        }

        // 🇹🇳 TUNISIA
        if (country === "tunisia") {
            if (cleaned.length !== 8) return null;

            return cleaned;
        }

        return null;
    };

    //Create new owner doc
    const handleAddOwner = async () => {
        if (!ownerName || !ownerPhone) {
            alert("يرجى ملء جميع الحقول");
            return;
        }

        // ✅ Normalize phone
        const normalizedPhone = normalizePhoneByCountry(ownerPhone, school.country);

        if (!normalizedPhone) {
            if (school.country === "iraq") {
                alert("رقم الهاتف غير صالح (يجب أن يبدأ بـ 7 ويكون 10 أرقام)");
            } else if (school.country === "tunisia") {
                alert("رقم الهاتف غير صالح (يجب أن يكون 8 أرقام)");
            }
            return;
        }

        try {
            setLoadingOwner(true);

            // The account is created server-side; the password is shown only once
            const result = await adminAccounts({
                action: "create_school_owner",
                schoolId: school.id,
                name: ownerName.trim(),
                phone: normalizedPhone,
            });

            setOwnerName("");
            setOwnerPhone("");
            setOpenOwnerModal(false);
            setCredentials({ username: result.username, password: result.password });

            await refresh();
        } catch (error) {
            console.error(error);
            alert(
                error.message === "phone_in_use" || error.message === "login_in_use"
                    ? "رقم الهاتف مستخدم الرجاء ادخال رقم اخر"
                    : "خطأ أثناء إضافة المالك"
            );
        } finally {
            setLoadingOwner(false);
        }
    };

    const handleResetOwnerPassword = async (emp) => {
        if (!emp.profile_id) {
            alert("لا يوجد حساب دخول مرتبط بهذا المشرف");
            return;
        }

        if (!confirm(`هل تريد إنشاء كلمة مرور جديدة للمشرف "${emp.name}"؟`)) return;

        try {
            setResettingId(emp.id);

            const result = await adminAccounts({
                action: "reset_password",
                profileId: emp.profile_id,
            });

            setCredentials({ username: result.username, password: result.password });
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء تغيير كلمة المرور");
        } finally {
            setResettingId(null);
        }
    };

    const openRenameModal = () => {
        setNewSchoolName(school?.name || "");
        setOpenNameModal(true);
    };

    const handleRenameSchool = async () => {
        const name = newSchoolName.trim().replace(/\s+/g, " ");

        if (!name) {
            alert("يرجى إدخال اسم المدرسة");
            return;
        }

        if (name === school.name) {
            setOpenNameModal(false);
            return;
        }

        try {
            setLoadingName(true);

            // The name is stored once, so every screen picks up the change
            const { error } = await supabase.from("schools").update({ name }).eq("id", id);

            if (error) throw error;

            alert("تم تغيير اسم المدرسة ✅");

            setOpenNameModal(false);
            await refresh();
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء تغيير الاسم");
        } finally {
            setLoadingName(false);
        }
    };

    const handleChangeLogo = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";

        if (!file) return;

        const invalid = imageError(file);
        if (invalid) {
            alert(invalid);
            return;
        }

        try {
            setLoadingLogo(true);

            const logoPath = storageName(file);

            const { error: uploadError } = await supabase.storage
                .from("school-logos")
                .upload(logoPath, file, { contentType: file.type });

            if (uploadError) throw uploadError;

            const { error } = await supabase
                .from("schools")
                .update({ logo_path: logoPath })
                .eq("id", id);

            if (error) throw error;

            const oldPath = school.logo_path;
            if (oldPath) {
                await supabase.storage.from("school-logos").remove([oldPath]);
            }

            alert("تم تغيير شعار المدرسة ✅");
            await refresh();
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء تغيير الشعار");
        } finally {
            setLoadingLogo(false);
        }
    };

    // The file name must be <student id>.<ext> so the parent app's read policy matches it
    const handleStudentPhoto = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";

        const student = photoTargetRef.current;

        if (!file || !student) return;

        const invalid = imageError(file);
        if (invalid) {
            alert(invalid);
            return;
        }

        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${id}/${student.id}.${ext}`;
        const bucket = supabase.storage.from("student-photos");

        try {
            setUploadingPhotoId(student.id);

            const { error: uploadError } = await bucket.upload(path, file, {
                contentType: file.type,
                upsert: true,
            });
            if (uploadError) throw uploadError;

            const { error } = await supabase
                .from("students")
                .update({ photo_path: path })
                .eq("id", student.id);
            if (error) throw error;

            if (student.photo_path && student.photo_path !== path) {
                await bucket.remove([student.photo_path]);
            }

            await refresh();
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء رفع صورة الطالب");
        } finally {
            setUploadingPhotoId(null);
        }
    };

    if (loading) {
        return (
        <div className="loader">
            <ClipLoader size={40} color="#8a6115" />
        </div>
        );
    }

    if (!school) {
        return <div>المدرسة غير موجودة</div>;
    }

    return (
        <div className="school-details-container">
            <Modal
                title="بيانات دخول المشرف"
                open={!!credentials}
                onCancel={() => setCredentials(null)}
                footer={null}
                centered
            >
                <div className="driver-credentials">
                    <p>رقم الدخول: <strong>{credentials?.username}</strong></p>
                    <p>كلمة المرور: <strong>{credentials?.password}</strong></p>
                    <p className="modal-hint">احفظ كلمة المرور الآن، لا يمكن عرضها مرة أخرى.</p>
                </div>
            </Modal>
            {/* Header Card */}
            <Modal
                title="تغيير اسم المدرسة"
                open={openNameModal}
                onCancel={() => setOpenNameModal(false)}
                footer={null}
                centered
            >
                <div className="create-school-form">
                    <input
                        placeholder="اسم المدرسة الجديد"
                        value={newSchoolName}
                        onChange={(e) => setNewSchoolName(e.target.value)}
                    />

                    <p className="modal-hint">
                        سيتغير الاسم في جميع شاشات التطبيقات واللوحات تلقائياً.
                    </p>

                    {loadingName ? (
                        <div className="btn-loading">
                            <ClipLoader size={15} color="#fff" />
                        </div>
                    ) : (
                        <button className="create-submit" onClick={handleRenameSchool}>
                            حفظ
                        </button>
                    )}
                </div>
            </Modal>

            {/* Header Card */}
            <div className="school-card">
                <div className="school-card-inner">
                    <div className="school-logo-box">
                        {school.logo_url ? (
                            <img src={school.logo_url} />
                        ) : (
                            <div className="logo-placeholder" />
                        )}
                    </div>
                    <div className="school-name-box">
                        <h2>{school.name}</h2>
                        <p>{school.country}</p>
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px", justifyContent: "center" }}>
                            <div
                                className="create-btn"
                                style={{ height: "25px" }}
                                onClick={openRenameModal}
                            >
                                <p>تغيير اسم المدرسة</p>
                            </div>
                            <div
                                className="create-btn"
                                style={{ height: "25px" }}
                                onClick={() => !loadingLogo && logoInputRef.current?.click()}
                            >
                                {loadingLogo ? (
                                    <ClipLoader size={12} color="#fff" />
                                ) : (
                                    <p>تغيير شعار المدرسة</p>
                                )}
                            </div>
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={handleChangeLogo}
                            />
                        </div>
                    </div>
                </div>
                <div className="back-btn" onClick={() => router.push("/")}>
                    <IoArrowBackCircle size={25}/>
                </div>
            </div>

            {/* Owners Section */}
            <div className="section">
                <div className="section-header">
                    <h3>المشرفون</h3>
                    <div 
                        className="create-btn"
                        style={{height:'25px'}} 
                        onClick={() => setOpenOwnerModal(true)}
                    >
                        <p>+ إضافة مشرف</p>
                    </div>
                </div>

                <div className="school-details-table">
                    <div className="school-details-table-header">
                        <span>الاسم</span>
                        <span>الهاتف / Username</span>
                        <span>كلمة المرور</span>
                    </div>

                    {groupedEmployees["المشرف العام"]?.length === 0 ? (
                        <div className="empty">لا يوجد</div>
                    ) : (
                        groupedEmployees["المشرف العام"]?.map((emp) => (
                            <div key={emp.id} className="school-details-table-row">
                                <span>{emp.name}</span>
                                <span className="phone-number">{emp.phone_number}</span>
                                <span>
                                    <button
                                        className="create-btn"
                                        style={{ height: "26px", padding: "0 10px" }}
                                        disabled={resettingId === emp.id}
                                        onClick={() => handleResetOwnerPassword(emp)}
                                    >
                                        {resettingId === emp.id ? (
                                            <ClipLoader size={12} color="#fff" />
                                        ) : (
                                            "كلمة مرور جديدة"
                                        )}
                                    </button>
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Lines & drivers of this school */}
            <div className="section">
                <div className="section-header">
                    <h3>الخطوط والسائقون ({schoolLines.length})</h3>

                    <div className="create-btn" onClick={() => setOpenLineModal(true)}>
                        <p>+ إنشاء خط جديد</p>
                    </div>
                </div>

                {schoolLines.length === 0 ? (
                    <div className="empty">لا يوجد خطوط لهذه المدرسة</div>
                ) : (
                    <div className="line-cards-grid">
                        {schoolLines.map((line) => {
                            const lineDriver = driverById.get(line.driver_id);

                            return (
                                <div
                                    key={line.id}
                                    className="line-card"
                                    onClick={() => router.push(`/lines/${line.id}`)}
                                >
                                    <div className="line-card-driver">
                                        {lineDriver?.personal_image ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={lineDriver.personal_image} alt={lineDriver.name} />
                                        ) : (
                                            <div className="driver-avatar-placeholder">
                                                {lineDriver?.name?.trim()?.charAt(0) || "؟"}
                                            </div>
                                        )}

                                        <div>
                                            <strong>{lineDriver?.name || "بدون سائق"}</strong>
                                            <small>{lineDriver?.car_type || "لم يتم التعيين"}</small>
                                        </div>
                                    </div>

                                    <div className="line-card-meta">
                                        <span>
                                            {line.line_name || `الخط ${line.line_number || "-"}`}
                                        </span>
                                        <span>{(line.riders || []).length} طالب</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Students & transport assignment */}
            <div className="section">
                <div className="section-header">
                    <h3>
                        الطلاب ({schoolStudents.length}) — لديهم سائق: {withDriverCount}
                    </h3>
                </div>

                <input
                    className="school-search"
                    placeholder="البحث باسم الطالب أو رقم الهاتف..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                />
                <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleStudentPhoto}
                />

                <div className="school-details-table">
                    <div className="school-details-table-header school-students-grid">
                        <span>الصورة</span>
                        <span>الطالب</span>
                        <span>الهاتف</span>
                        <span>السائق / الخط</span>
                        <span>الإجراء</span>
                    </div>

                    {schoolStudents.length === 0 ? (
                        <div className="empty">لا يوجد طلاب</div>
                    ) : (
                        schoolStudents.map((student) => {
                            const studentLine = lineById.get(student.line_id);
                            const studentDriver = driverById.get(student.driver_id);

                            return (
                                <div
                                    key={student.id}
                                    className="school-details-table-row school-students-grid"
                                >
                                    <span
                                        className="student-row-photo"
                                        style={{ cursor: "pointer" }}
                                        title={student.photo_url ? "تغيير الصورة" : "رفع صورة"}
                                        onClick={() => {
                                            if (uploadingPhotoId) return;
                                            photoTargetRef.current = student;
                                            photoInputRef.current?.click();
                                        }}
                                    >
                                        {uploadingPhotoId === student.id ? (
                                            <ClipLoader size={14} color="#8a6115" />
                                        ) : student.photo_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={student.photo_url} alt={student.name} />
                                        ) : (
                                            <div className="student-row-photo-placeholder">
                                                {student.name?.trim()?.charAt(0) || "؟"}
                                            </div>
                                        )}
                                    </span>

                                    <span>{student.name} {student.parent_name}</span>

                                    <span className="phone-number">{student.phone_number || "-"}</span>

                                    <span>
                                        {studentDriver ? (
                                            <span className="driver-chip">
                                                {studentDriver.personal_image ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={studentDriver.personal_image}
                                                        alt={studentDriver.name}
                                                    />
                                                ) : (
                                                    <span className="driver-avatar-placeholder small">
                                                        {studentDriver.name?.trim()?.charAt(0) || "؟"}
                                                    </span>
                                                )}
                                                <span className="driver-chip-text">
                                                    <strong>{studentDriver.name}</strong>
                                                    <small>الخط {studentLine?.line_number || "-"}</small>
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="no-driver-text">لا يوجد سائق</span>
                                        )}
                                    </span>

                                    <span>
                                        {student.driver_id ? (
                                            <span className="assigned-badge">مُعيَّن</span>
                                        ) : (
                                            <button
                                                className="assign-driver-btn"
                                                disabled={!canAssignStudent(student)}
                                                title={
                                                    canAssignStudent(student)
                                                        ? "تعيين سائق"
                                                        : "يجب ربط ولي الأمر وتحديد موقع المنزل أولاً"
                                                }
                                                onClick={() => {
                                                    setAssignStudent(student);
                                                    setSelectedLine(null);
                                                }}
                                            >
                                                تعيين سائق
                                            </button>
                                        )}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Assign a student to one of the school lines */}
            <Modal
                title="إنشاء خط جديد"
                open={openLineModal}
                onCancel={() => setOpenLineModal(false)}
                footer={null}
                centered
            >
                <div className="create-school-form">
                    <input
                        placeholder="اسم الخط (مثال: الخط الشمالي) - اختياري"
                        value={newLineName}
                        onChange={(e) => setNewLineName(e.target.value)}
                    />

                    <p className="modal-hint">
                        يمكن للمدرسة الواحدة إنشاء عدد غير محدود من الخطوط، ولكل خط سائق خاص به.
                    </p>

                    {loadingLine ? (
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

            <Modal
                title={`تعيين سائق - ${assignStudent?.name || ""}`}
                open={Boolean(assignStudent)}
                onCancel={() => {
                    setAssignStudent(null);
                    setSelectedLine(null);
                }}
                footer={null}
                centered
            >
                <div className="create-school-form">
                    {schoolLines.length === 0 ? (
                        <p className="empty">لا يوجد خطوط لهذه المدرسة، أنشئ خطاً أولاً</p>
                    ) : (
                        <div className="drivers-list">
                            {schoolLines.map((line) => {
                                const lineDriver = driverById.get(line.driver_id);

                                return (
                                    <div
                                        key={line.id}
                                        className={`driver-item ${selectedLine?.id === line.id ? "active" : ""}`}
                                        onClick={() => setSelectedLine(line)}
                                    >
                                        <p>
                                            {line.line_name || `الخط ${line.line_number || "-"}`} —{" "}
                                            {lineDriver?.name || "بدون سائق"}
                                        </p>
                                        <span>{(line.riders || []).length} طالب</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {loadingAssign ? (
                        <div className="btn-loading">
                            <ClipLoader size={15} color="#fff" />
                        </div>
                    ) : (
                        <button
                            className={`create-submit ${!selectedLine ? "disabled-button" : ""}`}
                            onClick={handleAssignStudentToLine}
                            disabled={!selectedLine}
                        >
                            تعيين
                        </button>
                    )}
                </div>
            </Modal>

            {/* Modal */}
            <Modal
                title="إضافة مشرف جديد"
                open={openOwnerModal}
                onCancel={() => setOpenOwnerModal(false)}
                footer={null}
                centered
            >
                <div className="create-school-form">
                    <input
                        placeholder="الاسم"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                    />
                    <input
                        placeholder="رقم الهاتف"
                        value={ownerPhone}
                        onChange={(e) => setOwnerPhone(e.target.value)}
                    />
                    {loadingOwner ? (
                        <div className="btn-loading">
                            <ClipLoader size={15} color="#fff" />
                        </div>
                    ) : (
                        <button className="create-submit" onClick={handleAddOwner}>
                             إضافة
                        </button>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default SchoolDetails;