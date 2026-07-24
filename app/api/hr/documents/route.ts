import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { hrDocumentFromRow } from "@/lib/hr-mappers";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

const bucketName = "hr-documents";
const maxFileSize = 4 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
type DocumentStatus = "Vigente" | "Archivado";

type DocumentBody = {
  deliveryDate: string;
  employeeId: string;
  expiryDate: string;
  id: string;
  notes: string;
  reference: string;
  status: DocumentStatus;
  type: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "lector");
  if (auth.error) return auth.error;
  if (!isSupabaseConfigured()) return databaseUnavailable();

  const id = cleanText(request.nextUrl.searchParams.get("id"));
  if (!id) {
    return NextResponse.json(
      { error: "Seleccione un documento." },
      { status: 400 },
    );
  }

  try {
    const rows = await supabaseSelect<Record<string, unknown>[]>(
      `hr_documents?id=eq.${encodeURIComponent(id)}&select=*`,
    );
    const row = rows[0];
    if (!row) return documentNotFound();
    const path = cleanText(row.file_path);
    if (!path) {
      return NextResponse.json(
        { error: "Este registro no tiene un archivo adjunto." },
        { status: 404 },
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .storage
      .from(bucketName)
      .download(path);
    if (error || !data) {
      throw new Error(error?.message || "No se pudo descargar el archivo.");
    }

    const fileName = cleanText(row.file_name) || "documento";
    const disposition = request.nextUrl.searchParams.get("download")
      ? "attachment"
      : "inline";
    return new NextResponse(await data.arrayBuffer(), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(disposition, fileName),
        "Content-Type":
          cleanText(row.mime_type) || data.type || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return documentError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;
  if (!isSupabaseConfigured()) return databaseUnavailable();

  const form = await request.formData();
  const body = documentBody(form);
  const validationError = validateDocument(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  const file = formFile(form);
  const fileError = validateFile(file);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  const id = `document-${randomUUID()}`;
  let uploadedPath = "";
  try {
    await ensureEmployee(body.employeeId);
    if (file) uploadedPath = await uploadFile(file, body.employeeId, id);
    const rows = await supabaseInsert<Record<string, unknown>[]>(
      "hr_documents",
      documentRow(body, {
        file,
        filePath: uploadedPath,
        id,
      }),
    );
    return NextResponse.json(
      { document: hrDocumentFromRow(rows[0]) },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedPath) await removeFile(uploadedPath);
    return documentError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;
  if (!isSupabaseConfigured()) return databaseUnavailable();

  const form = await request.formData();
  const body = documentBody(form);
  if (!body.id) {
    return NextResponse.json(
      { error: "Seleccione un documento." },
      { status: 400 },
    );
  }
  const validationError = validateDocument(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  const file = formFile(form);
  const fileError = validateFile(file);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  const canAdmin = hasPermission(
    auth.user ?? undefined,
    "rrhh",
    "administrador",
  );
  if (body.status === "Archivado" && !canAdmin) {
    return NextResponse.json(
      { error: "Se requiere permiso de administrador para archivar." },
      { status: 403 },
    );
  }

  let uploadedPath = "";
  try {
    const existingRows = await supabaseSelect<Record<string, unknown>[]>(
      `hr_documents?id=eq.${encodeURIComponent(body.id)}&select=*`,
    );
    const existing = existingRows[0];
    if (!existing) return documentNotFound();
    if (
      normalizeStatus(existing.status) === "Archivado" &&
      !canAdmin
    ) {
      return NextResponse.json(
        {
          error:
            "Se requiere permiso de administrador para modificar un documento archivado.",
        },
        { status: 403 },
      );
    }

    await ensureEmployee(body.employeeId);
    if (file) uploadedPath = await uploadFile(file, body.employeeId, body.id);
    const rows = await supabasePatch<Record<string, unknown>[]>(
      `hr_documents?id=eq.${encodeURIComponent(body.id)}`,
      documentRow(body, {
        file,
        filePath: uploadedPath || cleanText(existing.file_path),
        id: body.id,
        previous: existing,
      }),
    );
    if (!rows[0]) return documentNotFound();

    const previousPath = cleanText(existing.file_path);
    if (uploadedPath && previousPath && previousPath !== uploadedPath) {
      await removeFile(previousPath);
    }
    return NextResponse.json({ document: hrDocumentFromRow(rows[0]) });
  } catch (error) {
    if (uploadedPath) await removeFile(uploadedPath);
    return documentError(error);
  }
}

function documentBody(form: FormData): DocumentBody {
  const requestedStatus = normalizeStatus(form.get("status"));
  return {
    deliveryDate: cleanText(form.get("deliveryDate")),
    employeeId: cleanText(form.get("employeeId")),
    expiryDate: cleanText(form.get("expiryDate")),
    id: cleanText(form.get("id")),
    notes: cleanText(form.get("notes")),
    reference: cleanText(form.get("reference")),
    status: requestedStatus,
    type: cleanText(form.get("type")),
  };
}

function documentRow(
  body: DocumentBody,
  {
    file,
    filePath,
    id,
    previous,
  }: {
    file: File | null;
    filePath: string;
    id: string;
    previous?: Record<string, unknown>;
  },
) {
  return {
    delivery_date: body.deliveryDate || null,
    document_type: body.type,
    employee_id: body.employeeId,
    expiry_date: body.expiryDate || null,
    file_name: file?.name || cleanText(previous?.file_name) || null,
    file_path: filePath || null,
    file_size: file?.size || Number(previous?.file_size) || 0,
    id,
    mime_type: file?.type || cleanText(previous?.mime_type) || null,
    notes: body.notes || null,
    reference: body.reference || null,
    status: body.status,
    uploaded_at: file
      ? new Date().toISOString()
      : cleanText(previous?.uploaded_at) || null,
  };
}

async function uploadFile(file: File, employeeId: string, documentId: string) {
  const path = `${safePathPart(employeeId)}/${safePathPart(
    documentId,
  )}/${randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await getSupabaseAdmin()
    .storage
    .from(bucketName)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return path;
}

async function removeFile(path: string) {
  const { error } = await getSupabaseAdmin()
    .storage
    .from(bucketName)
    .remove([path]);
  if (error) {
    console.error("No se pudo retirar un archivo de RR.HH.", error.message);
  }
}

async function ensureEmployee(employeeId: string) {
  const employees = await supabaseSelect<Array<{ id: string }>>(
    `hr_employees?id=eq.${encodeURIComponent(employeeId)}&select=id`,
  );
  if (!employees[0]) throw new Error("Funcionario no encontrado.");
}

function validateDocument(body: DocumentBody) {
  if (!body.employeeId) return "Seleccione un funcionario.";
  if (!body.type) return "Seleccione un tipo de documento.";
  if (body.deliveryDate && !datePattern(body.deliveryDate)) {
    return "La fecha de entrega no es valida.";
  }
  if (body.expiryDate && !datePattern(body.expiryDate)) {
    return "La fecha de vencimiento no es valida.";
  }
  if (
    body.deliveryDate &&
    body.expiryDate &&
    body.expiryDate < body.deliveryDate
  ) {
    return "El vencimiento no puede ser anterior a la entrega.";
  }
  return "";
}

function formFile(form: FormData) {
  const value = form.get("file");
  return value instanceof File && value.size > 0 ? value : null;
}

function validateFile(file: File | null) {
  if (!file) return "";
  if (file.size > maxFileSize) {
    return "El archivo supera el limite de 4 MB.";
  }
  if (!allowedMimeTypes.has(file.type)) {
    return "Formato no permitido. Use PDF, JPG, PNG, WEBP, DOC o DOCX.";
  }
  return "";
}

function normalizeStatus(value: unknown): DocumentStatus {
  return cleanText(value).toLowerCase() === "archivado"
    ? "Archivado"
    : "Vigente";
}

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
}

function safeFileName(value: string) {
  const parts = value.trim().split(".");
  const extension =
    parts.length > 1
      ? `.${parts.pop()!.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}`
      : "";
  const base = parts
    .join(".")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return `${base || "documento"}${extension.toLowerCase()}`;
}

function contentDisposition(disposition: string, fileName: string) {
  const ascii = fileName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(
    fileName,
  )}`;
}

function cleanText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function datePattern(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function databaseUnavailable() {
  return NextResponse.json(
    { error: "Supabase no esta configurado." },
    { status: 503 },
  );
}

function documentNotFound() {
  return NextResponse.json(
    { error: "Documento no encontrado." },
    { status: 404 },
  );
}

function documentError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo guardar el documento.";
  const migrationRequired =
    message.includes("hr-documents") ||
    message.includes("file_path") ||
    message.includes("Bucket not found");
  return NextResponse.json(
    {
      error: migrationRequired
        ? "Falta preparar el almacenamiento de documentos en Supabase."
        : message,
    },
    { status: 400 },
  );
}
