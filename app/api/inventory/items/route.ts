import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { InventoryItem } from "@/lib/company-data";
import { requireAppUser } from "@/lib/auth";
import { inventoryItemFromRow, inventoryItemToRow } from "@/lib/db-mappers";
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabaseSelect,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAppUser(request, "deposito", "lector");
  if (auth.error) return auth.error;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ items: [], storageMode: "demo" });
  }

  const rows = await supabaseSelect<unknown[]>(
    "inventory_items?select=*&order=warehouse_name.asc,name.asc",
  );

  return NextResponse.json({
    items: rows.map((row) => inventoryItemFromRow(row as never)),
    storageMode: "supabase",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "deposito", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as Partial<InventoryItem>;
  const validationError = validateItem(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const payload = {
    warehouseName: body.warehouseName!,
    sku: body.sku!.trim().toUpperCase(),
    name: body.name!.trim(),
    category: body.category!,
    unit: body.unit!,
    currentStock: Number(body.currentStock),
    minStock: Number(body.minStock ?? 0),
    unitCost: Number(body.unitCost ?? 0),
    supplier: body.supplier ?? "",
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        item: {
          ...payload,
          id: randomUUID(),
          updatedAt: new Date().toISOString(),
        },
        storageMode: "demo",
      },
      { status: 201 },
    );
  }

  const rows = await supabaseInsert<unknown[]>(
    "inventory_items",
    inventoryItemToRow(payload),
  );

  return NextResponse.json(
    {
      item: inventoryItemFromRow(rows[0] as never),
      storageMode: "supabase",
    },
    { status: 201 },
  );
}

function validateItem(body: Partial<InventoryItem>) {
  if (!body.warehouseName) return "Seleccione un deposito.";
  if (!body.sku?.trim()) return "Ingrese el codigo interno.";
  if (!body.name?.trim()) return "Ingrese el articulo.";
  if (!body.category) return "Seleccione una categoria.";
  if (!body.unit) return "Seleccione una unidad.";
  if (!Number.isFinite(Number(body.currentStock)) || Number(body.currentStock) < 0) {
    return "Ingrese un stock valido.";
  }
  return null;
}
