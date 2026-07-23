"use client";

import {
  FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { HrEmployee } from "@/lib/company-data";
import {
  emptyHrData,
  type HrData,
  type HrSector,
} from "@/lib/hr-data";

type HrBlockId =
  | "resumen"
  | "funcionarios"
  | "sectores"
  | "cambios"
  | "asistencia"
  | "novedades"
  | "salarios"
  | "documentos"
  | "consultas"
  | "reportes"
  | "respaldo";

type HrReportId = "nomina" | "asistencia" | "novedades" | "dotacion";

type EmployeeForm = {
  dailyWage: string;
  department: string;
  documentNumber: string;
  fullName: string;
  id: string;
  monthlySalary: string;
  notes: string;
  role: string;
  salaryType: HrEmployee["salaryType"];
  startDate: string;
  status: HrEmployee["status"];
};

const hrBlocks: Array<{ id: HrBlockId; label: string }> = [
  { id: "resumen", label: "Panel general" },
  { id: "funcionarios", label: "Funcionarios" },
  { id: "sectores", label: "Sectores y jefaturas" },
  { id: "cambios", label: "Cambios de sector" },
  { id: "asistencia", label: "Asistencia" },
  { id: "novedades", label: "Permisos y novedades" },
  { id: "salarios", label: "Salarios y anticipos" },
  { id: "documentos", label: "Documentos" },
  { id: "consultas", label: "Consultas" },
  { id: "reportes", label: "Reportes" },
  { id: "respaldo", label: "Importar respaldo" },
];

const hrReports: Array<{
  description: string;
  id: HrReportId;
  label: string;
}> = [
  {
    description: "Liquidacion, anticipos, descuentos y saldo por funcionario.",
    id: "nomina",
    label: "Nomina",
  },
  {
    description: "Presentismo, ausencias, horas trabajadas y horas extras.",
    id: "asistencia",
    label: "Asistencia",
  },
  {
    description: "Permisos, licencias, novedades y descuentos asociados.",
    id: "novedades",
    label: "Novedades",
  },
  {
    description: "Composicion actual del personal por sector y modalidad.",
    id: "dotacion",
    label: "Dotacion",
  },
];

const baseSectors = [
  "Administracion",
  "Confinamiento 15 ha",
  "Confinamiento 500 ha",
  "Pastoreo Capitan",
  "Taller",
  "Eucalipto",
  "Capiacu - Brizantha",
  "Estructura / Inversiones",
  "Ovinos",
  "Porcinos",
  "Seguridad",
];

const emptyEmployeeForm: EmployeeForm = {
  dailyWage: "",
  department: "",
  documentNumber: "",
  fullName: "",
  id: "",
  monthlySalary: "",
  notes: "",
  role: "",
  salaryType: "mensual",
  startDate: new Date().toISOString().slice(0, 10),
  status: "activo",
};

export function HumanResourcesModule({
  canAdmin,
  canEdit,
  employees: initialEmployees,
  money,
}: {
  canAdmin: boolean;
  canEdit: boolean;
  employees: HrEmployee[];
  money: (value: number) => string;
}) {
  const [activeBlock, setActiveBlock] = useState<HrBlockId>("resumen");
  const [employees, setEmployees] = useState(initialEmployees);
  const [hrData, setHrData] = useState<HrData>({
    ...emptyHrData,
    employees: initialEmployees,
  });
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(emptyEmployeeForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [dataError, setDataError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    let active = true;

    void requestHrData()
      .then((nextData) => {
        if (!active) return;
        setHrData(nextData);
        setEmployees(nextData.employees);
        setDataError("");
      })
      .catch((error) => {
        if (!active) return;
        setDataError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar Recursos Humanos.",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "activo"),
    [employees],
  );
  const sectorRecords = useMemo(
    () =>
      hrData.sectors.length
        ? hrData.sectors
        : baseSectors.map<HrSector>((name, index) => ({
            boss: "",
            description: "",
            establishment: "",
            id: `base-sector-${index}`,
            name,
            status: "Activo",
          })),
    [hrData.sectors],
  );
  const sectors = useMemo(
    () =>
      Array.from(
        new Set([
          ...sectorRecords.map((sector) => sector.name),
          ...employees.map((employee) => employee.department).filter(Boolean),
        ]),
      ).sort((first, second) => first.localeCompare(second)),
    [employees, sectorRecords],
  );
  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return employees
      .filter((employee) => {
        const matchesQuery =
          !normalizedQuery ||
          [
            employee.fullName,
            employee.documentNumber,
            employee.role,
            employee.department,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesSector =
          sectorFilter === "Todos" || employee.department === sectorFilter;
        const matchesStatus =
          statusFilter === "Todos" || employee.status === statusFilter;
        return matchesQuery && matchesSector && matchesStatus;
      })
      .sort((first, second) => first.fullName.localeCompare(second.fullName));
  }, [employees, query, sectorFilter, statusFilter]);
  const salaryRows = useMemo(
    () =>
      activeEmployees.map((employee) => ({
        calculation: calculateEmployeePayroll(employee, selectedMonth, hrData),
        employee,
      })),
    [activeEmployees, hrData, selectedMonth],
  );
  const salaryTotals = useMemo(
    () =>
      salaryRows.reduce(
        (totals, row) => ({
          advances: totals.advances + row.calculation.advances,
          base: totals.base + row.calculation.base,
          balance: totals.balance + row.calculation.balance,
          extras: totals.extras + row.calculation.extras,
        }),
        { advances: 0, balance: 0, base: 0, extras: 0 },
      ),
    [salaryRows],
  );

  function openEmployeeForm(employee?: HrEmployee) {
    setEmployeeForm(
      employee
        ? {
            dailyWage: String(employee.dailyWage),
            department: employee.department,
            documentNumber: employee.documentNumber,
            fullName: employee.fullName,
            id: employee.id,
            monthlySalary: String(employee.monthlySalary),
            notes: employee.notes,
            role: employee.role,
            salaryType: employee.salaryType,
            startDate: employee.startDate,
            status: employee.status,
          }
        : emptyEmployeeForm,
    );
    setFormError("");
    setFormOpen(true);
  }

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const response = await fetch("/api/hr/employees", {
        body: JSON.stringify({
          ...employeeForm,
          dailyWage: Number(employeeForm.dailyWage),
          monthlySalary: Number(employeeForm.monthlySalary),
        }),
        headers: { "Content-Type": "application/json" },
        method: employeeForm.id ? "PATCH" : "POST",
      });
      const payload = (await response.json()) as {
        employee?: HrEmployee;
        error?: string;
      };
      if (!response.ok || !payload.employee) {
        throw new Error(payload.error ?? "No se pudo guardar el funcionario.");
      }

      setEmployees((current) =>
        employeeForm.id
          ? current.map((employee) =>
              employee.id === payload.employee?.id ? payload.employee : employee,
            )
          : [...current, payload.employee!],
      );
      setHrData((current) => ({
        ...current,
        employees: employeeForm.id
          ? current.employees.map((employee) =>
              employee.id === payload.employee?.id ? payload.employee : employee,
            )
          : [...current.employees, payload.employee!],
      }));
      setFormOpen(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "No se pudo guardar el funcionario.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setImportMessage("");

    try {
      const backup = JSON.parse(await file.text()) as unknown;
      const response = await fetch("/api/hr/import", {
        body: JSON.stringify(backup),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        imported?: Record<string, number>;
      };
      if (!response.ok || !payload.imported) {
        throw new Error(payload.error ?? "No se pudo importar el respaldo.");
      }

      const nextData = await requestHrData();
      setHrData(nextData);
      setEmployees(nextData.employees);
      setDataError("");
      setImportMessage(
        `${payload.imported.employees ?? 0} funcionarios y ${
          Object.values(payload.imported).reduce((sum, count) => sum + count, 0) -
          (payload.imported.employees ?? 0)
        } registros relacionados importados.`,
      );
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : "No se pudo importar el respaldo.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="hr-module">
      {dataError && <div className="status-banner warning">{dataError}</div>}
      <section className="hr-block-navigation" aria-label="Areas de recursos humanos">
        <div className="hr-block-status">
          <span>Area activa</span>
          <strong>
            {hrBlocks.find((block) => block.id === activeBlock)?.label}
          </strong>
        </div>
        <div className="hr-block-tabs">
          {hrBlocks.map((block) => (
            <button
              aria-pressed={activeBlock === block.id}
              className={activeBlock === block.id ? "active" : ""}
              key={block.id}
              onClick={() => setActiveBlock(block.id)}
              type="button"
            >
              {block.label}
            </button>
          ))}
        </div>
      </section>

      {activeBlock === "resumen" && (
        <HrSummary
          activeEmployees={activeEmployees}
          employees={employees}
          money={money}
          sectors={sectors}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          data={hrData}
        />
      )}

      {activeBlock === "funcionarios" && (
        <section className="panel hr-register-panel">
          <HrSectionHeading
            action={
              canEdit ? (
                <button
                  className="submit-button hr-primary-button"
                  onClick={() => openEmployeeForm()}
                  type="button"
                >
                  Nuevo funcionario
                </button>
              ) : null
            }
            eyebrow="Legajos"
            title="Funcionarios"
          />
          <div className="hr-filters">
            <label>
              Buscar
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre, C.I., cargo"
                value={query}
              />
            </label>
            <label>
              Sector
              <select
                onChange={(event) => setSectorFilter(event.target.value)}
                value={sectorFilter}
              >
                <option>Todos</option>
                {sectors.map((sector) => (
                  <option key={sector}>{sector}</option>
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
                <option value="activo">Activo</option>
                <option value="licencia">Licencia</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>
            <button
              className="secondary-button hr-clear-button"
              onClick={() => {
                setQuery("");
                setSectorFilter("Todos");
                setStatusFilter("Todos");
              }}
              type="button"
            >
              Limpiar
            </button>
          </div>
          <EmployeeTable
            canEdit={canEdit}
            employees={filteredEmployees}
            money={money}
            onEdit={openEmployeeForm}
          />
        </section>
      )}

      {activeBlock === "sectores" && (
        <section className="panel">
          <HrSectionHeading eyebrow="Organizacion" title="Sectores y jefaturas" />
          <div className="hr-sector-grid">
            {sectorRecords.map((sector) => {
              const assigned = activeEmployees.filter(
                (employee) => employee.department === sector.name,
              );
              return (
                <article className="hr-sector-card" key={sector.id}>
                  <div>
                    <span>Sector</span>
                    <strong>{sector.name}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Jefe</dt>
                      <dd>{sector.boss || "No definido"}</dd>
                    </div>
                    <div>
                      <dt>Activos</dt>
                      <dd>{assigned.length}</dd>
                    </div>
                  </dl>
                  {sector.establishment && <small>{sector.establishment}</small>}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeBlock === "salarios" && (
        <section className="panel">
          <HrSectionHeading
            action={
              <label className="hr-month-filter">
                Mes
                <input
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  type="month"
                  value={selectedMonth}
                />
              </label>
            }
            eyebrow="Nomina"
            title="Salarios y anticipos"
          />
          <div className="kpi-grid hr-kpi-grid">
            <HrKpi label="Base salarial" value={money(salaryTotals.base)} />
            <HrKpi label="Horas extras" value={money(salaryTotals.extras)} />
            <HrKpi
              label="Anticipos"
              tone="warning"
              value={money(salaryTotals.advances)}
            />
            <HrKpi
              label="Saldo restante"
              tone="blue"
              value={money(salaryTotals.balance)}
            />
          </div>
          <div className="table-wrap hr-table">
            <table>
              <thead>
                <tr>
                  <th>Funcionario</th>
                  <th>Sector</th>
                  <th>Modalidad</th>
                  <th>Base salarial</th>
                  <th>Horas extras</th>
                  <th>Anticipos</th>
                  <th>Descuentos</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {salaryRows.map(({ calculation, employee }) => (
                  <tr key={employee.id}>
                    <td><strong>{employee.fullName}</strong></td>
                    <td>{employee.department || "Sin sector"}</td>
                    <td>{salaryTypeLabel(employee.salaryType)}</td>
                    <td>{money(calculation.base)}</td>
                    <td>{money(calculation.extras)}</td>
                    <td>{money(calculation.advances)}</td>
                    <td>{money(calculation.discounts)}</td>
                    <td className="positive-amount">{money(calculation.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hr-subsection-heading">
            <div>
              <p className="eyebrow">Movimientos</p>
              <h3>Anticipos registrados</h3>
            </div>
            <span>{selectedMonth}</span>
          </div>
          <HrRecordsTable
            columns={[
              "Fecha",
              "Funcionario",
              "Monto",
              "Motivo",
              "Medio",
              "Autorizado por",
            ]}
            rows={hrData.advances
              .filter((advance) => advance.month === selectedMonth)
              .map((advance) => [
                formatDate(advance.date),
                employeeName(advance.employeeId, employees),
                money(advance.amount),
                advance.reason || "-",
                advance.method || "-",
                advance.approvedBy || "-",
              ])}
          />
        </section>
      )}

      {activeBlock === "reportes" && (
        <HrReports
          data={hrData}
          employees={employees}
          money={money}
          sectors={sectors}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
        />
      )}

      {activeBlock === "cambios" && (
        <HrOperationalTable
          columns={[
            "Fecha",
            "Funcionario",
            "Sector anterior",
            "Nuevo sector",
            "Jefe",
            "Motivo",
          ]}
          eyebrow="Historial"
          rows={hrData.transfers.map((transfer) => [
            formatDate(transfer.date),
            employeeName(transfer.employeeId, employees),
            sectorName(transfer.fromSectorId, hrData.sectors),
            sectorName(transfer.toSectorId, hrData.sectors),
            transfer.boss || "-",
            transfer.reason || "-",
          ])}
          title="Cambios de sector"
        />
      )}
      {activeBlock === "asistencia" && (
        <HrOperationalTable
          columns={[
            "Fecha",
            "Funcionario",
            "Sector",
            "Entrada",
            "Almuerzo",
            "Regreso",
            "Salida",
            "Horas",
            "Extras",
            "Estado",
          ]}
          eyebrow="Control diario"
          rows={hrData.attendance
            .filter((attendance) =>
              attendance.attendanceDate.startsWith(selectedMonth),
            )
            .map((attendance) => [
              formatDate(attendance.attendanceDate),
              employeeName(attendance.employeeId, employees),
              employeeSector(attendance.employeeId, employees),
              attendance.entry || "-",
              attendance.lunchOut || "-",
              attendance.lunchIn || "-",
              attendance.exit || "-",
              workedHours(attendance),
              attendance.extraHours.toFixed(2),
              attendance.status,
            ])}
          title="Asistencia"
        />
      )}
      {activeBlock === "novedades" && (
        <HrOperationalTable
          columns={[
            "Periodo",
            "Funcionario",
            "Tipo",
            "Dias",
            "Horas",
            "Motivo",
            "Estado",
            "Descuento",
          ]}
          eyebrow="Gestion"
          rows={hrData.events
            .filter((event) => event.dateFrom.startsWith(selectedMonth))
            .map((event) => [
              `${formatDate(event.dateFrom)}${
                event.dateTo && event.dateTo !== event.dateFrom
                  ? ` - ${formatDate(event.dateTo)}`
                  : ""
              }`,
              employeeName(event.employeeId, employees),
              event.eventType,
              eventDays(event.dateFrom, event.dateTo),
              event.hours.toFixed(2),
              event.reason || "-",
              event.status,
              money(event.discount),
            ])}
          title="Permisos y novedades"
        />
      )}
      {activeBlock === "documentos" && (
        <HrOperationalTable
          columns={[
            "Funcionario",
            "Documento",
            "Estado",
            "Entrega",
            "Vencimiento",
            "Referencia",
          ]}
          eyebrow="Legajos"
          rows={hrData.documents.map((document) => [
            employeeName(document.employeeId, employees),
            document.type,
            documentStatus(document),
            formatDate(document.deliveryDate),
            formatDate(document.expiryDate),
            document.reference || "-",
          ])}
          title="Documentos de ingreso"
        />
      )}
      {activeBlock === "consultas" && (
        <HrOperationalTable
          columns={[
            "Fecha",
            "Funcionario",
            "Tipo",
            "Asunto",
            "Estado",
            "Respuesta",
          ]}
          eyebrow="Atencion interna"
          rows={hrData.consultations
            .filter((consultation) => consultation.date.startsWith(selectedMonth))
            .map((consultation) => [
              formatDate(consultation.date),
              employeeName(consultation.employeeId, employees),
              consultation.type,
              consultation.subject,
              consultation.status,
              consultation.response || "-",
            ])}
          title="Consultas del personal"
        />
      )}

      {activeBlock === "respaldo" && (
        <section className="panel hr-import-panel">
          <HrSectionHeading eyebrow="Datos" title="Importar respaldo de RR.HH." />
          {importMessage && (
            <div
              className={`status-banner ${
                importMessage.includes("importados") ? "success" : "danger"
              }`}
            >
              {importMessage}
            </div>
          )}
          <div className="hr-import-layout">
            <label className="hr-file-control">
              Archivo JSON
              <input
                accept="application/json,.json"
                disabled={!canAdmin || importing}
                onChange={(event) => {
                  void importBackup(event.target.files?.[0]);
                  event.target.value = "";
                }}
                type="file"
              />
            </label>
            <div className="hr-import-summary">
              <span>Registros actuales</span>
              <strong>{employees.length} funcionarios</strong>
              <small>
                {hrData.sectors.length} sectores | {hrData.attendance.length} asistencias |
                {" "}{hrData.events.length} novedades | {hrData.advances.length} anticipos
              </small>
            </div>
          </div>
        </section>
      )}

      {formOpen && (
        <div className="hr-modal-backdrop" role="presentation">
          <section
            aria-labelledby="hr-employee-form-title"
            aria-modal="true"
            className="hr-modal"
            role="dialog"
          >
            <div className="hr-modal-heading">
              <div>
                <p className="eyebrow">Legajo</p>
                <h3 id="hr-employee-form-title">
                  {employeeForm.id ? "Editar funcionario" : "Nuevo funcionario"}
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
            {formError && <div className="status-banner danger">{formError}</div>}
            <form className="hr-employee-form" onSubmit={submitEmployee}>
              <fieldset disabled={saving}>
                <div className="hr-form-grid">
                  <label className="hr-span-2">
                    Nombre completo
                    <input
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }))
                      }
                      required
                      value={employeeForm.fullName}
                    />
                  </label>
                  <label>
                    C.I.
                    <input
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          documentNumber: event.target.value,
                        }))
                      }
                      value={employeeForm.documentNumber}
                    />
                  </label>
                  <label>
                    Estado
                    <select
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          status: event.target.value as HrEmployee["status"],
                        }))
                      }
                      value={employeeForm.status}
                    >
                      <option value="activo">Activo</option>
                      <option value="licencia">Licencia</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </label>
                  <label>
                    Sector
                    <input
                      list="hr-sector-options"
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          department: event.target.value,
                        }))
                      }
                      required
                      value={employeeForm.department}
                    />
                    <datalist id="hr-sector-options">
                      {sectors.map((sector) => (
                        <option key={sector} value={sector} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Cargo
                    <input
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          role: event.target.value,
                        }))
                      }
                      value={employeeForm.role}
                    />
                  </label>
                  <label>
                    Fecha de ingreso
                    <input
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          startDate: event.target.value,
                        }))
                      }
                      type="date"
                      value={employeeForm.startDate}
                    />
                  </label>
                  <label>
                    Modalidad salarial
                    <select
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          salaryType: event.target.value as HrEmployee["salaryType"],
                        }))
                      }
                      value={employeeForm.salaryType}
                    >
                      <option value="mensual">Salario mensual</option>
                      <option value="jornal">Pago por jornal</option>
                    </select>
                  </label>
                  {employeeForm.salaryType === "mensual" ? (
                    <label>
                      Salario mensual
                      <input
                        min="0"
                        onChange={(event) =>
                          setEmployeeForm((current) => ({
                            ...current,
                            monthlySalary: event.target.value,
                          }))
                        }
                        type="number"
                        value={employeeForm.monthlySalary}
                      />
                    </label>
                  ) : (
                    <label>
                      Valor del jornal
                      <input
                        min="0"
                        onChange={(event) =>
                          setEmployeeForm((current) => ({
                            ...current,
                            dailyWage: event.target.value,
                          }))
                        }
                        type="number"
                        value={employeeForm.dailyWage}
                      />
                    </label>
                  )}
                  <label className="hr-span-2">
                    Observaciones
                    <textarea
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      value={employeeForm.notes}
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
                    {saving ? "Guardando..." : "Guardar funcionario"}
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function HrReports({
  data,
  employees,
  money,
  sectors,
  selectedMonth,
  setSelectedMonth,
}: {
  data: HrData;
  employees: HrEmployee[];
  money: (value: number) => string;
  sectors: string[];
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
}) {
  const [reportId, setReportId] = useState<HrReportId>("nomina");
  const [sector, setSector] = useState("Todos");
  const [status, setStatus] = useState("activo");
  const [search, setSearch] = useState("");

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = normalizeText(search.trim());
    return employees
      .filter((employee) => {
        const matchesSector =
          sector === "Todos" || employee.department === sector;
        const matchesStatus =
          status === "Todos" || employee.status === status;
        const matchesSearch =
          !normalizedSearch ||
          normalizeText(
            [
              employee.fullName,
              employee.documentNumber,
              employee.role,
              employee.department,
            ].join(" "),
          ).includes(normalizedSearch);
        return matchesSector && matchesStatus && matchesSearch;
      })
      .sort((first, second) => first.fullName.localeCompare(second.fullName));
  }, [employees, search, sector, status]);

  const report = useMemo(() => {
    const employeeIds = new Set(filteredEmployees.map((employee) => employee.id));

    if (reportId === "asistencia") {
      const attendance = data.attendance.filter(
        (record) =>
          record.attendanceDate.startsWith(selectedMonth) &&
          employeeIds.has(record.employeeId),
      );
      const rows = filteredEmployees
        .map((employee) => {
          const records = attendance.filter(
            (record) => record.employeeId === employee.id,
          );
          const present = records.filter((record) =>
            normalizeText(record.status).includes("presente"),
          ).length;
          const absent = records.filter((record) =>
            normalizeText(record.status).includes("ausente"),
          ).length;
          const hours = records.reduce(
            (sum, record) => sum + Number(workedHours(record)),
            0,
          );
          const extraHours = records.reduce(
            (sum, record) => sum + record.extraHours,
            0,
          );
          return {
            employee,
            records: records.length,
            row: [
              employee.fullName,
              employee.department || "Sin sector",
              records.length,
              present,
              absent,
              decimal(hours),
              decimal(extraHours),
            ],
          };
        })
        .filter((summary) => summary.records > 0);
      const present = attendance.filter((record) =>
        normalizeText(record.status).includes("presente"),
      ).length;
      const absent = attendance.filter((record) =>
        normalizeText(record.status).includes("ausente"),
      ).length;
      const extraHours = attendance.reduce(
        (sum, record) => sum + record.extraHours,
        0,
      );

      return {
        columns: [
          "Funcionario",
          "Sector",
          "Registros",
          "Presentes",
          "Ausentes",
          "Horas",
          "Horas extra",
        ],
        description: hrReports.find((item) => item.id === reportId)!.description,
        kpis: [
          { label: "Funcionarios con registro", value: String(rows.length) },
          { label: "Dias presentes", value: String(present) },
          { label: "Ausencias", tone: "warning" as const, value: String(absent) },
          {
            label: "Horas extra",
            tone: "blue" as const,
            value: decimal(extraHours),
          },
        ],
        rows: rows.map((summary) => summary.row),
        title: "Resumen de asistencia",
      };
    }

    if (reportId === "novedades") {
      const events = data.events.filter(
        (event) =>
          event.dateFrom.startsWith(selectedMonth) &&
          employeeIds.has(event.employeeId),
      );
      const approved = events.filter((event) =>
        normalizeText(event.status).includes("aprob"),
      ).length;
      const pending = events.filter((event) =>
        normalizeText(event.status).includes("pend"),
      ).length;
      const discounts = events.reduce((sum, event) => sum + event.discount, 0);

      return {
        columns: [
          "Periodo",
          "Funcionario",
          "Sector",
          "Tipo",
          "Estado",
          "Dias",
          "Horas",
          "Descuento",
        ],
        description: hrReports.find((item) => item.id === reportId)!.description,
        kpis: [
          { label: "Novedades", value: String(events.length) },
          { label: "Aprobadas", value: String(approved) },
          { label: "Pendientes", tone: "warning" as const, value: String(pending) },
          {
            label: "Descuentos",
            tone: "blue" as const,
            value: money(discounts),
          },
        ],
        rows: events.map((event) => [
          `${formatDate(event.dateFrom)}${
            event.dateTo && event.dateTo !== event.dateFrom
              ? ` - ${formatDate(event.dateTo)}`
              : ""
          }`,
          employeeName(event.employeeId, employees),
          employeeSector(event.employeeId, employees),
          event.eventType,
          event.status,
          eventDays(event.dateFrom, event.dateTo),
          decimal(event.hours),
          money(event.discount),
        ]),
        title: "Permisos y novedades",
      };
    }

    if (reportId === "dotacion") {
      const active = filteredEmployees.filter(
        (employee) => employee.status === "activo",
      ).length;
      const monthly = filteredEmployees.filter(
        (employee) => employee.salaryType === "mensual",
      ).length;
      const daily = filteredEmployees.filter(
        (employee) => employee.salaryType === "jornal",
      ).length;
      const representedSectors = new Set(
        filteredEmployees
          .map((employee) => employee.department)
          .filter(Boolean),
      ).size;

      return {
        columns: [
          "Funcionario",
          "C.I.",
          "Sector",
          "Cargo",
          "Ingreso",
          "Modalidad",
          "Salario / jornal",
          "Estado",
        ],
        description: hrReports.find((item) => item.id === reportId)!.description,
        kpis: [
          { label: "Funcionarios", value: String(filteredEmployees.length) },
          { label: "Activos", value: String(active) },
          {
            label: "Mensuales / jornales",
            tone: "warning" as const,
            value: `${monthly} / ${daily}`,
          },
          {
            label: "Sectores",
            tone: "blue" as const,
            value: String(representedSectors),
          },
        ],
        rows: filteredEmployees.map((employee) => [
          employee.fullName,
          employee.documentNumber || "-",
          employee.department || "Sin sector",
          employee.role || "-",
          formatDate(employee.startDate),
          salaryTypeLabel(employee.salaryType),
          salaryDisplay(employee, money),
          statusLabel(employee.status),
        ]),
        title: "Dotacion de personal",
      };
    }

    const payrollRows = filteredEmployees.map((employee) => ({
      calculation: calculateEmployeePayroll(employee, selectedMonth, data),
      employee,
    }));
    const totals = payrollRows.reduce(
      (summary, row) => ({
        advances: summary.advances + row.calculation.advances,
        balance: summary.balance + row.calculation.balance,
        base: summary.base + row.calculation.base,
        discounts: summary.discounts + row.calculation.discounts,
        extras: summary.extras + row.calculation.extras,
      }),
      { advances: 0, balance: 0, base: 0, discounts: 0, extras: 0 },
    );

    return {
      columns: [
        "Funcionario",
        "Sector",
        "Modalidad",
        "Base",
        "Extras",
        "Anticipos",
        "Descuentos",
        "Saldo",
      ],
      description: hrReports.find((item) => item.id === reportId)!.description,
      kpis: [
        { label: "Base salarial", value: money(totals.base) },
        { label: "Anticipos", tone: "warning" as const, value: money(totals.advances) },
        { label: "Descuentos", tone: "warning" as const, value: money(totals.discounts) },
        { label: "Saldo a pagar", tone: "blue" as const, value: money(totals.balance) },
      ],
      rows: payrollRows.map(({ calculation, employee }) => [
        employee.fullName,
        employee.department || "Sin sector",
        salaryTypeLabel(employee.salaryType),
        money(calculation.base),
        money(calculation.extras),
        money(calculation.advances),
        money(calculation.discounts),
        money(calculation.balance),
      ]),
      title: "Liquidacion de nomina",
    };
  }, [
    data,
    employees,
    filteredEmployees,
    money,
    reportId,
    selectedMonth,
  ]);

  const sectorDistribution = useMemo(
    () =>
      sectors
        .map((name) => ({
          count: filteredEmployees.filter(
            (employee) => employee.department === name,
          ).length,
          name,
        }))
        .filter((item) => item.count > 0)
        .sort((first, second) => second.count - first.count),
    [filteredEmployees, sectors],
  );
  const largestSector = Math.max(
    1,
    ...sectorDistribution.map((item) => item.count),
  );

  function resetFilters() {
    setSector("Todos");
    setStatus("activo");
    setSearch("");
  }

  function exportCsv() {
    downloadCsv(
      `rrhh-${reportId}-${selectedMonth}.csv`,
      report.columns,
      report.rows,
    );
  }

  function printReport() {
    const previousTitle = document.title;
    const root = document.documentElement;
    const cleanup = () => {
      root.classList.remove("hr-report-printing");
      document.title = previousTitle;
    };

    root.classList.add("hr-report-printing");
    document.title = `Atyrenita SG - ${report.title} - ${selectedMonth}`;
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }

  return (
    <section className="panel hr-report">
      <header className="hr-report-print-header" aria-hidden="true">
        <div className="hr-report-print-brand">
          <span>SG</span>
          <div>
            <strong>Atyrenita SG</strong>
            <small>Sistema de Gestion Empresarial</small>
          </div>
        </div>
        <div className="hr-report-print-meta">
          <span>Recursos Humanos</span>
          <strong>Documento interno</strong>
        </div>
      </header>

      <HrSectionHeading
        action={
          <div className="hr-report-actions">
            <button
              className="secondary-button"
              disabled={!report.rows.length}
              onClick={exportCsv}
              type="button"
            >
              Descargar CSV
            </button>
            <button
              className="secondary-button"
              disabled={!report.rows.length}
              onClick={printReport}
              type="button"
            >
              Imprimir / PDF
            </button>
          </div>
        }
        eyebrow="Informes"
        title="Reportes de Recursos Humanos"
      />

      <div className="hr-report-types" role="tablist" aria-label="Tipo de reporte">
        {hrReports.map((item) => (
          <button
            aria-selected={reportId === item.id}
            className={reportId === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setReportId(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="hr-report-filters">
        <label>
          Mes
          <input
            onChange={(event) => setSelectedMonth(event.target.value)}
            type="month"
            value={selectedMonth}
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
        <label>
          Estado laboral
          <select
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="Todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="licencia">Licencia</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </label>
        <label className="hr-report-search">
          Funcionario
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, C.I. o cargo"
            value={search}
          />
        </label>
        <button
          className="secondary-button hr-report-clear"
          onClick={resetFilters}
          type="button"
        >
          Limpiar
        </button>
      </div>

      <div className="hr-report-document-heading">
        <div>
          <span>Atyrenita SG | Recursos Humanos</span>
          <h3>{report.title}</h3>
          <p>{report.description}</p>
        </div>
        <dl>
          <div>
            <dt>Periodo</dt>
            <dd>{monthLabel(selectedMonth)}</dd>
          </div>
          <div>
            <dt>Sector</dt>
            <dd>{sector}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{status === "Todos" ? "Todos" : statusLabel(status as HrEmployee["status"])}</dd>
          </div>
          <div>
            <dt>Registros</dt>
            <dd>{report.rows.length}</dd>
          </div>
        </dl>
      </div>

      <div className="kpi-grid hr-kpi-grid hr-report-kpis">
        {report.kpis.map((kpi) => (
          <HrKpi
            key={kpi.label}
            label={kpi.label}
            tone={kpi.tone}
            value={kpi.value}
          />
        ))}
      </div>

      <HrRecordsTable columns={report.columns} rows={report.rows} />

      <section className="hr-report-breakdown">
        <div className="hr-report-breakdown-heading">
          <div>
            <p className="eyebrow">Distribucion</p>
            <h3>Funcionarios incluidos por sector</h3>
          </div>
          <span>{filteredEmployees.length} funcionarios</span>
        </div>
        <div className="hr-report-sector-list">
          {sectorDistribution.length ? (
            sectorDistribution.map((item) => (
              <div className="hr-report-sector-row" key={item.name}>
                <span>{item.name}</span>
                <div aria-hidden="true">
                  <i
                    style={{
                      width: `${Math.max(6, (item.count / largestSector) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{item.count}</strong>
              </div>
            ))
          ) : (
            <p className="hr-report-empty">
              No hay funcionarios para los filtros seleccionados.
            </p>
          )}
        </div>
      </section>

      <section className="hr-report-signatures" aria-label="Firmas del reporte">
        <div>
          <i />
          <strong>Elaborado por</strong>
          <span>Nombre y firma</span>
        </div>
        <div>
          <i />
          <strong>Revisado por</strong>
          <span>Nombre y firma</span>
        </div>
        <div>
          <i />
          <strong>Aprobado por</strong>
          <span>Nombre y firma</span>
        </div>
      </section>

      <footer className="hr-report-print-footer" aria-hidden="true">
        <span>Documento generado por Atyrenita SG</span>
        <span>{dateTimeLabel()}</span>
      </footer>
    </section>
  );
}

function HrSummary({
  activeEmployees,
  data,
  employees,
  money,
  sectors,
  selectedMonth,
  setSelectedMonth,
}: {
  activeEmployees: HrEmployee[];
  data: HrData;
  employees: HrEmployee[];
  money: (value: number) => string;
  sectors: string[];
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
}) {
  const today = localDateValue();
  const todayAttendance = data.attendance.filter(
    (attendance) => attendance.attendanceDate === today,
  );
  const presentToday = todayAttendance.filter(
    (attendance) => normalizeText(attendance.status).includes("presente"),
  ).length;
  const absentToday = todayAttendance.filter(
    (attendance) => normalizeText(attendance.status).includes("ausente"),
  ).length;
  const monthlyCalculations = activeEmployees.map((employee) => ({
    calculation: calculateEmployeePayroll(employee, selectedMonth, data),
    employee,
  }));
  const monthlyPayroll = monthlyCalculations.reduce(
    (sum, row) => sum + row.calculation.balance,
    0,
  );
  const latestEmployees = [...employees]
    .sort((first, second) => second.startDate.localeCompare(first.startDate))
    .slice(0, 5);

  return (
    <div className="hr-summary">
      <div className="hr-summary-heading">
        <div>
          <p className="eyebrow">Resumen mensual</p>
          <h3>Indicadores de Recursos Humanos</h3>
        </div>
        <label className="hr-month-filter">
          Mes
          <input
            onChange={(event) => setSelectedMonth(event.target.value)}
            type="month"
            value={selectedMonth}
          />
        </label>
      </div>
      <section className="kpi-grid hr-kpi-grid" aria-label="Indicadores de personal">
        <HrKpi label="Funcionarios activos" value={String(activeEmployees.length)} />
        <HrKpi label="Presentes hoy" value={String(presentToday)} />
        <HrKpi label="Ausentes hoy" tone="warning" value={String(absentToday)} />
        <HrKpi label="Nomina del mes" tone="blue" value={money(monthlyPayroll)} />
      </section>
      <div className="hr-summary-grid">
        <section className="panel">
          <HrSectionHeading eyebrow="Dotacion" title="Funcionarios por sector" />
          <div className="hr-sector-summary">
            {sectors
              .map((sector) => ({
                count: activeEmployees.filter(
                  (employee) => employee.department === sector,
                ).length,
                sector,
              }))
              .filter((summary) => summary.count > 0)
              .map((summary) => (
                <div key={summary.sector}>
                  <span>{summary.sector}</span>
                  <strong>{summary.count}</strong>
                </div>
              ))}
          </div>
        </section>
        <section className="panel">
          <HrSectionHeading eyebrow="Actividad" title="Ultimas incorporaciones" />
          <div className="hr-latest-list">
            {latestEmployees.map((employee) => (
              <article key={employee.id}>
                <div>
                  <strong>{employee.fullName}</strong>
                  <span>{employee.department || "Sin sector"} | {employee.role || "Sin cargo"}</span>
                </div>
                <time>{formatDate(employee.startDate)}</time>
              </article>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <HrSectionHeading eyebrow="Nomina" title="Saldos restantes del mes" />
        <div className="table-wrap hr-table">
          <table>
            <thead>
              <tr>
                <th>Funcionario</th>
                <th>Sector</th>
                <th>Modalidad</th>
                <th>Base salarial</th>
                <th>Extras</th>
                <th>Anticipos</th>
                <th>Descuentos</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {monthlyCalculations.map(({ calculation, employee }) => (
                <tr key={employee.id}>
                  <td><strong>{employee.fullName}</strong></td>
                  <td>{employee.department || "Sin sector"}</td>
                  <td>{salaryTypeLabel(employee.salaryType)}</td>
                  <td>{money(calculation.base)}</td>
                  <td>{money(calculation.extras)}</td>
                  <td>{money(calculation.advances)}</td>
                  <td>{money(calculation.discounts)}</td>
                  <td className="positive-amount">
                    {money(calculation.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function EmployeeTable({
  canEdit = false,
  employees,
  money,
  onEdit,
}: {
  canEdit?: boolean;
  employees: HrEmployee[];
  money: (value: number) => string;
  onEdit?: (employee: HrEmployee) => void;
}) {
  return (
    <div className="table-wrap hr-table">
      <table>
        <thead>
          <tr>
            <th>Funcionario</th>
            <th>C.I.</th>
            <th>Sector</th>
            <th>Cargo</th>
            <th>Ingreso</th>
            <th>Modalidad</th>
            <th>Salario / jornal</th>
            <th>Estado</th>
            {canEdit && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {employees.length ? (
            employees.map((employee) => (
              <tr key={employee.id}>
                <td><strong>{employee.fullName}</strong></td>
                <td>{employee.documentNumber || "-"}</td>
                <td>{employee.department || "Sin sector"}</td>
                <td>{employee.role || "-"}</td>
                <td>{formatDate(employee.startDate)}</td>
                <td>{salaryTypeLabel(employee.salaryType)}</td>
                <td>{salaryDisplay(employee, money)}</td>
                <td>
                  <span className={`hr-status ${employee.status}`}>
                    {statusLabel(employee.status)}
                  </span>
                </td>
                {canEdit && (
                  <td>
                    <button
                      className="hr-table-action"
                      onClick={() => onEdit?.(employee)}
                      type="button"
                    >
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td className="hr-empty-cell" colSpan={canEdit ? 9 : 8}>
                No hay funcionarios para los filtros seleccionados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function HrOperationalTable({
  columns,
  eyebrow,
  rows,
  title,
}: {
  columns: string[];
  eyebrow: string;
  rows: ReactNode[][];
  title: string;
}) {
  return (
    <section className="panel">
      <HrSectionHeading eyebrow={eyebrow} title={title} />
      <HrRecordsTable columns={columns} rows={rows} />
    </section>
  );
}

function HrRecordsTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="table-wrap hr-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="hr-empty-cell" colSpan={columns.length}>
                Sin registros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function HrSectionHeading({
  action,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="panel-heading hr-section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
      {action}
    </div>
  );
}

function HrKpi({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "blue" | "warning";
  value: string;
}) {
  return (
    <article className={`kpi-card ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-PY");
}

function statusLabel(status: HrEmployee["status"]) {
  if (status === "activo") return "Activo";
  if (status === "licencia") return "Licencia";
  return "Inactivo";
}

function salaryTypeLabel(salaryType: HrEmployee["salaryType"]) {
  return salaryType === "jornal" ? "Jornal" : "Mensual";
}

function salaryDisplay(
  employee: HrEmployee,
  money: (value: number) => string,
) {
  return employee.salaryType === "jornal"
    ? `${money(employee.dailyWage)} / dia`
    : `${money(employee.monthlySalary)} / mes`;
}

function decimal(value: number) {
  return value.toLocaleString("es-PY", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function monthLabel(value: string) {
  if (!value) return "-";
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const label = new Intl.DateTimeFormat("es-PY", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dateTimeLabel() {
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
}

function downloadCsv(
  fileName: string,
  columns: string[],
  rows: ReactNode[][],
) {
  const csvRows = [columns, ...rows].map((row) =>
    row.map((cell) => csvCell(cell)).join(";"),
  );
  const blob = new Blob([`\uFEFF${csvRows.join("\r\n")}`], {
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

function csvCell(value: ReactNode) {
  const text =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
  return `"${text.replace(/"/g, '""')}"`;
}

async function requestHrData(): Promise<HrData> {
  const response = await fetch("/api/hr/bootstrap", { cache: "no-store" });
  const payload = (await response.json()) as HrData & {
    error?: string;
    migrationRequired?: boolean;
  };

  if (!response.ok) {
    throw new Error(
      payload.migrationRequired
        ? "Falta preparar las tablas integrales de RR.HH. en Supabase."
        : payload.error ?? "No se pudo cargar Recursos Humanos.",
    );
  }

  return payload;
}

function employeeName(employeeId: string, employees: HrEmployee[]) {
  return (
    employees.find((employee) => employee.id === employeeId)?.fullName ??
    "Funcionario no encontrado"
  );
}

function employeeSector(employeeId: string, employees: HrEmployee[]) {
  return (
    employees.find((employee) => employee.id === employeeId)?.department ||
    "Sin sector"
  );
}

function sectorName(sectorId: string, sectors: HrSector[]) {
  if (!sectorId) return "-";
  return sectors.find((sector) => sector.id === sectorId)?.name ?? sectorId;
}

function workedHours(attendance: HrData["attendance"][number]) {
  const firstBlock = elapsedHours(attendance.entry, attendance.lunchOut);
  const secondBlock = elapsedHours(attendance.lunchIn, attendance.exit);
  const total =
    firstBlock || secondBlock
      ? firstBlock + secondBlock
      : elapsedHours(attendance.entry, attendance.exit);
  return total.toFixed(2);
}

function elapsedHours(from: string, to: string) {
  if (!from || !to) return 0;
  const [fromHour, fromMinute] = from.split(":").map(Number);
  const [toHour, toMinute] = to.split(":").map(Number);
  if (
    [fromHour, fromMinute, toHour, toMinute].some((value) =>
      Number.isNaN(value),
    )
  ) {
    return 0;
  }
  return Math.max(0, toHour * 60 + toMinute - (fromHour * 60 + fromMinute)) / 60;
}

function eventDays(from: string, to: string) {
  if (!from) return "0";
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to || from}T12:00:00`);
  const difference = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  return String(Math.max(1, difference + 1));
}

function documentStatus(document: HrData["documents"][number]) {
  if (
    document.expiryDate &&
    document.expiryDate < localDateValue() &&
    !normalizeText(document.status).includes("venc")
  ) {
    return "Vencido";
  }
  return document.status || "Pendiente";
}

function calculateEmployeePayroll(
  employee: HrEmployee,
  month: string,
  data: HrData,
) {
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
  const base =
    employee.salaryType === "jornal"
      ? presentDays * employee.dailyWage
      : payroll?.salary || employee.monthlySalary;
  const attendanceExtraHours = attendance.reduce(
    (sum, record) => sum + record.extraHours,
    0,
  );
  const approvedExtraHours = data.events
    .filter(
      (event) =>
        event.employeeId === employee.id &&
        event.dateFrom.startsWith(month) &&
        normalizeText(event.eventType).includes("extra") &&
        !normalizeText(event.status).includes("rechaz"),
    )
    .reduce((sum, event) => sum + event.hours, 0);
  const extras =
    (attendanceExtraHours + approvedExtraHours) * (payroll?.extraRate ?? 0);
  const advances = data.advances
    .filter(
      (advance) =>
        advance.employeeId === employee.id && advance.month === month,
    )
    .reduce((sum, advance) => sum + advance.amount, 0);
  const eventDiscounts = data.events
    .filter(
      (event) =>
        event.employeeId === employee.id &&
        event.dateFrom.startsWith(month) &&
        !normalizeText(event.status).includes("rechaz"),
    )
    .reduce((sum, event) => sum + event.discount, 0);
  const discounts = eventDiscounts + (payroll?.otherDiscounts ?? 0);
  const otherIncome = payroll?.otherIncome ?? 0;

  return {
    advances,
    balance: base + extras + otherIncome - advances - discounts,
    base,
    discounts,
    extras,
  };
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
