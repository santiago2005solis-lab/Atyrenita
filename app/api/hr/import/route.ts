import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import {
  isSupabaseConfigured,
  supabaseSelect,
  supabaseUpsert,
} from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

type SourceRecord = Record<string, unknown>;
type SourceBackup = {
  advances?: SourceRecord[];
  attendance?: SourceRecord[];
  consultations?: SourceRecord[];
  documents?: SourceRecord[];
  employees?: SourceRecord[];
  events?: SourceRecord[];
  payroll?: SourceRecord[];
  payments?: SourceRecord[];
  sectors?: SourceRecord[];
  transfers?: SourceRecord[];
};

export async function POST(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "administrador");
  if (auth.error) return auth.error;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase no esta configurado." },
      { status: 503 },
    );
  }

  const backup = (await request.json()) as SourceBackup;
  if (!Array.isArray(backup.employees) || !Array.isArray(backup.sectors)) {
    return NextResponse.json(
      { error: "El respaldo no tiene el formato de Recursos Humanos esperado." },
      { status: 400 },
    );
  }

  try {
    const sectorRows = backup.sectors.map((sector) => ({
      boss: nullableText(sector.boss),
      description: nullableText(sector.description),
      establishment: nullableText(sector.establishment),
      id: requiredText(sector.id),
      name: requiredText(sector.name),
      status: sector.status === "Inactivo" ? "Inactivo" : "Activo",
    }));
    await upsertRows("hr_sectors?on_conflict=id", sectorRows);

    const existingEmployees = await supabaseSelect<
      Array<{
        document_number: string | null;
        id: string;
        legacy_id: string | null;
      }>
    >("hr_employees?select=id,legacy_id,document_number");
    const existingByLegacy = new Map(
      existingEmployees
        .filter((employee) => employee.legacy_id)
        .map((employee) => [employee.legacy_id!, employee]),
    );
    const existingByDocument = new Map(
      existingEmployees
        .filter((employee) => employee.document_number)
        .map((employee) => [employee.document_number!, employee]),
    );
    const employeeIdMap = new Map<string, string>();

    const employeeRows = backup.employees.map((employee) => {
      const legacyId = requiredText(employee.id);
      const documentNumber = text(employee.ci);
      const existing =
        existingByLegacy.get(legacyId) ||
        (documentNumber ? existingByDocument.get(documentNumber) : undefined);
      const employeeId = existing?.id ?? randomUUID();
      employeeIdMap.set(legacyId, employeeId);

      const salaryType =
        employee.salaryType === "jornal" || employee.payScheme === "jornal"
          ? "jornal"
          : "mensual";
      const sourceSalary = numberValue(employee.salary);
      return {
        account_holder: nullableText(employee.accountHolder),
        account_number: nullableText(employee.accountNumber),
        account_type: nullableText(employee.accountType),
        address: nullableText(employee.address),
        bank: nullableText(employee.bank),
        birth_date: nullableDate(employee.birthDate),
        boss: nullableText(employee.boss),
        city: nullableText(employee.city),
        contract_end: nullableDate(employee.contractEnd),
        contract_start: nullableDate(employee.contractStart),
        contract_type: nullableText(employee.contractType),
        daily_wage:
          salaryType === "jornal"
            ? numberValue(employee.dailyWage) || sourceSalary
            : numberValue(employee.dailyWage),
        department:
          sectorRows.find((sector) => sector.id === text(employee.sectorId))?.name ??
          "",
        document_number: documentNumber || null,
        email: nullableText(employee.email),
        emergency_name: nullableText(employee.emergencyName),
        emergency_phone: nullableText(employee.emergencyPhone),
        emergency_phone_2: nullableText(employee.emergencyPhone2),
        emergency_relation: nullableText(employee.emergencyRelation),
        employee_code: nullableText(employee.code),
        exit_date: nullableDate(employee.exitDate),
        full_name: [text(employee.firstName), text(employee.lastName)]
          .filter(Boolean)
          .join(" ")
          .trim(),
        functions: nullableText(employee.functions),
        id: employeeId,
        legacy_id: legacyId,
        marital_status: nullableText(employee.maritalStatus),
        monthly_salary:
          salaryType === "mensual"
            ? numberValue(employee.monthlySalary) || sourceSalary
            : numberValue(employee.monthlySalary),
        nationality: nullableText(employee.nationality),
        notes: nullableText(employee.notes),
        pay_method: nullableText(employee.payMethod),
        phone: nullableText(employee.phone),
        role: nullableText(employee.role),
        salary_type: salaryType,
        schedule: nullableText(employee.schedule),
        sector_id: nullableText(employee.sectorId),
        start_date: nullableDate(employee.admissionDate),
        status: employeeStatus(employee.status),
      };
    });
    await upsertRows("hr_employees?on_conflict=id", employeeRows);

    const transferRows = records(backup.transfers).map((record) => ({
      boss: nullableText(record.boss),
      created_by_name: nullableText(record.createdBy),
      employee_id: mappedEmployeeId(record.employeeId, employeeIdMap),
      from_boss: nullableText(record.fromBoss),
      from_role: nullableText(record.fromRole),
      from_sector_id: nullableText(record.fromSector),
      id: requiredText(record.id),
      notes: nullableText(record.notes),
      reason: nullableText(record.reason),
      to_role: nullableText(record.toRole),
      to_sector_id: requiredText(record.toSector),
      transfer_date: requiredDate(record.date),
    }));
    const attendanceRows = records(backup.attendance).map((record) => ({
      attendance_date: requiredDate(record.date),
      employee_id: mappedEmployeeId(record.employeeId, employeeIdMap),
      entry_time: nullableTime(record.entry),
      exit_time: nullableTime(record.exit),
      extra_hours: numberValue(record.extraHours),
      id: requiredText(record.id),
      lunch_in: nullableTime(record.lunchIn),
      lunch_out: nullableTime(record.lunchOut),
      notes: nullableText(record.notes),
      status: text(record.status) || "Presente",
    }));
    const eventRows = records(backup.events).map((record) => ({
      date_from: requiredDate(record.dateFrom),
      date_to: nullableDate(record.dateTo),
      discount: numberValue(record.discount),
      employee_id: mappedEmployeeId(record.employeeId, employeeIdMap),
      event_type: requiredText(record.type),
      extra_rate: numberValue(record.extraRate),
      hours: numberValue(record.hours),
      id: requiredText(record.id),
      justification: nullableText(record.justification),
      notes: nullableText(record.notes),
      paid: nullableText(record.paid),
      reason: nullableText(record.reason),
      status: text(record.status) || "Pendiente",
    }));
    const advanceRows = records(backup.advances).map((record) => ({
      advance_date: requiredDate(record.date),
      amount: numberValue(record.amount),
      approved_by: nullableText(record.approvedBy),
      employee_id: mappedEmployeeId(record.employeeId, employeeIdMap),
      id: requiredText(record.id),
      method: nullableText(record.method),
      payroll_month: requiredText(record.month),
      reason: nullableText(record.reason),
    }));
    const payrollRows = records(backup.payroll).map((record) => ({
      employee_id: mappedEmployeeId(record.employeeId, employeeIdMap),
      extra_rate: numberValue(record.extraRate),
      id:
        text(record.id) ||
        `pay-${requiredText(record.employeeId)}-${requiredText(record.month)}`,
      notes: nullableText(record.notes),
      other_discounts: numberValue(record.otherDiscounts),
      other_income: numberValue(record.otherIncome),
      payroll_month: requiredText(record.month),
      salary: numberValue(record.salary),
    }));
    const paymentRows = records(backup.payments).map((record) => ({
      amount: numberValue(record.amount),
      employee_id: mappedEmployeeId(record.employeeId, employeeIdMap),
      id: requiredText(record.id),
      method: nullableText(record.method),
      notes: nullableText(record.notes),
      payment_date: requiredDate(record.date),
      payroll_month: requiredText(record.month),
      reference: nullableText(record.reference),
      status: record.status === "anulado" ? "anulado" : "confirmado",
    }));
    const documentRows = records(backup.documents).map((record) => ({
      delivery_date: nullableDate(record.deliveryDate),
      document_type: requiredText(record.type),
      employee_id: mappedEmployeeId(record.employeeId, employeeIdMap),
      expiry_date: nullableDate(record.expiryDate),
      file_name: nullableText(record.fileName),
      file_path: nullableText(record.filePath),
      file_size: numberValue(record.fileSize),
      id: requiredText(record.id),
      mime_type: nullableText(record.mimeType),
      notes: nullableText(record.notes),
      reference: nullableText(record.reference),
      status: text(record.status) || "Pendiente",
      uploaded_at: nullableText(record.uploadedAt),
    }));
    const consultationRows = records(backup.consultations).map((record) => ({
      consultation_date: requiredDate(record.date),
      consultation_type: requiredText(record.type),
      detail: nullableText(record.detail),
      employee_id: mappedEmployeeId(record.employeeId, employeeIdMap),
      id: requiredText(record.id),
      response: nullableText(record.response),
      status: text(record.status) || "Abierta",
      subject: requiredText(record.subject),
    }));

    await Promise.all([
      upsertRows("hr_transfers?on_conflict=id", transferRows),
      upsertRows("hr_attendance?on_conflict=id", attendanceRows),
      upsertRows("hr_events?on_conflict=id", eventRows),
      upsertRows("hr_advances?on_conflict=id", advanceRows),
      upsertRows("hr_payroll?on_conflict=id", payrollRows),
      upsertRows("hr_salary_payments?on_conflict=id", paymentRows),
      upsertRows("hr_documents?on_conflict=id", documentRows),
      upsertRows("hr_consultations?on_conflict=id", consultationRows),
    ]);

    return NextResponse.json({
      imported: {
        advances: advanceRows.length,
        attendance: attendanceRows.length,
        consultations: consultationRows.length,
        documents: documentRows.length,
        employees: employeeRows.length,
        events: eventRows.length,
        payroll: payrollRows.length,
        payments: paymentRows.length,
        sectors: sectorRows.length,
        transfers: transferRows.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo importar el respaldo.",
      },
      { status: 400 },
    );
  }
}

