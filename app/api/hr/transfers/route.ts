import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { hrTransferFromRow } from "@/lib/hr-mappers";
import {
  isSupabaseConfigured,
  supabaseInsert,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

type TransferBody = {
  boss?: string;
  date?: string;
  employeeId?: string;
  notes?: string;
  reason?: string;
  toRole?: string;
  toSectorId?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as TransferBody;
  const error = validateTransfer(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase no esta configurado." },
      { status: 503 },
    );
  }

  try {
    const rows = await supabaseInsert<Record<string, unknown>[]>(
      "rpc/hr_record_transfer",
      {
        p_created_by_name: auth.user.fullName,
        p_employee_id: cleanText(body.employeeId),
        p_id: `transfer-${randomUUID()}`,
        p_notes: cleanText(body.notes),
        p_reason: cleanText(body.reason),
        p_to_boss: cleanText(body.boss),
        p_to_role: cleanText(body.toRole),
        p_to_sector_id: cleanText(body.toSectorId),
        p_transfer_date: cleanText(body.date),
      },
    );

    if (!rows[0]) {
      throw new Error("Supabase no devolvio el cambio registrado.");
    }

    return NextResponse.json(
      { transfer: hrTransferFromRow(rows[0]) },
      { status: 201 },
    );
  } catch (saveError) {
    const message =
      saveError instanceof Error
        ? saveError.message
        : "No se pudo registrar el cambio.";
    const migrationRequired =
      message.includes("hr_record_transfer") ||
      message.includes("from_role") ||
      message.includes("PGRST202");

    return NextResponse.json(
      {
        error: migrationRequired
          ? "Falta ejecutar la actualizacion de cambios de sector y cargos en Supabase."
          : readableDatabaseError(message),
        migrationRequired,
      },
      { status: migrationRequired ? 409 : 400 },
    );
  }
}

function validateTransfer(body: TransferBody) {
  if (!cleanText(body.employeeId)) return "Seleccione un funcionario.";
  if (!isDate(body.date)) return "Ingrese una fecha valida.";
  if (body.date! > new Date().toISOString().slice(0, 10)) {
    return "La fecha del cambio no puede ser futura.";
  }
  if (!cleanText(body.toSectorId)) return "Seleccione el nuevo sector.";
  if (!cleanText(body.reason)) return "Ingrese el motivo del cambio.";
  return "";
}

function isDate(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(cleanText(value));
}

function cleanText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function readableDatabaseError(message: string) {
  if (message.includes("Funcionario no encontrado")) {
    return "El funcionario seleccionado ya no existe.";
  }
  if (message.includes("Sector de destino")) {
    return "El sector seleccionado no esta activo o ya no existe.";
  }
  if (message.includes("no tiene cambios")) {
    return "Modifique el sector, cargo o jefe antes de guardar.";
  }
  if (message.includes("inactivo")) {
    return "No se pueden registrar cambios para un funcionario inactivo.";
  }
  return message;
}
