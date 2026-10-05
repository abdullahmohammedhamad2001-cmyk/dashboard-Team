"use client";

import React, { createContext, useReducer, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase, fetchAll, publicUrl } from "./supabaseClient";

const GlobalStateContext = createContext();

const PUBLIC_PATHS = ["/login", "/delete-account"];

const initialState = {
  students: [],
  schools: [],
  drivers: [],
  lines: [],
  teachers: [],
  employees: [],
  bills: [],
  loading: true,
  error: null,
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_DATA":
      return {
        ...state,
        ...action.payload,
        loading: false,
        error: null,
      };
    case "LOADING":
      return { ...state, loading: true };
    case "RESET":
      return { ...initialState, loading: false };
    case "ERROR":
      return {
        ...state,
        error: action.error,
        loading: false,
      };
    default:
      return state;
  }
};

// Signed URLs for the private driver-media bucket, keyed by storage path
const signDriverImages = async (drivers) => {
  const paths = [
    ...new Set(
      drivers.flatMap((d) => [d.personal_image_path, d.car_image_path]).filter(Boolean)
    ),
  ];

  if (!paths.length) return new Map();

  const { data } = await supabase.storage
    .from("driver-media")
    .createSignedUrls(paths, 3600);

  return new Map((data || []).filter((r) => r.signedUrl).map((r) => [r.path, r.signedUrl]));
};

// Student photos live in a private bucket too
const signStudentPhotos = async (students) => {
  const paths = students.map((s) => s.photo_path).filter(Boolean);

  if (!paths.length) return new Map();

  const { data } = await supabase.storage
    .from("student-photos")
    .createSignedUrls(paths, 3600);

  return new Map((data || []).filter((r) => r.signedUrl).map((r) => [r.path, r.signedUrl]));
};

// Rows are mapped to the shapes the dashboard screens already use
const loadAll = async () => {
  const [students, schools, drivers, lines, teachers, employees, bills] =
    await Promise.all([
      fetchAll("students"),
      fetchAll("schools"),
      fetchAll("drivers"),
      fetchAll("lines"),
      fetchAll("teachers"),
      fetchAll("employees"),
      fetchAll("student_bills"),
    ]);

  const signed = await signDriverImages(drivers);
  const studentPhotos = await signStudentPhotos(students);
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const lineById = new Map(lines.map((l) => [l.id, l]));

  const ridersByLine = new Map();
  students.forEach((s) => {
    if (!s.line_id) return;
    if (!ridersByLine.has(s.line_id)) ridersByLine.set(s.line_id, []);
    ridersByLine.get(s.line_id).push(s.id);
  });

  const linesByDriver = new Map();
  lines.forEach((l) => {
    if (!l.driver_id) return;
    if (!linesByDriver.has(l.driver_id)) linesByDriver.set(l.driver_id, []);
    linesByDriver.get(l.driver_id).push(l.id);
  });

  return {
    students: students.map((s) => ({
      ...s,
      linked_parent: s.linked_parent_id,
      driver_id: lineById.get(s.line_id)?.driver_id || null,
      home_location:
        s.home_lat != null && s.home_lng != null
          ? { latitude: s.home_lat, longitude: s.home_lng }
          : null,
      photo_url: studentPhotos.get(s.photo_path) || null,
    })),
    schools: schools.map((s) => ({
      ...s,
      logo_url: publicUrl("school-logos", s.logo_path),
      location:
        s.location_lat != null && s.location_lng != null
          ? { latitude: s.location_lat, longitude: s.location_lng }
          : null,
    })),
    drivers: drivers.map((d) => ({
      ...d,
      personal_image: signed.get(d.personal_image_path) || null,
      car_image: signed.get(d.car_image_path) || null,
      lines: linesByDriver.get(d.id) || [],
    })),
    lines: lines.map((l) => {
      const school = schoolById.get(l.school_id);
      return {
        ...l,
        destination: school?.name || null,
        destination_location:
          school?.location_lat != null
            ? { latitude: school.location_lat, longitude: school.location_lng }
            : null,
        riders: ridersByLine.get(l.id) || [],
      };
    }),
    teachers,
    employees,
    bills,
  };
};

export const GlobalStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pathname = usePathname();
  const router = useRouter();
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      dispatch({ type: "SET_DATA", payload: await loadAll() });
      loadedRef.current = true;
    } catch (error) {
      dispatch({ type: "ERROR", error });
    }
  }, []);

  // Data is read only for a signed-in user; it loads once and screens call refresh() after changes
  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));
    let cancelled = false;

    const init = async () => {
      const { data } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!data.session) {
        loadedRef.current = false;
        dispatch({ type: "RESET" });
        if (!isPublic) router.replace("/login");
        return;
      }

      if (!isPublic && !loadedRef.current) {
        dispatch({ type: "LOADING" });
        await refresh();
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [pathname, refresh, router]);

  return (
    <GlobalStateContext.Provider value={{ ...state, refresh }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => React.useContext(GlobalStateContext);
