import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import { strToU8, zipSync } from "fflate";
import { audit, id, now, read, transact } from "./store.js";
import { hashPassword, sha256, signToken, verifyPassword, verifyToken } from "./security.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const secret = process.env.APP_SECRET || "tickets-gasolina-local-development-secret-change-me";
const baseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
const publicDir = path.resolve("public");

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

const roles = {
  ADMIN: ["*"],
  SUPERVISOR: ["read", "catalogs", "requests", "approve", "inventory", "reports", "closures"],
  DESPACHADOR: ["read", "dispatch", "closures"],
  AUDITOR: ["read", "reports", "audit"],
  CONSULTA: ["read"],
  SOLICITANTE: ["read", "requests"]
};

const can = (user, permission) => roles[user?.role]?.includes("*") || roles[user?.role]?.includes(permission);
const fail = (res, status, message, details) => res.status(status).json({ error: message, details });
const cleanUser = ({ passwordHash, ...user }) => user;
const requestIp = (req) => req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;

async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const payload = verifyToken(token, secret);
    const data = await read();
    const user = data.users.find((item) => item.id === payload.sub && item.active);
    if (!user) return fail(res, 401, "Usuario no autorizado");
    req.user = cleanUser(user);
    next();
  } catch (error) { return fail(res, 401, error.message || "Sesion invalida"); }
}

const permit = (permission) => (req, res, next) => can(req.user, permission) ? next() : fail(res, 403, "No tienes permiso para esta accion");
const required = (body, fields) => fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === "");
const entityName = (data, collection, entityId, field = "name") => data[collection].find((item) => item.id === entityId)?.[field] || "-";
const effectiveTicketStatus = (ticket) => {
  if (["CONSUMIDO", "ANULADO"].includes(ticket.status)) return ticket.status;
  const remaining = new Date(ticket.expiresAt).getTime() - Date.now();
  if (remaining <= 0) return "VENCIDO";
  if (remaining <= 24 * 60 * 60 * 1000) return "PROXIMO_A_VENCER";
  return ticket.status;
};

function ticketView(data, ticket) {
  const request = data.requests.find((item) => item.id === ticket.requestId);
  return {
    ...ticket,
    status: effectiveTicketStatus(ticket),
    employeeName: entityName(data, "employees", ticket.employeeId, "fullName"),
    vehicleLabel: `${entityName(data, "vehicles", ticket.vehicleId, "plate")} - ${entityName(data, "vehicles", ticket.vehicleId, "internalCode")}`,
    departmentName: entityName(data, "departments", ticket.departmentId),
    requestStatus: request?.status
  };
}

function nextTicketNumber(data) {
  const year = new Date().getFullYear();
  if (data.settings.annualReset && data.meta.ticketYear !== year) {
    data.meta.ticketYear = year;
    data.meta.ticketSequence = 1;
  }
  const number = `${data.settings.ticketPrefix}-${year}-${String(data.meta.ticketSequence).padStart(6, "0")}`;
  data.meta.ticketSequence += 1;
  return number;
}

function createTicket(data, request, actor, ip) {
  const ticketId = id();
  const ticketNumber = nextTicketNumber(data);
  const expiresAt = request.expiresAt || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const qrToken = signToken({ type: "fuel-ticket", ticketId, ticketNumber, nonce: crypto.randomBytes(12).toString("hex") }, secret, Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  const ticket = {
    id: ticketId, ticketNumber, requestId: request.id, employeeId: request.employeeId, vehicleId: request.vehicleId,
    departmentId: request.departmentId, authorizedGallons: Number(request.requestedGallons), dispensedGallons: 0,
    fuelType: request.fuelType, status: "CREADO", qrToken, qrHash: sha256(qrToken), createdAt: now(), expiresAt,
    createdBy: actor.id
  };
  data.tickets.push(ticket);
  request.status = "APROBADA";
  request.approvedAt = now();
  request.approvedBy = actor.id;
  request.ticketId = ticket.id;
  data.outbox.push({ id: id(), channel: "EMAIL", recipient: entityName(data, "employees", request.employeeId, "email"), subject: `Ticket ${ticketNumber}`, status: "PENDIENTE", ticketId, createdAt: now() });
  data.notifications.push({ id: id(), type: "TICKET", title: "Ticket emitido", message: `${ticketNumber} por ${ticket.authorizedGallons} galones`, read: false, createdAt: now() });
  audit(data, actor, "EMITIR", "TICKET", ticket.id, { ticketNumber }, ip);
  return ticket;
}

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const data = await read();
  const user = data.users.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase() && item.active);
  if (!user || !verifyPassword(password, user.passwordHash)) return fail(res, 401, "Correo o contrasena incorrectos");
  await transact((draft) => audit(draft, user, "INICIAR_SESION", "USUARIO", user.id, {}, requestIp(req)));
  res.json({ token: signToken({ sub: user.id, role: user.role }, secret), user: cleanUser(user) });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", time: now() }));
