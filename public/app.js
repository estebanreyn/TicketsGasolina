const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { token: localStorage.getItem("tg_token"), user: null, view: "dashboard", data: {}, validatedTicket: null };
const labels = { ADMIN: "Administrador", SUPERVISOR: "Supervisor", DESPACHADOR: "Despachador", AUDITOR: "Auditor", CONSULTA: "Consulta", SOLICITANTE: "Solicitante" };
const navItems = [
  ["dashboard", "Resumen", "▦", ["ADMIN","SUPERVISOR","DESPACHADOR","AUDITOR","CONSULTA","SOLICITANTE"]],
  ["requests", "Solicitudes", "＋", ["ADMIN","SUPERVISOR","SOLICITANTE"]],
  ["tickets", "Tickets", "▣", ["ADMIN","SUPERVISOR","DESPACHADOR","AUDITOR","CONSULTA","SOLICITANTE"]],
  ["dispatch", "Despachar", "⌗", ["ADMIN","DESPACHADOR"]],
  ["inventory", "Inventario", "▤", ["ADMIN","SUPERVISOR","AUDITOR","CONSULTA"]],
  ["employees", "Empleados", "♙", ["ADMIN","SUPERVISOR"]],
  ["vehicles", "Vehículos", "▱", ["ADMIN","SUPERVISOR"]],
  ["departments", "Departamentos", "⌂", ["ADMIN","SUPERVISOR"]],
  ["users", "Usuarios", "◎", ["ADMIN"]],
  ["closures", "Cierres", "✓", ["ADMIN","SUPERVISOR","DESPACHADOR","AUDITOR"]],
  ["reports", "Reportes", "↗", ["ADMIN","SUPERVISOR","AUDITOR"]],
  ["audit", "Auditoría", "≡", ["ADMIN","AUDITOR"]]
];

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const fmtDate = (value, dateOnly = false) => value ? new Intl.DateTimeFormat("es-DO", dateOnly ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
const fmtNumber = (value) => new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 }).format(Number(value || 0));
const status = (value) => `<span class="status ${escapeHtml(value)}">${escapeHtml(String(value || "-").replaceAll("_", " "))}</span>`;
const empty = (message = "No hay registros para mostrar") => `<div class="empty"><strong>Sin resultados</strong>${escapeHtml(message)}</div>`;
const initials = (name) => String(name || "TG").split(" ").slice(0,2).map((part) => part[0]).join("").toUpperCase();

function toast(message, isError = false) {
  const element = $("#toast");
  element.textContent = message; element.className = `toast show${isError ? " error" : ""}`;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.className = "toast", 3200);
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...options.headers } });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await response.json() : await response.blob();
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación");
  return data;
}

async function load(path, key) { state.data[key] = await api(path); return state.data[key]; }
function showApp() {
  $("#login-screen").classList.add("hidden"); $("#app-shell").classList.remove("hidden");
  $("#user-name").textContent = state.user.name; $("#user-role").textContent = labels[state.user.role] || state.user.role; $("#avatar").textContent = initials(state.user.name);
  $("#nav").innerHTML = navItems.filter(([, , , roles]) => roles.includes(state.user.role)).map(([key, label, icon]) => `<button class="nav-item${key === state.view ? " active" : ""}" data-view="${key}"><span class="nav-icon">${icon}</span>${label}</button>`).join("");
}
function logout() { localStorage.removeItem("tg_token"); state.token = null; state.user = null; location.reload(); }

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("button[type=submit]", event.currentTarget); button.disabled = true;
  try { const body = Object.fromEntries(new FormData(event.currentTarget)); const result = await api("/auth/login", { method: "POST", body: JSON.stringify(body) }); state.token = result.token; state.user = result.user; localStorage.setItem("tg_token", result.token); showApp(); await navigate("dashboard"); }
  catch (error) { toast(error.message, true); } finally { button.disabled = false; }
});
$("#logout").onclick = logout; $("#mobile-logout").onclick = logout;
$("#menu-toggle").onclick = () => $(".sidebar").classList.toggle("open");
$("#nav").addEventListener("click", (event) => { const button = event.target.closest("[data-view]"); if (button) navigate(button.dataset.view); });
$$('[data-close]').forEach((button) => button.onclick = () => button.closest("dialog").close());

