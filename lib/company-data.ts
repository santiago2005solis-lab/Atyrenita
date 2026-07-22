import type { AppUser } from "./permissions";

export type StorageMode = "demo" | "supabase";

export type FinanceMovementType = "ingreso" | "egreso" | "transferencia";
export type InventoryMovementType = "entrada" | "salida" | "traslado" | "ajuste";

export type FinanceMovement = {
  id: string;
  cashboxName: string;
  movementType: FinanceMovementType;
  movementDate: string;
  concept: string;
  category: string;
  amount: number;
  currency: "PYG";
  paymentMethod: string;
  documentNumber: string;
  responsible: string;
  relatedParty: string;
  notes: string;
  createdAt: string;
};

export type InventoryItem = {
  id: string;
  warehouseName: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCost: number;
  supplier: string;
  updatedAt: string;
};

export type InventoryMovement = {
  id: string;
  itemId: string;
  warehouseName: string;
  targetWarehouseName: string;
  movementType: InventoryMovementType;
  movementDate: string;
  quantity: number;
  unitCost: number;
  documentNumber: string;
  responsible: string;
  notes: string;
  createdAt: string;
};

export type HrEmployee = {
  id: string;
  fullName: string;
  documentNumber: string;
  role: string;
  department: string;
  status: "activo" | "licencia" | "inactivo";
  startDate: string;
  monthlySalary: number;
  notes: string;
};

