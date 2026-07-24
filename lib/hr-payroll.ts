import type { HrEmployee } from "./company-data";
import type { HrData } from "./hr-data";

export type HrPayrollCalculation = {
  advances: number;
  balance: number;
  base: number;
  discounts: number;
  extraHours: number;
  extraRate: number;
  extras: number;
  otherIncome: number;
  paid: number;
  pending: number;
  presentDays: number;
};

export function calculateEmployeePayroll(
  employee: HrEmployee,
  month: string,
  data: HrData,
): HrPayrollCalculation {
  const payroll = data.payroll.find(
    (record) => record.employeeId === employee.id && record.month === month,
  );
  const attendance = data.attendance.filter(
    (record) =>
      record.employeeId === employee.id &&
      record.attendanceDate.startsWith(month),
  );
  const presentDays = attendance.filter((record) =>
    normalizeText(record.status).includes("presente"),
  ).length;
  const calculatedBase =
    employee.salaryType === "jornal"
      ? presentDays * employee.dailyWage
      : employee.monthlySalary;
  const base = payroll?.salary || calculatedBase;
  const attendanceExtraHours = attendance.reduce(
    (sum, record) => sum + record.extraHours,
    0,
  );
  const approvedExtraEvents = data.events
    .filter(
      (event) =>
        event.employeeId === employee.id &&
        event.dateFrom.startsWith(month) &&
        normalizeText(event.eventType).includes("extra") &&
        normalizeText(event.status).includes("aprob"),
    );
  const approvedExtraHours = approvedExtraEvents.reduce(
    (sum, event) => sum + event.hours,
    0,
  );
  const extraRate = payroll?.extraRate ?? 0;
  const extraHours = attendanceExtraHours + approvedExtraHours;
  const eventExtraPay = approvedExtraEvents.reduce(
    (sum, event) => sum + event.hours * (event.extraRate || extraRate),
    0,
  );
  const extras = attendanceExtraHours * extraRate + eventExtraPay;
  const advances = data.advances
    .filter(
      (advance) =>
        advance.employeeId === employee.id &&
        advance.month === month &&
        advance.status !== "anulado",
    )
    .reduce((sum, advance) => sum + advance.amount, 0);
  const eventDiscounts = data.events
    .filter(
      (event) =>
        event.employeeId === employee.id &&
        event.dateFrom.startsWith(month) &&
        normalizeText(event.status).includes("aprob"),
    )
    .reduce((sum, event) => sum + event.discount, 0);
  const discounts = eventDiscounts + (payroll?.otherDiscounts ?? 0);
  const otherIncome = payroll?.otherIncome ?? 0;
  const balance = base + extras + otherIncome - advances - discounts;
  const paid = data.payments
    .filter(
      (payment) =>
        payment.employeeId === employee.id &&
        payment.month === month &&
        payment.status !== "anulado",
    )
    .reduce((sum, payment) => sum + payment.amount, 0);

  return {
    advances,
    balance,
    base,
    discounts,
    extraHours,
    extraRate,
    extras,
    otherIncome,
    paid,
    pending: Math.max(0, balance - paid),
    presentDays,
  };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
