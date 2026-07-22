"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type MovementType = "ingreso" | "gasto";
type TabId = "resumen" | "movimientos" | "ganado" | "reportes";

type Movement = {
  id: number;
  type: MovementType;
  date: string;
  concept: string;
  category: string;
  account: string;
  amount: number;
  lot: string;
};

type Lot = {
  name: string;
  category: string;
  animals: number;
  avgWeight: number;
  cost: number;
  priceKg: number;
  status: string;
};

const incomeCategories = ["Venta ganado", "Leche", "Servicios", "Alquiler", "Otros ingresos"];
const expenseCategories = [
  "Alimento",
  "Sanidad",
  "Personal",
  "Combustible",
  "Mantenimiento",
  "Fletes",
  "Impuestos",
  "Compra ganado",
];

const accounts = ["Banco principal", "Caja campo", "Cuenta ahorro", "Tarjeta corporativa"];
const lots = ["Recria Norte", "Cria Tajamar", "Engorde Sur", "Vaquillas Este"];

const seedMovements: Movement[] = [
  {
    id: 1,
    type: "ingreso",
    date: "2026-07-20",
    concept: "Venta de 42 novillos terminados",
    category: "Venta ganado",
    account: "Banco principal",
    amount: 328400000,
    lot: "Engorde Sur",
  },
  {
    id: 2,
    type: "gasto",
    date: "2026-07-18",
    concept: "Balanceado terminacion",
    category: "Alimento",
    account: "Banco principal",
    amount: 68400000,
    lot: "Engorde Sur",
  },
  {
    id: 3,
    type: "gasto",
    date: "2026-07-16",
    concept: "Vacunas y antiparasitario",
    category: "Sanidad",
    account: "Caja campo",
    amount: 19300000,
    lot: "Recria Norte",
  },
  {
    id: 4,
    type: "gasto",
    date: "2026-07-12",
    concept: "Jornales y encargados",
    category: "Personal",
    account: "Banco principal",
    amount: 44200000,
    lot: "General",
  },
  {
    id: 5,
    type: "ingreso",
    date: "2026-07-10",
    concept: "Venta mensual de leche",
    category: "Leche",
    account: "Banco principal",
    amount: 47400000,
    lot: "Cria Tajamar",
  },
  {
    id: 6,
    type: "gasto",
    date: "2026-07-08",
    concept: "Flete a feria",
    category: "Fletes",
    account: "Tarjeta corporativa",
    amount: 11800000,
    lot: "Engorde Sur",
  },
];

const herdLots: Lot[] = [
  {
    name: "Recria Norte",
    category: "Novillos recria",
    animals: 184,
    avgWeight: 318,
    cost: 892000000,
    priceKg: 16700,
    status: "Ganancia diaria estable",
  },
  {
    name: "Cria Tajamar",
    category: "Vacas cria",
    animals: 226,
    avgWeight: 402,
    cost: 1016000000,
    priceKg: 12600,
    status: "Paricion monitoreada",
  },
  {
    name: "Engorde Sur",
    category: "Novillos terminacion",
    animals: 139,
    avgWeight: 462,
    cost: 1198000000,
    priceKg: 17100,
    status: "Listo para ventas parciales",
  },
  {
    name: "Vaquillas Este",
    category: "Reposicion",
    animals: 96,
    avgWeight: 286,
    cost: 418000000,
    priceKg: 13900,
    status: "Servicio programado",
  },
];

const monthlyFlow = [
  { month: "Abr", income: 242000000, expense: 186000000 },
  { month: "May", income: 294000000, expense: 214000000 },
  { month: "Jun", income: 366000000, expense: 238000000 },
  { month: "Jul", income: 375800000, expense: 143700000 },
];