app.use("/api", auth);
app.get("/api/me", (req, res) => res.json(req.user));

app.get("/api/dashboard", permit("read"), async (_req, res) => {
  const data = await read();
  const tickets = data.tickets.map((ticket) => ticketView(data, ticket));
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const dispatchesToday = data.dispatches.filter((item) => item.createdAt.startsWith(today));
  const dispatchesMonth = data.dispatches.filter((item) => item.createdAt.startsWith(month));
  const byDepartment = Object.values(data.dispatches.reduce((acc, item) => {
    const ticket = data.tickets.find((t) => t.id === item.ticketId);
    const label = entityName(data, "departments", ticket?.departmentId);
    acc[label] ||= { label, gallons: 0 };
    acc[label].gallons += item.gallons;
    return acc;
  }, {}));
  res.json({
    metrics: {
      stock: data.tanks.reduce((sum, tank) => sum + tank.currentStock, 0),
      dispatchedToday: dispatchesToday.reduce((sum, item) => sum + item.gallons, 0),
      dispatchedMonth: dispatchesMonth.reduce((sum, item) => sum + item.gallons, 0),
      activeTickets: tickets.filter((item) => ["CREADO", "ENVIADO", "PENDIENTE", "PROXIMO_A_VENCER"].includes(item.status)).length,
      expiredTickets: tickets.filter((item) => item.status === "VENCIDO").length,
      lowTanks: data.tanks.filter((tank) => tank.currentStock <= tank.criticalLevel).length
    },
    tanks: data.tanks,
    byDepartment,
    recentDispatches: data.dispatches.slice(-6).reverse().map((item) => ({ ...item, ticketNumber: data.tickets.find((t) => t.id === item.ticketId)?.ticketNumber, operatorName: entityName(data, "users", item.operatorId) })),
    notifications: data.notifications.filter((item) => !item.read).slice(-6).reverse()
  });
});

const catalogConfig = {
  departments: { permission: "catalogs", required: ["code", "name"] },
  employees: { permission: "catalogs", required: ["code", "fullName", "departmentId", "email"] },
  vehicles: { permission: "catalogs", required: ["plate", "internalCode", "departmentId", "fuelType"] },
  tanks: { permission: "inventory", required: ["code", "name", "fuelType", "capacity", "criticalLevel"] }
};

for (const [collection, config] of Object.entries(catalogConfig)) {
  app.get(`/api/${collection}`, permit("read"), async (_req, res) => res.json((await read())[collection]));
  app.post(`/api/${collection}`, permit(config.permission), async (req, res) => {
    const missing = required(req.body, config.required);
    if (missing.length) return fail(res, 400, "Faltan campos requeridos", missing);
    const created = await transact((data) => {
      const item = { id: id(), ...req.body, active: req.body.active ?? true, createdAt: now() };
      if (collection === "tanks") item.currentStock = Number(item.currentStock || 0);
      data[collection].push(item);
      audit(data, req.user, "CREAR", collection.toUpperCase(), item.id, {}, requestIp(req));
      return item;
    });
    res.status(201).json(created);
  });
  app.patch(`/api/${collection}/:id`, permit(config.permission), async (req, res) => {
    const updated = await transact((data) => {
      const item = data[collection].find((entry) => entry.id === req.params.id);
      if (!item) return null;
      Object.assign(item, req.body, { id: item.id, updatedAt: now() });
      audit(data, req.user, "MODIFICAR", collection.toUpperCase(), item.id, req.body, requestIp(req));
      return item;
    });
    updated ? res.json(updated) : fail(res, 404, "Registro no encontrado");
  });
}

