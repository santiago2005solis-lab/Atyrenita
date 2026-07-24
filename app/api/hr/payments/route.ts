import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { hrSalaryPaymentFromRow } from "@/lib/hr-mappers";
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabasePatch,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

type PaymentBody = {
  amount?: number;
  date?: string;
  employeeId?: string;
  id?: string;
  method?: string;
  month?: string;
  notes?: string;
  reference?: string;
  status?: "confirmado" | "anulado";
};

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as PaymentBody;
  const error = validatePayment(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!isSupabaseConfigured()) return databaseUnavailable();

  try {
    const rows = await supabaseInsert<Record<string, unknown>[]>(
      "hr_salary_payments",
      {
        ...paymentToRow(body),
        id: `salary-payment-${randomUUID()}`,
      },
    );
    return NextResponse.json(
      { payment: hrSalaryPaymentFromRow(rows[0]) },
      { status: 201 },
    );
  } catch (error) {
    return paymentError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as PaymentBody;
  if (!cleanText(body.id)) {
    return NextResponse.json(
      { error: "Seleccione un pago." },
      { status: 400 },
    );
  }
  const error = validatePayment(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!isSupabaseConfigured()) return databaseUnavailable();

  try {
    const rows = await supabasePatch<Record<string, unknown>[]>(
      `hr_salary_payments?id=eq.${encodeURIComponent(body.id!)}`,
      paymentToRow(body),
    );
    if (!rows[0]) {
      return NextResponse.json(
        { error: "Pago no encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json({ payment: hrSalaryPaymentFromRow(rows[0]) });
  } catch (error) {
    return paymentError(error);
  }
}

function paymentToRow(body: PaymentBody) {
  return {
    amount: Number(body.amount),
    employee_id: cleanText(body.employeeId),
    method: cleanText(body.method) || null,
    notes: cleanText(body.notes) || null,
    payment_date: cleanText(body.date),
    payroll_month: cleanText(body.month),
    reference: cleanText(body.reference) || null,
    status: body.status === "anulado" ? "anulado" : "confirmado",
  };
}

function validatePayment(body: PaymentBody) {
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
    {
      error:
        "Falta aplicar la actualizacion de pagos salariales en Supabase.",
      migrationRequired: true,
    },
    { status: 409 },
  );
}

function paymentError(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el pago.",
    },
    { status: 400 },
  );
}

function cleanText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}
