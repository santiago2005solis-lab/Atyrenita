"use client";

import { FormEvent, useMemo, useState } from "react";
import type { HrEmployee } from "@/lib/company-data";
import type { HrAttendance } from "@/lib/hr-data";

type AttendanceForm = {
  attendanceDate: string;
  employeeId: string;
  entry: string;
  exit: string;
  extraHours: string;
  id: string;
  lunchIn: string;
  lunchOut: string;
  notes: string;
  status: string;
};

const emptyAttendanceForm: AttendanceForm = {
  attendanceDate: localDateValue(),
  employeeId: "",
  entry: "07:00",
  exit: "17:00",
  extraHours: "0",
  id: "",
  lunchIn: "13:00",
  lunchOut: "12:00",
  notes: "",
  status: "Presente",
};

export function HrAttendancePanel({
  attendance,
  canEdit,
  employees,
  onRefresh,
  selectedMonth,
  setSelectedMonth,
}: {
  attendance: HrAttendance[];
  canEdit: boolean;
  employees: HrEmployee[];
  onRefresh: () => Promise<void>;
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(localDateValue());
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyAttendanceForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const monthRecords = useMemo(
    () =>
      attendance
        .filter((record) => record.attendanceDate.startsWith(selectedMonth))
        .filter(
          (record) =>
            statusFilter === "Todos" || record.status === statusFilter,
        )
        .filter((record) => {
          const employee = employeeMap.get(record.employeeId);
          return (
            !search.trim() ||
            normalizeText(
              `${employee?.fullName ?? ""} ${employee?.department ?? ""}`,
            ).includes(normalizeText(search))
          );
        })
        .sort((first, second) =>
          `${second.attendanceDate}-${employeeName(second.employeeId, employeeMap)}`
            .localeCompare(
              `${first.attendanceDate}-${employeeName(first.employeeId, employeeMap)}`,
            ),
        ),
    [attendance, employeeMap, search, selectedMonth, statusFilter],
  );
  const dayRecords = attendance.filter(
    (record) => record.attendanceDate === selectedDate,
  );
  const presentToday = dayRecords.filter(
    (record) => record.status === "Presente",
  ).length;
  const absentToday = dayRecords.filter(
    (record) => record.status === "Ausente",
  ).length;
  const extraHours = monthRecords.reduce(
    (sum, record) => sum + record.extraHours,
    0,
  );

  function openForm(record?: HrAttendance) {
    setForm(
      record
        ? {
            attendanceDate: record.attendanceDate,
            employeeId: record.employeeId,
            entry: record.entry,
            exit: record.exit,
            extraHours: String(record.extraHours),
            id: record.id,
            lunchIn: record.lunchIn,
            lunchOut: record.lunchOut,
            notes: record.notes,
            status: record.status,
          }
        : {
            ...emptyAttendanceForm,
            attendanceDate: selectedDate,
          },
    );
    setMessage("");
    setFormOpen(true);
  }

  async function submitAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/hr/attendance", {
        body: JSON.stringify({
          ...form,
          extraHours: Number(form.extraHours),
        }),
        headers: { "Content-Type": "application/json" },
        method: form.id ? "PATCH" : "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo guardar la asistencia.");
      }
      await onRefresh();
      setFormOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la asistencia.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function markPresent() {
    const activeIds = employees
      .filter((employee) => employee.status === "activo")
      .map((employee) => employee.id);
    if (!activeIds.length) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/hr/attendance", {
        body: JSON.stringify({
          ...emptyAttendanceForm,
          attendanceDate: selectedDate,
          employeeIds: activeIds,
          preserveExisting: true,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        saved?: number;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo registrar la asistencia.");
      }
      await onRefresh();
      setMessage(
        `${payload.saved ?? 0} asistencias agregadas; los registros existentes se conservaron.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo registrar la asistencia.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel hr-attendance-panel">
      <div className="panel-heading hr-section-heading">
        <div>
          <p className="eyebrow">Control diario</p>
          <h3>Asistencia</h3>
        </div>
        {canEdit && (
          <div className="hr-attendance-actions">
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() => void markPresent()}
              type="button"
            >
              Marcar presentes
            </button>
            <button
              className="submit-button hr-primary-button"
              onClick={() => openForm()}
              type="button"
            >
              Registrar asistencia
            </button>
          </div>
        )}
      </div>

      {message && <div className="status-banner success">{message}</div>}

      <div className="hr-attendance-daybar">
        <label>
          Fecha de trabajo
          <input
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setSelectedMonth(event.target.value.slice(0, 7));
            }}
            type="date"
            value={selectedDate}
          />
        </label>
        <div>
          <span>Presentes</span>
          <strong>{presentToday}</strong>
        </div>
        <div>
          <span>Ausentes</span>
          <strong>{absentToday}</strong>
        </div>
        <div>
          <span>Sin registrar</span>
          <strong>
            {Math.max(
              0,
              employees.filter((employee) => employee.status === "activo").length -
                dayRecords.length,
            )}
          </strong>
        </div>
        <div>
          <span>Extras del mes</span>
          <strong>{extraHours.toFixed(2)} h</strong>
        </div>
      </div>

      <div className="hr-attendance-filters">
        <label>
          Mes
          <input
            onChange={(event) => setSelectedMonth(event.target.value)}
            type="month"
            value={selectedMonth}
          />
        </label>
        <label>
          Estado
          <select
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option>Todos</option>
            <option>Presente</option>
            <option>Ausente</option>
            <option>Permiso</option>
            <option>Reposo</option>
          </select>
        </label>
        <label>
          Buscar
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Funcionario o sector"
            value={search}
          />
        </label>
      </div>

      <div className="table-wrap hr-table">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Funcionario</th>
              <th>Sector</th>
              <th>Entrada</th>
              <th>Almuerzo</th>
              <th>Regreso</th>
              <th>Salida</th>
              <th>Horas</th>
              <th>Extras</th>
              <th>Estado</th>
              {canEdit && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {monthRecords.length ? (
              monthRecords.map((record) => {
                const employee = employeeMap.get(record.employeeId);
                return (
                  <tr key={record.id}>
                    <td>{formatDate(record.attendanceDate)}</td>
                    <td><strong>{employee?.fullName ?? "No encontrado"}</strong></td>
                    <td>{employee?.department || "Sin sector"}</td>
                    <td>{record.entry || "-"}</td>
                    <td>{record.lunchOut || "-"}</td>
                    <td>{record.lunchIn || "-"}</td>
                    <td>{record.exit || "-"}</td>
                    <td>{workedHours(record)}</td>
                    <td>{record.extraHours.toFixed(2)}</td>
                    <td>
                      <span className={`hr-attendance-status ${normalizeText(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          className="hr-table-action"
                          onClick={() => openForm(record)}
                          type="button"
                        >
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="hr-empty-cell" colSpan={canEdit ? 11 : 10}>
                  No hay asistencias para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="hr-modal-backdrop" role="presentation">
          <section
            aria-labelledby="hr-attendance-form-title"
            aria-modal="true"
            className="hr-modal"
            role="dialog"
          >
            <div className="hr-modal-heading">
              <div>
                <p className="eyebrow">Control diario</p>
                <h3 id="hr-attendance-form-title">
                  {form.id ? "Editar asistencia" : "Registrar asistencia"}
                </h3>
              </div>
              <button
                aria-label="Cerrar"
                className="hr-close-button"
                onClick={() => setFormOpen(false)}
                type="button"
              >
                X
              </button>
            </div>
            <form className="hr-employee-form" onSubmit={submitAttendance}>
              {message && <div className="status-banner warning">{message}</div>}
              <fieldset disabled={saving}>
                <div className="hr-form-grid">
                  <label>
                    Funcionario
                    <select
                      disabled={Boolean(form.id)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          employeeId: event.target.value,
                        }))
                      }
                      required
                      value={form.employeeId}
                    >
                      <option value="">Seleccione...</option>
                      {employees
                        .filter((employee) => employee.status === "activo")
                        .map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.fullName} | {employee.department}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Fecha
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          attendanceDate: event.target.value,
                        }))
                      }
                      required
                      type="date"
                      value={form.attendanceDate}
                    />
                  </label>
                  <label>
                    Estado
                    <select
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                      value={form.status}
                    >
                      <option>Presente</option>
                      <option>Ausente</option>
                      <option>Permiso</option>
                      <option>Reposo</option>
                    </select>
                  </label>
                  <label>
                    Horas extras
                    <input
                      min="0"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          extraHours: event.target.value,
                        }))
                      }
                      step="0.25"
                      type="number"
                      value={form.extraHours}
                    />
                  </label>
                  <label>
                    Entrada
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          entry: event.target.value,
                        }))
                      }
                      type="time"
                      value={form.entry}
                    />
                  </label>
                  <label>
                    Salida al almuerzo
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          lunchOut: event.target.value,
                        }))
                      }
                      type="time"
                      value={form.lunchOut}
                    />
                  </label>
                  <label>
                    Regreso del almuerzo
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          lunchIn: event.target.value,
                        }))
                      }
                      type="time"
                      value={form.lunchIn}
                    />
                  </label>
                  <label>
                    Salida
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          exit: event.target.value,
                        }))
                      }
                      type="time"
                      value={form.exit}
                    />
                  </label>
                  <label className="hr-span-2">
                    Observaciones
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
                <div className="hr-modal-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setFormOpen(false)}
                    type="button"
                  >
                    Cancelar
                  </button>
                  <button className="submit-button hr-primary-button" type="submit">
                    {saving ? "Guardando..." : "Guardar asistencia"}
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function employeeName(
  employeeId: string,
  employeeMap: Map<string, HrEmployee>,
) {
  return employeeMap.get(employeeId)?.fullName ?? "";
}

function workedHours(record: HrAttendance) {
  const first = elapsed(record.entry, record.lunchOut);
  const second = elapsed(record.lunchIn, record.exit);
  const total = first || second ? first + second : elapsed(record.entry, record.exit);
  return total.toFixed(2);
}

function elapsed(from: string, to: string) {
  if (!from || !to) return 0;
  const [fromHour, fromMinute] = from.split(":").map(Number);
  const [toHour, toMinute] = to.split(":").map(Number);
  return Math.max(0, toHour * 60 + toMinute - fromHour * 60 - fromMinute) / 60;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-PY");
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