async function navigate(view) {
  state.view = view; state.validatedTicket = null; $(".sidebar").classList.remove("open");
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  const item = navItems.find(([key]) => key === view); $("#page-title").textContent = item?.[1] || "TicketsGasolina"; $("#breadcrumb").textContent = view === "dashboard" ? "OPERACIONES" : "GESTIÓN · OPERACIONES";
  $("#content").innerHTML = `<div class="empty"><strong>Cargando</strong>Consultando información...</div>`;
  try { await views[view](); } catch (error) { $("#content").innerHTML = empty(error.message); toast(error.message, true); }
}

function table(columns, rows, actions) {
  if (!rows.length) return empty();
  return `<div class="table-wrap"><table><thead><tr>${columns.map(([, label]) => `<th>${label}</th>`).join("")}${actions ? "<th>Acciones</th>" : ""}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([key, , render]) => `<td>${render ? render(row[key], row) : escapeHtml(row[key])}</td>`).join("")}${actions ? `<td>${actions(row)}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}
function viewToolbar(title, description, actionLabel, action) {
  return `<div class="toolbar"><div><strong>${title}</strong><p class="muted">${description}</p></div>${actionLabel ? `<button class="button primary" data-action="${action}">＋ ${actionLabel}</button>` : ""}</div>`;
}
function field(def) {
  const { name, label, type = "text", required = true, options = [], value = "", full = false, min, step } = def;
  const attrs = `${required ? "required" : ""} ${min !== undefined ? `min="${min}"` : ""} ${step ? `step="${step}"` : ""}`;
  if (type === "select") return `<label class="${full ? "full" : ""}">${label}<select name="${name}" ${attrs}><option value="">Seleccionar</option>${options.map(([v,l]) => `<option value="${escapeHtml(v)}" ${String(v) === String(value) ? "selected" : ""}>${escapeHtml(l)}</option>`).join("")}</select></label>`;
  if (type === "textarea") return `<label class="${full ? "full" : ""}">${label}<textarea name="${name}" ${attrs}>${escapeHtml(value)}</textarea></label>`;
  if (type === "checkbox") return `<label class="${full ? "full" : ""}"><span>${label}</span><input name="${name}" type="checkbox" ${value ? "checked" : ""}></label>`;
  return `<label class="${full ? "full" : ""}">${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${attrs}></label>`;
}
function openForm(title, fields, onSubmit, kicker = "NUEVO REGISTRO") {
  $("#modal-title").textContent = title; $("#modal-kicker").textContent = kicker;
  const form = $("#modal-form"); form.innerHTML = fields.map(field).join("") + `<div class="form-actions"><button type="button" class="button secondary" data-cancel>Cancelar</button><button type="submit" class="button primary">Guardar</button></div>`;
  $("[data-cancel]", form).onclick = () => $("#modal").close();
  form.onsubmit = async (event) => { event.preventDefault(); const submit = $("button[type=submit]", form); submit.disabled = true; const values = Object.fromEntries(new FormData(form)); $$('input[type="checkbox"]', form).forEach((input) => values[input.name] = input.checked); try { await onSubmit(values); $("#modal").close(); toast("Registro guardado correctamente"); await navigate(state.view); } catch (error) { toast(error.message, true); } finally { submit.disabled = false; } };
  $("#modal").showModal();
}

