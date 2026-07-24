"use client";

import { FormEvent, useMemo, useState } from "react";
import type { HrEmployee } from "@/lib/company-data";
import type { HrSector, HrTransfer } from "@/lib/hr-data";

type TransferFilter = "Todos" | "Sector" | "Cargo" | "Jefatura";

type TransferForm = {
  boss: string;
  date: string;
  employeeId: string;
  notes: string;
  reason: string;
  toRole: string;
  toSectorId: string;
};

const emptyForm = (): TransferForm => ({
  boss: "",
  date: new Date().toISOString().slice(0, 10),
  employeeId: "",
  notes: "",
  reason: "",
  toRole: "",
  toSectorId: "",
});

const reasons = [
  "Promocion",
  "Reorganizacion interna",
  "Necesidad operativa",
  "Cambio de establecimiento",
  "Reemplazo de funcion",
  "Solicitud del funcionario",
  "Otro",
];

export function HrTransfersPanel({
  canEdit,
  employees,
  onRefresh,
  sectors,
  transfers,
}: {
  canEdit: boolean;
  employees: HrEmployee[];
  onRefresh: () => Promise<void>;
  sectors: HrSector[];
  transfers: HrTransfer[];
}) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransferFilter>("Todos");
  const [form, setForm] = useState<TransferForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const sectorsById = useMemo(
    () => new Map(sectors.map((sector) => [sector.id, sector])),
    [sectors],
  );
  const activeEmployees = useMemo(
    () =>
      employees
        .filter((employee) => employee.status !== "inactivo")
        .sort((first, second) => first.fullName.localeCompare(second.fullName)),
    [employees],
  );
  const activeSectors = useMemo(
    () =>
      sectors
        .filter((sector) => sector.status === "Activo")
        .sort((first, second) => first.name.localeCompare(second.name)),
    [sectors],
  );
  const filteredTransfers = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return transfers.filter((transfer) => {
      const employee = employeesById.get(transfer.employeeId);
      const changes = transferChanges(transfer);
      const matchesType =
        typeFilter === "Todos" ||
        (typeFilter === "Sector" && changes.sector) ||
        (typeFilter === "Cargo" && changes.role) ||
        (typeFilter === "Jefatura" && changes.boss);
      const matchesQuery =
        !normalizedQuery ||
        normalizeText(
          [
            employee?.fullName,
            employee?.documentNumber,
            sectorLabel(transfer.fromSectorId, sectorsById),
            sectorLabel(transfer.toSectorId, sectorsById),
            transfer.fromRole,
            transfer.toRole,
            transfer.reason,
            transfer.createdBy,
          ].join(" "),
        ).includes(normalizedQuery);
      return (
        (!month || transfer.date.startsWith(month)) &&
        matchesType &&
        matchesQuery
      );
    });
  }, [
    employeesById,
    month,
    query,
    sectorsById,
    transfers,
    typeFilter,
  ]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyTransfers = useMemo(
    () => transfers.filter((transfer) => transfer.date.startsWith(currentMonth)),
    [currentMonth, transfers],
  );
  const selectedEmployee = employeesById.get(form.employeeId);
  const currentSector = selectedEmployee
    ? findEmployeeSector(selectedEmployee, sectors)
    : undefined;
  const targetSector = sectorsById.get(form.toSectorId);

  const monthlyTotals = useMemo(
    () => ({
      employees: new Set(
        monthlyTransfers.map((transfer) => transfer.employeeId),
      ).size,
      roles: monthlyTransfers.filter((transfer) => transferChanges(transfer).role)
        .length,
      sectors: monthlyTransfers.filter(
        (transfer) => transferChanges(transfer).sector,
      ).length,
      total: monthlyTransfers.length,
    }),
    [monthlyTransfers],
  );

  function openForm() {
    setForm(emptyForm());
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function chooseEmployee(employeeId: string) {
    const employee = employeesById.get(employeeId);
    const sector = employee ? findEmployeeSector(employee, sectors) : undefined;
    setForm((current) => ({
      ...current,
      boss: sector?.boss ?? "",
      employeeId,
      toRole: employee?.role ?? "",
      toSectorId:
        sector?.status === "Activo" ? sector.id : "",
    }));
  }

  function chooseSector(sectorId: string) {
    const sector = sectorsById.get(sectorId);
    setForm((current) => ({
      ...current,
      boss: sector?.boss ?? "",
      toSectorId: sectorId,
    }));
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/hr/transfers", {
        body: JSON.stringify(form),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo registrar el cambio.");
      }
      await onRefresh();
      setFormOpen(false);
      setMessage("Cambio registrado y legajo actualizado.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar el cambio.",
      );
    } finally {
      setSaving(false);
    }
  }

  function exportHistory() {
    const headers = [
      "Fecha",
      "Funcionario",
      "Sector anterior",
      "Nuevo sector",
      "Cargo anterior",
      "Nuevo cargo",
      "Jefe anterior",
      "Nuevo jefe",
      "Motivo",
      "Registrado por",
      "Observaciones",
    ];
    const rows = filteredTransfers.map((transfer) => [
      transfer.date,
      employeesById.get(transfer.employeeId)?.fullName ?? "",
      sectorLabel(transfer.fromSectorId, sectorsById),
      sectorLabel(transfer.toSectorId, sectorsById),
      transfer.fromRole,
      transfer.toRole,
      transfer.fromBoss,
      transfer.boss,
      transfer.reason,
      transfer.createdBy,
      transfer.notes,
    ]);
    downloadCsv(
      `cambios-rrhh-${month || "completo"}.csv`,
      [headers, ...rows],
    );
  }

  return (
    <section className="panel hr-transfer-panel">
      <div className="panel-heading hr-section-heading">
        <div>
          <p className="eyebrow">Trayectoria interna</p>
          <h3>Cambios de sector y cargos</h3>
        </div>
        <div className="hr-transfer-heading-actions">
          <button
            className="secondary-button"
            disabled={!filteredTransfers.length}
            onClick={exportHistory}
            type="button"
          >
            Exportar
          </button>
          {canEdit && (
            <button
              className="submit-button hr-primary-button"
              disabled={!activeEmployees.length || !activeSectors.length}
              onClick={openForm}
              type="button"
            >
              Registrar cambio
            </button>
          )}
        </div>
      </div>

      {message && <div className="status-banner success">{message}</div>}
      {error && !formOpen && (
        <div className="status-banner danger">{error}</div>
      )}

      <div className="hr-transfer-kpis" aria-label="Cambios del mes">
        <TransferKpi label="Cambios del mes" value={monthlyTotals.total} />
        <TransferKpi label="Movimientos de sector" value={monthlyTotals.sectors} />
        <TransferKpi label="Cambios de cargo" value={monthlyTotals.roles} />
        <TransferKpi label="Funcionarios alcanzados" value={monthlyTotals.employees} />
      </div>

      <div className="hr-transfer-filters">
        <label>
          Buscar
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Funcionario, sector, cargo o motivo"
            value={query}
          />
        </label>
        <label>
          Mes
          <input
            onChange={(event) => setMonth(event.target.value)}
            type="month"
            value={month}
          />
        </label>
        <label>
          Tipo de cambio
          <select
            onChange={(event) =>
              setTypeFilter(event.target.value as TransferFilter)
            }
            value={typeFilter}
          >
            <option>Todos</option>
            <option>Sector</option>
            <option>Cargo</option>
            <option>Jefatura</option>
          </select>
        </label>
        <button
          className="secondary-button hr-clear-button"
          onClick={() => {
            setQuery("");
            setMonth("");
            setTypeFilter("Todos");
          }}
          type="button"
        >
          Limpiar
        </button>
      </div>

      <div className="table-wrap hr-table hr-transfer-table">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Funcionario</th>
              <th>Sector</th>
              <th>Cargo</th>
              <th>Jefatura</th>
              <th>Motivo</th>
              <th>Registro</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransfers.length ? (
              filteredTransfers.map((transfer) => (
                <TransferRow
                  employee={employeesById.get(transfer.employeeId)}
                  key={transfer.id}
                  sectorsById={sectorsById}
                  transfer={transfer}
                />
              ))
            ) : (
              <tr>
                <td className="hr-empty-cell" colSpan={7}>
                  No hay cambios para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="hr-modal-backdrop" role="presentation">
          <section
            aria-labelledby="hr-transfer-form-title"
            aria-modal="true"
            className="hr-modal hr-transfer-modal"
            role="dialog"
          >
            <div className="hr-modal-heading">
              <div>
                <p className="eyebrow">Trayectoria interna</p>
                <h3 id="hr-transfer-form-title">Registrar cambio</h3>
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
            <form className="hr-employee-form" onSubmit={submitTransfer}>
              {error && <div className="status-banner danger">{error}</div>}
              <fieldset disabled={saving}>
                <div className="hr-form-grid">
                  <label className="hr-span-2">
                    Funcionario
                    <select
                      onChange={(event) => chooseEmployee(event.target.value)}
                      required
                      value={form.employeeId}
                    >
                      <option value="">Seleccionar</option>
                      {activeEmployees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.fullName}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedEmployee && (
                    <div className="hr-transfer-current hr-span-2">
                      <div>
                        <span>Sector actual</span>
                        <strong>
                          {currentSector?.name ||
                            selectedEmployee.department ||
                            "Sin sector"}
                        </strong>
                      </div>
                      <div>
                        <span>Cargo actual</span>
                        <strong>{selectedEmployee.role || "Sin cargo"}</strong>
                      </div>
                      <div>
                        <span>Jefatura actual</span>
                        <strong>{currentSector?.boss || "No definida"}</strong>
                      </div>
                    </div>
                  )}

                  <label>
                    Fecha efectiva
                    <input
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      required
                      type="date"
                      value={form.date}
                    />
                  </label>
                  <label>
                    Nuevo sector
                    <select
                      onChange={(event) => chooseSector(event.target.value)}
                      required
                      value={form.toSectorId}
                    >
                      <option value="">Seleccionar</option>
                      {activeSectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nuevo cargo
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          toRole: event.target.value,
                        }))
                      }
                      placeholder="Cargo o funcion"
                      value={form.toRole}
                    />
                  </label>
                  <label>
                    Nuevo jefe
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          boss: event.target.value,
                        }))
                      }
                      placeholder={targetSector?.boss || "Nombre del responsable"}
                      value={form.boss}
                    />
                  </label>
                  <label className="hr-span-2">
                    Motivo
                    <input
                      list="hr-transfer-reasons"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                      required
                      value={form.reason}
                    />
                    <datalist id="hr-transfer-reasons">
                      {reasons.map((reason) => (
                        <option key={reason} value={reason} />
                      ))}
                    </datalist>
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
                  <button className="submit-button" type="submit">
                    {saving ? "Guardando..." : "Confirmar cambio"}
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