const reportCards = [
  { label: "Cuentas por cobrar", value: 86500000, tone: "blue" },
  { label: "Cuentas por pagar", value: 52800000, tone: "amber" },
  { label: "Caja minima sugerida", value: 120000000, tone: "green" },
];

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function AppPage() {
  const [activeTab, setActiveTab] = useState<TabId>("resumen");
  const [movements, setMovements] = useState<Movement[]>(seedMovements);
  const [isReady, setIsReady] = useState(false);
  const [form, setForm] = useState({
    type: "ingreso" as MovementType,
    date: "2026-07-22",
    concept: "",
    category: incomeCategories[0],
    account: accounts[0],
    amount: "",
    lot: lots[0],
  });

  const currency = useMemo(
    () =>
      new Intl.NumberFormat("es-PY", {
        style: "currency",
        currency: "PYG",
        maximumFractionDigits: 0,
      }),
    [],
  );

  const money = (value: number) => currency.format(value).replace("PYG", "Gs.");

  useEffect(() => {
    const saved = window.localStorage.getItem("ganado-finanzas-movements");
    if (saved) {
      try {
        setMovements(JSON.parse(saved) as Movement[]);
      } catch {
        setMovements(seedMovements);
      }
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady) {
      window.localStorage.setItem("ganado-finanzas-movements", JSON.stringify(movements));
    }
  }, [isReady, movements]);

  const totals = useMemo(() => {
    const income = movements
      .filter((movement) => movement.type === "ingreso")
      .reduce((sum, movement) => sum + movement.amount, 0);
    const expense = movements
      .filter((movement) => movement.type === "gasto")
      .reduce((sum, movement) => sum + movement.amount, 0);
    const animals = herdLots.reduce((sum, lot) => sum + lot.animals, 0);
    const stockValue = herdLots.reduce(
      (sum, lot) => sum + lot.animals * lot.avgWeight * lot.priceKg,
      0,
    );

    return {
      income,
      expense,
      balance: income - expense,
      animals,
      stockValue,
      costPerAnimal: Math.round(expense / animals),
      operatingMargin: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
    };
  }, [movements]);

  const expenseByCategory = useMemo(() => {
    return expenseCategories
      .map((category) => ({
        category,
        value: movements
          .filter((movement) => movement.type === "gasto" && movement.category === category)
          .reduce((sum, movement) => sum + movement.amount, 0),
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [movements]);

  const accountBalances = useMemo(() => {
    return accounts.map((account) => {
      const balance = movements
        .filter((movement) => movement.account === account)
        .reduce(
          (sum, movement) =>
            movement.type === "ingreso" ? sum + movement.amount : sum - movement.amount,
          0,
        );
      return { account, balance };
    });
  }, [movements]);

  const latestMovements = [...movements].sort((a, b) => b.date.localeCompare(a.date));
  const categoryOptions = form.type === "ingreso" ? incomeCategories : expenseCategories;

  function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);

    if (!form.concept.trim() || Number.isNaN(amount) || amount <= 0) {
      return;
    }

    const nextMovement: Movement = {
      id: Date.now(),
      type: form.type,
      date: form.date,
      concept: form.concept.trim(),
      category: form.category,
      account: form.account,
      amount,
      lot: form.lot,
    };

    setMovements((current) => [nextMovement, ...current]);
    setForm((current) => ({ ...current, concept: "", amount: "" }));
  }

  function setMovementType(type: MovementType) {
    setForm((current) => ({
      ...current,
      type,
      category: type === "ingreso" ? incomeCategories[0] : expenseCategories[0],
    }));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navegacion principal">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            GF
          </div>
          <div>
            <p className="eyebrow">Sistema web</p>
            <h1>GanadoFinanzas</h1>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Vistas">
          {[
            { id: "resumen", label: "Resumen" },
            { id: "movimientos", label: "Movimientos" },
            { id: "ganado", label: "Ganado" },
            { id: "reportes", label: "Reportes" },
          ].map((tab) => (
            <button
              aria-pressed={activeTab === tab.id}
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              type="button"
            >
              <span aria-hidden="true">{tab.label.slice(0, 1)}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-summary">
          <p>Periodo activo</p>
          <strong>Julio 2026</strong>
          <span>Estancia San Miguel</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Control financiero ganadero</p>
            <h2>Operacion, caja y stock en una sola vista</h2>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={() => setActiveTab("movimientos")}>
              + Movimiento
            </button>
            <button type="button" onClick={() => setActiveTab("reportes")}>
              Ver reportes
            </button>
          </div>
        </header>

        <section className="kpi-grid" aria-label="Indicadores principales">
          <article className="kpi-card">
            <span>Caja neta del mes</span>
            <strong>{money(totals.balance)}</strong>
            <em>{totals.operatingMargin}% margen operativo</em>
          </article>
          <article className="kpi-card">
            <span>Ingresos</span>
            <strong>{money(totals.income)}</strong>
            <em>Ventas, leche y servicios</em>
          </article>
          <article className="kpi-card warning">
            <span>Egresos</span>
            <strong>{money(totals.expense)}</strong>
            <em>{money(totals.costPerAnimal)} por animal</em>
          </article>
          <article className="kpi-card blue">
            <span>Valor stock ganadero</span>
            <strong>{money(totals.stockValue)}</strong>
            <em>{totals.animals} cabezas registradas</em>
          </article>
        </section>

        {activeTab === "resumen" && (
          <div className="content-grid">
            <section className="panel wide">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Flujo de caja</p>
                  <h3>Resultado por mes</h3>
                </div>
                <span>Ingresos vs egresos</span>
              </div>

              <div className="flow-chart">
                {monthlyFlow.map((item) => {
                  const incomeHeight = Math.max(18, (item.income / 390000000) * 100);
                  const expenseHeight = Math.max(18, (item.expense / 390000000) * 100);

                  return (
                    <div className="flow-month" key={item.month}>
                      <div className="bars" aria-label={`Mes ${item.month}`}>
                        <span
                          className="bar income"
                          style={{ height: `${incomeHeight}%` }}
                          title={`Ingresos ${money(item.income)}`}
                        />
                        <span
                          className="bar expense"
                          style={{ height: `${expenseHeight}%` }}
                          title={`Egresos ${money(item.expense)}`}
                        />
                      </div>
                      <strong>{item.month}</strong>
                      <small>{money(item.income - item.expense)}</small>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Cuentas</p>
                  <h3>Saldos operativos</h3>
                </div>
              </div>

              <div className="account-list">
                {accountBalances.map((item) => (
                  <div className="account-row" key={item.account}>
                    <span>{item.account}</span>
                    <strong className={item.balance < 0 ? "negative" : ""}>{money(item.balance)}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel wide">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Ultimos movimientos</p>
                  <h3>Caja reciente</h3>
                </div>
                <button type="button" onClick={() => setActiveTab("movimientos")}>
                  Cargar
                </button>
              </div>

              <MovementTable movements={latestMovements.slice(0, 5)} money={money} />
            </section>
          </div>
        )}

        {activeTab === "movimientos" && (
          <div className="content-grid form-layout">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Registro</p>
                  <h3>Nuevo movimiento</h3>
                </div>
              </div>

              <form className="movement-form" onSubmit={submitMovement}>
                <div className="segmented" role="group" aria-label="Tipo de movimiento">
                  <button
                    className={form.type === "ingreso" ? "selected" : ""}
                    onClick={() => setMovementType("ingreso")}
                    type="button"
                  >
                    + Ingreso
                  </button>
                  <button
                    className={form.type === "gasto" ? "selected danger" : ""}
                    onClick={() => setMovementType("gasto")}
                    type="button"
                  >
                    - Gasto
                  </button>
                </div>

                <label>
                  Concepto
                  <input
                    onChange={(event) => setForm({ ...form, concept: event.target.value })}
                    placeholder="Ej. compra de suplemento"
                    value={form.concept}
                  />
                </label>

                <div className="field-row">
                  <label>
                    Monto
                    <input
                      inputMode="numeric"
                      onChange={(event) => setForm({ ...form, amount: event.target.value })}
                      placeholder="0"
                      value={form.amount}
                    />
                  </label>
                  <label>
                    Fecha
                    <input
                      onChange={(event) => setForm({ ...form, date: event.target.value })}
                      type="date"
                      value={form.date}
                    />
                  </label>
                </div>

                <label>
                  Categoria
                  <select
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    value={form.category}
                  >
                    {categoryOptions.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>

                <div className="field-row">
                  <label>
                    Cuenta
                    <select
                      onChange={(event) => setForm({ ...form, account: event.target.value })}
                      value={form.account}
                    >
                      {accounts.map((account) => (
                        <option key={account}>{account}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Lote
                    <select
                      onChange={(event) => setForm({ ...form, lot: event.target.value })}
                      value={form.lot}
                    >
                      {[...lots, "General"].map((lot) => (
                        <option key={lot}>{lot}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <button className="submit-button" type="submit">
                  Guardar movimiento
                </button>
              </form>
            </section>

            <section className="panel wide">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Libro diario</p>
                  <h3>Movimientos registrados</h3>
                </div>
                <span>{movements.length} items</span>
              </div>
              <MovementTable movements={latestMovements} money={money} />
            </section>
          </div>
        )}

        {activeTab === "ganado" && (
          <div className="content-grid">
            <section className="panel wide">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Inventario</p>
                  <h3>Lotes ganaderos</h3>
                </div>
                <span>{totals.animals} cabezas</span>
              </div>

              <div className="lot-grid">
                {herdLots.map((lot) => {
                  const value = lot.animals * lot.avgWeight * lot.priceKg;
                  const margin = value - lot.cost;

                  return (
                    <article className="lot-card" key={lot.name}>
                      <div>
                        <span>{lot.category}</span>
                        <h4>{lot.name}</h4>
                      </div>
                      <dl>
                        <div>
                          <dt>Cabezas</dt>
                          <dd>{lot.animals}</dd>
                        </div>
                        <div>
                          <dt>Peso medio</dt>
                          <dd>{lot.avgWeight} kg</dd>
                        </div>
                        <div>
                          <dt>Valor estimado</dt>
                          <dd>{money(value)}</dd>
                        </div>
                        <div>
                          <dt>Margen sobre costo</dt>
                          <dd className={margin < 0 ? "negative" : "positive"}>{money(margin)}</dd>
                        </div>
                      </dl>
                      <p>{lot.status}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === "reportes" && (
          <div className="content-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Costos</p>
                  <h3>Egresos por categoria</h3>
                </div>
              </div>

              <div className="expense-list">
                {expenseByCategory.map((item) => {
                  const width = totals.expense ? (item.value / totals.expense) * 100 : 0;
                  return (
                    <div className="expense-item" key={item.category}>
                      <div>
                        <span>{item.category}</span>
                        <strong>{money(item.value)}</strong>
                      </div>
                      <div className="meter" aria-hidden="true">
                        <span style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Gestion</p>
                  <h3>Indicadores pendientes</h3>
                </div>
              </div>

              <div className="report-stack">
                {reportCards.map((card) => (
                  <article className={`report-card ${card.tone}`} key={card.label}>
                    <span>{card.label}</span>
                    <strong>{money(card.value)}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel wide">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Rentabilidad</p>
                  <h3>Resumen operativo</h3>
                </div>
              </div>

              <div className="summary-grid">
                <div>
                  <span>Margen mensual</span>
                  <strong>{totals.operatingMargin}%</strong>
                </div>
                <div>
                  <span>Costo por cabeza</span>
                  <strong>{money(totals.costPerAnimal)}</strong>
                </div>
                <div>
                  <span>Stock valorizado</span>
                  <strong>{money(totals.stockValue)}</strong>
                </div>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function MovementTable({
  movements,
  money,
}: {
  movements: Movement[];
  money: (value: number) => string;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Concepto</th>
            <th>Categoria</th>
            <th>Lote</th>
            <th>Monto</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td>{formatDate(movement.date)}</td>
              <td>{movement.concept}</td>
              <td>{movement.category}</td>
              <td>{movement.lot}</td>
              <td className={movement.type === "gasto" ? "negative" : "positive"}>
                {movement.type === "gasto" ? "-" : "+"}
                {money(movement.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AppPage;
