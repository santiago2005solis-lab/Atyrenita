import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { hrEventFromRow } from "@/lib/hr-mappers";
import { hasPermission } from "@/lib/permissions";
import {
  isSupabaseConfigured,
  supabaseDelete,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

const eventTypes = [
  "Ausencia",
  "Justificacion",
  "Permiso",
  "Vacaciones",
  "Reposo medico",
  "Hora extra",
  "Otro",
] as const;
const eventStatuses = ["Pendiente", "Aprobado", "Rechazado"] as const;

type EventBody = {
  dateFrom?: string;
  dateTo?: string;
  discount?: number;
  employeeId?: string;
  eventType?: string;
  hours?: number;
  id?: string;
  justification?: string;
  notes?: string;
  paid?: string;
  reason?: string;
  status?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as EventBody;
  const error = validateEvent(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!isSupabaseConfigured()) return databaseUnavailable();

  const requestedStatus = eventStatus(body.status);
  const canApprove = hasPermission(
    auth.user ?? undefined,
    "rrhh",
    "administrador",
  );
  if (requestedStatus !== "Pendiente" && !canApprove) {
    return NextResponse.json(
      { error: "Se requiere permiso de administrador para aprobar o rechazar." },
      { status: 403 },
    );
  }

  try {
    const id = `event-${randomUUID()}`;
    const rows = await supabaseInsert<Record<string, unknown>[]>("hr_events", {
      ...eventToRow(body),
      id,
      status: requestedStatus,
    });
    if (requestedStatus === "Aprobado") {
      await syncEventAttendance({ ...body, id, status: requestedStatus });
    }
    return NextResponse.json(
      { event: hrEventFromRow(rows[0]) },
      { status: 201 },
    );
  } catch (error) {
    return eventError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as EventBody;
  if (!cleanText(body.id)) {
    return NextResponse.json(
      { error: "Seleccione una novedad." },
      { status: 400 },
    );
  }
  const error = validateEvent(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!isSupabaseConfigured()) return databaseUnavailable();

  const requestedStatus = eventStatus(body.status);
  const canApprove = hasPermission(
    auth.user ?? undefined,
    "rrhh",
    "administrador",
  );
  if (requestedStatus !== "Pendiente" && !canApprove) {
    return NextResponse.json(
      { error: "Se requiere permiso de administrador para aprobar o rechazar." },
      { status: 403 },
    );
  }

  try {
    const existingRows = await supabaseSelect<Record<string, unknown>[]>(
      `hr_events?id=eq.${encodeURIComponent(body.id!)}&select=*`,
    );
    if (!existingRows[0]) {
      return NextResponse.json(
        { error: "Novedad no encontrada." },
        { status: 404 },
      );
    }
    const existingEvent = hrEventFromRow(existingRows[0]);
    if (
      eventStatus(existingEvent.status) !== "Pendiente" &&
      !canApprove
    ) {
      return NextResponse.json(
        {
          error:
            "Se requiere permiso de administrador para modificar una novedad procesada.",
        },
        { status: 403 },
      );
    }

    const rows = await supabasePatch<Record<string, unknown>[]>(
      `hr_events?id=eq.${encodeURIComponent(body.id!)}`,
      {
        ...eventToRow(body),
        status: requestedStatus,
      },
    );
    if (!rows[0]) {
      return NextResponse.json(
        { error: "Novedad no encontrada." },
        { status: 404 },
      );
    }
    await syncEventAttendance({ ...body, status: requestedStatus });
    return NextResponse.json({ event: hrEventFromRow(rows[0]) });
  } catch (error) {
    return eventError(error);
  }
}

function eventToRow(body: EventBody) {
  return {
    date_from: cleanText(body.dateFrom),
    date_to: cleanText(body.dateTo) || cleanText(body.dateFrom),
    discount: Math.max(0, Number(body.discount) || 0),
    employee_id: cleanText(body.employeeId),
    event_type: canonicalEventType(body.eventType),
    hours: Math.max(0, Number(body.hours) || 0),
    justification: cleanText(body.justification) || null,
    notes: cleanText(body.notes) || null,
    paid: cleanText(body.paid) || "No",
    reason: cleanText(body.reason) || null,
  };
}

async function syncEventAttendance(body: EventBody) {
  const id = cleanText(body.id);
  if (!id) return;
  const marker = `NOVEDAD_RRHH:${id}`;

  await supabaseDelete<unknown[]>(
    `hr_attendance?notes=eq.${encodeURIComponent(marker)}`,
  );

  if (eventStatus(body.status) !== "Aprobado") return;
  const attendanceStatus = attendanceStatusForEvent(body.eventType);
  if (!attendanceStatus) return;

  const employeeId = cleanText(body.employeeId);
  const dateFrom = cleanText(body.dateFrom);
  const dateTo = cleanText(body.dateTo) || dateFrom;
  const existing = await supabaseSelect<
    Array<{ attendance_date: string }>
  >(
    `hr_attendance?employee_id=eq.${encodeURIComponent(
      employeeId,
    )}&attendance_date=gte.${encodeURIComponent(
      dateFrom,
    )}&attendance_date=lte.${encodeURIComponent(
      dateTo,
    )}&select=attendance_date`,
  );
  const existingDates = new Set(existing.map((record) => record.attendance_date));
  const rows = dateRange(dateFrom, dateTo)
    .filter((date) => !existingDates.has(date))
    .map((date) => ({
      attendance_date: date,
      employee_id: employeeId,
      entry_time: null,
      exit_time: null,
      extra_hours: 0,
      id: `attendance-event-${randomUUID()}`,
      lunch_in: null,
      lunch_out: null,
      notes: marker,
      status: attendanceStatus,
    }));

  if (rows.length) {
    await supabaseInsert<unknown[]>("hr_attendance", rows);
  }
}

function validateEvent(body: EventBody) {
  if (!cleanText(body.employeeId)) return "Seleccione un funcionario.";
  if (
    !eventTypes.some(
      (type) => normalizeText(type) === normalizeText(cleanText(body.eventType)),
    )
  ) {
    return "Seleccione un tipo de novedad valido.";
  }
  const dateFrom = cleanText(body.dateFrom);
  const dateTo = cleanText(body.dateTo) || dateFrom;
  if (!datePattern(dateFrom) || !datePattern(dateTo)) {
    return "Ingrese un periodo valido.";
  }
  if (dateTo < dateFrom) {
    return "La fecha final no puede ser anterior a la fecha inicial.";
  }
  if (dateRange(dateFrom, dateTo).length > 366) {
    return "El periodo no puede superar un ano.";
  }
  if (
    cleanText(body.status) &&
    !eventStatuses.some(
      (status) => normalizeText(status) === normalizeText(cleanText(body.status)),
    )
  ) {
    return "Seleccione un estado valido.";
  }
  if (Number(body.hours) < 0 || Number(body.discount) < 0) {
    return "Las horas y el descuento no pueden ser negativos.";
  }
  return "";
}

function canonicalEventType(value: unknown): (typeof eventTypes)[number] {
  const normalized = normalizeText(cleanText(value));
  return (
    eventTypes.find((type) => normalizeText(type) === normalized) ?? "Otro"
  );
}

function eventStatus(value: unknown): (typeof eventStatuses)[number] {
  const normalized = normalizeText(cleanText(value));
  return (
    eventStatuses.find((status) => normalizeText(status) === normalized) ??
    "Pendiente"
  );
}

function attendanceStatusForEvent(value: unknown) {
  const normalized = normalizeText(cleanText(value));
  if (normalized.includes("ausencia")) return "Ausente";
  if (normalized.includes("permiso") || normalized.includes("justificacion")) {
    return "Permiso";
  }
  if (normalized.includes("vacaciones") || normalized.includes("reposo")) {
    return "Reposo";
  }
  return "";
}

function dateRange(from: string, to: string) {
  const dates: string[] = [];
  const current = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (current <= end && dates.length <= 366) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function datePattern(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function databaseUnavailable() {
  return NextResponse.json(
    { error: "Supabase no esta configurado." },
    { status: 503 },
  );
}

function eventError(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la novedad.",
    },
    { status: 400 },
  );
}
