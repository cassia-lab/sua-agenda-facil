// ======== ELEMENTOS DA TELA ========
const horariosDiv = document.getElementById("horarios");
const servicoSelect = document.getElementById("servico");
const dataInput = document.getElementById("data");
const tituloPagina = document.getElementById("tituloPagina");
const calendarGrid = document.getElementById("calendarGrid");
const btnPrevMonth = document.getElementById("btnPrevMonth");
const btnNextMonth = document.getElementById("btnNextMonth");
const labelMonth = document.getElementById("labelMonth");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const serviceMeta = document.getElementById("serviceMeta");
const myBookingsPhone = document.getElementById("myBookingsPhone");
const btnBuscarBookings = document.getElementById("btnBuscarBookings");
const myBookingsList = document.getElementById("myBookingsList");
const myBookingsMsg = document.getElementById("myBookingsMsg");
const modalConfirmacao = document.getElementById("modalConfirmacao");
const modalRemarcacao = document.getElementById("modalRemarcacao");
const rescheduleInfo = document.getElementById("rescheduleInfo");
const rescheduleCalendarGrid = document.getElementById("rescheduleCalendarGrid");
const rescheduleMonthLabel = document.getElementById("rescheduleMonthLabel");
const btnReschedulePrev = document.getElementById("btnReschedulePrev");
const btnRescheduleNext = document.getElementById("btnRescheduleNext");
const rescheduleSlots = document.getElementById("rescheduleSlots");
const rescheduleMsg = document.getElementById("rescheduleMsg");
const btnSalvarRemarcacao = document.getElementById("btnSalvarRemarcacao");
const btnCancelarRemarcacao = document.getElementById("btnCancelarRemarcacao");

// ======= TITULO vindo do config.js =======
const nomePagina = window.APP_CONFIG?.nomePagina || "Sua Agenda Facil";
if (tituloPagina) tituloPagina.textContent = nomePagina;
document.title = nomePagina;

// ======== CONFIG PADRAO ========
const padrao = {
  diaInicio: 8 * 60,
  diaFim: 17 * 60,
  almocoInicio: 12 * 60,
  almocoFim: 13 * 60,
  passoMinutos: 30
};

let agendamentoPendente = null;
let gerarHorariosSeq = 0;
let diasDescansoSemana = null;
let servicosCache = [];
let calendarioMesAtual = new Date();
let selectedDia = "";
let excecoesPorDia = new Map();
let calendarioResumoCache = new Map();
let renderCalendarioSeq = 0;
let ultimoTelefoneBusca = null;
let rescheduleState = null;
let rescheduleMonth = new Date();
let rescheduleSelectedDay = "";
let rescheduleSelectedStart = null;

