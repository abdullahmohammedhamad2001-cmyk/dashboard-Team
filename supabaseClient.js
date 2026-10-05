import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const supabase = createClient(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Staff accounts sign in with a username; the auth email is derived from it.
export const emailFor = (kind, username) =>
    `${kind}.${String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_")}@staff.safeschool.invalid`;

export const publicUrl = (bucket, path) =>
    path ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` : null;

// Storage keys must be ASCII; keep only the extension of the original file name.
export const storageName = (file) => {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;
};

// Returns an Arabic error message, or null when the file is an acceptable image.
export const imageError = (file) => {
    if (!file.type.startsWith("image/")) return "يرجى اختيار صورة";
    if (file.size > 5 * 1024 * 1024) return "حجم الصورة يجب ألا يتجاوز 5 ميغابايت";
    return null;
};

// Calls the team-only account administration function.
export const adminAccounts = async (body) => {
    const { data, error } = await supabase.functions.invoke("admin-accounts", { body });

    if (error) {
        let code = "request_failed";
        try {
            code = (await error.context.json()).error || code;
        } catch {}
        throw new Error(code);
    }

    return data;
};

// PostgREST returns at most 1000 rows per request; read every page.
export const fetchAll = async (table, columns = "*", order = "id") => {
    const rows = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from(table)
            .select(columns)
            .order(order)
            .range(from, from + pageSize - 1);

        if (error) throw error;
        rows.push(...data);
        if (data.length < pageSize) break;
    }

    return rows;
};

// Next line number is max + 1; the unique constraint rejects a concurrent duplicate, so retry
export const createLine = async ({ schoolId, name }) => {
    for (let attempt = 0; attempt < 5; attempt++) {
        const rows = await fetchAll("lines", "line_number");
        const max = rows.reduce(
            (m, r) => Math.max(m, parseInt(String(r.line_number).replace(/\D/g, "")) || 0),
            0
        );
        const lineNumber = `L${String(max + 1).padStart(3, "0")}`;

        const { error } = await supabase.from("lines").insert({
            id: crypto.randomUUID(),
            line_number: lineNumber,
            line_name: name,
            school_id: schoolId,
        });

        if (!error) return lineNumber;
        if (error.code !== "23505") throw error;
    }

    throw new Error("line_number_conflict");
};