function TransferKpi({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function TransferRow({
  employee,
  sectorsById,
  transfer,
}: {
  employee: HrEmployee | undefined;
  sectorsById: Map<string, HrSector>;
  transfer: HrTransfer;
}) {
  const changes = transferChanges(transfer);
  return (
    <tr>
      <td>{formatDate(transfer.date)}</td>
      <td>
        <strong>{employee?.fullName ?? "Funcionario no encontrado"}</strong>
        <small>{employee?.documentNumber || "-"}</small>
      </td>
      <td>
        <ChangeValue
          changed={changes.sector}
          from={sectorLabel(transfer.fromSectorId, sectorsById)}
          to={sectorLabel(transfer.toSectorId, sectorsById)}
        />
      </td>
      <td>
        <ChangeValue
          changed={changes.role}
          from={transfer.fromRole || "-"}
          to={transfer.toRole || transfer.fromRole || "-"}
        />
      </td>
      <td>
        <ChangeValue
          changed={changes.boss}
          from={transfer.fromBoss || "-"}
          to={transfer.boss || "-"}
        />
      </td>
      <td>
        <strong>{transfer.reason || "-"}</strong>
        {transfer.notes && <small>{transfer.notes}</small>}
      </td>
      <td>
        <span>{transfer.createdBy || "Registro importado"}</span>
      </td>
    </tr>
  );
}

function ChangeValue({
  changed,
  from,
  to,
}: {
  changed: boolean;
  from: string;
  to: string;
}) {
  return (
    <div className={`hr-transfer-change ${changed ? "changed" : ""}`}>
      <small>{from}</small>
      <strong>{to}</strong>
    </div>
  );
}

function transferChanges(transfer: HrTransfer) {
  return {
    boss:
      Boolean(transfer.fromBoss || transfer.boss) &&
      normalizeText(transfer.fromBoss) !== normalizeText(transfer.boss),
    role:
      Boolean(transfer.fromRole || transfer.toRole) &&
      normalizeText(transfer.fromRole) !== normalizeText(transfer.toRole),
    sector:
      Boolean(transfer.fromSectorId || transfer.toSectorId) &&
      transfer.fromSectorId !== transfer.toSectorId,
  };
}

function findEmployeeSector(employee: HrEmployee, sectors: HrSector[]) {
  const department = normalizeText(employee.department);
  return sectors.find((sector) => normalizeText(sector.name) === department);
}

function sectorLabel(
  sectorId: string,
  sectorsById: Map<string, HrSector>,
) {
  if (!sectorId) return "-";
  return sectorsById.get(sectorId)?.name ?? sectorId;
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function downloadCsv(fileName: string, rows: string[][]) {
  const content = rows
    .map((row) =>
      row
        .map((value) => csvValue(value))
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvValue(value: string) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}
