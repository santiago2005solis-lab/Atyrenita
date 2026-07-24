import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { hrSectorFromRow } from "@/lib/hr-mappers";
import {
  isSupabaseConfigured,
  supabaseDelete,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

type SectorBody = {
  action?: "merge";
  boss?: string;
  description?: string;
  establishment?: string;
  id?: string;
  name?: string;
  sourceId?: string;
  status?: "Activo" | "Inactivo";
  targetId?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SectorBody;
  const minimumRole = body.action === "merge" ? "administrador" : "editor";
  const auth = await requireAppUser(request, "rrhh", minimumRole);
  if (auth.error) return auth.error;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase no esta configurado." },
      { status: 503 },
    );
  }

  try {
    if (body.action === "merge") {
      return mergeSectors(body);
    }

    const error = validateSector(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const rows = await supabaseInsert<Record<string, unknown>[]>("hr_sectors", {
      boss: cleanText(body.boss) || null,
      description: cleanText(body.description) || null,
      establishment: cleanText(body.establishment) || null,
      id: `sector-${randomUUID()}`,
      name: cleanText(body.name),
      status: body.status === "Inactivo" ? "Inactivo" : "Activo",
    });
    return NextResponse.json(
      { sector: hrSectorFromRow(rows[0]) },
      { status: 201 },
    );
  } catch (error) {
    return sectorError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as SectorBody;
  const error = validateSector(body, true);
  if (error) return NextResponse.json({ error }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase no esta configurado." },
      { status: 503 },
    );
  }

  try {
    const existing = await supabaseSelect<
      Array<{ id: string; name: string }>
    >(
      `hr_sectors?id=eq.${encodeURIComponent(body.id!)}&select=id,name&limit=1`,
    );
    if (!existing[0]) {
      return NextResponse.json(
        { error: "Sector no encontrado." },
        { status: 404 },
      );
    }

    const nextName = cleanText(body.name);
    const rows = await supabasePatch<Record<string, unknown>[]>(
      `hr_sectors?id=eq.${encodeURIComponent(body.id!)}`,
      {
        boss: cleanText(body.boss) || null,
        description: cleanText(body.description) || null,
        establishment: cleanText(body.establishment) || null,
        name: nextName,
        status: body.status === "Inactivo" ? "Inactivo" : "Activo",
      },
    );

    await Promise.all([
      supabasePatch<unknown[]>(
        `hr_employees?sector_id=eq.${encodeURIComponent(body.id!)}`,
        { department: nextName },
      ),
      supabasePatch<unknown[]>(
        `hr_employees?department=eq.${encodeURIComponent(existing[0].name)}`,
        { department: nextName, sector_id: body.id },
      ),
    ]);

    return NextResponse.json({ sector: hrSectorFromRow(rows[0]) });
  } catch (error) {
    return sectorError(error);
  }
}

async function mergeSectors(body: SectorBody) {
  const sourceId = cleanText(body.sourceId);
  const targetId = cleanText(body.targetId);
  if (!sourceId || !targetId || sourceId === targetId) {
    return NextResponse.json(
      { error: "Seleccione dos sectores diferentes para unificar." },
      { status: 400 },
    );
  }

  const sectors = await supabaseSelect<Array<{ id: string; name: string }>>(
    `hr_sectors?id=in.(${encodeURIComponent(sourceId)},${encodeURIComponent(
      targetId,
    )})&select=id,name`,
  );
  const source = sectors.find((sector) => sector.id === sourceId);
  const target = sectors.find((sector) => sector.id === targetId);
  if (!source || !target) {
    return NextResponse.json(
      { error: "Uno de los sectores ya no existe." },
      { status: 404 },
    );
  }

  await supabasePatch<unknown[]>(
    `hr_employees?sector_id=eq.${encodeURIComponent(sourceId)}`,
    { department: target.name, sector_id: targetId },
  );
  await supabasePatch<unknown[]>(
    `hr_employees?department=eq.${encodeURIComponent(source.name)}`,
    { department: target.name, sector_id: targetId },
  );
  await Promise.all([
    supabasePatch<unknown[]>(
      `hr_transfers?from_sector_id=eq.${encodeURIComponent(sourceId)}`,
      { from_sector_id: targetId },
    ),
    supabasePatch<unknown[]>(
      `hr_transfers?to_sector_id=eq.${encodeURIComponent(sourceId)}`,
      { to_sector_id: targetId },
    ),
  ]);
  await supabaseDelete<unknown[]>(
    `hr_sectors?id=eq.${encodeURIComponent(sourceId)}`,
  );

  return NextResponse.json({
    merged: true,
    source: source.name,
    target: target.name,
  });
}

function validateSector(body: SectorBody, requireId = false) {
  if (requireId && !cleanText(body.id)) return "Seleccione un sector.";
  if (!cleanText(body.name)) return "Ingrese el nombre del sector.";
  if (body.status && !["Activo", "Inactivo"].includes(body.status)) {
    return "El estado del sector no es valido.";
  }
  return "";
}

function cleanText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function sectorError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "No se pudo guardar el sector.";
  const duplicate = message.includes("duplicate") || message.includes("23505");
  return NextResponse.json(
    {
      error: duplicate
        ? "Ya existe un sector con ese nombre."
        : message,
    },
    { status: 400 },
  );
}