const views = {};
views.dashboard = async () => {
  const data = await load("/dashboard", "dashboard");
  $("#notification-count").textContent = data.notifications.length;
  $("#content").innerHTML = `<section class="metrics">
    <article class="metric"><p>INVENTARIO TOTAL</p><strong>${fmtNumber(data.metrics.stock)}</strong><small>galones disponibles</small></article>
    <article class="metric"><p>DESPACHADO HOY</p><strong>${fmtNumber(data.metrics.dispatchedToday)}</strong><small>${fmtNumber(data.metrics.dispatchedMonth)} este mes</small></article>
    <article class="metric"><p>TICKETS ACTIVOS</p><strong>${data.metrics.activeTickets}</strong><small>${data.metrics.expiredTickets} vencidos</small></article>
    <article class="metric"><p>ALERTAS DE NIVEL</p><strong>${data.metrics.lowTanks}</strong><small>tanques en nivel crítico</small></article>
  </section><section class="dashboard-grid"><article class="panel"><div class="panel-head"><div><h2>Nivel de tanques</h2><p class="muted">Existencia actual por combustible</p></div></div><div class="tank-list">${data.tanks.map((tank) => { const pct = Math.round(tank.currentStock / tank.capacity * 100); return `<div class="tank-row"><strong>${escapeHtml(tank.name)}</strong><span>${fmtNumber(tank.currentStock)} / ${fmtNumber(tank.capacity)} gal.</span><div class="progress"><span style="width:${pct}%;background:${pct <= 20 ? "var(--red)" : "var(--forest-2)"}"></span></div></div>`; }).join("") || empty("No hay tanques configurados")}</div></article>
  <article class="panel"><div class="panel-head"><div><h2>Actividad reciente</h2><p class="muted">Últimos despachos</p></div></div><div class="activity">${data.recentDispatches.map((item) => `<div class="activity-item"><span><strong>${escapeHtml(item.ticketNumber)}</strong><br><small>${escapeHtml(item.operatorName)}</small></span><small>${fmtNumber(item.gallons)} gal.</small></div>`).join("") || empty("Aún no hay despachos")}</div></article></section>`;
};

views.requests = async () => {
  const [requests, employees, vehicles, departments] = await Promise.all([load("/requests","requests"), load("/employees","employees"), load("/vehicles","vehicles"), load("/departments","departments")]);
  $("#content").innerHTML = viewToolbar("Solicitudes de combustible", "Creación, revisión y aprobación.", "Nueva solicitud", "new-request") + table([
    ["createdAt","Fecha",fmtDate],["employeeName","Empleado"],["vehicleLabel","Vehículo"],["requestedGallons","Galones",fmtNumber],["fuelType","Combustible"],["status","Estado",status]
  ], requests, (row) => row.status === "PENDIENTE" && ["ADMIN","SUPERVISOR"].includes(state.user.role) ? `<button class="button small primary" data-approve="${row.id}">Aprobar</button> <button class="button small danger" data-reject="${row.id}">Rechazar</button>` : "");
  $("[data-action='new-request']")?.addEventListener("click", () => openForm("Nueva solicitud", [
    { name:"employeeId",label:"Empleado",type:"select",options:employees.filter(x=>x.active).map(x=>[x.id,`${x.code} · ${x.fullName}`]) },
    { name:"vehicleId",label:"Vehículo",type:"select",options:vehicles.filter(x=>x.active).map(x=>[x.id,`${x.plate} · ${x.internalCode}`]) },
    { name:"departmentId",label:"Departamento",type:"select",options:departments.filter(x=>x.active).map(x=>[x.id,x.name]) },
    { name:"requestedGallons",label:"Cantidad autorizada (gal.)",type:"number",min:"0.1",step:"0.1" },
    { name:"fuelType",label:"Tipo de combustible",type:"select",options:[["DIESEL","Diesel"],["GASOLINA_REGULAR","Gasolina regular"],["GASOLINA_PREMIUM","Gasolina premium"]] },
    { name:"expiresAt",label:"Fecha de vencimiento",type:"datetime-local" }, { name:"reason",label:"Motivo / destino",type:"textarea",full:true,required:false }
  ], (values) => api("/requests", { method:"POST", body:JSON.stringify({ ...values, expiresAt:new Date(values.expiresAt).toISOString() }) })));
  $$("[data-approve]").forEach((button) => button.onclick = async () => { try { await api(`/requests/${button.dataset.approve}/approve`, { method:"POST", body:"{}" }); toast("Solicitud aprobada y ticket emitido"); navigate("requests"); } catch(error){toast(error.message,true);} });
  $$("[data-reject]").forEach((button) => button.onclick = () => openForm("Rechazar solicitud", [{name:"reason",label:"Motivo del rechazo",type:"textarea",full:true}], (values) => api(`/requests/${button.dataset.reject}/reject`, {method:"POST",body:JSON.stringify(values)}), "REVISIÓN"));
};

