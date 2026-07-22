import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { InventoryItem, InventoryMovement } from "@/lib/company-data";
import {
  inventoryItemFromRow,
  inventoryMovementFromRow,
  inventoryMovementToRow,
} from "@/lib/db-mappers";
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ movements: [], storageMode: "demo" });
  }

  const rows = await supabaseSelect<unknown[]>(
    "inventory_movements?select=*&order=movement_date.desc,created_at.desc",
  );

  return NextResponse.json({
    movements: rows.map((row) => inventoryMovementFromRow(row as never)),
    storageMode: "supabase",
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<InventoryMovement>;
  const validationError = validateMovement(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const quantity = Number(body.quantity);
  const payload = {
    itemId: body.itemId!,
    warehouseName: body.warehouseName!,
    targetWarehouseName: body.targetWarehouseName ?? "",
    movementType: body.movementType!,
    movementDate: body.movementDate!,
    quantity,
    unitCost: Number(body.unitCost ?? 0),
    documentNumber: body.documentNumber ?? "",
    responsible: body.responsible ?? "",
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

  const itemRows = await supabaseSelect<unknown[]>(
    `inventory_items?id=eq.${encodeURIComponent(payload.itemId)}&select=*&limit=1`,
  );
  if (!itemRows[0]) {
    return NextResponse.json({ error: "Articulo no encontrado." }, { status: 404 });
  }

  const currentItem = inventoryItemFromRow(itemRows[0] as never);
  const nextStock = calculateNextStock(currentItem, payload.movementType, quantity);
  if (nextStock < 0) {
    return NextResponse.json(
      { error: "El movimiento dejaria stock negativo." },
      { status: 400 },
    );
  }

  const movementRows = await supabaseInsert<unknown[]>(
    "inventory_movements",
    inventoryMovementToRow(payload),
  );
  const itemUpdateRows = await supabasePatch<unknown[]>(
    `inventory_items?id=eq.${encodeURIComponent(payload.itemId)}`,
    {
      current_stock: nextStock,
      unit_cost:
        payload.movementType === "entrada" && payload.unitCost > 0
          ? payload.unitCost
          : currentItem.unitCost,
      updated_at: new Date().toISOString(),
    },
  );

  return NextResponse.json(
    {
      item: inventoryItemFromRow(itemUpdateRows[0] as never),
      movement: inventoryMovementFromRow(movementRows[0] as never),
      storageMode: "supabase",
    },
    { status: 201 },
  );
}

function validateMovement(body: Partial<InventoryMovement>) {
  if (!body.itemId) return "Seleccione un articulo.";
  if (!body.warehouseName) return "Seleccione un deposito.";
  if (!body.movementType) return "Seleccione el tipo de movimiento.";
  if (!body.movementDate) return "Ingrese la fecha.";
  if (!Number.isFinite(Number(body.quantity)) || Number(body.quantity) <= 0) {
    return "Ingrese una cantidad valida.";
  }
  if (body.movementType === "traslado" && !body.targetWarehouseName) {
    return "Seleccione el deposito destino.";
  }
  return null;
}

function calculateNextStock(
  item: InventoryItem,
  movementType: InventoryMovement["movementType"],
  quantity: number,
) {
  if (movementType === "entrada") return item.currentStock + quantity;
  if (movementType === "ajuste") return quantity;
  return item.currentStock - quantity;
}
