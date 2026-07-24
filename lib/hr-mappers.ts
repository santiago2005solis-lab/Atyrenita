import type { HrEmployee } from "./company-data";
import type {
  HrAdvance,
  HrAttendance,
  HrConsultation,
  HrDocument,
  HrEvent,
  HrPayroll,
  HrSalaryPayment,
  HrSector,
  HrTransfer,
} from "./hr-data";

type Row = Record<string, unknown>;

export function hrEmployeeFromRow(row: Row): HrEmployee {
  return {
    dailyWage: numberValue(row.daily_wage),
    department: stringValue(row.department),
    documentNumber: stringValue(row.document_number),
    fullName: stringValue(row.full_name),
    id: stringValue(row.id),
    monthlySalary: numberValue(row.monthly_salary),
    notes: stringValue(row.notes),
    role: stringValue(row.role),
    salaryType: row.salary_type === "jornal" ? "jornal" : "mensual",
    startDate: stringValue(row.start_date),
    status:
      row.status === "licencia" || row.status === "inactivo"
        ? row.status
        : "activo",
  };
}

export function hrSectorFromRow(row: Row): HrSector {
  return {
    boss: stringValue(row.boss),
    description: stringValue(row.description),
    establishment: stringValue(row.establishment),
    id: stringValue(row.id),
    name: stringValue(row.name),
    status: row.status === "Inactivo" ? "Inactivo" : "Activo",
  };
}

export function hrTransferFromRow(row: Row): HrTransfer {
  return {
    boss: stringValue(row.boss),
    date: stringValue(row.transfer_date),
    employeeId: stringValue(row.employee_id),
    fromSectorId: stringValue(row.from_sector_id),
    id: stringValue(row.id),
    notes: stringValue(row.notes),
    reason: stringValue(row.reason),
    toSectorId: stringValue(row.to_sector_id),
  };
}

export function hrAttendanceFromRow(row: Row): HrAttendance {
  return {
    attendanceDate: stringValue(row.attendance_date),
    employeeId: stringValue(row.employee_id),
    entry: timeValue(row.entry_time),
    exit: timeValue(row.exit_time),
    extraHours: numberValue(row.extra_hours),
    id: stringValue(row.id),
    lunchIn: timeValue(row.lunch_in),
    lunchOut: timeValue(row.lunch_out),
    notes: stringValue(row.notes),
    status: stringValue(row.status),
  };
}

export function hrEventFromRow(row: Row): HrEvent {
  return {
    dateFrom: stringValue(row.date_from),
    dateTo: stringValue(row.date_to),
    discount: numberValue(row.discount),
    employeeId: stringValue(row.employee_id),
    eventType: stringValue(row.event_type),
    extraRate: numberValue(row.extra_rate),
    hours: numberValue(row.hours),
    id: stringValue(row.id),
    justification: stringValue(row.justification),
    notes: stringValue(row.notes),
    paid: stringValue(row.paid),
    reason: stringValue(row.reason),
    status: stringValue(row.status),
  };
}

export function hrAdvanceFromRow(row: Row): HrAdvance {
  return {
    amount: numberValue(row.amount),
    approvedBy: stringValue(row.approved_by),
    date: stringValue(row.advance_date),
    employeeId: stringValue(row.employee_id),
    id: stringValue(row.id),
    method: stringValue(row.method),
    month: stringValue(row.payroll_month),
    reason: stringValue(row.reason),
    status: row.status === "anulado" ? "anulado" : "activo",
  };
}

export function hrPayrollFromRow(row: Row): HrPayroll {
  return {
    employeeId: stringValue(row.employee_id),
    extraRate: numberValue(row.extra_rate),
    id: stringValue(row.id),
    month: stringValue(row.payroll_month),
    notes: stringValue(row.notes),
    otherDiscounts: numberValue(row.other_discounts),
    otherIncome: numberValue(row.other_income),
    salary: numberValue(row.salary),
  };
}

export function hrSalaryPaymentFromRow(row: Row): HrSalaryPayment {
  return {
    amount: numberValue(row.amount),
    date: stringValue(row.payment_date),
    employeeId: stringValue(row.employee_id),
    id: stringValue(row.id),
    method: stringValue(row.method),
    month: stringValue(row.payroll_month),
    notes: stringValue(row.notes),
    reference: stringValue(row.reference),
    status: row.status === "anulado" ? "anulado" : "confirmado",
  };
}

export function hrDocumentFromRow(row: Row): HrDocument {
  return {
    deliveryDate: stringValue(row.delivery_date),
    employeeId: stringValue(row.employee_id),
    expiryDate: stringValue(row.expiry_date),
    fileName: stringValue(row.file_name),
    id: stringValue(row.id),
    notes: stringValue(row.notes),
    reference: stringValue(row.reference),
    status: stringValue(row.status),
    type: stringValue(row.document_type),
  };
}

export function hrConsultationFromRow(row: Row): HrConsultation {
  return {
    date: stringValue(row.consultation_date),
    detail: stringValue(row.detail),
    employeeId: stringValue(row.employee_id),
    id: stringValue(row.id),
    response: stringValue(row.response),
    status: stringValue(row.status),
    subject: stringValue(row.subject),
    type: stringValue(row.consultation_type),
  };
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  return Number(value ?? 0) || 0;
}

function timeValue(value: unknown) {
  return stringValue(value).slice(0, 5);
}