views.tickets = async () => {
  const tickets = await load("/tickets","tickets");
  $("#content").innerHTML = viewToolbar("Tickets digitales", "QR firmado, correlativo y estado de consumo.") + table([
    ["ticketNumber","Número"],["employeeName","Empleado"],["vehicleLabel","Vehículo"],["authorizedGallons","Autorizado",(v,r)=>`${fmtNumber(r.dispensedGallons)} / ${fmtNumber(v)} gal.`],["expiresAt","Vence",fmtDate],["status","Estado",status]
  ], tickets, (row) => `<button class="button small secondary" data-qr="${row.id}">Ver QR</button> <a class="button small secondary" href="/api/tickets/${row.id}/pdf" data-download="${row.id}">PDF</a>${!["CONSUMIDO","ANULADO","VENCIDO"].includes(row.status) && ["ADMIN","SUPERVISOR"].includes(state.user.role) ? ` <button class="button small danger" data-cancel-ticket="${row.id}">Anular</button>` : ""}`);
  $$("[data-download]").forEach((link) => link.onclick = async (event) => { event.preventDefault(); try { const blob = await api(`/tickets/${link.dataset.download}/pdf`); const url=URL.createObjectURL(blob); window.open(url,"_blank"); setTimeout(()=>URL.revokeObjectURL(url),30000); } catch(error){toast(error.message,true);} });
  $$("[data-qr]").forEach((button) => button.onclick = () => showQr(tickets.find((item) => item.id === button.dataset.qr)));
  $$("[data-cancel-ticket]").forEach((button) => button.onclick = () => openForm("Anular ticket", [{name:"reason",label:"Motivo de anulación",type:"textarea",full:true}], (values) => api(`/tickets/${button.dataset.cancelTicket}/cancel`, {method:"POST",body:JSON.stringify(values)}), "ACCIÓN IRREVERSIBLE"));
};

async function showQr(ticket) {
  $("#qr-title").textContent = ticket.ticketNumber;
  $("#qr-content").innerHTML = `<img alt="QR del ticket ${escapeHtml(ticket.ticketNumber)}" src="/api/tickets/${ticket.id}/qr"><div class="qr-data"><div><small>Empleado</small><strong>${escapeHtml(ticket.employeeName)}</strong></div><div><small>Vehículo</small><strong>${escapeHtml(ticket.vehicleLabel)}</strong></div><div><small>Autorizado</small><strong>${fmtNumber(ticket.authorizedGallons)} gal.</strong></div><div><small>Vencimiento</small><strong>${fmtDate(ticket.expiresAt)}</strong></div></div>`;
  const image = $("img", $("#qr-content")); const response = await fetch(image.src,{headers:{Authorization:`Bearer ${state.token}`}}); const blob = await response.blob(); image.src = URL.createObjectURL(blob); $("#qr-modal").showModal();
}

