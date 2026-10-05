"use client";

import React, { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {useGlobalState} from '../../../globalState';
import { supabase, storageName, imageError } from "../../../supabaseClient";
import ClipLoader from "react-spinners/ClipLoader";
import { IoArrowBackCircle } from "react-icons/io5";
import "../../style.css";

const DriverDetails = () => {
    const { id } = useParams();
    const router = useRouter();

    const { drivers, lines, students, loading, refresh } = useGlobalState();

    const [uploading, setUploading] = useState(null);
    const personalInputRef = useRef(null);
    const carInputRef = useRef(null);

    const driver = drivers.find((d) => d.id === id);

    // kind is "personal" or "car"; the old file is removed once the new one is saved
    const handleChangeImage = async (kind, e) => {
        const file = e.target.files?.[0];
        e.target.value = "";

        if (!file || !driver) return;

        const invalid = imageError(file);
        if (invalid) {
            alert(invalid);
            return;
        }

        const column = `${kind}_image_path`;
        const media = supabase.storage.from("driver-media");
        const path = `${driver.id}/${kind}_${storageName(file)}`;

        try {
            setUploading(kind);

            const { error: uploadError } = await media.upload(path, file, { contentType: file.type });
            if (uploadError) throw uploadError;

            const { error } = await supabase.from("drivers").update({ [column]: path }).eq("id", driver.id);

            if (error) {
                await media.remove([path]);
                throw error;
            }

            if (driver[column]) await media.remove([driver[column]]);

            await refresh();
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء رفع الصورة");
        } finally {
            setUploading(null);
        }
    };

    // ✅ Get driver lines
    const driverLines = useMemo(() => {
        if (!lines || !driver) return [];

        return lines.filter((line) => line.driver_id === driver.id);
    }, [lines, driver]);

    // ✅ Map students per line
    const lineStudentsMap = useMemo(() => {
        const map = {};

        driverLines.forEach((line) => {
            map[line.id] = students.filter(
                (s) => s.line_id === line.id
            );
        });

        return map;
    }, [students, driverLines]);

    if (loading) {
        return (
            <div className="loader">
                <ClipLoader size={40} />
            </div>
        );
    }

    if (!driver) {
        return <div className="empty">السائق غير موجود</div>;
    }

    return (
        <div className="driver-details-container">
            {/* Back */}
            <div className="back-btn" onClick={() => router.push("/")}>
                <IoArrowBackCircle size={26} />
            </div>

            {/* Driver Info */}
            <div className="driver-card">
                <div className="driver-card-top">
                    <div className="driver-image">
                        {driver.personal_image ? (
                            <img src={driver.personal_image} />
                        ) : (
                            <div className="placeholder" />
                        )}
                    </div>

                    <div className="driver-info">
                        <h2>{driver.name}</h2>
                        <p>{driver.phone_number}</p>
                        <div className="driver-meta">
                            <span>{driver.car_type}</span>
                            <span>المقاعد: {driver.car_seats}</span>
                            <span>اللوحة: {driver.car_plate}</span>
                        </div>
                        <div
                            className="create-btn"
                            style={{ height: "25px", marginTop: "8px" }}
                            onClick={() => !uploading && personalInputRef.current?.click()}
                        >
                            {uploading === "personal" ? (
                                <ClipLoader size={12} color="#fff" />
                            ) : (
                                <p>{driver.personal_image ? "تغيير صورة السائق" : "رفع صورة السائق"}</p>
                            )}
                        </div>
                        <input
                            ref={personalInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => handleChangeImage("personal", e)}
                        />
                    </div>

                </div>

            </div>

            {/* Car Image */}
            <div className="driver-section">
                <h3>صورة السيارة</h3>
                <div
                    className="create-btn"
                    style={{ height: "25px", marginBottom: "8px" }}
                    onClick={() => !uploading && carInputRef.current?.click()}
                >
                    {uploading === "car" ? (
                        <ClipLoader size={12} color="#fff" />
                    ) : (
                        <p>{driver.car_image ? "تغيير صورة السيارة" : "رفع صورة السيارة"}</p>
                    )}
                </div>
                <input
                    ref={carInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleChangeImage("car", e)}
                />
                <div className="car-image-box">
                    {driver.car_image ? (
                        <img src={driver.car_image} />
                    ) : (
                        <div className="placeholder" />
                    )}
                </div>
            </div>

            {/* Lines + Students */}
            <div className="driver-section">
                <h3>الخطوط ({driverLines.length})</h3>

                {driverLines.length === 0 ? (
                    <p className="empty">لا يوجد خطوط</p>
                ) : (
                    <div className="lines-groups">
                        {driverLines.map((line) => (
                            <div key={line.id} className="line-card">

                                <div className="line-header">
                                    <h4>{line.line_name || line.name}</h4>
                                    <span>
                                        {line.destination || "-"} —{" "}
                                        {lineStudentsMap[line.id]?.length || 0} طالب
                                    </span>
                                </div>

                                <div className="line-table">

                                    <div className="line-table-header">
                                        <span>اسم الطالب</span>
                                        <span>الهاتف</span>
                                    </div>

                                    {lineStudentsMap[line.id]?.map((student) => (
                                        <div key={student.id} className="line-table-row">
                                            <span>{student.name}</span>
                                            <span className="phone-number">{student.phone_number}</span>
                                        </div>
                                    ))}

                                </div>

                            </div>
                        ))}

                    </div>
                )}
            </div>

        </div>
    );
};

export default DriverDetails;