async function upsertRows(path: string, rows: SourceRecord[]) {
  if (!rows.length) return;
  await supabaseUpsert<unknown[]>(path, rows);
}

function records(value: SourceRecord[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function mappedEmployeeId(
  sourceId: unknown,
  employeeIdMap: Map<string, string>,
) {
  const id = employeeIdMap.get(requiredText(sourceId));
  if (!id) throw new Error("Un registro referencia un funcionario inexistente.");
  return id;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function requiredText(value: unknown) {
  const result = text(value);
  if (!result) throw new Error("El respaldo contiene un identificador requerido vacio.");
  return result;
}

function nullableText(value: unknown) {
  return text(value) || null;
}

function numberValue(value: unknown) {
  return Number(value ?? 0) || 0;
}

function nullableDate(value: unknown) {
  const result = text(value);
  return result || null;
}

function requiredDate(value: unknown) {
  const result = nullableDate(value);
  if (!result) throw new Error("El respaldo contiene una fecha requerida vacia.");
  return result;
}

function nullableTime(value: unknown) {
  const result = text(value);
  return result || null;
}

function employeeStatus(value: unknown) {
  if (value === "Licencia" || value === "licencia") return "licencia";
  if (value === "Inactivo" || value === "inactivo") return "inactivo";
  return "activo";
}