views.dispatch = async () => {
  const tanks = await load("/tanks","tanks");
  $("#content").innerHTML = `<div class="scan-layout"><section class="scanner"><div class="scan-frame"></div><strong>Validar ticket</strong><p>Escanea el QR o ingresa el número correlativo.</p><input id="scan-value" placeholder="COM-2026-000001"><button id="validate-ticket" class="button primary wide">Validar <span>→</span></button></section><section id="validation-panel" class="panel validation">${empty("Esperando un ticket para validar")}</section></div>`;
  $("#validate-ticket").onclick = async () => { const value=$("#scan-value").value.trim(); if(!value)return toast("Ingresa un QR o número de ticket",true); try { const payload=value.startsWith("COM-")?{ticketNumber:value}:{qrToken:value}; const result=await api("/tickets/validate",{method:"POST",body:JSON.stringify(payload)}); state.validatedTicket={...result.ticket, qrToken:payload.qrToken}; renderValidated(result.ticket,tanks); } catch(error){state.validatedTicket=null; $("#validation-panel").innerHTML=empty(error.message); toast(error.message,true);} };
  if ("BarcodeDetector" in window) {
    const scanner=$(".scanner"); const camera=document.createElement("button"); camera.className="button secondary"; camera.textContent="Usar cámara"; scanner.append(camera);
    camera.onclick=async()=>{ try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});const video=document.createElement("video");video.autoplay=true;video.srcObject=stream;$(".scan-frame").replaceChildren(video);video.style.cssText="width:100%;height:100%;object-fit:cover";const detector=new BarcodeDetector({formats:["qr_code"]});const timer=setInterval(async()=>{const codes=await detector.detect(video);if(codes[0]){clearInterval(timer);stream.getTracks().forEach(t=>t.stop());$("#scan-value").value=codes[0].rawValue;$("#validate-ticket").click();}},400);}catch(error){toast("No se pudo abrir la cámara",true);} };
  }
};
function renderValidated(ticket,tanks) {
  const remaining=ticket.authorizedGallons-ticket.dispensedGallons;
  $("#validation-panel").innerHTML=`<div class="ticket-summary"><p class="eyebrow">TICKET VÁLIDO</p><h2>${escapeHtml(ticket.ticketNumber)}</h2><span>${escapeHtml(ticket.employeeName)} · ${escapeHtml(ticket.vehicleLabel)}</span><div class="amount">${fmtNumber(remaining)} gal.</div><small class="muted">restantes de ${fmtNumber(ticket.authorizedGallons)} autorizados</small><form id="dispatch-form" class="form-grid" style="padding:1rem 0 0"><label>Galones a despachar<input name="gallons" type="number" min="0.1" max="${remaining}" step="0.1" value="${remaining}" required></label><label>Tanque<select name="tankId" required>${tanks.filter(x=>x.active&&x.fuelType===ticket.fuelType).map(x=>`<option value="${x.id}">${escapeHtml(x.name)} · ${fmtNumber(x.currentStock)} gal.</option>`).join("")}</select></label><label>Odómetro<input name="odometer" type="number" min="0" required></label><label>Identidad confirmada<select name="identityConfirmed"><option value="true">Sí, confirmada</option><option value="false">No</option></select></label><label class="full">Observaciones<textarea name="observations"></textarea></label><div class="form-actions"><button class="button primary" type="submit">Confirmar despacho</button></div></form></div>`;
  $("#dispatch-form").onsubmit=async(event)=>{event.preventDefault();const body=Object.fromEntries(new FormData(event.currentTarget));body.ticketId=ticket.id;body.qrToken=state.validatedTicket.qrToken;body.identityConfirmed=body.identityConfirmed==="true";try{const result=await api("/dispatches",{method:"POST",body:JSON.stringify(body)});toast(`Despacho registrado. Stock: ${fmtNumber(result.stock)} galones`);state.validatedTicket=null;await navigate("dispatch");}catch(error){toast(error.message,true);}};
}

views.inventory = async () => {
  const [tanks,movements]=await Promise.all([load("/tanks","tanks"),load("/movements","movements")]);
  $("#content").innerHTML=`<section class="metrics">${tanks.map(t=>`<article class="metric"><p>${escapeHtml(t.fuelType)}</p><strong>${fmtNumber(t.currentStock)}</strong><small>${escapeHtml(t.name)} · ${Math.round(t.currentStock/t.capacity*100)}%</small></article>`).join("")}</section><section class="panel" style="margin-top:1rem">${viewToolbar("Movimientos de inventario","Entradas, salidas, transferencias y ajustes.", ["ADMIN","SUPERVISOR"].includes(state.user.role)?"Registrar recepción":null,"new-reception")}<div class="toolbar-group" style="margin-bottom:1rem">${["ADMIN","SUPERVISOR"].includes(state.user.role)?'<button class="button secondary" data-action="adjust">Ajustar inventario</button><button class="button secondary" data-action="new-tank">Nuevo tanque</button>':""}</div>${table([["createdAt","Fecha",fmtDate],["type","Movimiento",v=>escapeHtml(v.replaceAll("_"," "))],["tankName","Tanque"],["quantity","Cantidad",v=>`${Number(v)>0?"+":""}${fmtNumber(v)} gal.`],["after","Saldo",v=>`${fmtNumber(v)} gal.`]],movements)}</section>`;
  $("[data-action='new-reception']")?.addEventListener("click",()=>openForm("Recepción de combustible",[{name:"supplierTaxId",label:"RNC suplidor"},{name:"supplierName",label:"Nombre del suplidor"},{name:"invoice",label:"Factura"},{name:"volume",label:"Volumen recibido (gal.)",type:"number",min:"0.1",step:"0.1"},{name:"receivedAt",label:"Fecha de recepción",type:"datetime-local"},{name:"tankId",label:"Tanque",type:"select",options:tanks.map(x=>[x.id,x.name])}],v=>api("/receptions",{method:"POST",body:JSON.stringify({...v,receivedAt:new Date(v.receivedAt).toISOString()})})));
  $("[data-action='adjust']")?.addEventListener("click",()=>openForm("Ajuste de inventario",[{name:"tankId",label:"Tanque",type:"select",options:tanks.map(x=>[x.id,x.name])},{name:"quantity",label:"Cantidad (+ entrada / - salida)",type:"number",step:"0.1"},{name:"reason",label:"Motivo y evidencia",type:"textarea",full:true}],v=>api("/adjustments",{method:"POST",body:JSON.stringify(v)}),"CONTROL DE INVENTARIO"));
  $("[data-action='new-tank']")?.addEventListener("click",()=>openForm("Nuevo tanque",[{name:"code",label:"Código"},{name:"name",label:"Nombre"},{name:"fuelType",label:"Combustible",type:"select",options:[["DIESEL","Diesel"],["GASOLINA_REGULAR","Gasolina regular"],["GASOLINA_PREMIUM","Gasolina premium"]]},{name:"capacity",label:"Capacidad",type:"number",min:"1"},{name:"currentStock",label:"Existencia inicial",type:"number",min:"0",required:false},{name:"criticalLevel",label:"Nivel crítico",type:"number",min:"0"}],v=>api("/tanks",{method:"POST",body:JSON.stringify(v)})));
};

