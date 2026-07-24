import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { hrAttendanceFromRow } from "@/lib/hr-mappers";
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

type AttendanceBody = {
  attendanceDate?: string;
  employeeId?: string;
  employeeIds?: string[];
  entry?: string;
  exit?: string;
  extraHours?: number;
  id?: string;
  lunchIn?: string;
  lunchOut?: string;
  notes?: string;
  preserveExisting?: boolean;
  status?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as AttendanceBody;
  const employeeIds = Array.isArray(body.employeeIds)
    ? Array.from(new Set(body.employeeIds.map(cleanText).filter(Boolean)))
    : [cleanText(body.employeeId)].filter(Boolean);
  const error = validateAttendance(body, employeeIds);
  if (error) return NextResponse.json({ error }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase no esta configurado." },
      { status: 503 },
    );
  }

  try {
    const attendanceDate = cleanText(body.attendanceDate);
    const existing = await supabaseSelect<
      Array<Record<string, unknown> & { employee_id: string; id: string }>
    >(
      `hr_attendance?attendance_date=eq.${encodeURIComponent(
        attendanceDate,
      )}&select=*`,
    );
    const existingByEmployee = new Map(
      existing.map((record) => [record.employee_id, record]),
    );
    const results: Record<string, unknown>[] = [];
    const inserts: Record<string, unknown>[] = [];

    for (const employeeId of employeeIds) {
      const row = attendanceToRow(body, employeeId);
      const current = existingByEmployee.get(employeeId);
      if (current) {
        if (body.preserveExisting) continue;
        const updated = await supabasePatch<Record<string, unknown>[]>(
          `hr_attendance?id=eq.${encodeURIComponent(current.id)}`,
          row,
        );
        results.push(...updated);
      } else {
        inserts.push({ ...row, id: randomUUID() });
      }
    }

    if (inserts.length) {
      const inserted = await supabaseInsert<Record<string, unknown>[]>(
        "hr_attendance",
        inserts,
      );
      results.push(...inserted);
    }

    return NextResponse.json({
      attendance: results.map(hrAttendanceFromRow),
      saved: results.length,
    });
  } catch (error) {
    return attendanceError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as AttendanceBody;
  const employeeIds = [cleanText(body.employeeId)].filter(Boolean);
  const error =
    !cleanText(body.id) || validateAttendance(body, employeeIds);
  if (error) {
    return NextResponse.json(
      { error: typeof error === "string" ? error : "Seleccione un registro." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase no esta configurado." },
      { status: 503 },
    );
  }

  try {
    const duplicates = await supabaseSelect<Array<{ id: string }>>(
      `hr_attendance?employee_id=eq.${encodeURIComponent(
        employeeIds[0],
      )}&attendance_date=eq.${encodeURIComponent(
        cleanText(body.attendanceDate),
      )}&id=neq.${encodeURIComponent(body.id!)}&select=id&limit=1`,
    );
    if (duplicates[0]) {
      return NextResponse.json(
        { error: "Ese funcionario ya tiene asistencia registrada en la fecha." },
        { status: 409 },
      );
    }

    const rows = await supabasePatch<Record<string, unknown>[]>(
      `hr_attendance?id=eq.${encodeURIComponent(body.id!)}`,
      attendanceToRow(body, employeeIds[0]),
    );
    if (!rows[0]) {
      return NextResponse.json(
        { error: "Registro de asistencia no encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json({ attendance: hrAttendanceFromRow(rows[0]) });
  } catch (error) {
    return attendanceError(error);
  }
}

function attendanceToRow(body: AttendanceBody, employeeId: string) {
  return {
    attendance_date: cleanText(body.attendanceDate),
    employee_id: employeeId,
    entry_time: cleanText(body.entry) || null,
    exit_time: cleanText(body.exit) || null,
    extra_hours: Math.max(0, Number(body.extraHours) || 0),
    lunch_in: cleanText(body.lunchIn) || null,
    lunch_out: cleanText(body.lunchOut) || null,
    notes: cleanText(body.notes) || null,
    status: cleanText(body.status) || "Presente",
  };
}

function validateAttendance(body: AttendanceBody, employeeIds: string[]) {
  if (!employeeIds.length) return "Seleccione al menos un funcionario.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanText(body.attendanceDate))) {
    return "Ingrese una fecha valida.";
  }
  if (!["Presente", "Ausente", "Permiso", "Reposo"].includes(cleanText(body.status))) {
    return "Seleccione un estado valido.";
  }
  if (Number(body.extraHours) < 0) {
    return "Las horas extras no pueden ser negativas.";
  }
  return "";
}

function cleanText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function attendanceError(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la asistencia.",
    },
    { status: 400 },
  );
}
