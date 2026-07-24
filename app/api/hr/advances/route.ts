import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { hrAdvanceFromRow } from "@/lib/hr-mappers";
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabasePatch,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

type AdvanceBody = {
  amount?: number;
  approvedBy?: string;
  date?: string;
  employeeId?: string;
  id?: string;
  method?: string;
  month?: string;
  reason?: string;
  status?: "activo" | "anulado";
};

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as AdvanceBody;
  const error = validateAdvance(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!isSupabaseConfigured()) return databaseUnavailable();

  try {
    const rows = await supabaseInsert<Record<string, unknown>[]>("hr_advances", {
      ...advanceToRow(body),
      id: `advance-${randomUUID()}`,
    });
    return NextResponse.json(
      { advance: hrAdvanceFromRow(rows[0]) },
      { status: 201 },
    );
  } catch (error) {
    return advanceError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as AdvanceBody;
  if (!cleanText(body.id)) {
    return NextResponse.json(
      { error: "Seleccione un anticipo." },
      { status: 400 },
    );
  }
  const error = validateAdvance(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!isSupabaseConfigured()) return databaseUnavailable();

  try {
    const rows = await supabasePatch<Record<string, unknown>[]>(
      `hr_advances?id=eq.${encodeURIComponent(body.id!)}`,
      advanceToRow(body),
    );
    if (!rows[0]) {
      return NextResponse.json(
        { error: "Anticipo no encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json({ advance: hrAdvanceFromRow(rows[0]) });
  } catch (error) {
    return advanceError(error);
  }
}

function advanceToRow(body: AdvanceBody) {
  return {
    advance_date: cleanText(body.date),
    amount: Number(body.amount),
    approved_by: cleanText(body.approvedBy) || null,
    employee_id: cleanText(body.employeeId),
    method: cleanText(body.method) || null,
    payroll_month: cleanText(body.month),
    reason: cleanText(body.reason) || null,
    status: body.status === "anulado" ? "anulado" : "activo",
  };
}

function validateAdvance(body: AdvanceBody) {
  if (!cleanText(body.employeeId)) return "Seleccione un funcionario.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanText(body.date))) {
    return "Ingrese una fecha valida.";
  }
  if (!/^\d{4}-\d{2}$/.test(cleanText(body.month))) {
    return "Ingrese el mes de liquidacion.";
  }
  if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) {
    return "El monto debe ser mayor a cero.";
  }
  return "";
}

function databaseUnavailable() {
  return NextResponse.json(
    { error: "Supabase no esta configurado." },
    { status: 503 },
  );
}

function advanceError(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el anticipo.",
    },
    { status: 400 },
  );
}

function cleanText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}
