import type { HrEmployee } from "./company-data";

export type HrSector = {
  boss: string;
  description: string;
  establishment: string;
  id: string;
  name: string;
  status: "Activo" | "Inactivo";
};

export type HrTransfer = {
  boss: string;
  date: string;
  employeeId: string;
  fromSectorId: string;
  id: string;
  notes: string;
  reason: string;
  toSectorId: string;
};

export type HrAttendance = {
  attendanceDate: string;
  employeeId: string;
  entry: string;
  exit: string;
  extraHours: number;
  id: string;
  lunchIn: string;
  lunchOut: string;
  notes: string;
  status: string;
};

export type HrEvent = {
  dateFrom: string;
  dateTo: string;
  discount: number;
  employeeId: string;
  eventType: string;
  hours: number;
  id: string;
  justification: string;
  notes: string;
  paid: string;
  reason: string;
  status: string;
};

export type HrAdvance = {
  amount: number;
  approvedBy: string;
  date: string;
  employeeId: string;
  id: string;
  method: string;
  month: string;
  reason: string;
};

export type HrPayroll = {
  employeeId: string;
  extraRate: number;
  id: string;
  month: string;
  notes: string;
  otherDiscounts: number;
  otherIncome: number;
  salary: number;
};

export type HrDocument = {
  deliveryDate: string;
  employeeId: string;
  expiryDate: string;
  fileName: string;
  id: string;
  notes: string;
  reference: string;
  status: string;
  type: string;
};

export type HrConsultation = {
  date: string;
  detail: string;
  employeeId: string;
  id: string;
  response: string;
  status: string;
  subject: string;
  type: string;
};

export type HrData = {
  advances: HrAdvance[];
  attendance: HrAttendance[];
  consultations: HrConsultation[];
  documents: HrDocument[];
  employees: HrEmployee[];
  events: HrEvent[];
  payroll: HrPayroll[];
  sectors: HrSector[];
  transfers: HrTransfer[];
};

export const emptyHrData: HrData = {
  advances: [],
  attendance: [],
  consultations: [],
  documents: [],
  employees: [],
  events: [],
  payroll: [],
  sectors: [],
  transfers: [],
};
