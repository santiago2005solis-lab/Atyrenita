"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import type { HrEmployee } from "@/lib/company-data";
import type {
  HrAdvance,
  HrData,
  HrSalaryPayment,
} from "@/lib/hr-data";
import {
  calculateEmployeePayroll,
  type HrPayrollCalculation,
} from "@/lib/hr-payroll";

type PayrollRow = {
  calculation: HrPayrollCalculation;
  employee: HrEmployee;
};

type PayrollForm = {
  employeeId: string;
  extraRate: string;
  month: string;
  notes: string;
  otherDiscounts: string;
  otherIncome: string;
  salary: string;
};

type AdvanceForm = {
  amount: string;
  approvedBy: string;
  date: string;
  employeeId: string;
  id: string;
  method: string;
  month: string;
  reason: string;
  status: HrAdvance["status"];
};

type PaymentForm = {
  amount: string;
  date: string;
  employeeId: string;
  id: string;
  method: string;
  month: string;
  notes: string;
  reference: string;
  status: HrSalaryPayment["status"];
};

const paymentMethods = [
  "Transferencia bancaria",
  "Efectivo",
  "Cheque",
  "Otro",
];

export function HrPayrollPanel({
  canEdit,
  data,
  employees,
  money,
  onRefresh,
  selectedMonth,
  setSelectedMonth,
}: {
  canEdit: boolean;
  data: HrData;
  employees: HrEmployee[];
  money: (value: number) => string;
  onRefresh: () => Promise<void>;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("Todos");
  const [modal, setModal] = useState<"payroll" | "advance" | "payment" | null>(
    null,
  );
  const [payrollForm, setPayrollForm] = useState<PayrollForm>(
    emptyPayrollForm(selectedMonth),
  );
  const [advanceForm, setAdvanceForm] = useState<AdvanceForm>(
    emptyAdvanceForm(selectedMonth),
  );
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(
    emptyPaymentForm(selectedMonth),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeEmployees = useMemo(
    () =>
      employees
        .filter((employee) => employee.status === "activo")
        .sort((first, second) => first.fullName.localeCompare(second.fullName)),
    [employees],
  );
  const sectors = useMemo(
    () =>
      Array.from(
        new Set(activeEmployees.map((employee) => employee.department).filter(Boolean)),
      ).sort((first, second) => first.localeCompare(second)),
    [activeEmployees],
  );
  const rows = useMemo<PayrollRow[]>(() => {
    const normalizedQuery = normalizeText(query.trim());
    return activeEmployees
      .filter(
        (employee) =>
          (sector === "Todos" || employee.department === sector) &&
          (!normalizedQuery ||
            normalizeText(
              `${employee.fullName} ${employee.documentNumber} ${employee.role}`,
            ).includes(normalizedQuery)),
      )
      .map((employee) => ({
        calculation: calculateEmployeePayroll(employee, selectedMonth, data),
        employee,
      }));
  }, [activeEmployees, data, query, sector, selectedMonth]);
  const totals = useMemo(
    () =>
      rows.reduce(
        (current, row) => ({
          advances: current.advances + row.calculation.advances,
          base: current.base + row.calculation.base,
          discounts: current.discounts + row.calculation.discounts,
          extras: current.extras + row.calculation.extras,
          paid: current.paid + row.calculation.paid,
          pending: current.pending + row.calculation.pending,
        }),
        {
          advances: 0,
          base: 0,
          discounts: 0,
          extras: 0,
          paid: 0,
          pending: 0,
        },
      ),
    [rows],
  );
  const monthlyAdvances = useMemo(
    () =>
      data.advances
        .filter((advance) => advance.month === selectedMonth)
        .sort((first, second) => second.date.localeCompare(first.date)),
    [data.advances, selectedMonth],
  );
  const monthlyPayments = useMemo(
    () =>
      data.payments
        .filter((payment) => payment.month === selectedMonth)
        .sort((first, second) => second.date.localeCompare(first.date)),
    [data.payments, selectedMonth],
  );

  function openPayroll(employee: HrEmployee) {
    const record = data.payroll.find(
      (item) =>
        item.employeeId === employee.id && item.month === selectedMonth,
    );
    setPayrollForm({
      employeeId: employee.id,
      extraRate: String(record?.extraRate ?? 0),
      month: selectedMonth,
      notes: record?.notes ?? "",
      otherDiscounts: String(record?.otherDiscounts ?? 0),
      otherIncome: String(record?.otherIncome ?? 0),
      salary: String(record?.salary ?? 0),
    });
    openModal("payroll");
  }

  function openAdvance(advance?: HrAdvance, employeeId = "") {
    setAdvanceForm(
      advance
        ? {
            amount: String(advance.amount),
            approvedBy: advance.approvedBy,
            date: advance.date,
            employeeId: advance.employeeId,
            id: advance.id,
            method: advance.method || paymentMethods[0],
            month: advance.month,
            reason: advance.reason,
            status: advance.status,
          }
        : { ...emptyAdvanceForm(selectedMonth), employeeId },
    );
    openModal("advance");
  }

  function openPayment(payment?: HrSalaryPayment, row?: PayrollRow) {
    setPaymentForm(
      payment
        ? {
            amount: String(payment.amount),
            date: payment.date,
            employeeId: payment.employeeId,
            id: payment.id,
            method: payment.method || paymentMethods[0],
            month: payment.month,
            notes: payment.notes,
            reference: payment.reference,
            status: payment.status,
          }
        : {
            ...emptyPaymentForm(selectedMonth),
            amount:
              row && row.calculation.pending > 0
                ? String(row.calculation.pending)
                : "",
            employeeId: row?.employee.id ?? "",
          },
    );
    openModal("payment");
  }

  function openModal(nextModal: typeof modal) {
    setError("");
    setMessage("");
    setModal(nextModal);
  }

  async function submitPayroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveRecord("/api/hr/payroll", {
      ...payrollForm,
      extraRate: Number(payrollForm.extraRate),
      otherDiscounts: Number(payrollForm.otherDiscounts),
      otherIncome: Number(payrollForm.otherIncome),
      salary: Number(payrollForm.salary),
    }, "Liquidacion actualizada.");
  }

  async function submitAdvance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveRecord(
      "/api/hr/advances",
      { ...advanceForm, amount: Number(advanceForm.amount) },
      advanceForm.id ? "Anticipo actualizado." : "Anticipo registrado.",
      advanceForm.id ? "PATCH" : "POST",
    );
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveRecord(
      "/api/hr/payments",
      { ...paymentForm, amount: Number(paymentForm.amount) },
      paymentForm.id ? "Pago actualizado." : "Pago registrado.",
      paymentForm.id ? "PATCH" : "POST",
    );
  }

  async function saveRecord(
    url: string,
    body: unknown,
    successMessage: string,
    method = "POST",
  ) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(url, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo guardar el registro.");
      }
      await onRefresh();
      setModal(null);
      setMessage(successMessage);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el registro.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeAdvanceStatus(advance: HrAdvance) {
    if (
      advance.status !== "anulado" &&
      !window.confirm("¿Desea anular este anticipo?")
    ) {
      return;
    }
    await saveRecord(
      "/api/hr/advances",
      {
        ...advance,
        status: advance.status === "anulado" ? "activo" : "anulado",
      },
      advance.status === "anulado"
        ? "Anticipo reactivado."
        : "Anticipo anulado.",
      "PATCH",
    );
  }

  async function changePaymentStatus(payment: HrSalaryPayment) {
    if (
      payment.status !== "anulado" &&
      !window.confirm("¿Desea anular este pago?")
    ) {
      return;
    }
    await saveRecord(
      "/api/hr/payments",
      {
        ...payment,
        status: payment.status === "anulado" ? "confirmado" : "anulado",
      },
      payment.status === "anulado" ? "Pago reactivado." : "Pago anulado.",
      "PATCH",
    );
  }

  return (
    <div className="hr-payroll-panel">
      {message && <div className="status-banner success">{message}</div>}
      {error && !modal && <div className="status-banner danger">{error}</div>}

      <section className="panel hr-payroll-overview">
        <header className="hr-section-heading">
          <div>
            <p className="eyebrow">Nomina</p>
            <h3>Salarios y anticipos</h3>
          </div>
          <div className="hr-payroll-heading-actions">
            <label className="hr-month-filter">
              Mes
              <input
                onChange={(event) => setSelectedMonth(event.target.value)}
                type="month"
                value={selectedMonth}
              />
            </label>
            {canEdit && (
              <>
                <button
                  className="secondary-button"
                  onClick={() => openAdvance()}
                  type="button"
                >
                  Nuevo anticipo
                </button>
                <button
                  className="submit-button hr-primary-button"
                  onClick={() => openPayment()}
                  type="button"
                >
                  Registrar pago
                </button>
              </>
            )}
          </div>
        </header>

        <div className="hr-payroll-kpis">
          <PayrollKpi label="Base salarial" value={money(totals.base)} />
          <PayrollKpi label="Horas extras" value={money(totals.extras)} />
          <PayrollKpi
            label="Anticipos y descuentos"
            tone="warning"
            value={money(totals.advances + totals.discounts)}
          />
          <PayrollKpi label="Pagado" tone="blue" value={money(totals.paid)} />
          <PayrollKpi
            label="Saldo pendiente"
            tone={totals.pending < 0 ? "danger" : "success"}
            value={money(totals.pending)}
          />
        </div>

        <div className="hr-payroll-filters">
          <label>
            Buscar
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Funcionario, C.I. o cargo"
              value={query}
            />
          </label>
          <label>
            Sector
            <select
              onChange={(event) => setSector(event.target.value)}
              value={sector}
            >
              <option>Todos</option>
              {sectors.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button
            className="secondary-button"
            onClick={() => {
              setQuery("");
              setSector("Todos");
            }}
            type="button"
          >
            Limpiar
          </button>
        </div>

        <div className="table-wrap hr-table hr-payroll-table">
          <table>
            <thead>
              <tr>
                <th>Funcionario</th>
                <th>Base</th>
                <th>Extras</th>
                <th>Otros ingresos</th>
                <th>Anticipos</th>
                <th>Descuentos</th>
                <th>Neto</th>
                <th>Pagado</th>
                <th>Pendiente</th>
                <th>Estado</th>
                {canEdit && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = payrollStatus(row.calculation);
                return (
                  <tr key={row.employee.id}>
                    <td>
                      <strong>{row.employee.fullName}</strong>
                      <small>
                        {row.employee.department || "Sin sector"} |{" "}
                        {row.employee.salaryType === "jornal"
                          ? `${row.calculation.presentDays} jornales`
                          : "Mensual"}
                      </small>
                    </td>
                    <td>{money(row.calculation.base)}</td>
                    <td>
                      {money(row.calculation.extras)}
                      <small>
                        {decimal(row.calculation.extraHours)} h reconocidas
                      </small>
                    </td>
                    <td>{money(row.calculation.otherIncome)}</td>
                    <td>{money(row.calculation.advances)}</td>
                    <td>{money(row.calculation.discounts)}</td>
                    <td><strong>{money(row.calculation.balance)}</strong></td>
                    <td>{money(row.calculation.paid)}</td>
                    <td className={row.calculation.pending < 0 ? "negative-amount" : "positive-amount"}>
                      <strong>{money(row.calculation.pending)}</strong>
                    </td>
                    <td>
                      <span className={`hr-payroll-status ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    {canEdit && (
                      <td>
                        <div className="hr-payroll-row-actions">
                          <button
                            className="hr-table-action"
                            onClick={() => openPayroll(row.employee)}
                            type="button"
                          >
                            Liquidar
                          </button>
                          <button
                            className="hr-table-action"
                            onClick={() => openAdvance(undefined, row.employee.id)}
                            type="button"
                          >
                            Anticipo
                          </button>
                          <button
                            className="hr-table-action"
                            disabled={row.calculation.pending <= 0}
                            onClick={() => openPayment(undefined, row)}
                            type="button"
                          >
                            Pagar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td className="hr-empty-cell" colSpan={canEdit ? 11 : 10}>
                    No hay funcionarios para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="hr-payroll-movement-grid">
        <SalaryMovementTable
          canEdit={canEdit}
          columns={["Fecha", "Funcionario", "Monto", "Medio", "Motivo", "Estado"]}
          emptyMessage="No hay anticipos registrados en el mes."
          eyebrow="Deducciones"
          rows={monthlyAdvances.map((advance) => ({
            id: advance.id,
            status: advance.status,
            values: [
              formatDate(advance.date),
              employeeName(advance.employeeId, employees),
              money(advance.amount),
              advance.method || "-",
              advance.reason || "-",
              advance.status === "anulado" ? "Anulado" : "Activo",
            ],
            onEdit: () => openAdvance(advance),
            onToggle: () => void changeAdvanceStatus(advance),
          }))}
          title="Anticipos"
        />
        <SalaryMovementTable
          canEdit={canEdit}
          columns={["Fecha", "Funcionario", "Monto", "Medio", "Referencia", "Estado"]}
          emptyMessage="No hay pagos registrados en el mes."
          eyebrow="Tesoreria"
          rows={monthlyPayments.map((payment) => ({
            id: payment.id,
            status: payment.status,
            values: [
              formatDate(payment.date),
              employeeName(payment.employeeId, employees),
              money(payment.amount),
              payment.method || "-",
              payment.reference || "-",
              payment.status === "anulado" ? "Anulado" : "Confirmado",
            ],
            onEdit: () => openPayment(payment),
            onToggle: () => void changePaymentStatus(payment),
          }))}
          title="Pagos realizados"
        />
      </div>

      {modal === "payroll" && (
        <PayrollModal
          employees={activeEmployees}
          error={error}
          form={payrollForm}
          onChange={setPayrollForm}
          onClose={() => setModal(null)}
          onSubmit={submitPayroll}
          saving={saving}
        />
      )}
      {modal === "advance" && (
        <AdvanceModal
          employees={activeEmployees}
          error={error}
          form={advanceForm}
          onChange={setAdvanceForm}
          onClose={() => setModal(null)}
          onSubmit={submitAdvance}
          saving={saving}
        />
      )}
      {modal === "payment" && (
        <PaymentModal
          employees={activeEmployees}
          error={error}
          form={paymentForm}
          onChange={setPaymentForm}
          onClose={() => setModal(null)}
          onSubmit={submitPayment}
          saving={saving}
        />
      )}
    </div>
  );
}

function PayrollModal({
  employees,
  error,
  form,
  onChange,
  onClose,
  onSubmit,
  saving,
}: {
  employees: HrEmployee[];
  error: string;
  form: PayrollForm;
  onChange: (form: PayrollForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const employee = employees.find((item) => item.id === form.employeeId);
  return (
    <PayrollDialog onClose={onClose} title="Configurar liquidacion">
      <form className="hr-employee-form" onSubmit={onSubmit}>
        {error && <div className="status-banner danger">{error}</div>}
        <div className="hr-form-grid">
          <label>
            Funcionario
            <select
              onChange={(event) =>
                onChange({ ...form, employeeId: event.target.value })
              }
              required
              value={form.employeeId}
            >
              <option value="">Seleccione...</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mes
            <input
              onChange={(event) => onChange({ ...form, month: event.target.value })}
              required
              type="month"
              value={form.month}
            />
          </label>
          <label>
            Base especial del mes
            <input
              min="0"
              onChange={(event) => onChange({ ...form, salary: event.target.value })}
              placeholder="0 usa el salario habitual"
              step="1"
              type="number"
              value={form.salary}
            />
            <small>
              Base habitual:{" "}
              {employee?.salaryType === "jornal"
                ? "jornal por dias presentes"
                : "salario mensual"}
            </small>
          </label>
          <label>
            Valor por hora extra
            <input
              min="0"
              onChange={(event) =>
                onChange({ ...form, extraRate: event.target.value })
              }
              step="1"
              type="number"
              value={form.extraRate}
            />
          </label>
          <label>
            Otros ingresos
            <input
              min="0"
              onChange={(event) =>
                onChange({ ...form, otherIncome: event.target.value })
              }
              step="1"
              type="number"
              value={form.otherIncome}
            />
          </label>
          <label>
            Otros descuentos
            <input
              min="0"
              onChange={(event) =>
                onChange({ ...form, otherDiscounts: event.target.value })
              }
              step="1"
              type="number"
              value={form.otherDiscounts}
            />
          </label>
          <label className="hr-span-2">
            Observaciones
            <textarea
              onChange={(event) => onChange({ ...form, notes: event.target.value })}
              rows={3}
              value={form.notes}
            />
          </label>
        </div>
        <ModalActions
          onClose={onClose}
          saving={saving}
          submitLabel="Guardar liquidacion"
        />
      </form>
    </PayrollDialog>
  );
}

function AdvanceModal({
  employees,
  error,
  form,
  onChange,
  onClose,
  onSubmit,
  saving,
}: {
  employees: HrEmployee[];
  error: string;
  form: AdvanceForm;
  onChange: (form: AdvanceForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  return (
    <PayrollDialog
      onClose={onClose}
      title={form.id ? "Editar anticipo" : "Registrar anticipo"}
    >
      <form className="hr-employee-form" onSubmit={onSubmit}>
        {error && <div className="status-banner danger">{error}</div>}
        <div className="hr-form-grid">
          <EmployeeSelect
            employees={employees}
            onChange={(employeeId) => onChange({ ...form, employeeId })}
            value={form.employeeId}
          />
          <label>
            Fecha
            <input
              onChange={(event) => onChange({ ...form, date: event.target.value })}
              required
              type="date"
              value={form.date}
            />
          </label>
          <label>
            Mes a descontar
            <input
              onChange={(event) => onChange({ ...form, month: event.target.value })}
              required
              type="month"
              value={form.month}
            />
          </label>
          <label>
            Monto
            <input
              min="1"
              onChange={(event) => onChange({ ...form, amount: event.target.value })}
              required
              step="1"
              type="number"
              value={form.amount}
            />
          </label>
          <MethodSelect
            onChange={(method) => onChange({ ...form, method })}
            value={form.method}
          />
          <label>
            Autorizado por
            <input
              onChange={(event) =>
                onChange({ ...form, approvedBy: event.target.value })
              }
              value={form.approvedBy}
            />
          </label>
          <label className="hr-span-2">
            Motivo
            <textarea
              onChange={(event) => onChange({ ...form, reason: event.target.value })}
              required
              rows={3}
              value={form.reason}
            />
          </label>
        </div>
        <ModalActions
          onClose={onClose}
          saving={saving}
          submitLabel={form.id ? "Actualizar anticipo" : "Guardar anticipo"}
        />
      </form>
    </PayrollDialog>
  );
}

function PaymentModal({
  employees,
  error,
  form,
  onChange,
  onClose,
  onSubmit,
  saving,
}: {
  employees: HrEmployee[];
  error: string;
  form: PaymentForm;
  onChange: (form: PaymentForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  return (
    <PayrollDialog
      onClose={onClose}
      title={form.id ? "Editar pago" : "Registrar pago salarial"}
    >
      <form className="hr-employee-form" onSubmit={onSubmit}>
        {error && <div className="status-banner danger">{error}</div>}
        <div className="hr-form-grid">
          <EmployeeSelect
            employees={employees}
            onChange={(employeeId) => onChange({ ...form, employeeId })}
            value={form.employeeId}
          />
          <label>
            Fecha de pago
            <input
              onChange={(event) => onChange({ ...form, date: event.target.value })}
              required
              type="date"
              value={form.date}
            />
          </label>
          <label>
            Mes liquidado
            <input
              onChange={(event) => onChange({ ...form, month: event.target.value })}
              required
              type="month"
              value={form.month}
            />
          </label>
          <label>
            Monto pagado
            <input
              min="1"
              onChange={(event) => onChange({ ...form, amount: event.target.value })}
              required
              step="1"
              type="number"
              value={form.amount}
            />
          </label>
          <MethodSelect
            onChange={(method) => onChange({ ...form, method })}
            value={form.method}
          />
          <label>
            Referencia
            <input
              onChange={(event) =>
                onChange({ ...form, reference: event.target.value })
              }
              placeholder="Transferencia, recibo o cheque"
              value={form.reference}
            />
          </label>
          <label className="hr-span-2">
            Observaciones
            <textarea
              onChange={(event) => onChange({ ...form, notes: event.target.value })}
              rows={3}
              value={form.notes}
            />
          </label>
        </div>
        <ModalActions
          onClose={onClose}
          saving={saving}
          submitLabel={form.id ? "Actualizar pago" : "Confirmar pago"}
        />
      </form>
    </PayrollDialog>
  );
}

function PayrollDialog({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="hr-modal-backdrop" role="presentation">
      <section
        aria-modal="true"
        className="hr-modal hr-payroll-modal"
        role="dialog"
      >
        <header className="hr-modal-heading">
          <div>
            <p className="eyebrow">Nomina mensual</p>
            <h3>{title}</h3>
          </div>
          <button
            aria-label="Cerrar"
            className="hr-close-button"
            onClick={onClose}
            type="button"
          >
            X
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function EmployeeSelect({
  employees,
  onChange,
  value,
}: {
  employees: HrEmployee[];
  onChange: (employeeId: string) => void;
  value: string;
}) {
  return (
    <label>
      Funcionario
      <select
        onChange={(event) => onChange(event.target.value)}
        required
        value={value}
      >
        <option value="">Seleccione...</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.fullName} | {employee.department || "Sin sector"}
          </option>
        ))}
      </select>
    </label>
  );
}

function MethodSelect({
  onChange,
  value,
}: {
  onChange: (method: string) => void;
  value: string;
}) {
  return (
    <label>
      Medio
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {paymentMethods.map((method) => (
          <option key={method}>{method}</option>
        ))}
      </select>
    </label>
  );
}

function ModalActions({
  onClose,
  saving,
  submitLabel,
}: {
  onClose: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="hr-modal-actions">
      <button
        className="secondary-button"
        disabled={saving}
        onClick={onClose}
        type="button"
      >
        Cancelar
      </button>
      <button className="submit-button" disabled={saving} type="submit">
        {saving ? "Guardando..." : submitLabel}
      </button>
    </div>
  );
}

function PayrollKpi({
  label,
  tone = "",
  value,
}: {
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SalaryMovementTable({
  canEdit,
  columns,
  emptyMessage,
  eyebrow,
  rows,
  title,
}: {
  canEdit: boolean;
  columns: string[];
  emptyMessage: string;
  eyebrow: string;
  rows: Array<{
    id: string;
    onEdit: () => void;
    onToggle: () => void;
    status: string;
    values: string[];
  }>;
  title: string;
}) {
  return (
    <section className="panel hr-payroll-movements">
      <header className="hr-section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <span className="hr-payroll-count">{rows.length} registros</span>
      </header>
      <div className="table-wrap hr-table">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
              {canEdit && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className={row.status === "anulado" ? "is-cancelled" : ""} key={row.id}>
                {row.values.map((value, index) => (
                  <td key={`${row.id}-${columns[index]}`}>{value}</td>
                ))}
                {canEdit && (
                  <td>
                    <div className="hr-payroll-row-actions">
                      <button
                        className="hr-table-action"
                        onClick={row.onEdit}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="hr-table-action danger"
                        onClick={row.onToggle}
                        type="button"
                      >
                        {row.status === "anulado" ? "Reactivar" : "Anular"}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  className="hr-empty-cell"
                  colSpan={columns.length + (canEdit ? 1 : 0)}
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function payrollStatus(calculation: HrPayrollCalculation) {
  if (calculation.balance <= 0) {
    return { className: "sin-saldo", label: "Sin saldo" };
  }
  if (calculation.pending <= 0) {
    return { className: "pagado", label: "Pagado" };
  }
  if (calculation.paid > 0) {
    return { className: "parcial", label: "Pago parcial" };
  }
  return { className: "pendiente", label: "Pendiente" };
}

function emptyPayrollForm(month: string): PayrollForm {
  return {
    employeeId: "",
    extraRate: "0",
    month,
    notes: "",
    otherDiscounts: "0",
    otherIncome: "0",
    salary: "0",
  };
}

function emptyAdvanceForm(month: string): AdvanceForm {
  return {
    amount: "",
    approvedBy: "",
    date: localDateValue(),
    employeeId: "",
    id: "",
    method: paymentMethods[0],
    month,
    reason: "",
    status: "activo",
  };
}

function emptyPaymentForm(month: string): PaymentForm {
  return {
    amount: "",
    date: localDateValue(),
    employeeId: "",
    id: "",
    method: paymentMethods[0],
    month,
    notes: "",
    reference: "",
    status: "confirmado",
  };
}

function employeeName(employeeId: string, employees: HrEmployee[]) {
  return employees.find((employee) => employee.id === employeeId)?.fullName ??
    "Funcionario no encontrado";
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-PY").format(
    new Date(`${value}T12:00:00`),
  );
}

function decimal(value: number) {
  return new Intl.NumberFormat("es-PY", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function localDateValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}
