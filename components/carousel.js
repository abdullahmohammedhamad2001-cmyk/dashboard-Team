"use client";

import React, { useEffect, useState } from "react";
import { supabase, publicUrl, storageName, imageError } from "../supabaseClient";
import ClipLoader from "react-spinners/ClipLoader";
import { IoClose } from "react-icons/io5";
import "../app/style.css";

const MAX_CAROUSEL_IMAGES = 3;
const BUCKET = "global-carousel";

// Settings row holds only the storage paths; the public URL is derived from them
const saveImages = async (images) => {
    const { error } = await supabase.from("app_settings").upsert({
        key: "global_carousel",
        value: { images: images.map((i) => ({ path: i.path })) },
    });

    if (error) throw error;
};

const Carousel = () => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingIndex, setDeletingIndex] = useState(null);

    // Fetch the current global carousel images
    useEffect(() => {
        const fetchImages = async () => {
            try {
                const { data, error } = await supabase
                    .from("app_settings")
                    .select("value")
                    .eq("key", "global_carousel")
                    .maybeSingle();

                if (error) throw error;

                setImages(
                    (data?.value?.images || []).map((i) => ({
                        path: i.path,
                        url: publicUrl(BUCKET, i.path),
                    }))
                );
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

        const invalid = imageError(file);
        if (invalid) {
            alert(invalid);
            return;
        }

        if (images.length >= MAX_CAROUSEL_IMAGES) {
            alert(`الحد الأقصى ${MAX_CAROUSEL_IMAGES} صور`);
            return;
        }

        try {
            setUploading(true);

            const filePath = storageName(file);

            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(filePath, file, { contentType: file.type });

            if (uploadError) throw uploadError;

            const newImages = [...images, { url: publicUrl(BUCKET, filePath), path: filePath }];

            await saveImages(newImages);
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

            await saveImages(newImages);

            if (image?.path) {
                const { error } = await supabase.storage.from(BUCKET).remove([image.path]);
                if (error) console.warn("Storage file not removed:", error);
            }

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
                <ClipLoader size={40} color="#8a6115" />
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
