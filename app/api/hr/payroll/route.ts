import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { hrPayrollFromRow } from "@/lib/hr-mappers";
import {
  isSupabaseConfigured,
  supabaseSelect,
  supabaseUpsert,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

type PayrollBody = {
  employeeId?: string;
  extraRate?: number;
  month?: string;
  notes?: string;
  otherDiscounts?: number;
  otherIncome?: number;
  salary?: number;
};

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as PayrollBody;
  const error = validatePayroll(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase no esta configurado." },
      { status: 503 },
    );
  }

  try {
    const employeeId = cleanText(body.employeeId);
    const month = cleanText(body.month);
    const existing = await supabaseSelect<Array<{ id: string }>>(
      `hr_payroll?employee_id=eq.${encodeURIComponent(
        employeeId,
      )}&payroll_month=eq.${encodeURIComponent(month)}&select=id&limit=1`,
    );
    const rows = await supabaseUpsert<Record<string, unknown>[]>(
      "hr_payroll?on_conflict=employee_id,payroll_month",
      {
        employee_id: employeeId,
        extra_rate: Number(body.extraRate) || 0,
        id: existing[0]?.id ?? `payroll-${randomUUID()}`,
        notes: cleanText(body.notes) || null,
        other_discounts: Number(body.otherDiscounts) || 0,
        other_income: Number(body.otherIncome) || 0,
        payroll_month: month,
        salary: Number(body.salary) || 0,
      },
    );
    return NextResponse.json({ payroll: hrPayrollFromRow(rows[0]) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la liquidacion.",
      },
      { status: 400 },
    );
  }
}

function validatePayroll(body: PayrollBody) {
  if (!cleanText(body.employeeId)) return "Seleccione un funcionario.";
  if (!/^\d{4}-\d{2}$/.test(cleanText(body.month))) {
    return "Ingrese el mes de liquidacion.";
  }
  for (const value of [
    body.salary,
    body.extraRate,
    body.otherIncome,
    body.otherDiscounts,
  ]) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      return "Los importes no pueden ser negativos.";
    }
  }
  return "";
}

function cleanText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}
