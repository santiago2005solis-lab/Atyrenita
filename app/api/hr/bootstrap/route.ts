import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import {
  hrAdvanceFromRow,
  hrAttendanceFromRow,
  hrConsultationFromRow,
  hrDocumentFromRow,
  hrEmployeeFromRow,
  hrEventFromRow,
  hrPayrollFromRow,
  hrSalaryPaymentFromRow,
  hrSectorFromRow,
  hrTransferFromRow,
} from "@/lib/hr-mappers";
import { emptyHrData, type HrData } from "@/lib/hr-data";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAppUser(request, "rrhh", "lector");
  if (auth.error) return auth.error;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(emptyHrData);
  }

  try {
    const [
      employeeRows,
      sectorRows,
      transferRows,
      attendanceRows,
      eventRows,
      advanceRows,
      payrollRows,
      paymentRows,
      documentRows,
      consultationRows,
    ] = await Promise.all([
      supabaseSelect<Record<string, unknown>[]>(
        "hr_employees?select=*&order=full_name.asc",
      ),
      supabaseSelect<Record<string, unknown>[]>(
        "hr_sectors?select=*&order=name.asc",
      ),
      supabaseSelect<Record<string, unknown>[]>(
        "hr_transfers?select=*&order=transfer_date.desc",
      ),
      supabaseSelect<Record<string, unknown>[]>(
        "hr_attendance?select=*&order=attendance_date.desc",
      ),
      supabaseSelect<Record<string, unknown>[]>(
        "hr_events?select=*&order=date_from.desc",
      ),
      supabaseSelect<Record<string, unknown>[]>(
        "hr_advances?select=*&order=advance_date.desc",
      ),
      supabaseSelect<Record<string, unknown>[]>(
        "hr_payroll?select=*&order=payroll_month.desc",
      ),
      optionalSelect("hr_salary_payments?select=*&order=payment_date.desc"),
      supabaseSelect<Record<string, unknown>[]>(
        "hr_documents?select=*&order=delivery_date.desc",
      ),
      supabaseSelect<Record<string, unknown>[]>(
        "hr_consultations?select=*&order=consultation_date.desc",
      ),
    ]);

    const data: HrData = {
      advances: advanceRows.map(hrAdvanceFromRow),
      attendance: attendanceRows.map(hrAttendanceFromRow),
      consultations: consultationRows.map(hrConsultationFromRow),
      documents: documentRows.map(hrDocumentFromRow),
      employees: employeeRows.map(hrEmployeeFromRow),
      events: eventRows.map(hrEventFromRow),
      payroll: payrollRows.map(hrPayrollFromRow),
      payments: paymentRows.map(hrSalaryPaymentFromRow),
      sectors: sectorRows.map(hrSectorFromRow),
      transfers: transferRows.map(hrTransferFromRow),
    };
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar Recursos Humanos.",
        migrationRequired: true,
      },
      { status: 409 },
    );
  }
}

async function optionalSelect(path: string) {
  try {
    return await supabaseSelect<Record<string, unknown>[]>(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("PGRST205") ||
      message.includes("hr_salary_payments")
    ) {
      return [];
    }
    throw error;
  }
}
