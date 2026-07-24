"use client";

import { FormEvent, useMemo, useState } from "react";
import type { HrEmployee } from "@/lib/company-data";
import type { HrEvent, HrPayroll } from "@/lib/hr-data";

type EventForm = {
  dateFrom: string;
  dateTo: string;
  discount: string;
  employeeId: string;
  eventType: string;
  extraRate: string;
  hours: string;
  id: string;
  justification: string;
  notes: string;
  paid: string;
  reason: string;
  status: string;
};

const eventTypes = [
  "Ausencia",
  "Justificación",
  "Permiso",
  "Vacaciones",
  "Reposo médico",
  "Hora extra",
  "Otro",
];
const eventStatuses = ["Pendiente", "Aprobado", "Rechazado"];

export function HrEventsPanel({
  canAdmin,
  canEdit,
  employees,
  events,
  money,
  onRefresh,
  payroll,
  selectedMonth,
  setSelectedMonth,
}: {
  canAdmin: boolean;
  canEdit: boolean;
  employees: HrEmployee[];
  events: HrEvent[];
  money: (value: number) => string;
  onRefresh: () => Promise<void>;
  payroll: HrPayroll[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [form, setForm] = useState<EventForm>(emptyEventForm());
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeEmployees = useMemo(
    () =>
      employees
        .filter((employee) => employee.status !== "inactivo")
        .sort((first, second) => first.fullName.localeCompare(second.fullName)),
    [employees],
  );
  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const monthlyEvents = useMemo(
    () =>
      events.filter((event) =>
        overlapsMonth(event.dateFrom, event.dateTo, selectedMonth),
      ),
    [events, selectedMonth],
  );
  const filteredEvents = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    return monthlyEvents
      .filter((event) => {
        const employee = employeesById.get(event.employeeId);
        return (
          (typeFilter === "Todos" ||
            normalizeText(event.eventType) === normalizeText(typeFilter)) &&
          (statusFilter === "Todos" ||
            normalizeText(event.status) === normalizeText(statusFilter)) &&
          (!normalizedQuery ||
            normalizeText(
              [
                employee?.fullName,
                employee?.documentNumber,
                employee?.department,
                event.reason,
                event.justification,
                event.notes,
              ].join(" "),
            ).includes(normalizedQuery))
        );
      })
      .sort(
        (first, second) =>
          second.dateFrom.localeCompare(first.dateFrom) ||
          employeeName(first.employeeId, employees).localeCompare(
            employeeName(second.employeeId, employees),
          ),
      );
  }, [
    employees,
    employeesById,
    monthlyEvents,
    query,
    statusFilter,
    typeFilter,
  ]);
  const totals = useMemo(() => {
    const approved = monthlyEvents.filter((event) =>
      statusIs(event.status, "Aprobado"),
    );
    const approvedExtraEvents = approved.filter((event) =>
      isExtraHoursEvent(event.eventType),
    );
    return {
      approved: approved.length,
      discounts: approved.reduce((sum, event) => sum + event.discount, 0),
      extraHours: approvedExtraEvents.reduce(
        (sum, event) => sum + event.hours,
        0,
      ),
      extraPay: approvedExtraEvents.reduce(
        (sum, event) => sum + eventExtraPay(event, payroll),
        0,
      ),
      pending: monthlyEvents.filter((event) =>
        statusIs(event.status, "Pendiente"),
      ).length,
    };
  }, [monthlyEvents, payroll]);

  const formPayrollRate = useMemo(
    () =>
      payroll.find(
        (record) =>
          record.employeeId === form.employeeId &&
          record.month === form.dateFrom.slice(0, 7),
      )?.extraRate ?? 0,
    [form.dateFrom, form.employeeId, payroll],
  );
  const formExtraRate = Number(form.extraRate) || formPayrollRate;
  const formExtraTotal = (Number(form.hours) || 0) * formExtraRate;

  function openNewEvent() {
    setForm(emptyEventForm());
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function openEditEvent(event: HrEvent) {
    setForm({
      dateFrom: event.dateFrom,
      dateTo: event.dateTo || event.dateFrom,
      discount: String(event.discount || 0),
      employeeId: event.employeeId,
      eventType: displayEventType(event.eventType),
      extraRate: String(event.extraRate || 0),
      hours: String(event.hours || 0),
      id: event.id,
      justification: event.justification,
      notes: event.notes,
      paid: isPaid(event.paid) ? "Sí" : "No",
      reason: event.reason,
      status: displayStatus(event.status),
    });
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveEvent(
      eventBody(form),
      form.id ? "Novedad actualizada." : "Novedad registrada como pendiente.",
      form.id ? "PATCH" : "POST",
      true,
    );
  }

  async function changeStatus(event: HrEvent, status: string) {
    if (
      status === "Rechazado" &&
      !window.confirm("¿Desea rechazar esta novedad?")
    ) {
      return;
    }
    if (
      status === "Pendiente" &&
      !window.confirm("¿Desea reabrir esta novedad para revisión?")
    ) {
      return;
    }
    await saveEvent(
      {
        dateFrom: event.dateFrom,
        dateTo: event.dateTo || event.dateFrom,
        discount: event.discount,
        employeeId: event.employeeId,
        eventType: event.eventType,
        extraRate: event.extraRate,
        hours: event.hours,
        id: event.id,
        justification: event.justification,
        notes: event.notes,
        paid: event.paid,
        reason: event.reason,
        status,
      },
      status === "Aprobado"
        ? "Novedad aprobada y asistencia sincronizada."
        : status === "Rechazado"
          ? "Novedad rechazada."
          : "Novedad reabierta.",
      "PATCH",
      false,
    );
  }

  async function saveEvent(
    body: Record<string, unknown>,
    successMessage: string,
    method: "POST" | "PATCH",
    closeForm: boolean,
  ) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/hr/events", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo guardar la novedad.");
      }
      await onRefresh();
      if (closeForm) setFormOpen(false);
      setMessage(successMessage);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la novedad.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hr-events-panel">
      {message && <div className="status-banner success">{message}</div>}
      {error && !formOpen && <div className="status-banner danger">{error}</div>}

      <section className="panel hr-events-overview">
        <header className="hr-section-heading">
          <div>
            <p className="eyebrow">Gestión</p>
            <h3>Permisos y novedades</h3>
          </div>
          <div className="hr-events-heading-actions">
            <label className="hr-month-filter">
              Mes
              <input
                onChange={(event) => setSelectedMonth(event.target.value)}
                type="month"
                value={selectedMonth}
              />
            </label>
            {canEdit && (
              <button
                className="submit-button hr-primary-button"
                onClick={openNewEvent}
                type="button"
              >
                Nueva novedad
              </button>
            )}
          </div>
        </header>

        <div className="hr-event-kpis">
          <EventKpi label="Pendientes" tone="warning" value={String(totals.pending)} />
          <EventKpi label="Aprobadas" tone="success" value={String(totals.approved)} />
          <EventKpi
            label="Horas extra aprobadas"
            value={decimal(totals.extraHours)}
          />
          <EventKpi
            label="Pago extra aprobado"
            tone="success"
            value={money(totals.extraPay)}
          />
          <EventKpi
            label="Descuentos aprobados"
            tone="danger"
            value={money(totals.discounts)}
          />
        </div>

        <div className="hr-event-filters">
          <label>
            Buscar
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Funcionario, C.I., sector o motivo"
              value={query}
            />
          </label>
          <label>
            Tipo
            <select
              onChange={(event) => setTypeFilter(event.target.value)}
              value={typeFilter}
            >
              <option>Todos</option>
              {eventTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option>Todos</option>
              {eventStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <button
            className="secondary-button"
            onClick={() => {
              setQuery("");
              setTypeFilter("Todos");
              setStatusFilter("Todos");
            }}
            type="button"
          >
            Limpiar
          </button>
        </div>

        <div className="table-wrap hr-table hr-events-table">
          <table>
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Funcionario</th>
                <th>Tipo</th>
                <th>Días / horas</th>
                <th>Goce</th>
                <th>Motivo</th>
                <th>Descuento</th>
                <th>Pago extra</th>
                <th>Estado</th>
                {(canEdit || canAdmin) && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => {
                const employee = employeesById.get(event.employeeId);
                const status = displayStatus(event.status);
                const canEditRecord =
                  canEdit && (status === "Pendiente" || canAdmin);
                return (
                  <tr key={event.id}>
                    <td>
                      <strong>{formatDate(event.dateFrom)}</strong>
                      {event.dateTo && event.dateTo !== event.dateFrom && (
                        <small>hasta {formatDate(event.dateTo)}</small>
                      )}
                    </td>
                    <td>
                      <strong>{employee?.fullName ?? "Funcionario no encontrado"}</strong>
                      <small>{employee?.department || "Sin sector"}</small>
                    </td>
                    <td>{displayEventType(event.eventType)}</td>
                    <td>
                      {eventDays(event.dateFrom, event.dateTo)} días
                      {event.hours > 0 && <small>{decimal(event.hours)} horas</small>}
                    </td>
                    <td>{isPaid(event.paid) ? "Sí" : "No"}</td>
                    <td>
                      <strong>{event.reason || "-"}</strong>
                      {event.justification && <small>{event.justification}</small>}
                    </td>
                    <td className={event.discount > 0 ? "negative-amount" : ""}>
                      {isExtraHoursEvent(event.eventType)
                        ? "-"
                        : money(event.discount)}
                    </td>
                    <td
                      className={
                        isExtraHoursEvent(event.eventType)
                          ? "positive-amount"
                          : ""
                      }
                    >
                      {isExtraHoursEvent(event.eventType) ? (
                        <>
                          <strong>{money(eventExtraPay(event, payroll))}</strong>
                          <small>
                            {effectiveExtraRate(event, payroll) > 0
                              ? `${money(effectiveExtraRate(event, payroll))} / h`
                              : "Tarifa no definida"}
                          </small>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <span
                        className={`hr-event-status ${normalizeText(status)}`}
                      >
                        {status}
                      </span>
                    </td>
                    {(canEdit || canAdmin) && (
                      <td>
                        <div className="hr-event-row-actions">
                          {canEditRecord && (
                            <button
                              className="hr-table-action"
                              onClick={() => openEditEvent(event)}
                              type="button"
                            >
                              Editar
                            </button>
                          )}
                          {canAdmin && status === "Pendiente" && (
                            <>
                              <button
                                className="hr-table-action success"
                                disabled={saving}
                                onClick={() =>
                                  void changeStatus(event, "Aprobado")
                                }
                                type="button"
                              >
                                Aprobar
                              </button>
                              <button
                                className="hr-table-action danger"
                                disabled={saving}
                                onClick={() =>
                                  void changeStatus(event, "Rechazado")
                                }
                                type="button"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          {canAdmin && status !== "Pendiente" && (
                            <button
                              className="hr-table-action"
                              disabled={saving}
                              onClick={() =>
                                void changeStatus(event, "Pendiente")
                              }
                              type="button"
                            >
                              Reabrir
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!filteredEvents.length && (
                <tr>
                  <td
                    className="hr-empty-cell"
                    colSpan={canEdit || canAdmin ? 10 : 9}
                  >
                    No hay novedades para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <div className="hr-modal-backdrop" role="presentation">
          <section
            aria-labelledby="hr-event-dialog-title"
            aria-modal="true"
            className="hr-modal hr-event-modal"
            role="dialog"
          >
            <header className="hr-modal-heading">
              <div>
                <p className="eyebrow">Novedades</p>
                <h3 id="hr-event-dialog-title">
                  {form.id ? "Editar novedad" : "Registrar novedad"}
                </h3>
              </div>
              <button
                aria-label="Cerrar"
                className="hr-close-button"
                onClick={() => setFormOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <form className="hr-employee-form" onSubmit={submitEvent}>
              {error && <div className="status-banner danger">{error}</div>}
              <div className="hr-form-grid">
                <label className="hr-span-2">
                  Funcionario
                  <select
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        employeeId: event.target.value,
                      }))
                    }
                    required
                    value={form.employeeId}
                  >
                    <option value="">Seleccione un funcionario</option>
                    {activeEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} · {employee.department || "Sin sector"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo de novedad
                  <select
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        eventType: event.target.value,
                      }))
                    }
                    value={form.eventType}
                  >
                    {eventTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Con goce de salario
                  <select
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paid: event.target.value,
                      }))
                    }
                    value={form.paid}
                  >
                    <option>Sí</option>
                    <option>No</option>
                  </select>
                </label>
                <label>
                  Desde
                  <input
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                    required
                    type="date"
                    value={form.dateFrom}
                  />
                </label>
                <label>
                  Hasta
                  <input
                    min={form.dateFrom}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                    required
                    type="date"
                    value={form.dateTo}
                  />
                </label>
                <label>
                  {isExtraHoursEvent(form.eventType)
                    ? "Horas extra"
                    : "Horas asociadas"}
                  <input
                    min="0"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        hours: event.target.value,
                      }))
                    }
                    step="0.25"
                    type="number"
                    value={form.hours}
                  />
                </label>
                {isExtraHoursEvent(form.eventType) ? (
                  <label>
                    Valor por hora extra
                    <input
                      min="0"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          extraRate: event.target.value,
                        }))
                      }
                      placeholder={
                        formPayrollRate > 0
                          ? `Tarifa mensual: ${money(formPayrollRate)}`
                          : "Ingrese el valor por hora"
                      }
                      step="1"
                      type="number"
                      value={form.extraRate}
                    />
                    <small>
                      {Number(form.extraRate) > 0
                        ? "Tarifa específica para esta novedad."
                        : formPayrollRate > 0
                          ? `Se usará la tarifa mensual de ${money(formPayrollRate)}.`
                          : "Debe definir aquí la tarifa o configurarla en la liquidación."}
                    </small>
                  </label>
                ) : (
                  <label>
                    Descuento
                    <input
                      min="0"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          discount: event.target.value,
                        }))
                      }
                      step="1"
                      type="number"
                      value={form.discount}
                    />
                  </label>
                )}
                {isExtraHoursEvent(form.eventType) && (
                  <div className="hr-event-extra-total hr-span-2">
                    <span>Total estimado de horas extra</span>
                    <strong>{money(formExtraTotal)}</strong>
                    <small>
                      {decimal(Number(form.hours) || 0)} horas ×{" "}
                      {money(formExtraRate)}
                    </small>
                  </div>
                )}
                <label className="hr-span-2">
                  Motivo
                  <input
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Motivo principal de la novedad"
                    value={form.reason}
                  />
                </label>
                <label className="hr-span-2">
                  Justificación
                  <textarea
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        justification: event.target.value,
                      }))
                    }
                    placeholder="Detalle o documento presentado"
                    value={form.justification}
                  />
                </label>
                <label className="hr-span-2">
                  Observaciones internas
                  <textarea
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    value={form.notes}
                  />
                </label>
              </div>
              <p className="hr-event-note">
                Los descuentos y horas extra solo afectan la liquidación cuando
                la novedad está aprobada. Los permisos y ausencias aprobados se
                reflejan automáticamente en asistencia.
              </p>
              <div className="hr-modal-actions">
                <button
                  className="secondary-button"
                  disabled={saving}
                  onClick={() => setFormOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="submit-button"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Guardando..." : "Guardar novedad"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function EventKpi({
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

function emptyEventForm(): EventForm {
  const today = new Date().toISOString().slice(0, 10);
  return {
    dateFrom: today,
    dateTo: today,
    discount: "0",
    employeeId: "",
    eventType: eventTypes[0],
    extraRate: "0",
    hours: "0",
    id: "",
    justification: "",
    notes: "",
    paid: "Sí",
    reason: "",
    status: "Pendiente",
  };
}

function eventBody(form: EventForm): Record<string, unknown> {
  return {
    ...form,
    discount: Number(form.discount) || 0,
    extraRate: isExtraHoursEvent(form.eventType)
      ? Number(form.extraRate) || 0
      : 0,
    hours: Number(form.hours) || 0,
  };
}

function displayEventType(value: string) {
  const normalized = normalizeText(value);
  return (
    eventTypes.find((type) => normalizeText(type) === normalized) ?? value
  );
}

function displayStatus(value: string) {
  const normalized = normalizeText(value);
  return (
    eventStatuses.find((status) => normalizeText(status) === normalized) ??
    "Pendiente"
  );
}

function statusIs(value: string, expected: string) {
  return normalizeText(value) === normalizeText(expected);
}

function overlapsMonth(from: string, to: string, month: string) {
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;
  return from <= monthEnd && (to || from) >= monthStart;
}

function effectiveExtraRate(event: HrEvent, payroll: HrPayroll[]) {
  if (event.extraRate > 0) return event.extraRate;
  return (
    payroll.find(
      (record) =>
        record.employeeId === event.employeeId &&
        record.month === event.dateFrom.slice(0, 7),
    )?.extraRate ?? 0
  );
}

function eventExtraPay(event: HrEvent, payroll: HrPayroll[]) {
  return event.hours * effectiveExtraRate(event, payroll);
}

function isExtraHoursEvent(value: string) {
  return normalizeText(value).includes("hora extra");
}

function eventDays(from: string, to: string) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to || from}T12:00:00`);
  const difference = end.getTime() - start.getTime();
  return Number.isFinite(difference)
    ? Math.max(1, Math.floor(difference / 86_400_000) + 1)
    : 0;
}

function employeeName(employeeId: string, employees: HrEmployee[]) {
  return (
    employees.find((employee) => employee.id === employeeId)?.fullName ??
    "Funcionario no encontrado"
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function decimal(value: number) {
  return new Intl.NumberFormat("es-PY", {
    maximumFractionDigits: 2,
  }).format(value);
}

function isPaid(value: string) {
  return ["si", "sí", "yes", "true"].includes(value.trim().toLowerCase());
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