// ======== HELPERS ========
function parseYYYYMMDD(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYYYYMMDDLocal(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function diaSemanaPermitidoUTC(dateObjUTC) {
  const d = dateObjUTC.getUTCDay();
  return d >= 2 && d <= 6; // Tue-Sat
}

function isDiaPermitidoUTC(dateObjUTC) {
  if (!diaSemanaPermitidoUTC(dateObjUTC)) return false;
  if (diasDescansoSemana && diasDescansoSemana.has(dateObjUTC.getUTCDay())) return false;
  return true;
}

function getExcecaoStatus(dia) {
  if (!dia || !excecoesPorDia) return null;
  if (!excecoesPorDia.has(dia)) return null;
  return excecoesPorDia.get(dia) ? "closed" : "open";
}

function proximaDataPermitidaLocal() {
  const d = new Date();
  while (true) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const utc = parseYYYYMMDD(`${y}-${m}-${day}`);
    if (isDiaPermitidoUTC(utc)) return d;
    d.setDate(d.getDate() + 1);
  }
}

function formatarDataBR(dia) {
  return dia.split("-").reverse().join("/");
}

function minutosParaHHMM(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function nomeMes(idx) {
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return nomes[idx] || "";
}

function formatarDataResumida(dia) {
  if (!dia) return "";
  const [y, m, d] = dia.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const semana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][dt.getUTCDay()];
  return `Para: ${semana}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function ajustarInicioParaPasso(minutos, passo) {
  if (!Number.isFinite(minutos) || !Number.isFinite(passo) || passo <= 0) {
    return minutos;
  }
  const resto = minutos % passo;
  if (resto === 0) return minutos;
  return minutos + (passo - resto);
}

function intervalosConflitam(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function estaDisponivel(start, end, agendamentos, config) {
  if (start < config.diaInicio || end > config.diaFim) return false;

  if (config.almocoInicio < config.almocoFim) {
    if (intervalosConflitam(start, end, config.almocoInicio, config.almocoFim)) return false;
  }

  for (const ag of agendamentos) {
    if (intervalosConflitam(start, end, ag.start, ag.end)) return false;
  }
  return true;
}

function normalizarTelefoneBR(telefoneRaw) {
  if (!telefoneRaw || !telefoneRaw.trim()) return null;

  let telefone = telefoneRaw.replace(/\D/g, "");
  telefone = telefone.replace(/^0+/, "");

  if (telefone.startsWith("55")) {
    return telefone;
  }

  if (telefone.length === 10 || telefone.length === 11) {
    return "55" + telefone;
  }

  return null;
}

function obterDuracaoServico(serviceId) {
  if (!Number.isFinite(serviceId)) return null;
  const item = servicosCache.find((s) => Number(s.id) === Number(serviceId));
  return item ? Number(item.duracao || 0) : null;
}

function podeRemarcarAgendamento(booking) {
  const day = booking?.day;
  const start = Number(booking?.start_min);
  if (!day || !Number.isFinite(start)) return false;
  const [y, m, d] = String(day).split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(y, m - 1, d, Math.floor(start / 60), start % 60);
  const diffMs = dt.getTime() - Date.now();
  return diffMs >= 24 * 60 * 60 * 1000;
}

// ======== API ========
async function carregarConfigDoDia(dia) {
  const resp = await fetch(`/api/day-settings?date=${encodeURIComponent(dia)}`, {
    cache: "no-store"
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  if (!json?.config) throw new Error("Config not found");
  return { config: json.config, meta: json.meta || { exists: false } };
}

async function carregarDiasDescansoCliente() {
  const resp = await fetch("/api/weekly-closed", { cache: "no-store" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const days = Array.isArray(json?.days) ? json.days : [];
  return new Set(days.map((d) => Number(d)));
}

async function carregarExcecoesMes(ano, mes) {
  const mesStr = String(mes).padStart(2, "0");
  const prefix = `${ano}-${mesStr}-`;
  const resp = await fetch("/api/day-settings?limit=500", { cache: "no-store" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const configs = Array.isArray(json?.configs) ? json.configs : [];

  const mapa = new Map();
  configs.forEach((c) => {
    const day = c?.day;
    if (!day || typeof day !== "string") return;
    if (!day.startsWith(prefix)) return;
    mapa.set(day, Boolean(c.fechado));
  });

  excecoesPorDia = mapa;
}

async function carregarResumoMesCliente(ano, mes, duracao) {
  const mm = String(mes).padStart(2, "0");
  const durKey = Number.isFinite(duracao) && duracao > 0 ? `-${duracao}` : "";
  const chave = `${ano}-${mm}${durKey}`;
  if (calendarioResumoCache.has(chave)) return calendarioResumoCache.get(chave);

  const params = new URLSearchParams({ month: `${ano}-${mm}` });
  if (Number.isFinite(duracao) && duracao > 0) {
    params.set("duration", String(duracao));
  }

  const resp = await fetch(`/api/bookings/summary?${params.toString()}`, {
    cache: "no-store"
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const days = Array.isArray(json?.days) ? json.days : [];
  calendarioResumoCache.set(chave, days);
  return days;
}

async function carregarBookingsAPI(dia) {
  const resp = await fetch(`/api/bookings?date=${encodeURIComponent(dia)}`, {
    cache: "no-store"
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const lista = Array.isArray(json?.bookings) ? json.bookings : [];

  return lista
    .filter((b) => b?.status !== "canceled")
    .map((b) => ({
      id: b?.id ?? null,
      start: Number(b?.start_min),
      end: Number(b?.end_min),
      nome: b?.client_name ?? null,
      telefone: b?.client_phone ?? null,
      servico: b?.service_name ?? b?.service_id ?? null,
      status: b?.status ?? null
    }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end));
}

async function carregarServicosAPI() {
  const resp = await fetch("/api/services", { cache: "no-store" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const services = Array.isArray(json.services) ? json.services : [];

  return services
    .filter((s) => s.active !== false)
    .map((s) => ({
      id: s.id,
      nome: s.name,
      duracao: Number(s.duration_minutes || 0),
      preco: Number(s.price_cents || 0) / 100
    }))
    .filter((s) => s.nome && s.duracao > 0);
}

async function carregarBookingsPorTelefone(telefone) {
  const resp = await fetch(`/api/bookings/by-phone?phone=${encodeURIComponent(telefone)}`, {
    cache: "no-store"
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const lista = Array.isArray(json?.bookings) ? json.bookings : [];
  return lista;
}

function renderMeusAgendamentos(lista) {
  if (!myBookingsList || !myBookingsMsg) return;
  myBookingsList.innerHTML = "";
  myBookingsMsg.textContent = "";

  if (!lista.length) {
    myBookingsMsg.textContent = "Nenhum agendamento futuro encontrado.";
    return;
  }

  lista.forEach((b) => {
    const item = document.createElement("div");
    item.className = "my-booking-item";

    const titulo = document.createElement("div");
    titulo.className = "my-booking-title";
    const dia = String(b?.day || "");
    const hora = minutosParaHHMM(Number(b?.start_min));
    titulo.textContent = `${formatarDataBR(dia)} \u2022 ${hora}`;

    const sub = document.createElement("div");
    sub.className = "my-booking-sub";
    sub.textContent = b?.service_name || b?.servico || "Servico";

    const actions = document.createElement("div");
    actions.className = "my-booking-actions";

    const btnRemarcar = document.createElement("button");
    btnRemarcar.type = "button";
    btnRemarcar.className = "my-booking-btn";
    btnRemarcar.textContent = "Remarcar";

    const podeRemarcar = b?.can_reschedule === true;
    if (!podeRemarcar) {
      btnRemarcar.disabled = true;
      const note = document.createElement("div");
      note.className = "my-booking-note";
      note.textContent = "Remarcacao disponivel ate 24h antes do horario.";
      item.appendChild(note);
    } else {
      btnRemarcar.addEventListener("click", () => abrirModalRemarcacao(b));
    }

    actions.appendChild(btnRemarcar);

    item.appendChild(titulo);
    item.appendChild(sub);
    item.appendChild(actions);
    myBookingsList.appendChild(item);
  });
}

async function buscarMeusAgendamentos() {
  if (!myBookingsPhone) return;
  if (myBookingsMsg) myBookingsMsg.textContent = "";
  if (myBookingsList) myBookingsList.innerHTML = "";

  const raw = myBookingsPhone.value || "";
  const telefone = normalizarTelefoneBR(raw);
  if (!telefone) {
    if (myBookingsMsg) myBookingsMsg.textContent = "Digite um WhatsApp valido.";
    return;
  }

  try {
    ultimoTelefoneBusca = telefone;
    const lista = await carregarBookingsPorTelefone(telefone);
    renderMeusAgendamentos(lista);
  } catch (e) {
    console.error("Erro ao buscar agendamentos:", e);
    if (myBookingsMsg) myBookingsMsg.textContent = "Erro ao buscar agendamentos.";
  }
}

// ======== UI ========
async function renderSelectServicos() {
  if (!servicoSelect) return;
  servicoSelect.innerHTML = "<option value=\"\">Carregando servicos...</option>";

  try {
    const lista = await carregarServicosAPI();
    if (!Array.isArray(lista) || lista.length === 0) {
      servicoSelect.innerHTML = "<option value=\"\">Nenhum servico cadastrado</option>";
      return;
    }

    servicoSelect.innerHTML = "<option value=\"\">Selecione o servico que deseja fazer.</option>";
    servicosCache = lista;
    lista.forEach((s) => {
      const dur = Number(s.duracao || 0);
      if (!dur) return;

      const opt = document.createElement("option");
      opt.value = String(dur);
      opt.dataset.serviceId = s.id ? String(s.id) : "";
      opt.textContent = `${s.nome} (${dur} min) - ${formatarPrecoBR(s.preco)}`;
      servicoSelect.appendChild(opt);
    });

    servicoSelect.selectedIndex = 0;
    atualizarResumoServico();
  } catch (e) {
    console.error("Erro ao carregar servicos:", e);
    servicoSelect.innerHTML = "<option value=\"\">Erro ao carregar servicos</option>";
  }
}

function formatarPrecoBR(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

async function gerarHorarios() {
  if (!horariosDiv) return;
  const seq = ++gerarHorariosSeq;
  horariosDiv.innerHTML = "";

  const dia = dataInput?.value;
  const duracao = parseInt(servicoSelect?.value || "0", 10);

  if (!dia) {
    horariosDiv.textContent = "Selecione uma data para ver os horarios.";
    return;
  }

  const dateObjUTC = parseYYYYMMDD(dia);
  const excecaoStatus = getExcecaoStatus(dia);
  if (excecaoStatus === "closed") {
    horariosDiv.textContent = "Este dia esta fechado.";
    return;
  }
  if (!isDiaPermitidoUTC(dateObjUTC) && excecaoStatus !== "open") {
    horariosDiv.textContent = "Este dia nao esta disponivel para atendimento.";
    return;
  }

  if (!duracao || duracao <= 0) {
    horariosDiv.textContent = "Selecione o servico que deseja fazer.";
    return;
  }

  let config;
  let configMeta;
  try {
    const cfg = await carregarConfigDoDia(dia);
    config = cfg.config;
    configMeta = cfg.meta;
  } catch (e) {
    console.error("Erro buscando config:", e);
    horariosDiv.textContent = "Erro ao carregar configuracao do dia.";
    return;
  }

  if (seq !== gerarHorariosSeq) return;

  if (config.fechado) {
    horariosDiv.textContent = "Este dia esta fechado.";
    return;
  }

  if (
    excecaoStatus !== "open" &&
    !configMeta?.exists &&
    diasDescansoSemana &&
    diasDescansoSemana.has(parseYYYYMMDD(dia).getUTCDay())
  ) {
    horariosDiv.textContent = "Este dia esta fechado.";
    return;
  }

  let agendamentos = [];
  try {
    agendamentos = await carregarBookingsAPI(dia);
  } catch (e) {
    console.error("Erro buscando bookings:", e);
    horariosDiv.textContent = "Erro ao carregar agendamentos do dia.";
    return;
  }

  if (seq !== gerarHorariosSeq) return;

  let achou = false;
  const passo = padrao.passoMinutos;
  let start = ajustarInicioParaPasso(config.diaInicio, passo);
  const hojeStr = formatYYYYMMDDLocal(new Date());
  const agoraMin = dia === hojeStr
    ? (new Date().getHours() * 60 + new Date().getMinutes())
    : null;
  for (; start + duracao <= config.diaFim; start += passo) {
    const end = start + duracao;

    if (agoraMin != null && start < agoraMin) continue;
    if (!estaDisponivel(start, end, agendamentos, config)) continue;

    const slotStart = start;
    const slotEnd = end;

    achou = true;
    const botao = document.createElement("button");
    botao.textContent = `${minutosParaHHMM(slotStart)}`;

    botao.onclick = () => {
      document
        .querySelectorAll(".horarios-grid button.selecionado")
        .forEach((b) => b.classList.remove("selecionado"));

      botao.classList.add("selecionado");
      agendar(dia, slotStart, slotEnd, duracao);
    };

    horariosDiv.appendChild(botao);
  }

  if (!achou) {
    horariosDiv.textContent = "Nenhum horario disponivel para esse servico nessa data.";
  }
}

function resetarRemarcacao() {
  rescheduleState = null;
  rescheduleSelectedDay = "";
  rescheduleSelectedStart = null;
  if (rescheduleSlots) rescheduleSlots.innerHTML = "";
  if (rescheduleMsg) rescheduleMsg.textContent = "";
  if (rescheduleInfo) rescheduleInfo.textContent = "";
}

function abrirModalRemarcacao(booking) {
  if (!modalRemarcacao) return;

  const duracao = obterDuracaoServico(Number(booking?.service_id));
  if (!duracao || duracao <= 0) {
    alert("Nao foi possivel identificar a duracao do servico.");
    return;
  }

  const podeRemarcar = booking?.can_reschedule === true;
  if (!podeRemarcar) {
    alert("Remarcacao disponivel apenas ate 24h antes do horario.");
    return;
  }

  rescheduleState = {
    booking,
    duracao
  };

  rescheduleSelectedDay = String(booking?.day || "");
  rescheduleSelectedStart = null;

  if (rescheduleInfo) {
    const nome = booking?.client_name || "Cliente";
    const telefone = booking?.client_phone || "";
    const servico = booking?.service_name || "Servico";
    rescheduleInfo.textContent = `${nome} - ${telefone} - ${servico}`;
  }

  const [y, m] = String(rescheduleSelectedDay || "").split("-").map(Number);
  if (Number.isFinite(y) && Number.isFinite(m)) {
    rescheduleMonth = new Date(y, m - 1, 1);
  } else {
    rescheduleMonth = new Date();
  }

  renderCalendarioRemarcacao();
  renderSlotsRemarcacao();
  modalRemarcacao.removeAttribute("hidden");
  modalRemarcacao.classList.add("is-open");
  document.body.classList.add("modal-open");
}

function fecharModalRemarcacao() {
  if (modalRemarcacao) {
    modalRemarcacao.classList.remove("is-open");
    modalRemarcacao.setAttribute("hidden", "");
  }
  document.body.classList.remove("modal-open");
  resetarRemarcacao();
}

async function renderCalendarioRemarcacao() {
  if (!rescheduleCalendarGrid || !rescheduleState) return;

  const duracao = rescheduleState.duracao;
  const ano = rescheduleMonth.getFullYear();
  const mes = rescheduleMonth.getMonth();
  if (rescheduleMonthLabel) rescheduleMonthLabel.textContent = `${nomeMes(mes)} ${ano}`;

  rescheduleCalendarGrid.innerHTML = "";

  try {
    await carregarExcecoesMes(ano, mes + 1);
  } catch (e) {
    console.error("Erro carregando excecoes:", e);
    excecoesPorDia = new Map();
  }

  let resumo = [];
  try {
    resumo = await carregarResumoMesCliente(ano, mes + 1, duracao);
  } catch (e) {
    console.error("Erro carregando resumo mensal:", e);
  }

  const resumoPorDia = new Map();
  resumo.forEach((r) => {
    if (r?.day) resumoPorDia.set(r.day, r);
  });

  const primeiroDia = new Date(ano, mes, 1);
  const startDow = primeiroDia.getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hojeStr = formatYYYYMMDDLocal(new Date());

  for (let i = 0; i < startDow; i++) {
    const vazio = document.createElement("div");
    vazio.className = "calendar-cell empty";
    rescheduleCalendarGrid.appendChild(vazio);
  }

  for (let d = 1; d <= totalDias; d++) {
    const dayStr = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const utc = parseYYYYMMDD(dayStr);
    const excecao = excecoesPorDia.has(dayStr);
    const permitidoPadrao = isDiaPermitidoUTC(utc);
    const permitido = excecao ? false : permitidoPadrao;
    const isPast = dayStr < hojeStr;
    const resumoInfo = resumoPorDia.get(dayStr);
    const status = resumoInfo?.status;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "calendar-cell day-btn";
    btn.textContent = String(d);
    btn.dataset.day = dayStr;

    if (!isPast && status === "free") {
      btn.style.background = "#bbf7d0";
      btn.style.borderColor = "#bbf7d0";
      btn.style.color = "#166534";
    }
    if (!isPast && status === "full") {
      btn.style.background = "#fecaca";
      btn.style.borderColor = "#fecaca";
      btn.style.color = "#7f1d1d";
    }
    if (status === "closed") {
      btn.style.background = "#e5e7eb";
      btn.style.borderColor = "#e5e7eb";
      btn.style.color = "#6b7280";
    }

    if (rescheduleSelectedDay === dayStr) btn.classList.add("selected");
    if (isPast || !permitido || status === "closed" || status === "full") {
      btn.classList.add("disabled");
      btn.disabled = true;
    }

    btn.addEventListener("click", () => {
      rescheduleSelectedDay = dayStr;
      rescheduleSelectedStart = null;
      renderCalendarioRemarcacao();
      renderSlotsRemarcacao();
    });

    rescheduleCalendarGrid.appendChild(btn);
  }
}

async function renderSlotsRemarcacao() {
  if (!rescheduleState || !rescheduleSlots || !rescheduleMsg) return;
  rescheduleSlots.innerHTML = "";
  rescheduleMsg.textContent = "";

  const dia = rescheduleSelectedDay;
  const duracao = rescheduleState.duracao;
  const bookingId = rescheduleState.booking?.id;

  if (!dia) {
    rescheduleMsg.textContent = "Selecione uma data.";
    return;
  }

  const dateObjUTC = parseYYYYMMDD(dia);
  const excecaoStatus = getExcecaoStatus(dia);
  if (excecaoStatus === "closed") {
    rescheduleMsg.textContent = "Este dia esta fechado.";
    return;
  }
  if (!isDiaPermitidoUTC(dateObjUTC) && excecaoStatus !== "open") {
    rescheduleMsg.textContent = "Este dia nao esta disponivel para atendimento.";
    return;
  }

  let config;
  let configMeta;
  try {
    const cfg = await carregarConfigDoDia(dia);
    config = cfg.config;
    configMeta = cfg.meta;
  } catch (e) {
    console.error("Erro buscando config:", e);
    rescheduleMsg.textContent = "Erro ao carregar configuracao do dia.";
    return;
  }

  if (config.fechado) {
    rescheduleMsg.textContent = "Este dia esta fechado.";
    return;
  }

  if (
    excecaoStatus !== "open" &&
    !configMeta?.exists &&
    diasDescansoSemana &&
    diasDescansoSemana.has(parseYYYYMMDD(dia).getUTCDay())
  ) {
    rescheduleMsg.textContent = "Este dia esta fechado.";
    return;
  }

  let agendamentos = [];
  try {
    agendamentos = await carregarBookingsAPI(dia);
  } catch (e) {
    console.error("Erro buscando bookings:", e);
    rescheduleMsg.textContent = "Erro ao carregar agendamentos do dia.";
    return;
  }

  if (Number.isFinite(bookingId)) {
    agendamentos = agendamentos.filter((ag) => Number(ag.id) !== Number(bookingId));
  }

  let achou = false;
  const passo = padrao.passoMinutos;
  let start = ajustarInicioParaPasso(config.diaInicio, passo);
  const hojeStr = formatYYYYMMDDLocal(new Date());
  const agoraMin = dia === hojeStr
    ? (new Date().getHours() * 60 + new Date().getMinutes())
    : null;

  for (; start + duracao <= config.diaFim; start += passo) {
    const end = start + duracao;
    if (agoraMin != null && start < agoraMin) continue;
    if (!estaDisponivel(start, end, agendamentos, config)) continue;

    achou = true;
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = minutosParaHHMM(start);
    if (rescheduleSelectedStart === start) botao.classList.add("selecionado");

    botao.addEventListener("click", () => {
      rescheduleSelectedStart = start;
      renderSlotsRemarcacao();
    });

    rescheduleSlots.appendChild(botao);
  }

  if (!achou) {
    rescheduleMsg.textContent = "Sem horarios disponiveis para esse servico.";
  }
}

async function salvarRemarcacaoCliente() {
  if (!rescheduleState) return;

  const booking = rescheduleState.booking;
  if (!booking?.id) return;

  if (!podeRemarcarAgendamento(booking)) {
    alert("Remarcacao disponivel apenas ate 24h antes do horario.");
    return;
  }

  if (!rescheduleSelectedDay || rescheduleSelectedStart == null) {
    alert("Selecione uma data e horario.");
    return;
  }

  const duracao = rescheduleState.duracao;
  const payload = {
    action: "reschedule",
    id: booking.id,
    day: rescheduleSelectedDay,
    start_min: rescheduleSelectedStart,
    end_min: rescheduleSelectedStart + duracao
  };

  try {
    const resp = await fetch("/api/bookings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (resp.status === 409) {
        alert(json?.error || "Horario indisponivel ou fora do prazo.");
        renderSlotsRemarcacao();
        return;
      }
      alert(json?.error || `Erro ao remarcar (HTTP ${resp.status}).`);
      return;
    }
  } catch (e) {
    console.error("Erro ao remarcar:", e);
    alert("Nao foi possivel remarcar. Tente novamente.");
    return;
  }

  fecharModalRemarcacao();
  if (ultimoTelefoneBusca && myBookingsPhone) {
    myBookingsPhone.value = ultimoTelefoneBusca;
    buscarMeusAgendamentos();
  }
}

function atualizarResumoServico() {
  if (!serviceMeta || !servicoSelect) return;
  const opt = servicoSelect.options[servicoSelect.selectedIndex];
  if (!opt) {
    serviceMeta.textContent = "";
    return;
  }
  if (!opt.value) {
    serviceMeta.textContent = "Selecione o servico que deseja fazer.";
    return;
  }
  serviceMeta.textContent = opt.textContent || "";
}

async function renderCalendario() {
  if (!calendarGrid) return;
  const seq = ++renderCalendarioSeq;

  const ano = calendarioMesAtual.getFullYear();
  const mes = calendarioMesAtual.getMonth();
  if (labelMonth) labelMonth.textContent = `${nomeMes(mes)} ${ano}`;

  const primeiroDia = new Date(ano, mes, 1);
  const startDow = primeiroDia.getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();
  const hojeStr = formatYYYYMMDDLocal(hoje);
  const duracaoSelecionada = servicoSelect ? Number(servicoSelect.value || 0) : 0;
  let resumo = [];

  try {
    await carregarExcecoesMes(ano, mes + 1);
  } catch (e) {
    console.error("Erro carregando excecoes:", e);
    excecoesPorDia = new Map();
  }

  try {
    resumo = await carregarResumoMesCliente(ano, mes + 1, duracaoSelecionada);
  } catch (e) {
    console.error("Erro carregando resumo mensal:", e);
  }

  if (seq !== renderCalendarioSeq) return;
  calendarGrid.innerHTML = "";

  const resumoPorDia = new Map();
  resumo.forEach((r) => {
    if (r?.day) resumoPorDia.set(r.day, r);
  });

  for (let i = 0; i < startDow; i++) {
    const vazio = document.createElement("div");
    vazio.className = "calendar-cell empty";
    calendarGrid.appendChild(vazio);
  }

  for (let d = 1; d <= totalDias; d++) {
    const dayStr = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const utc = parseYYYYMMDD(dayStr);
    const excecao = excecoesPorDia.has(dayStr) ? excecoesPorDia.get(dayStr) : null;
    const permitidoPadrao = isDiaPermitidoUTC(utc);
    const permitido = excecao === null ? permitidoPadrao : !excecao;
    const isPast = dayStr < hojeStr;
    const resumoInfo = resumoPorDia.get(dayStr);
    const status = resumoInfo?.status;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "calendar-cell day-btn";
    btn.textContent = String(d);
    btn.dataset.day = dayStr;

    if (!isPast && status === "free") {
      btn.style.background = "#bbf7d0";
      btn.style.borderColor = "#bbf7d0";
      btn.style.color = "#166534";
    }
    if (!isPast && status === "full") {
      btn.style.background = "#fecaca";
      btn.style.borderColor = "#fecaca";
      btn.style.color = "#7f1d1d";
    }
    if (status === "closed") {
      btn.style.background = "#e5e7eb";
      btn.style.borderColor = "#e5e7eb";
      btn.style.color = "#6b7280";
    }

    if (selectedDia === dayStr) btn.classList.add("selected");
    if (isPast || !permitido || status === "closed") {
      btn.classList.add("disabled");
      btn.disabled = true;
    }

    btn.addEventListener("click", () => setSelectedDia(dayStr, true));
    calendarGrid.appendChild(btn);
  }
}

function setSelectedDia(dia, fromCalendar) {
  selectedDia = dia;
  if (dataInput) dataInput.value = dia;
  if (selectedDateLabel) selectedDateLabel.textContent = formatarDataResumida(dia);
  renderCalendario();
  gerarHorarios();
  if (!fromCalendar) return;
}

function agendar(dia, start, end, duracao) {
  const servico = servicoSelect?.options[servicoSelect.selectedIndex]?.text || "Servico";
  const dataBR = formatarDataBR(dia);
  const horaInicio = minutosParaHHMM(start);
  const horaFim = minutosParaHHMM(end);

  agendamentoPendente = { dia, start, end, duracao, servico, dataBR, horaInicio, horaFim };
  abrirModalConfirmacao(agendamentoPendente);
}

function abrirModalConfirmacao() {
  const titulo = document.getElementById("modalTitulo");
  const texto = document.getElementById("modalTexto");
  const nomeInput = document.getElementById("nomeCliente");
  const telInput = document.getElementById("telefoneCliente");
  const btnConfirmar = document.getElementById("btnConfirmarModal");
  const btnCancelar = document.getElementById("btnCancelarModal");

  if (!modalConfirmacao) return;

  if (titulo) titulo.textContent = "Informe seus dados";
  if (texto) texto.innerHTML = "";

  if (nomeInput) { nomeInput.value = ""; nomeInput.disabled = false; }
  if (telInput) { telInput.value = ""; telInput.disabled = false; }

  if (btnConfirmar) { btnConfirmar.style.display = "block"; btnConfirmar.textContent = "Confirmar"; }
  if (btnCancelar) { btnCancelar.style.display = "block"; btnCancelar.textContent = "Cancelar"; }

  modalConfirmacao.removeAttribute("hidden");
  modalConfirmacao.classList.add("is-open");
  setTimeout(() => nomeInput && nomeInput.focus(), 50);
}

function fecharModalConfirmacao() {
  if (modalConfirmacao) {
    modalConfirmacao.classList.remove("is-open");
    modalConfirmacao.setAttribute("hidden", "");
  }

  const titulo = document.getElementById("modalTitulo");
  if (titulo) titulo.textContent = "Confirmar agendamento";

  const btnCancelar = document.getElementById("btnCancelarModal");
  if (btnCancelar) btnCancelar.textContent = "Cancelar";

  const nomeInput = document.getElementById("nomeCliente");
  const telInput = document.getElementById("telefoneCliente");
  if (nomeInput) nomeInput.removeAttribute("disabled");
  if (telInput) telInput.removeAttribute("disabled");

  agendamentoPendente = null;
}

async function confirmarAgendamentoDoModal() {
  if (!agendamentoPendente) return;

  const nomeInput = document.getElementById("nomeCliente");
  const telInput = document.getElementById("telefoneCliente");

  const nome = (nomeInput?.value || "").trim();
  if (!nome) {
    alert("Nome e obrigatorio.");
    nomeInput && nomeInput.focus();
    return;
  }

  const telefone = normalizarTelefoneBR(telInput?.value || "");
  if (!telefone) {
    alert("Telefone invalido. Digite com DDD (ex: 14 99999-8888).");
    telInput && telInput.focus();
    return;
  }

  const { dia, start, end, duracao, servico, dataBR, horaInicio } = agendamentoPendente;

  const startNum = Number(start);
  let endNum = Number(end);
  let durNum = Number(duracao);
  if (Number.isFinite(startNum) && Number.isFinite(durNum)) {
    endNum = startNum + durNum;
  }
  if (!Number.isFinite(durNum) && Number.isFinite(startNum) && Number.isFinite(endNum)) {
    durNum = endNum - startNum;
  }

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dia)) {
    alert("Data invalida.");
    return;
  }

  const selectedOpt = servicoSelect?.options[servicoSelect.selectedIndex];
  const serviceIdRaw = selectedOpt?.dataset?.serviceId || "";
  const serviceId = serviceIdRaw ? Number(serviceIdRaw) : null;

  const payload = {
    day: dia,
    start: startNum,
    end: endNum,
    client_name: nome,
    client_phone: telefone
  };
  if (Number.isFinite(serviceId)) payload.service_id = serviceId;

  try {
    const resp = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (resp.status === 409) {
        alert("Esse horario acabou de ficar indisponivel. Escolha outro.");
        gerarHorarios();
        return;
      }
      alert(json?.error || `Erro ao salvar o agendamento (HTTP ${resp.status}).`);
      return;
    }
  } catch (e) {
    console.error("Erro ao salvar booking:", e);
    alert("Nao foi possivel salvar o agendamento. Tente novamente.");
    return;
  }

  const titulo = document.getElementById("modalTitulo");
  const texto = document.getElementById("modalTexto");
  const btnConfirmar = document.getElementById("btnConfirmarModal");
  const btnCancelar = document.getElementById("btnCancelarModal");

  if (titulo) titulo.textContent = "Agendamento feito com sucesso";

  if (texto) {
    texto.innerHTML = `
      Esperamos voce em <strong>${dataBR}</strong> as <strong>${horaInicio}</strong>.<br>
      Servico: <strong>${servico}</strong><br><br>
      Aguarde a confirmacao pelo WhatsApp.
    `;
  }

  if (nomeInput) nomeInput.disabled = true;
  if (telInput) telInput.disabled = true;
  if (btnConfirmar) btnConfirmar.style.display = "none";

  if (btnCancelar) {
    btnCancelar.textContent = "OK";
    btnCancelar.onclick = () => fecharModalConfirmacao();
  }

  const msgSucesso = document.getElementById("msgSucesso");
  if (msgSucesso) {
    msgSucesso.style.display = "block";
    msgSucesso.innerHTML = `
      <strong>Agendamento feito com sucesso</strong><br>
      Esperamos voce em <strong>${dataBR}</strong> as <strong>${horaInicio}</strong>.<br>
      Servico: <strong>${servico}</strong><br>
      Aguarde a confirmacao pelo WhatsApp.
    `;
    msgSucesso.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  gerarHorarios();
  agendamentoPendente = null;
}

// ======== INICIALIZACAO ========
(async function init() {
  if (modalConfirmacao) modalConfirmacao.setAttribute("hidden", "");
  if (modalRemarcacao) modalRemarcacao.setAttribute("hidden", "");

  try {
    diasDescansoSemana = await carregarDiasDescansoCliente();
  } catch (e) {
    console.error("Erro ao carregar dias de descanso:", e);
    diasDescansoSemana = null;
  }

  if (dataInput) {
    const prox = proximaDataPermitidaLocal();
    dataInput.value = formatYYYYMMDDLocal(prox);
    selectedDia = dataInput.value;
    calendarioMesAtual = new Date(prox.getFullYear(), prox.getMonth(), 1);
    if (selectedDateLabel) selectedDateLabel.textContent = formatarDataResumida(selectedDia);
    renderCalendario();

    dataInput.addEventListener("change", () => {
      const dia = dataInput.value;
      if (!dia) {
        gerarHorarios();
        return;
      }

      const utc = parseYYYYMMDD(dia);
      if (!isDiaPermitidoUTC(utc)) {
        const prox2 = proximaDataPermitidaLocal();
        dataInput.value = formatYYYYMMDDLocal(prox2);
      }
      selectedDia = dataInput.value;
      calendarioMesAtual = new Date(
        Number(selectedDia.slice(0, 4)),
        Number(selectedDia.slice(5, 7)) - 1,
        1
      );
      renderCalendario();
      gerarHorarios();
    });
  }

  if (servicoSelect) {
    servicoSelect.addEventListener("change", () => {
      atualizarResumoServico();
      renderCalendario();
      gerarHorarios();
    });
  }

  if (btnBuscarBookings) {
    btnBuscarBookings.addEventListener("click", buscarMeusAgendamentos);
  }

  await renderSelectServicos();
  atualizarResumoServico();
  renderCalendario();
  gerarHorarios();
})();

if (btnPrevMonth) {
  btnPrevMonth.addEventListener("click", () => {
    calendarioMesAtual.setMonth(calendarioMesAtual.getMonth() - 1);
    calendarioMesAtual.setDate(1);
    renderCalendario();
  });
}

if (btnNextMonth) {
  btnNextMonth.addEventListener("click", () => {
    calendarioMesAtual.setMonth(calendarioMesAtual.getMonth() + 1);
    calendarioMesAtual.setDate(1);
    renderCalendario();
  });
}

// botoes do modal
 document.getElementById("btnConfirmarModal")?.addEventListener("click", confirmarAgendamentoDoModal);
 document.getElementById("btnCancelarModal")?.addEventListener("click", fecharModalConfirmacao);

// fechar modal clicando fora do card
 document.getElementById("modalConfirmacao")?.addEventListener("click", (e) => {
  if (e.target && e.target.id === "modalConfirmacao") fecharModalConfirmacao();
 });

if (btnReschedulePrev) {
  btnReschedulePrev.addEventListener("click", () => {
    rescheduleMonth.setMonth(rescheduleMonth.getMonth() - 1);
    rescheduleMonth.setDate(1);
    renderCalendarioRemarcacao();
  });
}

if (btnRescheduleNext) {
  btnRescheduleNext.addEventListener("click", () => {
    rescheduleMonth.setMonth(rescheduleMonth.getMonth() + 1);
    rescheduleMonth.setDate(1);
    renderCalendarioRemarcacao();
  });
}

if (btnSalvarRemarcacao) {
  btnSalvarRemarcacao.addEventListener("click", salvarRemarcacaoCliente);
}

if (btnCancelarRemarcacao) {
  btnCancelarRemarcacao.addEventListener("click", fecharModalRemarcacao);
}

if (modalRemarcacao) {
  modalRemarcacao.addEventListener("click", (e) => {
    if (e.target && e.target.id === "modalRemarcacao") fecharModalRemarcacao();
  });
}
