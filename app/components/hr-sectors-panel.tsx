"use client";

import { FormEvent, useMemo, useState } from "react";
import type { HrEmployee } from "@/lib/company-data";
import type { HrSector } from "@/lib/hr-data";

type SectorForm = {
  boss: string;
  description: string;
  establishment: string;
  id: string;
  name: string;
  status: HrSector["status"];
};

const emptySectorForm: SectorForm = {
  boss: "",
  description: "",
  establishment: "",
  id: "",
  name: "",
  status: "Activo",
};

export function HrSectorsPanel({
  canAdmin,
  canEdit,
  employees,
  onRefresh,
  sectors,
}: {
  canAdmin: boolean;
  canEdit: boolean;
  employees: HrEmployee[];
  onRefresh: () => Promise<void>;
  sectors: HrSector[];
}) {
  const [form, setForm] = useState(emptySectorForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, HrSector[]>();
    for (const sector of sectors) {
      const key = normalizeName(sector.name);
      groups.set(key, [...(groups.get(key) ?? []), sector]);
    }
    return Array.from(groups.values()).filter((group) => group.length > 1);
  }, [sectors]);

  function openForm(sector?: HrSector) {
    setForm(
      sector
        ? {
            boss: sector.boss,
            description: sector.description,
            establishment: sector.establishment,
            id: sector.id,
            name: sector.name,
            status: sector.status,
          }
        : emptySectorForm,
    );
    setMessage("");
    setFormOpen(true);
  }

  async function submitSector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/hr/sectors", {
        body: JSON.stringify(form),
        headers: { "Content-Type": "application/json" },
        method: form.id ? "PATCH" : "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo guardar el sector.");
      }
      await onRefresh();
      setFormOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar el sector.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function mergeGroup(group: HrSector[]) {
    if (!canAdmin || group.length < 2) return;
    const target = [...group].sort(
      (first, second) =>
        assignedCount(second, employees) - assignedCount(first, employees),
    )[0];
    const sources = group.filter((sector) => sector.id !== target.id);
    setSaving(true);
    setMessage("");
    try {
      for (const source of sources) {
        const response = await fetch("/api/hr/sectors", {
          body: JSON.stringify({
            action: "merge",
            sourceId: source.id,
            targetId: target.id,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudieron unificar los sectores.");
        }
      }
      await onRefresh();
      setMessage(`Sectores unificados en "${target.name}".`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron unificar los sectores.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading hr-section-heading">
        <div>
          <p className="eyebrow">Organizacion</p>
          <h3>Sectores y jefaturas</h3>
        </div>
        {canEdit && (
          <button
            className="submit-button hr-primary-button"
            onClick={() => openForm()}
            type="button"
          >
            Nuevo sector
          </button>
        )}
      </div>

      {message && (
        <div
          className={`status-banner ${
            message.includes("unificados") ? "success" : "warning"
          }`}
        >
          {message}
        </div>
      )}

      {duplicateGroups.length > 0 && (
        <div className="hr-duplicate-sectors">
          <div>
            <strong>{duplicateGroups.length} grupo duplicado detectado</strong>
            <span>
              Se encontraron sectores que solo cambian por tildes o mayusculas.
            </span>
          </div>
          {duplicateGroups.map((group) => (
            <div className="hr-duplicate-sector-row" key={normalizeName(group[0].name)}>
              <span>{group.map((sector) => sector.name).join(" / ")}</span>
              {canAdmin && (
                <button
                  className="secondary-button"
                  disabled={saving}
                  onClick={() => void mergeGroup(group)}
                  type="button"
                >
                  Unificar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="hr-sector-grid">
        {sectors.map((sector) => {
          const assigned = assignedCount(sector, employees);
          return (
            <article className="hr-sector-card" key={sector.id}>
              <div className="hr-sector-card-heading">
                <div>
                  <span>Sector</span>
                  <strong>{sector.name}</strong>
                </div>
                <span className={`hr-sector-state ${sector.status.toLowerCase()}`}>
                  {sector.status}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Jefe</dt>
                  <dd>{sector.boss || "No definido"}</dd>
                </div>
                <div>
                  <dt>Funcionarios</dt>
                  <dd>{assigned}</dd>
                </div>
              </dl>
              <small>{sector.establishment || "Sin establecimiento"}</small>
              {canEdit && (
                <button
                  className="hr-table-action"
                  onClick={() => openForm(sector)}
                  type="button"
                >
                  Editar
                </button>
              )}
            </article>
          );
        })}
      </div>

      {formOpen && (
        <div className="hr-modal-backdrop" role="presentation">
          <section
            aria-labelledby="hr-sector-form-title"
            aria-modal="true"
            className="hr-modal hr-sector-modal"
            role="dialog"
          >
            <div className="hr-modal-heading">
              <div>
                <p className="eyebrow">Organizacion</p>
                <h3 id="hr-sector-form-title">
                  {form.id ? "Editar sector" : "Nuevo sector"}
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
            <form className="hr-employee-form" onSubmit={submitSector}>
              {message && <div className="status-banner warning">{message}</div>}
              <fieldset disabled={saving}>
                <div className="hr-form-grid">
                  <label>
                    Nombre
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      required
                      value={form.name}
                    />
                  </label>
                  <label>
                    Estado
                    <select
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as HrSector["status"],
                        }))
                      }
                      value={form.status}
                    >
                      <option>Activo</option>
                      <option>Inactivo</option>
                    </select>
                  </label>
                  <label>
                    Jefe
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          boss: event.target.value,
                        }))
                      }
                      value={form.boss}
                    />
                  </label>
                  <label>
                    Establecimiento
                    <input
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          establishment: event.target.value,
                        }))
                      }
                      value={form.establishment}
                    />
                  </label>
                  <label className="hr-span-2">
                    Descripcion
                    <textarea
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      value={form.description}
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
                    {saving ? "Guardando..." : "Guardar sector"}
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

function assignedCount(sector: HrSector, employees: HrEmployee[]) {
  return employees.filter((employee) => employee.department === sector.name)
    .length;
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