const catalogViews={
  employees:{title:"Empleados",description:"Personal habilitado para recibir asignaciones.",endpoint:"employees",columns:[["code","Código"],["fullName","Nombre"],["nationalId","Cédula"],["position","Cargo"],["email","Correo"],["active","Estado",v=>status(v?"ACTIVO":"INACTIVO")]]},
  vehicles:{title:"Vehículos",description:"Flota autorizada para consumo de combustible.",endpoint:"vehicles",columns:[["internalCode","Ficha"],["plate","Placa"],["brand","Marca"],["model","Modelo"],["fuelType","Combustible"],["odometer","Odómetro",fmtNumber],["active","Estado",v=>status(v?"ACTIVO":"INACTIVO")]]},
  departments:{title:"Departamentos",description:"Unidades responsables de empleados y vehículos.",endpoint:"departments",columns:[["code","Código"],["name","Nombre"],["active","Estado",v=>status(v?"ACTIVO":"INACTIVO")]]},
  users:{title:"Usuarios",description:"Acceso al sistema y permisos por rol.",endpoint:"users",columns:[["name","Nombre"],["email","Correo"],["role","Rol",v=>escapeHtml(labels[v]||v)],["active","Estado",v=>status(v?"ACTIVO":"INACTIVO")]]}
};
for(const [key,config] of Object.entries(catalogViews)) views[key]=async()=>{const rows=await load(`/${config.endpoint}`,key);if(["employees","vehicles"].includes(key)&&!state.data.departments)await load("/departments","departments");$("#content").innerHTML=viewToolbar(config.title,config.description,`Nuevo ${key==="users"?"usuario":"registro"}`,`new-${key}`)+table(config.columns,rows);$("[data-action]").onclick=()=>openCatalogForm(key);};
function openCatalogForm(type){const depts=(state.data.departments||[]).map(x=>[x.id,x.name]);const definitions={departments:[{name:"code",label:"Código"},{name:"name",label:"Nombre"}],employees:[{name:"code",label:"Código de empleado"},{name:"fullName",label:"Nombre completo"},{name:"nationalId",label:"Cédula"},{name:"departmentId",label:"Departamento",type:"select",options:depts},{name:"position",label:"Cargo"},{name:"email",label:"Correo",type:"email"},{name:"phone",label:"Teléfono",required:false}],vehicles:[{name:"plate",label:"Placa"},{name:"internalCode",label:"Ficha / código interno"},{name:"brand",label:"Marca"},{name:"model",label:"Modelo"},{name:"year",label:"Año",type:"number"},{name:"type",label:"Tipo"},{name:"departmentId",label:"Departamento",type:"select",options:depts},{name:"tankCapacity",label:"Capacidad tanque",type:"number",step:"0.1"},{name:"odometer",label:"Odómetro",type:"number"},{name:"fuelType",label:"Combustible",type:"select",options:[["DIESEL","Diesel"],["GASOLINA_REGULAR","Gasolina regular"],["GASOLINA_PREMIUM","Gasolina premium"]]}],users:[{name:"name",label:"Nombre"},{name:"email",label:"Correo",type:"email"},{name:"phone",label:"Teléfono",required:false},{name:"role",label:"Rol",type:"select",options:Object.entries(labels)},{name:"password",label:"Contraseña temporal",type:"password"}]};openForm(`Nuevo ${catalogViews[type].title.slice(0,-1).toLowerCase()}`,definitions[type],v=>api(`/${type}`,{method:"POST",body:JSON.stringify(v)}));}

