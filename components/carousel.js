"use client";

import React, { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { DB, STORAGE } from "../firebaseConfig";
import ClipLoader from "react-spinners/ClipLoader";
import { IoClose } from "react-icons/io5";
import "../app/style.css";

const MAX_CAROUSEL_IMAGES = 3;
const CAROUSEL_DOC_REF = () => doc(DB, "app_settings", "global_carousel");

const Carousel = () => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingIndex, setDeletingIndex] = useState(null);

    // Fetch the current global carousel images
    useEffect(() => {
        const fetchImages = async () => {
            try {
                const snap = await getDoc(CAROUSEL_DOC_REF());
                setImages(snap.exists() ? snap.data().images || [] : []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchImages();
    }, []);

    // 🖼️ Add a new carousel image (max MAX_CAROUSEL_IMAGES)
    const handleAddImage = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        if (images.length >= MAX_CAROUSEL_IMAGES) {
            alert(`الحد الأقصى ${MAX_CAROUSEL_IMAGES} صور`);
            return;
        }

        try {
            setUploading(true);

            const filePath = `global_carousel/${Date.now()}_${file.name}`;
            const fileRef = storageRef(STORAGE, filePath);

            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);

            const newImages = [...images, { url, path: filePath }];

            await setDoc(CAROUSEL_DOC_REF(), { images: newImages }, { merge: true });
            setImages(newImages);

        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء رفع الصورة");
        } finally {
            setUploading(false);
        }
    };

    // 🗑️ Remove a carousel image
    const handleDeleteImage = async (index) => {
        try {
            setDeletingIndex(index);

            const image = images[index];
            const newImages = images.filter((_, i) => i !== index);

            if (image?.path) {
                try {
                    await deleteObject(storageRef(STORAGE, image.path));
                } catch (err) {
                    console.warn("Storage file already removed:", err);
                }
            }

            await updateDoc(CAROUSEL_DOC_REF(), { images: newImages });
            setImages(newImages);

        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء حذف الصورة");
        } finally {
            setDeletingIndex(null);
        }
    };

    if (loading) {
        return (
            <div className="loader">
                <ClipLoader size={40} color="#3b82f6" />
            </div>
        );
    }

    return (
        <div className="section">
            <div className="section-header">
                <h3>الكارسول العام - {images.length}/{MAX_CAROUSEL_IMAGES}</h3>
                {images.length < MAX_CAROUSEL_IMAGES && (
                    <label className="create-btn" style={{ height: "25px", cursor: "pointer" }}>
                        {uploading ? (
                            <ClipLoader size={12} color="#fff" />
                        ) : (
                            <p>+ إضافة صورة</p>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleAddImage}
                            disabled={uploading}
                            style={{ display: "none" }}
                        />
                    </label>
                )}
            </div>

            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "10px" }}>
                هذه الصور تظهر لجميع مستخدمي تطبيق Safe Student بغض النظر عن مدرستهم.
                المقاس الموصى به: 1080 × 420 بكسل — بحد أقصى {MAX_CAROUSEL_IMAGES} صور
            </p>

            {images.length === 0 ? (
                <div className="empty">لا توجد صور</div>
            ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                    {images.map((img, index) => (
                        <div
                            key={index}
                            style={{
                                position: "relative",
                                width: "220px",
                                height: "86px",
                                borderRadius: "10px",
                                overflow: "hidden",
                                border: "1px solid #e5e7eb",
                            }}
                        >
                            <img
                                src={img.url}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <button
                                onClick={() => handleDeleteImage(index)}
                                disabled={deletingIndex === index}
                                style={{
                                    position: "absolute",
                                    top: 4,
                                    left: 4,
                                    width: 24,
                                    height: 24,
                                    borderRadius: "50%",
                                    border: "none",
                                    background: "rgba(0,0,0,0.6)",
                                    color: "#fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                }}
                            >
                                {deletingIndex === index ? (
                                    <ClipLoader size={10} color="#fff" />
                                ) : (
                                    <IoClose size={14} />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Carousel;