export type AppData = {
  currentUser?: AppUser;
  storageMode: StorageMode;
  storageMessage?: string;
  storageError?: string;
  cashboxes: string[];
  warehouses: string[];
  financeMovements: FinanceMovement[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  hrEmployees: HrEmployee[];
};

export const cashboxes = [
  "Caja Ganadero Confinamiento",
  "Caja Ganadero a Pasto",
  "Caja Agricola",
  "Caja Inversiones",
  "Caja Maquinas",
  "Caja CDE",
];

export const warehouses = [
  "Deposito Capitan",
  "Deposito Villagra",
  "Deposito Confinamiento 15 HAS",
  "Confinamiento 500 HAS",
];

export const financeCategories = [
  "Venta",
  "Compra",
  "Alimento",
  "Sanidad",
  "Combustible",
  "Personal",
  "Mantenimiento",
  "Agricola",
  "Inversion",
  "Transferencia interna",
  "Otros",
];

export const paymentMethods = [
  "Efectivo",
  "Transferencia bancaria",
  "Cheque",
  "Tarjeta",
  "Credito proveedor",
];

export const inventoryCategories = [
  "Alimento",
  "Veterinaria",
  "Agricola",
  "Repuestos",
  "Combustible",
  "Herramientas",
  "Otros",
];

export const inventoryUnits = ["kg", "bolsa", "litro", "unidad", "ton", "caja"];

export const demoFinanceMovements: FinanceMovement[] = [
  {
    id: "fin-demo-1",
    cashboxName: "Caja Ganadero Confinamiento",
    movementType: "ingreso",
    movementDate: "2026-07-21",
    concept: "Venta de novillos terminados",
    category: "Venta",
    amount: 328400000,
    currency: "PYG",
    paymentMethod: "Transferencia bancaria",
    documentNumber: "FV-00128",
    responsible: "Administracion",
    relatedParty: "Frigorifico regional",
    notes: "Operacion de cierre semanal",
    createdAt: "2026-07-21T13:00:00.000Z",
  },
  {
    id: "fin-demo-2",
    cashboxName: "Caja Ganadero Confinamiento",
    movementType: "egreso",
    movementDate: "2026-07-20",
    concept: "Compra de balanceado terminacion",
    category: "Alimento",
    amount: 68400000,
    currency: "PYG",
    paymentMethod: "Transferencia bancaria",
    documentNumber: "FC-00451",
    responsible: "Compras",
    relatedParty: "Nutricion Campo",
    notes: "Reposicion mensual",
    createdAt: "2026-07-20T13:00:00.000Z",
  },
  {
    id: "fin-demo-3",
    cashboxName: "Caja Ganadero a Pasto",
    movementType: "egreso",
    movementDate: "2026-07-18",
    concept: "Vacunas y antiparasitario",
    category: "Sanidad",
    amount: 19300000,
    currency: "PYG",
    paymentMethod: "Efectivo",
    documentNumber: "FC-00442",
    responsible: "Encargado campo",
    relatedParty: "Veterinaria Norte",
    notes: "Plan sanitario trimestral",
    createdAt: "2026-07-18T13:00:00.000Z",
  },
  {
    id: "fin-demo-4",
    cashboxName: "Caja Agricola",
    movementType: "egreso",
    movementDate: "2026-07-17",
    concept: "Semillas y fertilizante",
    category: "Agricola",
    amount: 95800000,
    currency: "PYG",
    paymentMethod: "Cheque",
    documentNumber: "FC-00439",
    responsible: "Compras",
    relatedParty: "Agroinsumos Central",
    notes: "Campana de invierno",
    createdAt: "2026-07-17T13:00:00.000Z",
  },
  {
    id: "fin-demo-5",
    cashboxName: "Caja Maquinas",
    movementType: "egreso",
    movementDate: "2026-07-15",
    concept: "Mantenimiento de tractor",
    category: "Mantenimiento",
    amount: 22500000,
    currency: "PYG",
    paymentMethod: "Transferencia bancaria",
    documentNumber: "OS-0097",
    responsible: "Taller",
    relatedParty: "Mecanica Diesel",
    notes: "Cambio de filtros y reparacion hidraulica",
    createdAt: "2026-07-15T13:00:00.000Z",
  },
  {
    id: "fin-demo-6",
    cashboxName: "Caja Inversiones",
    movementType: "transferencia",
    movementDate: "2026-07-12",
    concept: "Reserva para compra de reproductores",
    category: "Transferencia interna",
    amount: 120000000,
    currency: "PYG",
    paymentMethod: "Transferencia bancaria",
    documentNumber: "TR-0021",
    responsible: "Gerencia",
    relatedParty: "Caja Ganadero a Pasto",
    notes: "Movimiento entre cajas",
    createdAt: "2026-07-12T13:00:00.000Z",
  },
];

export const demoInventoryItems: InventoryItem[] = [
  {
    id: "inv-item-1",
    warehouseName: "Deposito Capitan",
    sku: "ALM-001",
    name: "Balanceado terminacion",
    category: "Alimento",
    unit: "kg",
    currentStock: 18450,
    minStock: 8000,
    unitCost: 3100,
    supplier: "Nutricion Campo",
    updatedAt: "2026-07-21T13:00:00.000Z",
  },
  {
    id: "inv-item-2",
    warehouseName: "Deposito Villagra",
    sku: "VET-014",
    name: "Antiparasitario bovino",
    category: "Veterinaria",
    unit: "litro",
    currentStock: 64,
    minStock: 30,
    unitCost: 125000,
    supplier: "Veterinaria Norte",
    updatedAt: "2026-07-20T13:00:00.000Z",
  },
  {
    id: "inv-item-3",
    warehouseName: "Deposito Confinamiento 15 HAS",
    sku: "REP-022",
    name: "Filtro hidraulico",
    category: "Repuestos",
    unit: "unidad",
    currentStock: 11,
    minStock: 8,
    unitCost: 185000,
    supplier: "Mecanica Diesel",
    updatedAt: "2026-07-18T13:00:00.000Z",
  },
  {
    id: "inv-item-4",
    warehouseName: "Confinamiento 500 HAS",
    sku: "AGR-102",
    name: "Fertilizante granulado",
    category: "Agricola",
    unit: "bolsa",
    currentStock: 420,
    minStock: 150,
    unitCost: 168000,
    supplier: "Agroinsumos Central",
    updatedAt: "2026-07-17T13:00:00.000Z",
  },
];

export const demoInventoryMovements: InventoryMovement[] = [
  {
    id: "inv-mov-1",
    itemId: "inv-item-1",
    warehouseName: "Deposito Capitan",
    targetWarehouseName: "",
    movementType: "entrada",
    movementDate: "2026-07-21",
    quantity: 6000,
    unitCost: 3100,
    documentNumber: "RM-0091",
    responsible: "Deposito",
    notes: "Reposicion por compra",
    createdAt: "2026-07-21T13:00:00.000Z",
  },
  {
    id: "inv-mov-2",
    itemId: "inv-item-2",
    warehouseName: "Deposito Villagra",
    targetWarehouseName: "",
    movementType: "salida",
    movementDate: "2026-07-19",
    quantity: 14,
    unitCost: 125000,
    documentNumber: "SM-0033",
    responsible: "Sanidad",
    notes: "Entrega para lote a pasto",
    createdAt: "2026-07-19T13:00:00.000Z",
  },
  {
    id: "inv-mov-3",
    itemId: "inv-item-4",
    warehouseName: "Confinamiento 500 HAS",
    targetWarehouseName: "Deposito Capitan",
    movementType: "traslado",
    movementDate: "2026-07-18",
    quantity: 60,
    unitCost: 168000,
    documentNumber: "TRD-0012",
    responsible: "Logistica",
    notes: "Traslado para siembra",
    createdAt: "2026-07-18T13:00:00.000Z",
  },
];

export const demoHrEmployees: HrEmployee[] = [
  {
    id: "hr-demo-1",
    fullName: "Carlos Benitez",
    documentNumber: "1234567",
    role: "Encargado de campo",
    department: "Ganaderia",
    status: "activo",
    startDate: "2024-02-15",
    monthlySalary: 5200000,
    notes: "Responsable de recorridas y novedades",
  },
  {
    id: "hr-demo-2",
    fullName: "Maria Duarte",
    documentNumber: "2345678",
    role: "Auxiliar administrativo",
    department: "Administracion",
    status: "activo",
    startDate: "2025-03-01",
    monthlySalary: 4300000,
    notes: "Control documental y archivo",
  },
];

export const demoData: AppData = {
  storageMode: "demo",
  storageMessage: "Modo demo: configure Supabase en Vercel para guardar datos reales.",
  cashboxes,
  warehouses,
  financeMovements: demoFinanceMovements,
  inventoryItems: demoInventoryItems,
  inventoryMovements: demoInventoryMovements,
  hrEmployees: demoHrEmployees,
};