views.closures=async()=>{const rows=await load("/closures","closures");$("#content").innerHTML=viewToolbar("Cierres diarios","Conciliación de despachos e inventario final.",["ADMIN","SUPERVISOR","DESPACHADOR"].includes(state.user.role)?"Realizar cierre":null,"new-closure")+table([["date","Fecha",v=>fmtDate(v,true)],["dispatchCount","Despachos"],["calculatedGallons","Sistema",v=>`${fmtNumber(v)} gal.`],["declaredGallons","Declarado",v=>`${fmtNumber(v)} gal.`],["difference","Diferencia",v=>`${fmtNumber(v)} gal.`],["finalInventory","Inventario final",v=>`${fmtNumber(v)} gal.`]],rows);$("[data-action='new-closure']")?.addEventListener("click",()=>openForm("Cierre diario",[{name:"date",label:"Fecha",type:"date",value:new Date().toISOString().slice(0,10)},{name:"declaredGallons",label:"Volumen físico despachado",type:"number",step:"0.1",required:false},{name:"observations",label:"Observaciones",type:"textarea",full:true,required:false}],v=>api("/closures",{method:"POST",body:JSON.stringify(v)}),"CONCILIACIÓN"));};
views.reports=async()=>{$("#content").innerHTML=`<section class="panel"><div class="panel-head"><div><h2>Reporte de tickets</h2><p class="muted">Filtra el período y descarga el formato requerido.</p></div></div><form id="report-form" class="form-grid"><label>Desde<input name="from" type="date"></label><label>Hasta<input name="to" type="date"></label><label>Estado<select name="status"><option value="">Todos</option>${["CREADO","PENDIENTE","PROXIMO_A_VENCER","VENCIDO","CONSUMIDO","ANULADO"].map(x=>`<option>${x}</option>`).join("")}</select></label><label>Combustible<select name="fuelType"><option value="">Todos</option><option>DIESEL</option><option>GASOLINA_REGULAR</option><option>GASOLINA_PREMIUM</option></select></label><div class="form-actions"><button class="button secondary" type="button" data-format="csv">CSV</button><button class="button secondary" type="button" data-format="xlsx">Excel</button><button class="button primary" type="button" data-format="pdf">PDF</button></div></form></section>`;$$('[data-format]').forEach(button=>button.onclick=async()=>{const q=new URLSearchParams(new FormData($("#report-form")));q.set("format",button.dataset.format);try{const blob=await api(`/reports/tickets?${q}`);const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`reporte-tickets.${button.dataset.format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(error){toast(error.message,true);}});};
views.audit=async()=>{const rows=await load("/audit","audit");$("#content").innerHTML=viewToolbar("Bitácora de auditoría","Registro append-only de accesos y operaciones críticas.")+table([["createdAt","Fecha",fmtDate],["actorName","Usuario"],["action","Acción"],["entity","Entidad"],["entityId","Identificador"],["ip","IP"]],rows);};

$("#notifications-button").onclick=async()=>{try{const items=await api("/notifications");$("#qr-title").textContent="Notificaciones";$("#qr-content").innerHTML=`<div class="activity" style="text-align:left">${items.slice(0,12).map(x=>`<div class="activity-item"><span><strong>${escapeHtml(x.title)}</strong><br><small>${escapeHtml(x.message)}</small></span><small>${fmtDate(x.createdAt)}</small></div>`).join("")||empty()}</div>`;$("#qr-modal").showModal();}catch(error){toast(error.message,true);}};

async function boot(){if(!state.token)return;try{state.user=await api("/me");showApp();await navigate("dashboard");}catch{logout();}}
if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
boot();
