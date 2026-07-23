import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { HrEmployee } from "@/lib/company-data";
import { requireAppUser } from "@/lib/auth";
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabasePatch,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

type EmployeeBody = Partial<HrEmployee>;

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as EmployeeBody;
  const error = validateEmployee(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const employee = employeeFromBody(body);
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { employee: { ...employee, id: randomUUID() } },
      { status: 201 },
    );
  }

  const rows = await supabaseInsert<unknown[]>("hr_employees", employeeToRow(employee));
  return NextResponse.json(
    { employee: employeeFromRow(rows[0] as Record<string, unknown>) },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "editor");
  if (auth.error) return auth.error;

  const body = (await request.json()) as EmployeeBody;
  if (!body.id) {
    return NextResponse.json(
      { error: "Seleccione el funcionario que desea editar." },
      { status: 400 },
    );
  }
  const error = validateEmployee(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const employee = employeeFromBody(body);
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ employee: { ...employee, id: body.id } });
  }

  const rows = await supabasePatch<unknown[]>(
    `hr_employees?id=eq.${encodeURIComponent(body.id)}`,
    employeeToRow(employee),
  );
  if (!rows[0]) {
    return NextResponse.json(
      { error: "Funcionario no encontrado." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    employee: employeeFromRow(rows[0] as Record<string, unknown>),
  });
}

function validateEmployee(body: EmployeeBody) {
  if (!body.fullName?.trim()) return "Ingrese el nombre del funcionario.";
  if (!body.department?.trim()) return "Ingrese el sector del funcionario.";
  if (
    body.status &&
    !["activo", "licencia", "inactivo"].includes(body.status)
  ) {
    return "El estado del funcionario no es valido.";
  }
  if (Number(body.monthlySalary) < 0) return "El salario no puede ser negativo.";
  return "";
}

function employeeFromBody(body: EmployeeBody): Omit<HrEmployee, "id"> {
  return {
    department: body.department?.trim() ?? "",
    documentNumber: body.documentNumber?.trim() ?? "",
    fullName: body.fullName?.trim() ?? "",
    monthlySalary: Number(body.monthlySalary) || 0,
    notes: body.notes?.trim() ?? "",
    role: body.role?.trim() ?? "",
    startDate: body.startDate ?? "",
    status: body.status ?? "activo",
  };
}

function employeeToRow(employee: Omit<HrEmployee, "id">) {
  return {
    department: employee.department,
    document_number: employee.documentNumber || null,
    full_name: employee.fullName,
    monthly_salary: employee.monthlySalary,
    notes: employee.notes || null,
    role: employee.role || null,
    start_date: employee.startDate || null,
    status: employee.status,
  };
}

function employeeFromRow(row: Record<string, unknown>): HrEmployee {
  return {
    department: String(row.department ?? ""),
    documentNumber: String(row.document_number ?? ""),
    fullName: String(row.full_name ?? ""),
    id: String(row.id ?? ""),
    monthlySalary: Number(row.monthly_salary ?? 0),
    notes: String(row.notes ?? ""),
    role: String(row.role ?? ""),
    startDate: String(row.start_date ?? ""),
    status:
      row.status === "licencia" || row.status === "inactivo"
        ? row.status
        : "activo",
  };
}
