"use client";

import React, { useMemo,useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection,query,where,orderBy,limit,getDocs,addDoc,doc,runTransaction,serverTimestamp } from "firebase/firestore";
import { DB } from "../../../firebaseConfig";
import {useGlobalState} from '../../../globalState';
import { Modal } from "antd";
import ClipLoader from "react-spinners/ClipLoader";
import { IoArrowBackCircle } from "react-icons/io5";
import "../../style.css";

const SchoolDetails = () => {
    const { id } = useParams();
    const router = useRouter();
    const { schools, employees, students, lines, drivers, loading } = useGlobalState();

    const [openOwnerModal, setOpenOwnerModal] = useState(false);
    const [ownerName, setOwnerName] = useState("");
    const [ownerPhone, setOwnerPhone] = useState("");
    const [loadingOwner, setLoadingOwner] = useState(false);

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

    const getNextLineNumber = async () => {
        const snap = await getDocs(
            query(collection(DB, "lines"), orderBy("line_number", "desc"), limit(1))
        );

        if (snap.empty) return "L001";

        const number = parseInt(snap.docs[0].data().line_number?.replace("L", "")) || 0;
        return `L${String(number + 1).padStart(3, "0")}`;
    };

    // A school can hold an unlimited number of lines, each with its own driver
    const handleCreateLine = async () => {
        if (!school) return;

        try {
            setLoadingLine(true);

            const lineNumber = await getNextLineNumber();

            await addDoc(collection(DB, "lines"), {
                line_number: lineNumber,
                line_name: newLineName.trim() || `خط ${schoolLines.length + 1}`,
                destination: school.name,
                destination_location: school.location || null,
                school_id: school.id,
                driver_id: null,
                driver_name: null,
                car_type: null,
                riders: [],
                created_at: new Date(),
            });

            alert(`تم إنشاء الخط ${lineNumber} ✅`);

            setNewLineName("");
            setOpenLineModal(false);
            window.location.reload();
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

            const lineRef = doc(DB, "lines", selectedLine.id);
            const studentRef = doc(DB, "students", assignStudent.id);

            let alreadyAssigned = false;

            await runTransaction(DB, async (transaction) => {
                const lineDoc = await transaction.get(lineRef);
                const studentDoc = await transaction.get(studentRef);

                if (studentDoc.data()?.line_id) {
                    alreadyAssigned = true;
                    return;
                }

                const riders = lineDoc.data()?.riders || [];

                transaction.update(studentRef, {
                    line_id: selectedLine.id,
                    driver_id: lineDoc.data()?.driver_id || null,
                });

                transaction.update(lineRef, {
                    riders: riders.includes(assignStudent.id)
                        ? riders
                        : [...riders, assignStudent.id],
                });
            });

            if (alreadyAssigned) {
                alert("هذا الطالب مضاف لخط بالفعل");
                return;
            }

            alert("تم تعيين السائق للطالب ✅");

            setAssignStudent(null);
            setSelectedLine(null);
            window.location.reload();
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

    //Generate owner doc password
    const generatePassword = (length = 8) => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        let password = "";
        for (let i = 0; i < length; i++) {
            password += chars[Math.floor(Math.random() * chars.length)];
        }
        return password;
    };

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

            const password = generatePassword();

            //Check phone uniqueness
            const q = query(
                collection(DB, "employees"),
                where("phone_number", "==", normalizedPhone)
            );

            const snap = await getDocs(q);

            if (!snap.empty) {
                alert('رقم الهاتف مستخدم الرجاء ادخال رقم اخر');
                return
            }

            await runTransaction(DB, async (transaction) => {
                const employeeRef = doc(collection(DB, "employees"));

                transaction.set(employeeRef, {
                    name: ownerName,
                    phone_number: normalizedPhone,
                    username:normalizedPhone,
                    password,
                    school_id: school.id,
                    job_title: "المشرف العام",
                    country: school.country,
                    is_active: true,
                    account_deleted: false,
                    created_at: serverTimestamp(),
                });

                // create school admin
                const adminRef = doc(DB, "schoolAdmins", normalizedPhone);

                transaction.set(adminRef, {
                    admin_id: employeeRef.id,
                    name: ownerName,
                    username: normalizedPhone,
                    password,
                    role: "admin",
                    job_title: "المشرف العام",
                    school: school.name,
                    school_id: school.id,
                    school_logo: school.logo_url || null,
                    country: school.country,
                    account_banned: false,
                });
            });

            alert("تم إضافة المالك ✅");

            setOwnerName("");
            setOwnerPhone("");
            setOpenOwnerModal(false);

        } catch (error) {
            console.error(error);
            alert("خطأ أثناء إضافة المالك");
        } finally {
            setLoadingOwner(false);
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
                                <span>{emp.password}</span>
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
                                    <span className="student-row-photo">
                                        {student.photo_url ? (
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