app.get("/api/users", permit("read"), async (_req, res) => res.json((await read()).users.map(cleanUser)));
app.post("/api/users", permit("*"), async (req, res) => {
  const missing = required(req.body, ["name", "email", "role", "password"]);
  if (missing.length) return fail(res, 400, "Faltan campos requeridos", missing);
  const created = await transact((data) => {
    if (data.users.some((item) => item.email.toLowerCase() === req.body.email.toLowerCase())) return null;
    const user = { id: id(), name: req.body.name, email: req.body.email, phone: req.body.phone || "", role: req.body.role, passwordHash: hashPassword(req.body.password), active: true, createdAt: now() };
    data.users.push(user);
    audit(data, req.user, "CREAR", "USUARIO", user.id, { role: user.role }, requestIp(req));
    return cleanUser(user);
  });
  created ? res.status(201).json(created) : fail(res, 409, "Ya existe un usuario con ese correo");
});
app.patch("/api/users/:id", permit("*"), async (req, res) => {
  const updated = await transact((data) => {
    const user = data.users.find((item) => item.id === req.params.id);
    if (!user) return null;
    for (const field of ["name", "email", "phone", "role", "active"]) if (req.body[field] !== undefined) user[field] = req.body[field];
    if (req.body.password) user.passwordHash = hashPassword(req.body.password);
    user.updatedAt = now();
    audit(data, req.user, "MODIFICAR", "USUARIO", user.id, { role: user.role, active: user.active }, requestIp(req));
    return cleanUser(user);
  });
  updated ? res.json(updated) : fail(res, 404, "Usuario no encontrado");
});

app.get("/api/requests", permit("read"), async (_req, res) => {
  const data = await read();
  res.json(data.requests.map((item) => ({ ...item, employeeName: entityName(data, "employees", item.employeeId, "fullName"), vehicleLabel: entityName(data, "vehicles", item.vehicleId, "plate"), departmentName: entityName(data, "departments", item.departmentId) })).reverse());
});
app.post("/api/requests", permit("requests"), async (req, res) => {
  const missing = required(req.body, ["employeeId", "vehicleId", "departmentId", "requestedGallons", "fuelType", "expiresAt"]);
  if (missing.length) return fail(res, 400, "Faltan campos requeridos", missing);
  const created = await transact((data) => {
    const item = { id: id(), ...req.body, requestedGallons: Number(req.body.requestedGallons), kind: req.body.kind || "MANUAL", status: "PENDIENTE", requestedBy: req.user.id, createdAt: now() };
    data.requests.push(item);
    audit(data, req.user, "CREAR", "SOLICITUD", item.id, { gallons: item.requestedGallons }, requestIp(req));
    return item;
  });
  res.status(201).json(created);
});
app.post("/api/requests/:id/approve", permit("approve"), async (req, res) => {
  const result = await transact((data) => {
    const request = data.requests.find((item) => item.id === req.params.id);
    if (!request || request.status !== "PENDIENTE") return null;
    return createTicket(data, request, req.user, requestIp(req));
  });
  result ? res.status(201).json(result) : fail(res, 409, "La solicitud no existe o ya fue procesada");
});
app.post("/api/requests/:id/reject", permit("approve"), async (req, res) => {
  const result = await transact((data) => {
    const item = data.requests.find((entry) => entry.id === req.params.id && entry.status === "PENDIENTE");
    if (!item) return null;
    item.status = "RECHAZADA"; item.rejectionReason = req.body.reason || "Sin detalle"; item.reviewedAt = now(); item.reviewedBy = req.user.id;
    audit(data, req.user, "RECHAZAR", "SOLICITUD", item.id, { reason: item.rejectionReason }, requestIp(req));
    return item;
  });
  result ? res.json(result) : fail(res, 409, "La solicitud no existe o ya fue procesada");
});

