"use client";

import { FormEvent, useMemo, useState } from "react";
import type { HrEmployee } from "@/lib/company-data";

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
  | "reportes";

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
  canEdit,
  employees: initialEmployees,
  money,
}: {
  canEdit: boolean;
  employees: HrEmployee[];
  money: (value: number) => string;
}) {
  const [activeBlock, setActiveBlock] = useState<HrBlockId>("resumen");
  const [employees, setEmployees] = useState(initialEmployees);
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

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "activo"),
    [employees],
  );
  const payroll = useMemo(
    () =>
      activeEmployees.reduce(
        (sum, employee) =>
          sum + (employee.salaryType === "mensual" ? employee.monthlySalary : 0),
        0,
      ),
    [activeEmployees],
  );
  const dailyWages = useMemo(
    () =>
      activeEmployees.reduce(
        (sum, employee) =>
          sum + (employee.salaryType === "jornal" ? employee.dailyWage : 0),
        0,
      ),
    [activeEmployees],
  );
  const sectors = useMemo(
    () =>
      Array.from(
        new Set([
          ...baseSectors,
          ...employees.map((employee) => employee.department).filter(Boolean),
        ]),
      ).sort((first, second) => first.localeCompare(second)),
    [employees],
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
      setFormOpen(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "No se pudo guardar el funcionario.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hr-module">
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
          payroll={payroll}
          sectors={sectors}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
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
            {sectors.map((sector) => {
              const assigned = activeEmployees.filter(
                (employee) => employee.department === sector,
              );
              return (
                <article className="hr-sector-card" key={sector}>
                  <div>
                    <span>Sector</span>
                    <strong>{sector}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Jefe</dt>
                      <dd>No definido</dd>
                    </div>
                    <div>
                      <dt>Activos</dt>
                      <dd>{assigned.length}</dd>
                    </div>
                  </dl>
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
            <HrKpi label="Salarios mensuales" value={money(payroll)} />
            <HrKpi label="Jornales diarios" value={money(dailyWages)} />
            <HrKpi label="Anticipos" tone="warning" value={money(0)} />
            <HrKpi label="Saldo restante" tone="blue" value={money(payroll)} />
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
                {activeEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td><strong>{employee.fullName}</strong></td>
                    <td>{employee.department || "Sin sector"}</td>
                    <td>{salaryTypeLabel(employee.salaryType)}</td>
                    <td>{salaryDisplay(employee, money)}</td>
                    <td>{money(0)}</td>
                    <td>{money(0)}</td>
                    <td>{money(0)}</td>
                    <td className="positive-amount">
                      {employee.salaryType === "mensual"
                        ? money(employee.monthlySalary)
                        : "Pendiente de asistencia"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeBlock === "reportes" && (
        <section className="panel hr-report">
          <HrSectionHeading
            action={
              <button
                className="secondary-button"
                onClick={() => window.print()}
                type="button"
              >
                Imprimir / Guardar PDF
              </button>
            }
            eyebrow="Informes"
            title="Detalle de funcionarios"
          />
          <div className="kpi-grid hr-kpi-grid">
            <HrKpi label="Funcionarios" value={String(employees.length)} />
            <HrKpi label="Activos" value={String(activeEmployees.length)} />
            <HrKpi label="Sectores" tone="blue" value={String(sectors.length)} />
            <HrKpi label="Nomina" tone="warning" value={money(payroll)} />
          </div>
          <EmployeeTable employees={employees} money={money} />
        </section>
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
          title="Consultas del personal"
        />
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

function HrSummary({
  activeEmployees,
  employees,
  money,
  payroll,
  sectors,
  selectedMonth,
  setSelectedMonth,
}: {
  activeEmployees: HrEmployee[];
  employees: HrEmployee[];
  money: (value: number) => string;
  payroll: number;
  sectors: string[];
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
}) {
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
        <HrKpi label="Presentes hoy" value="0" />
        <HrKpi label="Ausentes hoy" tone="warning" value="0" />
        <HrKpi label="Nomina del mes" tone="blue" value={money(payroll)} />
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
              {activeEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td><strong>{employee.fullName}</strong></td>
                  <td>{employee.department || "Sin sector"}</td>
                  <td>{salaryTypeLabel(employee.salaryType)}</td>
                  <td>{salaryDisplay(employee, money)}</td>
                  <td>{money(0)}</td>
                  <td>{money(0)}</td>
                  <td>{money(0)}</td>
                  <td className="positive-amount">
                    {employee.salaryType === "mensual"
                      ? money(employee.monthlySalary)
                      : "Pendiente de asistencia"}
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
  title,
}: {
  columns: string[];
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="panel">
      <HrSectionHeading eyebrow={eyebrow} title={title} />
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
            <tr>
              <td className="hr-empty-cell" colSpan={columns.length}>
                Sin registros.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HrSectionHeading({
  action,
  eyebrow,
  title,
}: {
  action?: React.ReactNode;
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
