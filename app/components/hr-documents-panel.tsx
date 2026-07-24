"use client";

import { FormEvent, useMemo, useState } from "react";
import type { HrEmployee } from "@/lib/company-data";
import type { HrDocument } from "@/lib/hr-data";

type DocumentForm = {
  deliveryDate: string;
  employeeId: string;
  expiryDate: string;
  id: string;
  notes: string;
  reference: string;
  status: string;
  type: string;
};

const documentTypes = [
  "Cédula de identidad",
  "Contrato laboral",
  "Certificado médico",
  "Certificado de antecedentes",
  "Licencia de conducir",
  "Ficha de ingreso",
  "Constancia",
  "Otro",
];
const maxFileSize = 4 * 1024 * 1024;
const acceptedFiles =
  ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function HrDocumentsPanel({
  canAdmin,
  canEdit,
  documents,
  employees,
  onRefresh,
}: {
  canAdmin: boolean;
  canEdit: boolean;
  documents: HrDocument[];
  employees: HrEmployee[];
  onRefresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [form, setForm] = useState<DocumentForm>(emptyDocumentForm());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const activeEmployees = useMemo(
    () =>
      employees
        .filter((employee) => employee.status !== "inactivo")
        .sort((first, second) => first.fullName.localeCompare(second.fullName)),
    [employees],
  );
  const availableTypes = useMemo(
    () =>
      Array.from(
        new Set([...documentTypes, ...documents.map((document) => document.type)]),
      )
        .filter(Boolean)
        .sort((first, second) => first.localeCompare(second)),
    [documents],
  );
  const filteredDocuments = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    return documents
      .filter((document) => {
        const employee = employeesById.get(document.employeeId);
        const state = documentState(document);
        const matchesStatus =
          statusFilter === "Todos" ||
          (statusFilter === "Sin archivo"
            ? !document.filePath && state.label !== "Archivado"
            : state.label === statusFilter);
        return (
          (typeFilter === "Todos" || document.type === typeFilter) &&
          matchesStatus &&
          (!normalizedQuery ||
            normalizeText(
              [
                employee?.fullName,
                employee?.documentNumber,
                employee?.department,
                document.type,
                document.reference,
                document.fileName,
                document.notes,
              ].join(" "),
            ).includes(normalizedQuery))
        );
      })
      .sort((first, second) => {
        const firstState = documentState(first);
        const secondState = documentState(second);
        return (
          firstState.order - secondState.order ||
          (first.expiryDate || "9999-12-31").localeCompare(
            second.expiryDate || "9999-12-31",
          ) ||
          employeeName(first.employeeId, employees).localeCompare(
            employeeName(second.employeeId, employees),
          )
        );
      });
  }, [
    documents,
    employees,
    employeesById,
    query,
    statusFilter,
    typeFilter,
  ]);
  const totals = useMemo(
    () =>
      documents.reduce(
        (current, document) => {
          const state = documentState(document).label;
          if (state !== "Archivado") current.active += 1;
          if (state === "Por vencer") current.expiring += 1;
          if (state === "Vencido") current.expired += 1;
          if (state !== "Archivado" && !document.filePath) {
            current.withoutFile += 1;
          }
          return current;
        },
        { active: 0, expired: 0, expiring: 0, withoutFile: 0 },
      ),
    [documents],
  );
  const currentDocument = documents.find((document) => document.id === form.id);

  function openNewDocument() {
    setForm(emptyDocumentForm());
    setSelectedFile(null);
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function openEditDocument(document: HrDocument) {
    setForm({
      deliveryDate: document.deliveryDate,
      employeeId: document.employeeId,
      expiryDate: document.expiryDate,
      id: document.id,
      notes: document.notes,
      reference: document.reference,
      status:
        documentState(document).label === "Archivado" ? "Archivado" : "Vigente",
      type: document.type,
    });
    setSelectedFile(null);
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = documentFormData(form, selectedFile);
    await saveDocument(
      formData,
      form.id ? "Documento actualizado." : "Documento agregado al legajo.",
      form.id ? "PATCH" : "POST",
      true,
    );
  }

  async function toggleArchive(document: HrDocument) {
    const archived = documentState(document).label === "Archivado";
    if (
      !window.confirm(
        archived
          ? "¿Desea reactivar este documento?"
          : "¿Desea archivar este documento?",
      )
    ) {
      return;
    }
    const formData = documentFormData(
      {
        deliveryDate: document.deliveryDate,
        employeeId: document.employeeId,
        expiryDate: document.expiryDate,
        id: document.id,
        notes: document.notes,
        reference: document.reference,
        status: archived ? "Vigente" : "Archivado",
        type: document.type,
      },
      null,
    );
    await saveDocument(
      formData,
      archived ? "Documento reactivado." : "Documento archivado.",
      "PATCH",
      false,
    );
  }

  async function saveDocument(
    body: FormData,
    successMessage: string,
    method: "POST" | "PATCH",
    closeForm: boolean,
  ) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/hr/documents", { body, method });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo guardar el documento.");
      }
      await onRefresh();
      if (closeForm) setFormOpen(false);
      setMessage(successMessage);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el documento.",
      );
    } finally {
      setSaving(false);
    }
  }

  function chooseFile(file: File | null) {
    if (file && file.size > maxFileSize) {
      setSelectedFile(null);
      setError("El archivo supera el límite de 4 MB.");
      return;
    }
    setError("");
    setSelectedFile(file);
  }

  return (
    <div className="hr-documents-panel">
      {message && <div className="status-banner success">{message}</div>}
      {error && !formOpen && <div className="status-banner danger">{error}</div>}

      <section className="panel hr-documents-overview">
        <header className="hr-section-heading">
          <div>
            <p className="eyebrow">Legajos</p>
            <h3>Documentos de funcionarios</h3>
          </div>
          {canEdit && (
            <button
              className="submit-button hr-primary-button"
              onClick={openNewDocument}
              type="button"
            >
              Nuevo documento
            </button>
          )}
        </header>

        <div className="hr-document-kpis">
          <DocumentKpi label="Documentos activos" value={String(totals.active)} />
          <DocumentKpi
            label="Próximos a vencer"
            tone="warning"
            value={String(totals.expiring)}
          />
          <DocumentKpi
            label="Vencidos"
            tone="danger"
            value={String(totals.expired)}
          />
          <DocumentKpi
            label="Sin archivo adjunto"
            tone="blue"
            value={String(totals.withoutFile)}
          />
        </div>

        <div className="hr-document-filters">
          <label>
            Buscar
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Funcionario, C.I., documento o referencia"
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
              {availableTypes.map((type) => (
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
              <option>Vigente</option>
              <option>Por vencer</option>
              <option>Vencido</option>
              <option>Archivado</option>
              <option>Sin archivo</option>
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

        <div className="table-wrap hr-table hr-documents-table">
          <table>
            <thead>
              <tr>
                <th>Funcionario</th>
                <th>Documento</th>
                <th>Entrega</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Archivo</th>
                <th>Referencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((document) => {
                const employee = employeesById.get(document.employeeId);
                const state = documentState(document);
                const archived = state.label === "Archivado";
                return (
                  <tr className={archived ? "is-archived" : ""} key={document.id}>
                    <td>
                      <strong>
                        {employee?.fullName ?? "Funcionario no encontrado"}
                      </strong>
                      <small>{employee?.department || "Sin sector"}</small>
                    </td>
                    <td>
                      <strong>{document.type}</strong>
                      {document.notes && <small>{document.notes}</small>}
                    </td>
                    <td>{formatDate(document.deliveryDate)}</td>
                    <td>
                      {formatDate(document.expiryDate)}
                      {state.detail && <small>{state.detail}</small>}
                    </td>
                    <td>
                      <span className={`hr-document-status ${state.className}`}>
                        {state.label}
                      </span>
                    </td>
                    <td>
                      {document.filePath ? (
                        <>
                          <strong>{document.fileName || "Archivo adjunto"}</strong>
                          <small>{formatFileSize(document.fileSize)}</small>
                        </>
                      ) : (
                        <span className="hr-document-missing">Sin archivo</span>
                      )}
                    </td>
                    <td>{document.reference || "-"}</td>
                    <td>
                      <div className="hr-document-row-actions">
                        {document.filePath && (
                          <>
                            <a
                              className="hr-table-action"
                              href={`/api/hr/documents?id=${encodeURIComponent(
                                document.id,
                              )}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Ver
                            </a>
                            <a
                              className="hr-table-action"
                              href={`/api/hr/documents?id=${encodeURIComponent(
                                document.id,
                              )}&download=1`}
                            >
                              Descargar
                            </a>
                          </>
                        )}
                        {canEdit && (!archived || canAdmin) && (
                          <button
                            className="hr-table-action"
                            onClick={() => openEditDocument(document)}
                            type="button"
                          >
                            Editar
                          </button>
                        )}
                        {canAdmin && (
                          <button
                            className={`hr-table-action ${
                              archived ? "success" : "danger"
                            }`}
                            disabled={saving}
                            onClick={() => void toggleArchive(document)}
                            type="button"
                          >
                            {archived ? "Reactivar" : "Archivar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredDocuments.length && (
                <tr>
                  <td className="hr-empty-cell" colSpan={8}>
                    No hay documentos para los filtros seleccionados.
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
            aria-labelledby="hr-document-dialog-title"
            aria-modal="true"
            className="hr-modal hr-document-modal"
            role="dialog"
          >
            <header className="hr-modal-heading">
              <div>
                <p className="eyebrow">Legajo digital</p>
                <h3 id="hr-document-dialog-title">
                  {form.id ? "Editar documento" : "Agregar documento"}
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
            <form className="hr-employee-form" onSubmit={submitDocument}>
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
                  Tipo de documento
                  <select
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value,
                      }))
                    }
                    value={form.type}
                  >
                    {availableTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Referencia
                  <input
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                    placeholder="Número, código o institución"
                    value={form.reference}
                  />
                </label>
                <label>
                  Fecha de entrega
                  <input
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        deliveryDate: event.target.value,
                      }))
                    }
                    type="date"
                    value={form.deliveryDate}
                  />
                </label>
                <label>
                  Fecha de vencimiento
                  <input
                    min={form.deliveryDate || undefined}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        expiryDate: event.target.value,
                      }))
                    }
                    type="date"
                    value={form.expiryDate}
                  />
                  <small>Puede dejarse vacío si el documento no vence.</small>
                </label>
                <label className="hr-span-2 hr-document-file-control">
                  {currentDocument?.filePath
                    ? "Reemplazar archivo"
                    : "Archivo adjunto"}
                  <input
                    accept={acceptedFiles}
                    onChange={(event) =>
                      chooseFile(event.target.files?.[0] ?? null)
                    }
                    type="file"
                  />
                  <small>
                    PDF, imagen o Word de hasta 4 MB.
                    {currentDocument?.filePath &&
                      ` Actual: ${currentDocument.fileName}.`}
                  </small>
                  {selectedFile && (
                    <span>
                      Seleccionado: {selectedFile.name} ·{" "}
                      {formatFileSize(selectedFile.size)}
                    </span>
                  )}
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
                    placeholder="Información útil para el legajo"
                    value={form.notes}
                  />
                </label>
              </div>
              <p className="hr-document-note">
                El archivo se guarda en un espacio privado de Supabase. Solo los
                usuarios autorizados del módulo pueden abrirlo o descargarlo.
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
                  {saving ? "Guardando..." : "Guardar documento"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function DocumentKpi({
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

function emptyDocumentForm(): DocumentForm {
  return {
    deliveryDate: new Date().toISOString().slice(0, 10),
    employeeId: "",
    expiryDate: "",
    id: "",
    notes: "",
    reference: "",
    status: "Vigente",
    type: documentTypes[0],
  };
}

function documentFormData(form: DocumentForm, file: File | null) {
  const data = new FormData();
  Object.entries(form).forEach(([key, value]) => data.set(key, value));
  if (file) data.set("file", file);
  return data;
}

function documentState(document: HrDocument) {
  if (normalizeText(document.status) === "archivado") {
    return {
      className: "archived",
      detail: "",
      label: "Archivado",
      order: 4,
    };
  }
  if (!document.expiryDate) {
    return {
      className: "valid",
      detail: "Sin vencimiento",
      label: "Vigente",
      order: 3,
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${document.expiryDate}T12:00:00`);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) {
    return {
      className: "expired",
      detail: `Venció hace ${Math.abs(days)} días`,
      label: "Vencido",
      order: 0,
    };
  }
  if (days <= 30) {
    return {
      className: "expiring",
      detail: days === 0 ? "Vence hoy" : `Vence en ${days} días`,
      label: "Por vencer",
      order: 1,
    };
  }
  return {
    className: "valid",
    detail: `Vence en ${days} días`,
    label: "Vigente",
    order: 2,
  };
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

function formatFileSize(value: number) {
  if (!value) return "Tamaño no disponible";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
