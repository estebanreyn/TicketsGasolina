import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { hashPassword } from "./security.js";

const DATA_DIR = path.resolve("data");
const DEFAULT_DATA_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), "tickets-gasolina-app.json")
  : path.join(DATA_DIR, "app.json");
const DATA_FILE = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : DEFAULT_DATA_FILE;
let queue = Promise.resolve();

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function seed() {
  const adminId = id();
  const supervisorId = id();
  const dispatcherId = id();
  const operationsId = id();
  const logisticsId = id();
  const tankId = id();
  const employeeId = id();
  const vehicleId = id();
  return {
    meta: { version: 1, createdAt: now(), ticketSequence: 1 },
    settings: { ticketPrefix: "COM", annualReset: true, expiringHours: 24, criticalPercent: 20, stationName: "Estacion Principal", allowPartialDispatch: true },
    users: [
      { id: adminId, name: "Administrador General", email: "admin@intec.edu.do", phone: "809-000-0001", role: "ADMIN", passwordHash: hashPassword("Admin123!"), active: true, createdAt: now() },
      { id: supervisorId, name: "Supervisor Combustible", email: "supervisor@intec.edu.do", phone: "809-000-0002", role: "SUPERVISOR", passwordHash: hashPassword("Supervisor123!"), active: true, createdAt: now() },
      { id: dispatcherId, name: "Despachador Principal", email: "despachador@intec.edu.do", phone: "809-000-0003", role: "DESPACHADOR", passwordHash: hashPassword("Despachador123!"), active: true, createdAt: now() }
    ],
    departments: [
      { id: operationsId, code: "OPE", name: "Operaciones", active: true, createdAt: now() },
      { id: logisticsId, code: "LOG", name: "Logistica", active: true, createdAt: now() }
    ],
    employees: [
      { id: employeeId, code: "EMP-001", fullName: "Carlos Rodriguez", nationalId: "001-0000000-1", departmentId: operationsId, position: "Tecnico", email: "carlos@intec.edu.do", phone: "809-555-0101", active: true, createdAt: now() }
    ],
    vehicles: [
      { id: vehicleId, plate: "A123456", internalCode: "VEH-001", brand: "Toyota", model: "Hilux", year: 2024, type: "Camioneta", departmentId: operationsId, tankCapacity: 21, odometer: 18420, fuelType: "DIESEL", active: true, createdAt: now() }
    ],
    tanks: [
      { id: tankId, code: "TQ-01", name: "Tanque diesel principal", fuelType: "DIESEL", capacity: 5000, currentStock: 3200, criticalLevel: 1000, active: true, createdAt: now() }
    ],
    requests: [], tickets: [], dispatches: [], receptions: [], movements: [], closures: [], schedules: [],
    notifications: [{ id: id(), type: "INFO", title: "Sistema listo", message: "La plataforma fue inicializada correctamente.", read: false, createdAt: now() }],
    outbox: [], audit: []
  };
}

async function ensure() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try { await fs.access(DATA_FILE); } catch { await write(seed()); }
}

async function write(data) {
  const temp = `${DATA_FILE}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(temp, DATA_FILE);
}

export async function read() {
  await ensure();
  return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
}

export function transact(mutator) {
  const operation = queue.then(async () => {
    const data = await read();
    const result = await mutator(data);
    await write(data);
    return result;
  });
  queue = operation.catch(() => undefined);
  return operation;
}

export function audit(data, actor, action, entity, entityId, details = {}, ip = "") {
  data.audit.push({ id: id(), actorId: actor?.id || null, actorName: actor?.name || "Sistema", action, entity, entityId, details, ip, createdAt: now() });
}

export { id, now };