app.get("/api/tickets", permit("read"), async (_req, res) => {
  const data = await read();
  res.json(data.tickets.map((item) => ticketView(data, item)).reverse());
});
app.post("/api/tickets/validate", permit("dispatch"), async (req, res) => {
  try {
    const data = await read();
    let ticket;
    if (req.body.qrToken) {
      const payload = verifyToken(req.body.qrToken, secret);
      ticket = data.tickets.find((item) => item.id === payload.ticketId && item.qrHash === sha256(req.body.qrToken));
    } else ticket = data.tickets.find((item) => item.ticketNumber === req.body.ticketNumber);
    if (!ticket) return fail(res, 404, "Ticket no encontrado o QR alterado");
    const view = ticketView(data, ticket);
    const valid = ["CREADO", "ENVIADO", "PENDIENTE", "PROXIMO_A_VENCER"].includes(view.status);
    res.status(valid ? 200 : 409).json({ valid, ticket: view, reason: valid ? null : `Ticket ${view.status.toLowerCase()}` });
  } catch (error) { fail(res, 400, error.message); }
});
app.post("/api/tickets/:id/cancel", permit("approve"), async (req, res) => {
  const result = await transact((data) => {
    const ticket = data.tickets.find((item) => item.id === req.params.id);
    if (!ticket || ["CONSUMIDO", "ANULADO"].includes(ticket.status)) return null;
    ticket.status = "ANULADO"; ticket.cancelReason = req.body.reason || "Anulado por usuario autorizado"; ticket.cancelledAt = now(); ticket.cancelledBy = req.user.id;
    audit(data, req.user, "ANULAR", "TICKET", ticket.id, { reason: ticket.cancelReason }, requestIp(req));
    return ticket;
  });
  result ? res.json(result) : fail(res, 409, "El ticket no puede ser anulado");
});
app.get("/api/tickets/:id/qr", permit("read"), async (req, res) => {
  const data = await read();
  const ticket = data.tickets.find((item) => item.id === req.params.id);
  if (!ticket) return fail(res, 404, "Ticket no encontrado");
  res.type("png");
  res.send(await QRCode.toBuffer(ticket.qrToken, { width: 420, margin: 2, errorCorrectionLevel: "H" }));
});
app.get("/api/tickets/:id/pdf", permit("read"), async (req, res) => {
  const data = await read();
  const ticket = data.tickets.find((item) => item.id === req.params.id);
  if (!ticket) return fail(res, 404, "Ticket no encontrado");
  const view = ticketView(data, ticket);
  const qr = await QRCode.toBuffer(ticket.qrToken, { width: 260, margin: 1 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${ticket.ticketNumber}.pdf`);
  const doc = new PDFDocument({ size: "A5", margin: 36 });
  doc.pipe(res);
  doc.fillColor("#143d2b").fontSize(22).text("Ticket de combustible", { align: "center" });
  doc.moveDown().fillColor("#111827").fontSize(18).text(view.ticketNumber, { align: "center" });
  doc.image(qr, 124, 110, { width: 170 });
  doc.y = 290;
  for (const [label, value] of [["Empleado", view.employeeName], ["Vehiculo", view.vehicleLabel], ["Departamento", view.departmentName], ["Combustible", view.fuelType], ["Autorizado", `${view.authorizedGallons} galones`], ["Vence", new Date(view.expiresAt).toLocaleString("es-DO")]]) doc.fontSize(10).fillColor("#6b7280").text(label).fontSize(12).fillColor("#111827").text(String(value)).moveDown(.35);
  doc.fontSize(8).fillColor("#6b7280").text("QR firmado digitalmente. Valido para un solo uso.", 36, 540, { align: "center" });
  doc.end();
});

app.get("/api/dispatches", permit("read"), async (_req, res) => {
  const data = await read();
  res.json(data.dispatches.map((item) => ({ ...item, ticketNumber: data.tickets.find((ticket) => ticket.id === item.ticketId)?.ticketNumber, operatorName: entityName(data, "users", item.operatorId) })).reverse());
});
app.post("/api/dispatches", permit("dispatch"), async (req, res) => {
  const gallons = Number(req.body.gallons);
  if (!Number.isFinite(gallons) || gallons <= 0) return fail(res, 400, "La cantidad debe ser mayor que cero");
  let qrPayload;
  try { if (req.body.qrToken) qrPayload = verifyToken(req.body.qrToken, secret); } catch (error) { return fail(res, 400, error.message); }
  const outcome = await transact((data) => {
    const ticket = req.body.ticketId ? data.tickets.find((item) => item.id === req.body.ticketId) : data.tickets.find((item) => item.id === qrPayload?.ticketId && item.qrHash === sha256(req.body.qrToken));
    if (!ticket) return { error: "Ticket no encontrado o QR alterado", status: 404 };
    const status = effectiveTicketStatus(ticket);
    if (!["CREADO", "ENVIADO", "PENDIENTE", "PROXIMO_A_VENCER"].includes(status)) return { error: `El ticket esta ${status.toLowerCase()}`, status: 409 };
    const remaining = ticket.authorizedGallons - ticket.dispensedGallons;
    if (gallons > remaining) return { error: `Solo quedan ${remaining} galones autorizados`, status: 409 };
    if (!data.settings.allowPartialDispatch && gallons !== remaining) return { error: "Este sistema exige despacho total", status: 409 };
    const tank = req.body.tankId ? data.tanks.find((item) => item.id === req.body.tankId) : data.tanks.find((item) => item.fuelType === ticket.fuelType && item.active);
    if (!tank || tank.currentStock < gallons) return { error: "Inventario insuficiente para el despacho", status: 409 };
    const before = tank.currentStock;
    tank.currentStock -= gallons;
    ticket.dispensedGallons += gallons;
    ticket.status = ticket.dispensedGallons >= ticket.authorizedGallons ? "CONSUMIDO" : "PENDIENTE";
    if (ticket.status === "CONSUMIDO") ticket.consumedAt = now();
    const dispatch = { id: id(), ticketId: ticket.id, gallons, tankId: tank.id, operatorId: req.user.id, station: req.body.station || data.settings.stationName, odometer: Number(req.body.odometer || 0), identityConfirmed: Boolean(req.body.identityConfirmed), observations: req.body.observations || "", createdAt: now() };
    data.dispatches.push(dispatch);
    data.movements.push({ id: id(), type: "SALIDA_DESPACHO", fuelType: ticket.fuelType, tankId: tank.id, quantity: -gallons, before, after: tank.currentStock, referenceType: "DISPATCH", referenceId: dispatch.id, createdBy: req.user.id, createdAt: now() });
    if (tank.currentStock <= tank.criticalLevel) data.notifications.push({ id: id(), type: "ALERTA", title: "Inventario bajo", message: `${tank.name}: ${tank.currentStock} galones`, read: false, createdAt: now() });
    audit(data, req.user, "DESPACHAR", "TICKET", ticket.id, { gallons, tankId: tank.id }, requestIp(req));
    return { dispatch, ticket: ticketView(data, ticket), stock: tank.currentStock };
  });
  outcome.error ? fail(res, outcome.status, outcome.error) : res.status(201).json(outcome);
});

app.get("/api/movements", permit("read"), async (_req, res) => {
  const data = await read();
  res.json(data.movements.map((item) => ({ ...item, tankName: entityName(data, "tanks", item.tankId) })).reverse());
});
app.post("/api/receptions", permit("inventory"), async (req, res) => {
  const missing = required(req.body, ["supplierTaxId", "supplierName", "invoice", "volume", "receivedAt", "tankId"]);
  if (missing.length) return fail(res, 400, "Faltan campos requeridos", missing);
  const outcome = await transact((data) => {
    const tank = data.tanks.find((item) => item.id === req.body.tankId);
    const volume = Number(req.body.volume);
    if (!tank || !Number.isFinite(volume) || volume <= 0 || tank.currentStock + volume > tank.capacity) return null;
    const before = tank.currentStock; tank.currentStock += volume;
    const reception = { id: id(), ...req.body, volume, createdBy: req.user.id, createdAt: now() };
    data.receptions.push(reception);
    data.movements.push({ id: id(), type: "ENTRADA_RECEPCION", fuelType: tank.fuelType, tankId: tank.id, quantity: volume, before, after: tank.currentStock, referenceType: "RECEPTION", referenceId: reception.id, createdBy: req.user.id, createdAt: now() });
    audit(data, req.user, "RECIBIR", "INVENTARIO", reception.id, { volume, tankId: tank.id }, requestIp(req));
    return reception;
  });
  outcome ? res.status(201).json(outcome) : fail(res, 409, "Recepcion invalida o excede la capacidad del tanque");
});
app.post("/api/adjustments", permit("inventory"), async (req, res) => {
  const quantity = Number(req.body.quantity);
  if (!quantity || !req.body.reason || !req.body.tankId) return fail(res, 400, "Tanque, cantidad y motivo son requeridos");
  const outcome = await transact((data) => {
    const tank = data.tanks.find((item) => item.id === req.body.tankId);
    if (!tank || tank.currentStock + quantity < 0 || tank.currentStock + quantity > tank.capacity) return null;
    const before = tank.currentStock; tank.currentStock += quantity;
    const movement = { id: id(), type: quantity > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO", fuelType: tank.fuelType, tankId: tank.id, quantity, before, after: tank.currentStock, reason: req.body.reason, createdBy: req.user.id, createdAt: now() };
    data.movements.push(movement);
    data.notifications.push({ id: id(), type: "AJUSTE", title: "Ajuste de inventario", message: `${tank.name}: ${quantity > 0 ? "+" : ""}${quantity} galones`, read: false, createdAt: now() });
    audit(data, req.user, "AJUSTAR", "INVENTARIO", movement.id, { quantity, reason: req.body.reason }, requestIp(req));
    return movement;
  });
  outcome ? res.status(201).json(outcome) : fail(res, 409, "El ajuste deja el tanque fuera de sus limites");
});
app.post("/api/transfers", permit("inventory"), async (req, res) => {
  const quantity = Number(req.body.quantity);
  const outcome = await transact((data) => {
    const source = data.tanks.find((item) => item.id === req.body.sourceTankId);
    const target = data.tanks.find((item) => item.id === req.body.targetTankId);
    if (!source || !target || source.id === target.id || source.fuelType !== target.fuelType || quantity <= 0 || source.currentStock < quantity || target.currentStock + quantity > target.capacity) return null;
    const transferId = id(); const sourceBefore = source.currentStock; const targetBefore = target.currentStock;
    source.currentStock -= quantity; target.currentStock += quantity;
    data.movements.push(
      { id: id(), type: "TRANSFERENCIA_SALIDA", fuelType: source.fuelType, tankId: source.id, quantity: -quantity, before: sourceBefore, after: source.currentStock, referenceType: "TRANSFER", referenceId: transferId, createdBy: req.user.id, createdAt: now() },
      { id: id(), type: "TRANSFERENCIA_ENTRADA", fuelType: target.fuelType, tankId: target.id, quantity, before: targetBefore, after: target.currentStock, referenceType: "TRANSFER", referenceId: transferId, createdBy: req.user.id, createdAt: now() }
    );
    audit(data, req.user, "TRANSFERIR", "INVENTARIO", transferId, { quantity, source: source.id, target: target.id }, requestIp(req));
    return { id: transferId, quantity, sourceStock: source.currentStock, targetStock: target.currentStock };
  });
  outcome ? res.status(201).json(outcome) : fail(res, 409, "La transferencia no es valida");
});

app.get("/api/closures", permit("read"), async (_req, res) => res.json((await read()).closures.slice().reverse()));
app.post("/api/closures", permit("closures"), async (req, res) => {
  const date = req.body.date || new Date().toISOString().slice(0, 10);
  const outcome = await transact((data) => {
    if (data.closures.some((item) => item.date === date)) return null;
    const dispatches = data.dispatches.filter((item) => item.createdAt.startsWith(date));
    const calculated = dispatches.reduce((sum, item) => sum + item.gallons, 0);
    const declared = Number(req.body.declaredGallons ?? calculated);
    const closure = { id: id(), date, dispatchCount: dispatches.length, calculatedGallons: calculated, declaredGallons: declared, difference: declared - calculated, finalInventory: data.tanks.reduce((sum, tank) => sum + tank.currentStock, 0), observations: req.body.observations || "", closedBy: req.user.id, createdAt: now() };
    data.closures.push(closure);
    audit(data, req.user, "CERRAR_DIA", "CIERRE", closure.id, { date, difference: closure.difference }, requestIp(req));
    return closure;
  });
  outcome ? res.status(201).json(outcome) : fail(res, 409, "Ya existe un cierre para esa fecha");
});

function reportRows(data, query) {
  const from = query.from || "0000-01-01"; const to = query.to || "9999-12-31";
  return data.tickets.map((ticket) => ticketView(data, ticket)).filter((ticket) => {
    const day = ticket.createdAt.slice(0, 10);
    return day >= from && day <= to && (!query.status || ticket.status === query.status) && (!query.departmentId || ticket.departmentId === query.departmentId) && (!query.fuelType || ticket.fuelType === query.fuelType);
  }).map((ticket) => ({ Numero: ticket.ticketNumber, Estado: ticket.status, Empleado: ticket.employeeName, Vehiculo: ticket.vehicleLabel, Departamento: ticket.departmentName, Combustible: ticket.fuelType, Autorizado: ticket.authorizedGallons, Despachado: ticket.dispensedGallons, Creado: ticket.createdAt, Vence: ticket.expiresAt }));
}

const xml = (value) => String(value ?? "").replace(/[<>&'\"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]);
function createXlsx(rows) {
  const headers = Object.keys(rows[0] || { Numero: "" });
  const allRows = [headers, ...rows.map((row) => headers.map((key) => row[key]))];
  const cells = allRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    let n = columnIndex + 1; let column = "";
    while (n) { column = String.fromCharCode(65 + ((n - 1) % 26)) + column; n = Math.floor((n - 1) / 26); }
    const ref = `${column}${rowIndex + 1}`;
    return typeof value === "number" ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tickets" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cells}</sheetData><autoFilter ref="A1:${String.fromCharCode(64 + Math.min(headers.length, 26))}${allRows.length}"/></worksheet>`
  };
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)]))));
}
app.get("/api/reports/tickets", permit("reports"), async (req, res) => {
  const data = await read(); const rows = reportRows(data, req.query); const format = req.query.format || "json";
  if (format === "json") return res.json(rows);
  if (format === "csv") {
    const headers = Object.keys(rows[0] || { Numero: "" });
    const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=tickets.csv"); return res.send(`\ufeff${csv}`);
  }
  if (format === "xlsx") {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.setHeader("Content-Disposition", "attachment; filename=tickets.xlsx"); return res.send(createXlsx(rows));
  }
  if (format === "pdf") {
    res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", "inline; filename=reporte-tickets.pdf");
    const doc = new PDFDocument({ size: "A4", margin: 36 }); doc.pipe(res); doc.fontSize(20).fillColor("#143d2b").text("Reporte de tickets"); doc.moveDown().fontSize(9).fillColor("#111827");
    rows.forEach((row) => { doc.fontSize(10).text(`${row.Numero} | ${row.Estado} | ${row.Empleado}`); doc.fontSize(8).fillColor("#6b7280").text(`${row.Vehiculo} | ${row.Combustible} | ${row.Despachado}/${row.Autorizado} gal.`).fillColor("#111827").moveDown(.5); });
    doc.end(); return;
  }
  fail(res, 400, "Formato no soportado");
});

app.get("/api/audit", permit("audit"), async (_req, res) => res.json((await read()).audit.slice().reverse()));
app.get("/api/notifications", permit("read"), async (_req, res) => res.json((await read()).notifications.slice().reverse()));
app.post("/api/notifications/:id/read", permit("read"), async (req, res) => {
  const result = await transact((data) => { const item = data.notifications.find((entry) => entry.id === req.params.id); if (item) item.read = true; return item; });
  result ? res.json(result) : fail(res, 404, "Notificacion no encontrada");
});
app.get("/api/outbox", permit("*"), async (_req, res) => res.json((await read()).outbox.slice().reverse()));
app.get("/api/settings", permit("read"), async (_req, res) => res.json((await read()).settings));
app.patch("/api/settings", permit("*"), async (req, res) => res.json(await transact((data) => { Object.assign(data.settings, req.body); audit(data, req.user, "MODIFICAR", "CONFIGURACION", "global", req.body, requestIp(req)); return data.settings; })));

app.use("/api", (_req, res) => fail(res, 404, "Ruta no encontrada"));
app.use((_error, _req, res, _next) => fail(res, 500, "Ocurrio un error interno"));

app.listen(port, () => console.log(`TicketsGasolina disponible en ${baseUrl}`));
