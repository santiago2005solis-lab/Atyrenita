import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { FinanceMovement } from "@/lib/company-data";
import {
  financeMovementFromRow,
  financeMovementToRow,
} from "@/lib/db-mappers";
import { requireAppUser } from "@/lib/auth";
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabaseSelect,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAppUser(request, "financiero", "lector");
  if (auth.error) return auth.error;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ movements: [], storageMode: "demo" });
  }

  const rows = await supabaseSelect<unknown[]>(
    "finance_movements?select=*&order=movement_date.desc,created_at.desc",
  );

  return NextResponse.json({
    movements: rows.map((row) => financeMovementFromRow(row as never)),
    storageMode: "supabase",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "financiero", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as Partial<FinanceMovement>;
  const validationError = validateMovement(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const payload = {
    accountName: body.accountName!,
    cashboxName: body.cashboxName!,
    costCenterName: body.costCenterName!,
    movementType: body.movementType!,
    movementDate: body.movementDate!,
    concept: body.concept!.trim(),
    category: body.category!,
    amount: Number(body.amount),
    currency: "PYG" as const,
    linkedModule: body.linkedModule!,
    paymentMethod: body.paymentMethod ?? "",
    documentNumber: body.documentNumber ?? "",
    responsible: body.responsible ?? "",
    relatedParty: body.relatedParty ?? "",
    sourceModule: body.sourceModule ?? "manual",
    status: body.status ?? "activo",
    notes: body.notes ?? "",
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        movement: {
          ...payload,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        },
        storageMode: "demo",
      },
      { status: 201 },
    );
  }

  const rows = await supabaseInsert<unknown[]>(
    "finance_movements",
    financeMovementToRow(payload),
  );

  return NextResponse.json(
    {
      movement: financeMovementFromRow(rows[0] as never),
      storageMode: "supabase",
    },
    { status: 201 },
  );
}

function validateMovement(body: Partial<FinanceMovement>) {
  if (!body.cashboxName) return "Seleccione una caja.";
  if (!body.movementType) return "Seleccione el tipo de movimiento.";
  if (!body.movementDate) return "Ingrese la fecha.";
  if (!body.concept?.trim()) return "Ingrese el concepto.";
  if (!body.category) return "Seleccione una categoria.";
  if (!body.accountName) return "Seleccione una cuenta contable.";
  if (!body.costCenterName) return "Seleccione un centro de costo.";
  if (!body.linkedModule) return "Seleccione el modulo vinculado.";
  if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) {
    return "Ingrese un monto valido.";
  }
  return null;
}
