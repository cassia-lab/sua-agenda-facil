// ================== TITULO ==================
const adminTitulo = document.getElementById("adminTitulo");
const adminNomeBase = "Sua Agenda Facil";
adminTitulo.textContent = `Admin - ${adminNomeBase}`;
document.title = adminTitulo.textContent;

async function aplicarTituloStudioAdmin() {
  try {
    const resp = await fetch("/api/studio-info", { cache: "no-store" });
    if (!resp.ok) return;
    const json = await resp.json();
    const studioNome = String(json?.studioNome || "").trim();
    if (!studioNome) return;
    const titulo = `Admin - Sua Agenda Facil - ${studioNome}`;
    adminTitulo.textContent = titulo;
    document.title = titulo;
  } catch {
    // ignore
  }
}

aplicarTituloStudioAdmin();


const adminTokenStorageKey = "adminToken";

function getAdminToken() {
  return sessionStorage.getItem(adminTokenStorageKey) || "";
}

async function adminFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
    "x-admin-token": getAdminToken()
  };
  return fetch(url, { ...options, headers });
}

async function validarAdminToken(token) {
  const resp = await fetch("/api/admin/auth", {
    headers: { "x-admin-token": token }
  });
  return resp.ok;
}

// ================== UI ==================
const adminSenha = document.getElementById("adminSenha");
const btnEntrarAdmin = document.getElementById("btnEntrarAdmin");
const adminConteudo = document.getElementById("adminConteudo");

const dataAdmin = document.getElementById("dataAdmin");
const dataHorario = document.getElementById("dataHorario");
const diaFechadoSelect = document.getElementById("diaFechado");
const inicioAtendimentoInput = document.getElementById("inicioAtendimento");
const fimAtendimentoInput = document.getElementById("fimAtendimento");
const inicioAlmocoInput = document.getElementById("inicioAlmoco");
const fimAlmocoInput = document.getElementById("fimAlmoco");
const defaultInicioAtendimento = document.getElementById("defaultInicioAtendimento");
const defaultFimAtendimento = document.getElementById("defaultFimAtendimento");
const defaultInicioAlmoco = document.getElementById("defaultInicioAlmoco");
const defaultFimAlmoco = document.getElementById("defaultFimAlmoco");
const btnSalvarConfig = document.getElementById("btnSalvarConfig");
const btnSalvarPadraoCompleto = document.getElementById("btnSalvarPadraoCompleto");
const listaFechadosForaPadrao = document.getElementById("listaFechadosForaPadrao");
const modalRemarcar = document.getElementById("modalRemarcar");
const remarcarInfo = document.getElementById("remarcarInfo");
const remarcarCalendario = document.getElementById("remarcarCalendario");
const remarcarHorarios = document.getElementById("remarcarHorarios");
const remarcarSelecionado = document.getElementById("remarcarSelecionado");
const btnConfirmarRemarcar = document.getElementById("btnConfirmarRemarcar");
const btnApagarRemarcar = document.getElementById("btnApagarRemarcar");
const btnCancelarRemarcar = document.getElementById("btnCancelarRemarcar");

const btnLimparAgendamentos = document.getElementById("btnLimparAgendamentos");
const btnVerAgendamentos = document.getElementById("btnVerAgendamentos");
const painelAgendamentos = document.getElementById("painelAgendamentos");
const listaAgendamentos = document.getElementById("listaAgendamentos");

const novoServicoNome = document.getElementById("novoServicoNome");
const novoServicoDuracao = document.getElementById("novoServicoDuracao");
const btnAdicionarServico = document.getElementById("btnAdicionarServico");
const listaServicos = document.getElementById("listaServicos");
const btnToggleHorarios = document.getElementById("btnToggleHorarios");
const btnToggleServicos = document.getElementById("btnToggleServicos");
const btnTogglePadrao = document.getElementById("btnTogglePadrao");
const btnToggleExcecoes = document.getElementById("btnToggleExcecoes");
const btnToggleInfoStudio = document.getElementById("btnToggleInfoStudio");
const secHorarios = document.getElementById("secHorarios");
const secPadrao = document.getElementById("secPadrao");
const secExcecoes = document.getElementById("secExcecoes");
const secInfoStudio = document.getElementById("secInfoStudio");
const secServicos = document.getElementById("secServicos");
const dataAdminInput = document.getElementById("dataAdmin");
const semanaDescanso = document.getElementById("semanaDescanso");
const btnMesPrev = document.getElementById("btnMesPrev");
const btnMesNext = document.getElementById("btnMesNext");
const labelMesAtual = document.getElementById("labelMesAtual");
const calendarioGrid = document.getElementById("calendarioGrid");
const agendaMensal = document.getElementById("agendaMensal");
const agendaDetalheTitulo = document.getElementById("agendaDetalheTitulo");
const agendaDetalheLista = document.getElementById("agendaDetalheLista");
const agendaDetalhePopover = document.getElementById("agendaDetalhePopover");
const agendaDetalheFechar = document.getElementById("agendaDetalheFechar");
const listaPagamentosPendentes = document.getElementById("listaPagamentosPendentes");
const painelLembretes = document.getElementById("painelLembretes");
const listaLembretes7d = document.getElementById("listaLembretes7d");
const listaLembretes24h = document.getElementById("listaLembretes24h");
const btnToggleLembretes7d = document.getElementById("btnToggleLembretes7d");
const btnToggleLembretes24h = document.getElementById("btnToggleLembretes24h");
const painelLembretes7d = document.getElementById("painelLembretes7d");
const painelLembretes24h = document.getElementById("painelLembretes24h");
const studioNomeInput = document.getElementById("studioNome");
const studioEnderecoInput = document.getElementById("studioEndereco");
const studioPixChaveInput = document.getElementById("studioPixChave");
const btnSalvarInfoStudio = document.getElementById("btnSalvarInfoStudio");
const btnTogglePagamentos = document.getElementById("btnTogglePagamentos");
const painelPagamentos = document.getElementById("painelPagamentos");
const btnToggleLembretes = document.getElementById("btnToggleLembretes");



let adminAutoRefreshId = null;
const adminCache = {
  pagamentos: { ts: 0, ttl: 60000 },
  lembretes7d: { ts: 0, ttl: 60000 },
  lembretes24h: { ts: 0, ttl: 60000 },
  calendario: { ts: 0, ttl: 120000 }
};

function cacheFresh(entry) {
  return Date.now() - entry.ts < entry.ttl;
}

function isVisible(el) {
  return !!el && el.style.display === "block";
}

function iniciarAutoRefreshAdmin() {
  if (adminAutoRefreshId) return;
  adminAutoRefreshId = setInterval(async () => {
    if (!adminConteudo || adminConteudo.style.display !== "block") return;
    const dia = dataAdmin?.value;
    if (dia) {
      await renderMapaDoDia(dia);
      if (typeof renderAgendamentos === "function") {
        await renderAgendamentos(dia);
      }
    }
    await refreshCalendario();
    if (isVisible(painelPagamentos)) {
      await carregarPagamentosPendentes();
    }
    if (isVisible(painelLembretes)) {
      if (isVisible(painelLembretes7d)) {
        await carregarLembretesTipo("7d");
      }
      if (isVisible(painelLembretes24h)) {
        await carregarLembretesTipo("24h");
      }
    }
  }, 60000);
}
async function refreshCalendario() {
  if (!isVisible(painelAgendamentos)) return;
  if (cacheFresh(adminCache.calendario)) return;
  if (typeof calendarioCache !== "undefined" && calendarioCache) {
    calendarioCache.clear();
  }
  await renderCalendarioMes();
  adminCache.calendario.ts = Date.now();
}function toggleSection(el) {
  if (!el) return;
  const isHidden = (el.style.display === "none" || el.style.display === "");
  el.style.display = isHidden ? "block" : "none";
}

if (btnToggleHorarios) btnToggleHorarios.addEventListener("click", () => toggleSection(secHorarios));
if (btnTogglePadrao) btnTogglePadrao.addEventListener("click", () => toggleSection(secPadrao));
if (btnToggleExcecoes) btnToggleExcecoes.addEventListener("click", () => toggleSection(secExcecoes));
if (btnToggleInfoStudio) btnToggleInfoStudio.addEventListener("click", () => toggleSection(secInfoStudio));
if (btnToggleServicos) btnToggleServicos.addEventListener("click", () => toggleSection(secServicos));
if (btnTogglePagamentos) btnTogglePagamentos.addEventListener("click", async () => {
  const wasHidden = painelPagamentos && (painelPagamentos.style.display === "none" || painelPagamentos.style.display === "");
  toggleSection(painelPagamentos);
  if (wasHidden) await carregarPagamentosPendentes({ force: true });
});
if (btnToggleLembretes) btnToggleLembretes.addEventListener("click", () => toggleSection(painelLembretes));
if (btnToggleLembretes7d) btnToggleLembretes7d.addEventListener("click", async () => {
  const wasHidden = painelLembretes7d && (painelLembretes7d.style.display === "none" || painelLembretes7d.style.display === "");
  toggleSection(painelLembretes7d);
  if (wasHidden) await carregarLembretesTipo("7d", { force: true });
});
if (btnToggleLembretes24h) btnToggleLembretes24h.addEventListener("click", async () => {
  const wasHidden = painelLembretes24h && (painelLembretes24h.style.display === "none" || painelLembretes24h.style.display === "");
  toggleSection(painelLembretes24h);
  if (wasHidden) await carregarLembretesTipo("24h", { force: true });
});
if (btnVerAgendamentos) btnVerAgendamentos.addEventListener("click", async () => {
  const aberto = painelAgendamentos && painelAgendamentos.style.display === "block";
  if (painelAgendamentos) painelAgendamentos.style.display = aberto ? "none" : "block";
  if (!aberto) {
    adminCache.calendario.ts = 0;
    await renderCalendarioMes();
  }
});


// ================== PADRÕES ==================
const padrao = {
  diaInicio: 8 * 60,
  diaFim: 17 * 60,
  almocoInicio: 12 * 60,
  almocoFim: 13 * 60
};

const studioInfo = {
  studioNome: "",
  studioEndereco: "",
  pixChave: ""
};

// ================== API OPS ==================

async function carregarHorarioPadrao() {
  if (!defaultInicioAtendimento || !defaultFimAtendimento || !defaultInicioAlmoco || !defaultFimAlmoco) return;
  try {
    const resp = await adminFetch("/api/default-settings", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const cfg = json?.config || {};
    defaultInicioAtendimento.value = minutosParaHHMM(Number(cfg.diaInicio ?? 480));
    defaultFimAtendimento.value = minutosParaHHMM(Number(cfg.diaFim ?? 1020));
    defaultInicioAlmoco.value = minutosParaHHMM(Number(cfg.almocoInicio ?? 720));
    defaultFimAlmoco.value = minutosParaHHMM(Number(cfg.almocoFim ?? 780));
    studioInfo.studioNome = String(cfg.studioNome || "");
    studioInfo.studioEndereco = String(cfg.studioEndereco || "");
    studioInfo.pixChave = String(cfg.pixChave || "");
  } catch (e) {
    console.error("Erro ao carregar horario padrao:", e);
  }
}

async function carregarInfoStudio() {
  if (!studioNomeInput || !studioEnderecoInput || !studioPixChaveInput) return;
  try {
    const resp = await adminFetch("/api/default-settings", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const cfg = json?.config || {};
    studioNomeInput.value = String(cfg.studioNome || "");
    studioEnderecoInput.value = String(cfg.studioEndereco || "");
    studioPixChaveInput.value = String(cfg.pixChave || "");
    studioInfo.studioNome = String(cfg.studioNome || "");
    studioInfo.studioEndereco = String(cfg.studioEndereco || "");
    studioInfo.pixChave = String(cfg.pixChave || "");
  } catch (e) {
    console.error("Erro ao carregar informacoes do studio:", e);
  }
}

async function salvarInfoStudio() {
  if (!studioNomeInput || !studioEnderecoInput || !studioPixChaveInput) return;
  const nome = studioNomeInput.value.trim();
  const endereco = studioEnderecoInput.value.trim();
  const pixChave = studioPixChaveInput.value.trim();

  const ini = hhmmParaMinutos(defaultInicioAtendimento?.value || "08:00");
  const fim = hhmmParaMinutos(defaultFimAtendimento?.value || "17:00");
  const almIni = hhmmParaMinutos(defaultInicioAlmoco?.value || "12:00");
  const almFim = hhmmParaMinutos(defaultFimAlmoco?.value || "13:00");

  try {
    const resp = await adminFetch("/api/default-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diaInicio: ini,
        diaFim: fim,
        almocoInicio: almIni,
        almocoFim: almFim,
        studioNome: nome,
        studioEndereco: endereco,
        pixChave
      })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
  } catch (e) {
    console.error("Erro ao salvar informacoes do studio:", e);
    alert("Nao foi possivel salvar as informacoes.");
    return;
  }

  studioInfo.studioNome = nome;
  studioInfo.studioEndereco = endereco;
  studioInfo.pixChave = pixChave;
  alert("Informacoes salvas.");
}

async function salvarHorarioPadrao(silent = false) {
  if (!defaultInicioAtendimento || !defaultFimAtendimento || !defaultInicioAlmoco || !defaultFimAlmoco) return false;
  const ini = hhmmParaMinutos(defaultInicioAtendimento.value);
  const fim = hhmmParaMinutos(defaultFimAtendimento.value);
  const almIni = hhmmParaMinutos(defaultInicioAlmoco.value);
  const almFim = hhmmParaMinutos(defaultFimAlmoco.value);

  if (ini == null || fim == null || almIni == null || almFim == null) {
    if (!silent) alert("Preencha todos os horarios padrao.");
    return false;
  }
  if (ini >= fim) {
    if (!silent) alert("Inicio precisa ser antes do fim.");
    return false;
  }
  if (almIni > almFim) {
    if (!silent) alert("Almoco invalido (ou coloque igual para desativar).");
    return false;
  }

  try {
    const resp = await adminFetch("/api/default-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diaInicio: ini,
        diaFim: fim,
        almocoInicio: almIni,
        almocoFim: almFim
      })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
  } catch (e) {
    console.error("Erro ao salvar horario padrao:", e);
    if (!silent) alert("Nao foi possivel salvar o horario padrao.");
    return false;
  }

  if (!silent) alert("Horario padrao salvo.");
  return true;
}
async function salvarPadraoCompleto() {
  const okDias = await salvarDiasDescanso(true);
  const okHorario = await salvarHorarioPadrao(true);
  if (!okDias || !okHorario) return;
  alert("Funcionamento padrao salvo.");
  if (typeof calendarioCache !== "undefined" && calendarioCache) {
    calendarioCache.clear();
  }
  if (painelAgendamentos && painelAgendamentos.style.display === "block") {
    await renderCalendarioMes();
  }
}
async function carregarAgendamentosDoDia(dia) {
  const resp = await fetch(`/api/bookings?date=${encodeURIComponent(dia)}`, {
    cache: "no-store"
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const bookings = Array.isArray(json?.bookings) ? json.bookings : [];

  return bookings.map((b) => ({
    id: b?.id ?? null,
    start: Number(b?.start_min ?? b?.start),
    end: Number(b?.end_min ?? b?.end),
    nome: b?.client_name ?? b?.nome ?? b?.name ?? null,
    telefone: b?.client_phone ?? b?.telefone ?? b?.phone ?? null,
    servico: b?.service_name ?? b?.servico ?? b?.service ?? null,
    paid: Boolean(b?.paid),
    status: b?.status ?? null,
    service_id: b?.service_id ?? null
  })).filter(b => Number.isFinite(b.start) && Number.isFinite(b.end));
}

function normalizarTelefone(raw) {
  const tel = String(raw || "").replace(/\D/g, "");
  if (!tel) return "";
  return tel.startsWith("55") ? tel : `55${tel}`;
}

function montarLinkWhatsapp(telefone, texto) {
  const tel = normalizarTelefone(telefone);
  if (!tel) return "";
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

function formatarDataHora(ag) {
  const dia = ag?.day || "";
  const inicio = Number(ag?.start_min ?? ag?.start);
  const hora = Number.isFinite(inicio) ? minutosParaHHMM(inicio) : "--:--";
  return `${dataParaBR(dia)} ${hora}`;
}

function nomeServico(ag) {
  return ag?.service_name || ag?.servico || ag?.service || "Servico";
}

async function carregarLembretes() {
  await carregarLembretesTipo("7d", { force: true });
  await carregarLembretesTipo("24h", { force: true });
}

async function carregarLembretesTipo(tipo, opts = {}) {
  const alvo = tipo === "7d" ? listaLembretes7d : listaLembretes24h;
  if (!alvo) return;
  const cacheEntry = tipo === "7d" ? adminCache.lembretes7d : adminCache.lembretes24h;
  if (!opts.force && cacheFresh(cacheEntry)) return;
  alvo.textContent = "Carregando...";

  let lista = [];
  try {
    const resp = await adminFetch(`/api/bookings/reminders?type=${encodeURIComponent(tipo)}`, {
      cache: "no-store"
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    lista = Array.isArray(json?.bookings) ? json.bookings : [];
  } catch (e) {
    console.error("Erro ao carregar lembretes:", e);
    alvo.textContent = "Erro ao carregar lembretes.";
    return;
  }

  if (!lista.length) {
    alvo.textContent = "Sem lembretes pendentes.";
    cacheEntry.ts = Date.now();
    return;
  }

  const agrupado = {};
  lista.forEach((ag) => {
    const dia = ag?.day || "";
    if (!dia) return;
    if (!agrupado[dia]) agrupado[dia] = [];
    agrupado[dia].push(ag);
  });

  const dias = Object.keys(agrupado).sort();
  alvo.innerHTML = "";

  dias.forEach((dia) => {
    const header = document.createElement("div");
    header.style.fontWeight = "700";
    header.style.margin = "8px 0 4px";
    header.textContent = dataParaBR(dia);
    alvo.appendChild(header);

    agrupado[dia].forEach((ag) => {
      const linha = document.createElement("div");
      linha.style.display = "flex";
      linha.style.justifyContent = "space-between";
      linha.style.alignItems = "center";
      linha.style.gap = "10px";
      linha.style.borderBottom = "1px solid #eee";
      linha.style.padding = "8px 0";

      const info = document.createElement("div");
      info.style.display = "flex";
      info.style.flexDirection = "column";
      info.style.gap = "2px";
      const pagoCor = ag?.paid ? "#22c55e" : "#ef4444";
      info.innerHTML = `<strong style="display:inline-flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:999px;background:${pagoCor};display:inline-block;"></span>
          ${ag?.client_name || "Cliente"}
        </strong>
        <span>${formatarDataHora(ag)} — ${nomeServico(ag)}</span>`;

      const acoes = document.createElement("div");
      acoes.style.display = "flex";
      acoes.style.gap = "6px";

      const btnWpp = document.createElement("button");
      btnWpp.type = "button";
      btnWpp.textContent = "WhatsApp";
      btnWpp.style.width = "auto";
      btnWpp.style.padding = "6px 10px";
      btnWpp.onclick = async () => {
        const dataTxt = dataParaBR(ag?.day);
        const horaTxt = minutosParaHHMM(Number(ag?.start_min));
        const serv = nomeServico(ag);
        const texto = tipo === "7d"
          ? `Oi, ${ag?.client_name || "Cliente"}!\nPassando pra lembrar do seu horario na proxima semana:\n✅ ${dataTxt} as ${horaTxt}\n${serv}.\n\nQualquer ajuste, so ir em reagendar.`
          : `Oi, ${ag?.client_name || "Cliente"}! Lembrete do seu horario amanha ✅ ${dataTxt} as ${horaTxt} — ${serv}. Se precisar ajustar, me chama por aqui.`;
        const link = montarLinkWhatsapp(ag?.client_phone, texto);
        if (!link) {
          alert("Telefone invalido.");
          return;
        }
        window.open(link, "_blank");
        try {
          const resp = await adminFetch("/api/bookings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: tipo === "7d" ? "mark_reminder_7d" : "mark_reminder_24h",
              id: ag?.id
            })
          });
          const json = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
        } catch (e) {
          console.error("Erro ao marcar lembrete:", e);
        }
        linha.style.background = "#dcfce7";
        linha.style.borderRadius = "10px";
        linha.style.padding = "10px";
        cacheEntry.ts = 0;
      };

      acoes.appendChild(btnWpp);
      linha.appendChild(info);
      linha.appendChild(acoes);
      alvo.appendChild(linha);
    });
  });
  cacheEntry.ts = Date.now();
}

async function carregarPagamentosPendentes(opts = {}) {
  if (!listaPagamentosPendentes) return;
  if (!opts.force && cacheFresh(adminCache.pagamentos)) return;
  listaPagamentosPendentes.textContent = "Carregando...";

  let lista = [];
  try {
    const resp = await adminFetch("/api/bookings/pending-payments", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    lista = Array.isArray(json?.bookings) ? json.bookings : [];
  } catch (e) {
    console.error("Erro ao carregar pagamentos pendentes:", e);
    listaPagamentosPendentes.textContent = "Erro ao carregar pagamentos.";
    return;
  }

  if (!lista.length) {
    listaPagamentosPendentes.textContent = "Sem pagamentos pendentes.";
    adminCache.pagamentos.ts = Date.now();
    return;
  }

  listaPagamentosPendentes.innerHTML = "";
  lista.forEach((ag) => {
    const linha = document.createElement("div");
    linha.style.display = "flex";
    linha.style.justifyContent = "space-between";
    linha.style.alignItems = "center";
    linha.style.gap = "10px";
    linha.style.borderBottom = "1px solid #eee";
    linha.style.padding = "8px 0";

    const info = document.createElement("div");
    info.style.display = "flex";
    info.style.flexDirection = "column";
    info.style.gap = "2px";
    info.innerHTML = `<strong>${ag?.client_name || "Cliente"}</strong>
      <span>${formatarDataHora(ag)} — ${nomeServico(ag)}</span>`;

    if (ag?.pix_sent_at) {
      linha.style.background = "#dcfce7";
      linha.style.borderRadius = "10px";
      linha.style.padding = "10px";
    }

    const acoes = document.createElement("div");
    acoes.style.display = "flex";
    acoes.style.gap = "6px";

    const btnCobrar = document.createElement("button");
    btnCobrar.type = "button";
    btnCobrar.textContent = "PIX";
    btnCobrar.style.width = "auto";
    btnCobrar.style.padding = "6px 10px";
    btnCobrar.onclick = async () => {
      const chavePix = studioInfo.pixChave || "CHAVE_PIX_AQUI";
      const texto = `Oi, ${ag?.client_name || "Cliente"}!\n\nPara confirmar seu horario em ${dataParaBR(ag?.day)} as ${minutosParaHHMM(Number(ag?.start_min))}, preciso do pagamento mediante o PIX no valor de R$ 15,00.\nPIX: ${chavePix}\n\nAssim que realizar, por favor me avise por aqui ou enviar o comprovante.\n\nObrigada,\nGe :)`;
      const link = montarLinkWhatsapp(ag?.client_phone, texto);
      if (!link) {
        alert("Telefone invalido.");
        return;
      }
      window.open(link, "_blank");
      try {
        const resp = await adminFetch("/api/bookings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "mark_pix_sent",
            id: ag?.id
          })
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
      } catch (e) {
        console.error("Erro ao marcar PIX enviado:", e);
      }
      await carregarPagamentosPendentes({ force: true });
    };

    const btnPago = document.createElement("button");
    btnPago.type = "button";
    btnPago.textContent = "Pago";
    btnPago.style.width = "auto";
    btnPago.style.padding = "6px 10px";
    btnPago.onclick = async () => {
      try {
        const resp = await adminFetch("/api/bookings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "toggle_paid",
            id: ag?.id,
            paid: true
          })
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
      } catch (e) {
        console.error("Erro ao marcar como pago:", e);
        alert("Nao foi possivel marcar como pago.");
        return;
      }
      await carregarPagamentosPendentes({ force: true });
    };

    acoes.appendChild(btnCobrar);
    acoes.appendChild(btnPago);

    linha.appendChild(info);
    linha.appendChild(acoes);
    listaPagamentosPendentes.appendChild(linha);
  });
  adminCache.pagamentos.ts = Date.now();
}


async function carregarConfigDoDia(dia) {
  async function carregarDiasFechadosSemana() {
    if (carregarConfigDoDia._weeklyClosed) return carregarConfigDoDia._weeklyClosed;
    const resp = await fetch("/api/weekly-closed", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const days = Array.isArray(json?.days) ? json.days : [];
    const set = new Set(days.map((d) => Number(d)));
    carregarConfigDoDia._weeklyClosed = set;
    return set;
  }

  const resp = await fetch(`/api/day-settings?date=${encodeURIComponent(dia)}`, {
    cache: "no-store"
  });
  if (resp.status === 404) {
    try {
      const weeklyClosed = await carregarDiasFechadosSemana();
      const weekday = new Date(`${dia}T00:00:00`).getDay();
      if (weeklyClosed.has(weekday)) {
        return {
          fechado: true,
          diaInicio: padrao.diaInicio,
          diaFim: padrao.diaFim,
          almocoInicio: padrao.almocoInicio,
          almocoFim: padrao.almocoFim
        };
      }
    } catch {
      // ignore weekly closed errors
    }
    return {
      fechado: false,
      diaInicio: padrao.diaInicio,
      diaFim: padrao.diaFim,
      almocoInicio: padrao.almocoInicio,
      almocoFim: padrao.almocoFim
    };
  }
  if (!resp.ok) {
    console.error("Erro carregando config do dia:", resp.status);
    return {
      fechado: false,
      diaInicio: padrao.diaInicio,
      diaFim: padrao.diaFim,
      almocoInicio: padrao.almocoInicio,
      almocoFim: padrao.almocoFim
    };
  }
  const json = await resp.json().catch(() => ({}));
  if (!json?.config) {
    try {
      const weeklyClosed = await carregarDiasFechadosSemana();
      const weekday = new Date(`${dia}T00:00:00`).getDay();
      if (weeklyClosed.has(weekday)) {
        return {
          fechado: true,
          diaInicio: padrao.diaInicio,
          diaFim: padrao.diaFim,
          almocoInicio: padrao.almocoInicio,
          almocoFim: padrao.almocoFim
        };
      }
    } catch {
      // ignore weekly closed errors
    }
    return {
      fechado: false,
      diaInicio: padrao.diaInicio,
      diaFim: padrao.diaFim,
      almocoInicio: padrao.almocoInicio,
      almocoFim: padrao.almocoFim
    };
  }
  return json.config;
}
async function salvarConfigDoDia(dia, cfg) {
  const payload = {
    day: dia,
    fechado: Boolean(cfg.fechado),
    diaInicio: Number(cfg.diaInicio),
    diaFim: Number(cfg.diaFim),
    almocoInicio: Number(cfg.almocoInicio),
    almocoFim: Number(cfg.almocoFim)
  };

    let resp = await adminFetch("/api/day-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (resp.status === 409) {
    resp = await adminFetch("/api/day-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  if (!resp.ok) {
    let msg = "Erro ao salvar configuracao.";
    try {
      const json = await resp.json();
      msg = json?.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return resp.json();
}
async function renderMapaDoDia(dia) {
  const el = document.getElementById("mapaDia");
  if (!el) return;

  const compacto = document.getElementById("chkMapaCompacto")?.checked ?? true;

  // helper local (evita depender de minutosParaHHMM)
  function hhmm(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  el.innerHTML = "";

  if (!dia) {
    el.innerHTML = "<p>Selecione uma data.</p>";
    return;
  }

  let config;
  try {
    config = await carregarConfigDoDia(dia);
  } catch (e) {
    console.error("Erro buscando config:", e);
    el.innerHTML = "<p>Erro ao carregar configuracao do dia.</p>";
    return;
  }

  let agendamentos = [];
  try {
    agendamentos = await carregarAgendamentosDoDia(dia);
  } catch (e) {
    console.error("Erro buscando agendamentos:", e);
    el.innerHTML = "<p>Erro ao carregar agendamentos do dia.</p>";
    return;
  }

  if (config.fechado) {
    el.innerHTML = `<div style="padding:10px;border-radius:12px;background:#fff;">
      Dia fechado (sem atendimento).
    </div>`;
    return;
  }

  const inicio = Number(config.diaInicio);
  const fim = Number(config.diaFim);
  const almocoIni = Number(config.almocoInicio);
  const almocoFim = Number(config.almocoFim);

  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) {
    el.innerHTML = `<div style="padding:10px;border-radius:12px;background:#fff;">
      Configuração inválida para esse dia. Abra “Configurar horários” e salve.
    </div>`;
    return;
  }

  const passo = 30;

  // monta slots
  const slots = [];
  for (let t = inicio; t < fim; t += passo) {
    const emAlmoco =
      Number.isFinite(almocoIni) && Number.isFinite(almocoFim) &&
      t >= almocoIni && t < almocoFim;

    if (emAlmoco) {
      slots.push({ start: t, end: t + passo, tipo: "almoco" });
      continue;
    }

    const ag = agendamentos.find(a => t >= a.start && t < a.end);
    if (ag) {
      slots.push({ start: t, end: t + passo, tipo: "ocupado", ag });
    } else {
      slots.push({ start: t, end: t + passo, tipo: "livre" });
    }
  }

  // agrupa (compacto)
  function agruparSlots(lista) {
    if (!lista.length) return [];
    const out = [];
    let atual = { ...lista[0] };

    for (let i = 1; i < lista.length; i++) {
      const s = lista[i];

      const mesmoTipo = s.tipo === atual.tipo;

      // se ocupado: só agrupa se for o MESMO agendamento (mesma referência)
      const mesmoAg = (s.tipo !== "ocupado") || (s.ag === atual.ag);

      if (mesmoTipo && mesmoAg && s.start === atual.end) {
        atual.end = s.end;
      } else {
        out.push(atual);
        atual = { ...s };
      }
    }
    out.push(atual);
    return out;
  }

  const listaParaRender = compacto ? agruparSlots(slots) : slots;


function badge(texto) {
  return `<span style="
    display:inline-block;
    padding:4px 8px;
    border-radius:999px;
    font-size:12px;
    background:#f1f5f9;
    color:#334155;
  ">${texto}</span>`;
}


  // render
  listaParaRender.forEach((s) => {
    const card = document.createElement("div");
    card.style.display = "flex";
    card.style.justifyContent = "space-between";
    card.style.alignItems = "center";
    card.style.gap = "12px";
    card.style.padding = "9px 10px";
    card.style.borderRadius = "14px";
    card.style.margin = "6px 0";
    card.style.border = "1px solid rgba(0,0,0,0.06)";
    card.style.background =
      s.tipo === "ocupado" ? "#ffecec" :
      s.tipo === "livre"   ? "#eafff0" : "#fff";

    const esquerda = document.createElement("div");
    esquerda.style.fontWeight = "700";
    esquerda.textContent = `${hhmm(s.start)} - ${hhmm(s.end)}`;

    const direita = document.createElement("div");
    direita.style.textAlign = "right";

    if (s.tipo === "livre") {
  direita.innerHTML = badge("Livre");
}

if (s.tipo === "almoco") {
  direita.innerHTML = `<span style="
    display:inline-block;
    padding:4px 8px;
    border-radius:999px;
    font-size:12px;
    background:#f8fafc;
    color:#64748b;
  ">Almoço</span>`;
}


    if (s.tipo === "ocupado") {
      const ag = s.ag || {};
      const serv = ag.servico || "Serviço";
      const nome = ag.nome || "Sem nome";
      const precoTxt = (ag.preco != null && String(ag.preco).trim() !== "")
        ? ` — ${String(ag.preco).startsWith("R$") ? ag.preco : `R$ ${ag.preco}`}`
        : "";

      const linha = document.createElement("div");
      linha.style.display = "grid";
      linha.style.gridTemplateColumns = "1fr auto";
      linha.style.alignItems = "center";
      linha.style.gap = "10px";
      linha.style.width = "100%";

      const info = document.createElement("div");
      info.style.display = "flex";
      info.style.flexDirection = "column";
      info.style.gap = "2px";
      info.style.flex = "1";
      info.style.textAlign = "center";
      info.style.alignItems = "center";

      const titulo = document.createElement("div");
      titulo.style.fontSize = "13px";
      titulo.style.fontWeight = "600";
      titulo.textContent = `${serv}${precoTxt}`;

      const sub = document.createElement("div");
      sub.style.fontSize = "12px";
      sub.style.color = "#333";
      sub.textContent = `${nome}`;

      info.appendChild(titulo);
      info.appendChild(sub);

      const acoes = document.createElement("div");
      acoes.style.display = "flex";
      acoes.style.gap = "6px";
      acoes.style.alignItems = "center";

      function criarIcone(label, svg, ativo) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-label", label);
        btn.title = label;
        btn.innerHTML = svg;
        btn.style.width = "30px";
        btn.style.height = "30px";
        btn.style.borderRadius = "8px";
        btn.style.border = "1px solid #e5e7eb";
        btn.style.background = ativo ? "#22c55e" : "#fff";
        btn.style.color = ativo ? "#fff" : "#6b7280";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.padding = "0";
        return btn;
      }

      const iconRemarcar = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"1 4 1 10 7 10\"/><path d=\"M3.51 15a9 9 0 1 0 .49-5\"/></svg>";
      const iconWpp = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 11.5a8.5 8.5 0 1 1-4.7-7.6\"/><path d=\"M8.5 9.5c1 2.5 3 4.5 5.5 5.5\"/><path d=\"M15 15l2.5-.5\"/></svg>";
      const iconPago = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.84 4.61a5.5 5.5 0 0 1 0 7.78L7.5 19.73 3 21l1.27-4.5L16.61 4.61a5.5 5.5 0 0 1 7.78 0Z\"/></svg>";
      const iconPagoOn = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9 12l2 2 4-4\"/></svg>";

      const btnRemarcar = criarIcone("Remarcar", iconRemarcar, false);
      btnRemarcar.style.borderColor = "#93c5fd";
      btnRemarcar.style.color = "#2563eb";
      btnRemarcar.onclick = () => abrirModalRemarcar(ag, dia);

      const btnWpp = criarIcone("WhatsApp", iconWpp, false);
      btnWpp.style.borderColor = "#86efac";
      btnWpp.style.color = "#16a34a";
      btnWpp.onclick = () => {
        let telefone = String(ag.telefone || "").replace(/\D/g, "");
        if (!telefone) {
          alert("Sem telefone no agendamento.");
          return;
        }
        if (!telefone.startsWith("55")) telefone = "55" + telefone;
        const nomeCliente = ag.nome || "Cliente";
        const msg = `Ola ${nomeCliente}, tudo bem?`;
        window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`, "_blank");
      };

      const pagoAtivo = Boolean(ag.paid);
      const btnPago = criarIcone("Pago", pagoAtivo ? iconPagoOn : iconPago, pagoAtivo);
      btnPago.onclick = async () => {
        try {
          const resp = await adminFetch("/api/bookings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "toggle_paid",
              id: ag.id,
              paid: !pagoAtivo
            })
          });
          const json = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            alert(json?.error || `Erro ao atualizar pagamento (HTTP ${resp.status}).`);
            return;
          }
        } catch (e) {
          console.error("Erro ao atualizar pagamento:", e);
          alert("Nao foi possivel atualizar o pagamento.");
          return;
        }

        await renderMapaDoDia(dia);
        await carregarPagamentosPendentes();
        await carregarLembretes();
      };

      acoes.appendChild(btnRemarcar);
      acoes.appendChild(btnWpp);
      acoes.appendChild(btnPago);

      linha.appendChild(info);
      linha.appendChild(acoes);

      direita.style.textAlign = "left";
      direita.style.flex = "1";
      direita.style.display = "flex";
      direita.appendChild(linha);
    }

    card.appendChild(esquerda);
    card.appendChild(direita);
    el.appendChild(card);
  });
}

function agruparSlots(slots) {
  const blocos = [];
  for (const s of slots) {
    const ultimo = blocos[blocos.length - 1];

    const mesmoTipo = ultimo && ultimo.tipo === s.tipo && ultimo.label === s.label;
    const encosta = ultimo && ultimo.end === s.start;

    if (mesmoTipo && encosta) {
      ultimo.end = s.end;
    } else {
      blocos.push({ ...s });
    }
  }
  return blocos;
}
function hhmm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function obterDuracaoAgendamento(ag, servicosMap) {
  const id = Number(ag?.service_id);
  const durServ = servicosMap?.get(id)?.duration_minutes;
  const durNum = Number(durServ);
  if (Number.isFinite(durNum) && durNum > 0) return durNum;

  const fallback = Number(ag?.end) - Number(ag?.start);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;

  return 30;
}

async function obterServicosMap() {
  if (servicosCache) return servicosCache;
  let servicos = [];
  try {
    servicos = await carregarServicosAPI();
  } catch (e) {
    console.error("Erro carregando servicos para remarcar:", e);
  }
  const map = new Map();
  servicos.forEach((s) => {
    if (s?.id != null) map.set(Number(s.id), s);
  });
  servicosCache = map;
  return map;
}

async function renderRemarcarCalendario() {
  if (!remarcarCalendario) return;

  const ano = remarcarMesAtual.getFullYear();
  const mes = remarcarMesAtual.getMonth();

  remarcarCalendario.innerHTML = "";

  let resumo = [];
  try {
    const servicosMap = await obterServicosMap();
    const duracao = obterDuracaoAgendamento(remarcarAgendamento, servicosMap);
    resumo = await carregarResumoMes(ano, mes + 1, duracao);
  } catch (e) {
    console.error("Erro carregando resumo do remarcar:", e);
  }

  const mapa = {};
  resumo.forEach((r) => {
    if (r?.day) mapa[r.day] = r;
  });

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "10px";
  header.style.marginBottom = "8px";

  const btnPrev = document.createElement("button");
  btnPrev.type = "button";
  btnPrev.innerHTML = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"15 18 9 12 15 6\"/></svg>";
  btnPrev.style.width = "32px";
  btnPrev.style.height = "32px";
  btnPrev.style.borderRadius = "999px";
  btnPrev.style.border = "1px solid #e5e7eb";
  btnPrev.style.background = "#fff";
  btnPrev.style.fontSize = "20px";
  btnPrev.style.fontWeight = "700";
  btnPrev.style.color = "#111827";
  btnPrev.style.lineHeight = "1";
  btnPrev.onclick = () => {
    remarcarMesAtual = new Date(ano, mes - 1, 1);
    renderRemarcarCalendario();
  };

  const titulo = document.createElement("strong");
  titulo.textContent = `${nomeMes(mes)} ${ano}`;

  const btnNext = document.createElement("button");
  btnNext.type = "button";
  btnNext.innerHTML = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"9 18 15 12 9 6\"/></svg>";
  btnNext.style.width = "32px";
  btnNext.style.height = "32px";
  btnNext.style.borderRadius = "999px";
  btnNext.style.border = "1px solid #e5e7eb";
  btnNext.style.background = "#fff";
  btnNext.style.fontSize = "20px";
  btnNext.style.fontWeight = "700";
  btnNext.style.color = "#111827";
  btnNext.style.lineHeight = "1";
  btnNext.onclick = () => {
    remarcarMesAtual = new Date(ano, mes + 1, 1);
    renderRemarcarCalendario();
  };

  header.appendChild(btnPrev);
  header.appendChild(titulo);
  header.appendChild(btnNext);
  remarcarCalendario.appendChild(header);

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(7, 1fr)";
  grid.style.gap = "6px";

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  diasSemana.forEach((d) => {
    const h = document.createElement("div");
    h.textContent = d;
    h.style.fontWeight = "bold";
    h.style.fontSize = "12px";
    grid.appendChild(h);
  });

  const primeiro = new Date(ano, mes, 1);
  const offset = primeiro.getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const vazio = document.createElement("div");
    grid.appendChild(vazio);
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const diaStr = formatYYYYMMDD(ano, mes + 1, dia);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(dia);
    btn.style.padding = "8px 0";
    btn.style.borderRadius = "12px";
    btn.style.border = "1px solid #e5e7eb";
    btn.style.background = "#fff";
    btn.style.fontWeight = "600";

    const info = mapa[diaStr];
    if (info) {
      const status = info?.status;
      if (status === "closed") {
        btn.style.background = "#e5e7eb";
        btn.style.color = "#6b7280";
        btn.style.borderColor = "#e5e7eb";
      } else if (status === "full") {
        btn.style.background = "#fecaca";
        btn.style.color = "#7f1d1d";
        btn.style.borderColor = "#fecaca";
      } else if (status === "free") {
        btn.style.background = "#bbf7d0";
        btn.style.color = "#166534";
        btn.style.borderColor = "#bbf7d0";
      }
    }

    if (diaStr === remarcarDiaSelecionado) {
      btn.style.background = "#d16c8a";
      btn.style.color = "#fff";
      btn.style.borderColor = "#d16c8a";
    }

    btn.onclick = () => selecionarDiaRemarcar(diaStr);
    grid.appendChild(btn);
  }

  remarcarCalendario.appendChild(grid);
}
function selecionarDiaRemarcar(dia) {
  remarcarDiaSelecionado = dia;
  renderRemarcarCalendario();
  carregarHorariosRemarcar(dia);
}

async function carregarHorariosRemarcar(dia) {
  if (!remarcarHorarios || !btnConfirmarRemarcar) return;

  remarcarHorarios.innerHTML = "";
  if (remarcarSelecionado) remarcarSelecionado.textContent = "";
  remarcarHorarioSelecionado = null;
  btnConfirmarRemarcar.disabled = true;
  btnConfirmarRemarcar.style.opacity = "0.6";

  if (!dia) {
    remarcarHorarios.textContent = "Selecione uma data.";
    return;
  }

  if (!remarcarAgendamento) return;

  let config;
  try {
    config = await carregarConfigDoDia(dia);
  } catch (e) {
    console.error("Erro buscando config:", e);
    remarcarHorarios.textContent = "Erro ao carregar configuracao.";
    return;
  }

  if (config.fechado) {
    remarcarHorarios.textContent = "Dia fechado para atendimento.";
    return;
  }

  const inicio = Number(config.diaInicio);
  const fim = Number(config.diaFim);
  const almocoIni = Number(config.almocoInicio);
  const almocoFim = Number(config.almocoFim);

  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) {
    remarcarHorarios.textContent = "Configuracao do dia invalida.";
    return;
  }

  let ags = [];
  try {
    ags = await carregarAgendamentosDoDia(dia);
  } catch (e) {
    console.error("Erro buscando agendamentos:", e);
    remarcarHorarios.textContent = "Erro ao carregar agendamentos.";
    return;
  }

  ags = ags.filter((a) => a.id !== remarcarAgendamento.id);

  const servicosMap = await obterServicosMap();
  const duracao = obterDuracaoAgendamento(remarcarAgendamento, servicosMap);
  const passo = 30;

  const hojeStr = new Date().toISOString().slice(0, 10);
  const agoraMin = dia === hojeStr
    ? (new Date().getHours() * 60 + new Date().getMinutes())
    : null;

  const slots = [];
  for (let start = inicio; start + duracao <= fim; start += passo) {
    const end = start + duracao;

    if (agoraMin != null && start < agoraMin) continue;

    const emAlmoco =
      Number.isFinite(almocoIni) && Number.isFinite(almocoFim) &&
      start < almocoFim && end > almocoIni;

    if (emAlmoco) continue;

    const conflito = ags.some((a) => a.start < end && a.end > start);
    if (conflito) continue;

    slots.push({ start, end });
  }

  if (!slots.length) {
    remarcarHorarios.textContent = "Sem horarios disponiveis para esse dia.";
    return;
  }

  slots.forEach((slot) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${minutosParaHHMM(slot.start)} - ${minutosParaHHMM(slot.end)}`;
    btn.style.padding = "6px 10px";
    btn.style.borderRadius = "10px";
    btn.style.border = "1px solid #e5e7eb";
    btn.style.background = "#fff";
    btn.style.fontSize = "12px";
    btn.style.fontWeight = "600";
    btn.style.color = "#333";

    btn.onclick = () => {
      remarcarHorarioSelecionado = { ...slot };
      Array.from(remarcarHorarios.children).forEach((el) => {
        if (el && el.style) {
          el.style.background = "#fff";
          el.style.color = "#333";
          el.style.borderColor = "#e5e7eb";
        }
      });
      btn.style.background = "#d16c8a";
      btn.style.color = "#fff";
      btn.style.borderColor = "#d16c8a";

      if (remarcarSelecionado) {
        remarcarSelecionado.textContent = `Selecionado: ${dia} ${minutosParaHHMM(slot.start)} - ${minutosParaHHMM(slot.end)}`;
      }

      btnConfirmarRemarcar.disabled = false;
      btnConfirmarRemarcar.style.opacity = "1";
    };

    remarcarHorarios.appendChild(btn);
  });
}

async function abrirModalRemarcar(ag, dia) {
  if (!modalRemarcar || !remarcarCalendario || !remarcarHorarios) return;
  remarcarAgendamento = { ...ag, day: dia };

  if (remarcarInfo) {
    const nome = ag?.nome || "Cliente";
    const serv = ag?.servico || "Servico";
    const tel = ag?.telefone ? String(ag.telefone) : "Sem telefone";
    remarcarInfo.textContent = `${nome} - ${tel} - ${serv}`;
  }

  const diaInicial = dia || new Date().toISOString().slice(0, 10);
  remarcarDiaSelecionado = diaInicial;
  remarcarMesAtual = new Date(`${diaInicial}T00:00:00`);
  remarcarMesAtual.setDate(1);

  renderRemarcarCalendario();
  await carregarHorariosRemarcar(diaInicial);

  modalRemarcar.style.display = "flex";
}

function fecharModalRemarcar() {
  if (modalRemarcar) modalRemarcar.style.display = "none";
  remarcarAgendamento = null;
  remarcarDiaSelecionado = null;
  remarcarHorarioSelecionado = null;
}

if (btnCancelarRemarcar) {
  btnCancelarRemarcar.addEventListener("click", () => fecharModalRemarcar());
}

if (btnApagarRemarcar) {
  btnApagarRemarcar.addEventListener("click", async () => {
    if (!remarcarAgendamento) return;
    const ok = confirm("Deseja apagar este agendamento?");
    if (!ok) return;

    try {
      const resp = await adminFetch(`/api/bookings?id=${encodeURIComponent(remarcarAgendamento.id)}`, {
        method: "DELETE"
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        alert(json?.error || `Erro ao apagar (HTTP ${resp.status}).`);
        return;
      }
    } catch (e) {
      console.error("Erro ao apagar agendamento:", e);
      alert("Nao foi possivel apagar o agendamento.");
      return;
    }

    fecharModalRemarcar();
    const diaAtual = dataAdmin?.value;
    if (diaAtual) {
      await renderMapaDoDia(diaAtual);
      if (typeof renderAgendamentos === "function") {
        await renderAgendamentos(diaAtual);
      }
    }
    if (typeof calendarioCache !== "undefined" && calendarioCache) {
      calendarioCache.clear();
    }
    await refreshCalendario();
  });
}

if (modalRemarcar) {
  modalRemarcar.addEventListener("click", (e) => {
    if (e.target && e.target.id === "modalRemarcar") {
      fecharModalRemarcar();
    }
  });
}

if (btnConfirmarRemarcar) {
  btnConfirmarRemarcar.addEventListener("click", async () => {
    if (!remarcarAgendamento) return;
    if (!remarcarDiaSelecionado || !remarcarHorarioSelecionado) {
      alert("Selecione um horario disponivel.");
      return;
    }

    const dia = remarcarDiaSelecionado;
    const ini = remarcarHorarioSelecionado.start;
    const fim = remarcarHorarioSelecionado.end;

    if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini) {
      alert("Horario invalido.");
      return;
    }

    try {
      const resp = await adminFetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          force: true,
          id: remarcarAgendamento.id,
          day: dia,
          start_min: ini,
          end_min: fim
        })
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        alert(json?.error || `Erro ao remarcar (HTTP ${resp.status}).`);
        return;
      }
    } catch (e) {
      console.error("Erro ao remarcar:", e);
      alert("Nao foi possivel remarcar.");
      return;
    }

    fecharModalRemarcar();
    const diaAtual = dataAdmin?.value;
    if (diaAtual) {
      await renderMapaDoDia(diaAtual);
      if (typeof renderAgendamentos === "function") {
        await renderAgendamentos(diaAtual);
      }
    }
    await refreshCalendario();
  });
}async function confirmarAgendamentoAdmin(dia, start, telefone, servico) {
  if (!telefone) {
    alert("Esse agendamento nao tem telefone.");
    return;
  }

  let ags = [];
  try {
    ags = await carregarAgendamentosDoDia(dia);
  } catch (e) {
    console.error("Erro buscando agendamentos:", e);
    return;
  }

  const ag = ags.find(a => a.start === start);
  if (!ag) return;

  const dataBR = formatarDataBR(dia);
  const msg =
`Ola ${ag.nome || ""}! Confirmando seu horario.

Servico: ${ag.servico || servico || ""}
Data: ${dataBR}
Hora: ${minutosParaHHMM(ag.start)}

Qualquer imprevisto, avise por aqui.`;

  const url = `https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

async function apagarAgendamentoAdmin(dia, start) {
  const ok = confirm("Apagar esse agendamento?");
  if (!ok) return;

  let ags = [];
  try {
    ags = await carregarAgendamentosDoDia(dia);
  } catch (e) {
    console.error("Erro buscando agendamentos:", e);
    return;
  }

  const ag = ags.find(a => a.start === start);
  if (!ag || !ag.id) {
    alert("Nao foi possivel identificar este agendamento.");
    return;
  }

  try {
    const resp = await adminFetch(`/api/bookings?id=${encodeURIComponent(ag.id)}`, {
      method: "DELETE"
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
  } catch (e) {
    console.error("Erro ao apagar agendamento:", e);
    alert("Nao foi possivel apagar o agendamento.");
    return;
  }

  await renderMapaDoDia(dia);
  if (typeof renderAgendamentos === "function") {
    await renderAgendamentos(dia);
  }
  if (typeof calendarioCache !== "undefined" && calendarioCache) {
    calendarioCache.clear();
  }
  await refreshCalendario();
}
// ================== HELPERS ==================
function minutosParaHHMM(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hhmmParaMinutos(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function limparTelefone(tel) {
  let t = (tel || "").toString().replace(/\D/g, "");
  t = t.replace(/^0+/, ""); // remove zeros no começo

  // Se já estiver com 55 e tiver tamanho OK, mantém
  if (t.startsWith("55") && (t.length === 12 || t.length === 13)) return t;

  // Se estiver sem 55 mas tiver DDD+numero (10 ou 11), adiciona 55
  if (t.length === 10 || t.length === 11) return "55" + t;

  // Caso não dê pra garantir, retorna vazio para "pular"
  return "";
}

function dataParaBR(diaYYYYMMDD) {
  return diaYYYYMMDD.split("-").reverse().join("/");
}

function abrirConfirmacaoWhatsApp(dia, ag) {
  const tel = limparTelefone(ag.telefone);
  if (!tel) return null;

  const numeroFinal = tel.startsWith("55") ? tel : `55${tel}`;
  const dataBR = dataParaBR(dia);

  const mensagem =
    `Olá, ${ag.nome || ""}! 😊

  Confirmando seu horário:
  ✅ Serviço: ${ag.servico || "Serviço"}
  📅 Data: ${dataBR}
  🕒 Horário: ${minutosParaHHMM(ag.start)}

  Se precisar remarcar, me avise por aqui.`;

  return `https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensagem)}`;
}
async function carregarServicosAPI() {
  const resp = await fetch("/api/services?all=1", { cache: "no-store" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  return Array.isArray(json?.services) ? json.services : [];
}

async function criarServico(payload) {
  const resp = await adminFetch("/api/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
  return json?.service || null;
}

async function atualizarServico(payload) {
  const resp = await adminFetch("/api/services", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
  return json?.service || null;
}

async function apagarServico(id) {
  const resp = await adminFetch(`/api/services?id=${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
  return json;
}

async function renderServicos() {
  if (!listaServicos) return;
  listaServicos.innerHTML = "";

  let servicos = [];
  try {
    servicos = await carregarServicosAPI();
  } catch (e) {
    console.error("Erro carregando servicos:", e);
    listaServicos.textContent = "Erro ao carregar servicos.";
    return;
  }

  if (!servicos.length) {
    listaServicos.textContent = "Nenhum servico cadastrado.";
    return;
  }

  servicos.forEach((s) => {
    const linha = document.createElement("div");
    linha.style.display = "flex";
    linha.style.justifyContent = "space-between";
    linha.style.alignItems = "center";
    linha.style.borderBottom = "1px solid #eee";
    linha.style.padding = "8px 0";
    linha.style.gap = "10px";

    const info = document.createElement("div");
    const preco = Number(s.price_cents || 0) / 100;
    info.innerHTML = `<strong>${s.name}</strong><br><span>${s.duration_minutes} min</span> - <span>${formatarPrecoBR(preco)}</span>`;

    function formatarPrecoBR(v) {
      const n = Number(v || 0);
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.style.width = "auto";
    btnEditar.style.padding = "6px 10px";
    btnEditar.style.marginTop = "0";

    btnEditar.onclick = async () => {
      const novoNome = prompt("Nome do servico:", s.name);
      if (!novoNome || !novoNome.trim()) return;

      const novaDur = parseInt(prompt("Duracao em minutos", String(s.duration_minutes)), 10);
      if (!novaDur || novaDur < 10) {
        alert("Duracao invalida. Ex: 50, 60, 120.");
        return;
      }

      const precoAtual = Number(s.price_cents || 0) / 100;
      const novoPrecoRaw = prompt("Preco (ex: 55,00):", String(precoAtual).replace(".", ","));
      if (!novoPrecoRaw || !novoPrecoRaw.trim()) return;

      const novoPreco = parseFloat(novoPrecoRaw.replace(".", "").replace(",", "."));
      if (!Number.isFinite(novoPreco) || novoPreco < 0) {
        alert("Preco invalido.");
        return;
      }

      try {
        await atualizarServico({
          id: s.id,
          name: novoNome.trim(),
          duration_minutes: novaDur,
          price_cents: Math.round(novoPreco * 100)
        });
      } catch (e) {
        console.error("Erro ao atualizar servico:", e);
        alert("Nao foi possivel atualizar o servico.");
        return;
      }

      await renderServicos();
      alert("Servico atualizado com sucesso.");
    };

    const btnApagar = document.createElement("button");
    btnApagar.textContent = "Apagar";
    btnApagar.style.width = "auto";
    btnApagar.style.padding = "6px 10px";
    btnApagar.style.marginTop = "0";

    btnApagar.onclick = async () => {
      const ok = confirm(`Apagar o servico "${s.name}"?`);
      if (!ok) return;
      try {
        const json = await apagarServico(s.id);
        if (json?.deactivated) {
          alert("Servico possui agendamentos. Foi desativado.");
        }
      } catch (e) {
        console.error("Erro ao apagar servico:", e);
        alert("Nao foi possivel apagar o servico.");
        return;
      }
      await renderServicos();
      alert("Servico removido.");
    };

    const acoes = document.createElement("div");
    acoes.style.display = "flex";
    acoes.style.gap = "8px";
    acoes.appendChild(btnEditar);
    acoes.appendChild(btnApagar);

    linha.appendChild(info);
    linha.appendChild(acoes);
    listaServicos.appendChild(linha);
  });
}
async function limparAgendamentos() {
  const ok = confirm("Tem certeza? Isso apagará TODOS os agendamentos.");
  if (!ok) return;

  try {
    const resp = await adminFetch("/api/bookings?all=1", { method: "DELETE" });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
  } catch (e) {
    console.error("Erro ao apagar agendamentos:", e);
    alert("Nao foi possivel apagar os agendamentos.");
    return;
  }

  alert("Agenda limpa com sucesso.");
  const dia = dataAdmin?.value;
  if (dia) {
    await renderMapaDoDia(dia);
    if (typeof renderAgendamentos === "function") {
      await renderAgendamentos(dia);
    }
  }
}
// Adicionar o botão de adicionar serviço //
if (btnAdicionarServico) {
  btnAdicionarServico.addEventListener("click", async () => {
    const nome = (novoServicoNome.value || "").trim();
    const dur = parseInt(novoServicoDuracao.value, 10);
    const precoRaw = (novoServicoPreco.value || "").trim();

    if (!nome) {
      alert("Digite o nome do servico.");
      return;
    }

    if (!dur || dur < 10) {
      alert("Duracao invalida.");
      return;
    }

    if (!precoRaw) {
      alert("Digite o preco. Ex: 55,00");
      return;
    }

    const preco = parseFloat(precoRaw.replace(".", "").replace(",", "."));
    if (!Number.isFinite(preco) || preco < 0) {
      alert("Preco invalido.");
      return;
    }

    try {
      await criarServico({
        name: nome,
        duration_minutes: dur,
        price_cents: Math.round(preco * 100),
        active: true
      });
    } catch (e) {
      console.error("Erro ao criar servico:", e);
      alert("Nao foi possivel criar o servico.");
      return;
    }

    novoServicoNome.value = "";
    novoServicoDuracao.value = "";
    novoServicoPreco.value = "";

    await renderServicos();
    alert("Servico adicionado.");
  });
}
async function carregarFormExcecao(dia) {
  let cfg;
  try {
    cfg = await carregarConfigDoDia(dia);
  } catch (e) {
    console.error("Erro buscando config:", e);
    alert("Nao foi possivel carregar a configuracao do dia.");
    return;
  }

  diaFechadoSelect.value = cfg.fechado ? "sim" : "nao";
  inicioAtendimentoInput.value = minutosParaHHMM(cfg.diaInicio);
  fimAtendimentoInput.value = minutosParaHHMM(cfg.diaFim);
  inicioAlmocoInput.value = minutosParaHHMM(cfg.almocoInicio);
  fimAlmocoInput.value = minutosParaHHMM(cfg.almocoFim);
}
async function carregarForm(dia) {
  if (typeof dataHorario !== "undefined" && dataHorario) { dataHorario.value = dia; }
  let cfg;
  try {
    cfg = await carregarConfigDoDia(dia);
  } catch (e) {
    console.error("Erro buscando config:", e);
    alert("Nao foi possivel carregar a configuracao do dia.");
    return;
  }

  diaFechadoSelect.value = cfg.fechado ? "sim" : "nao";
  inicioAtendimentoInput.value = minutosParaHHMM(cfg.diaInicio);
  fimAtendimentoInput.value = minutosParaHHMM(cfg.diaFim);
  inicioAlmocoInput.value = minutosParaHHMM(cfg.almocoInicio);
  fimAlmocoInput.value = minutosParaHHMM(cfg.almocoFim);

  await renderMapaDoDia(dia);
}


if (btnLimparAgendamentos) {
  btnLimparAgendamentos.addEventListener("click", () => limparAgendamentos());
}
const calendarioCache = new Map();
let calendarioMesAtual = new Date();
let remarcarAgendamento = null;
let remarcarDiaSelecionado = null;
let remarcarHorarioSelecionado = null;
let remarcarMesAtual = new Date();
let servicosCache = null;
calendarioMesAtual.setDate(1);

function formatYYYYMM(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatYYYYMMDD(y, m, d) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function nomeMes(idx) {
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return nomes[idx] || "";
}

async function carregarResumoMes(ano, mes, duracao) {
  const durKey = Number.isFinite(duracao) && duracao > 0 ? `-${duracao}` : "";
  const chave = `${ano}-${String(mes).padStart(2, "0")}${durKey}`;
  if (calendarioCache.has(chave)) return calendarioCache.get(chave);

  const params = new URLSearchParams({
    month: chave.slice(0, 7)
  });
  if (Number.isFinite(duracao) && duracao > 0) {
    params.set("duration", String(duracao));
  }

  const resp = await fetch(`/api/bookings/summary?${params.toString()}`, {
    cache: "no-store"
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const days = Array.isArray(json?.days) ? json.days : [];
  calendarioCache.set(chave, days);
  return days;
}

function corPorQuantidade(info) {
  const status = info?.status;
  if (status === "closed") return "#e5e7eb";
  if (status === "full") return "#f87171";
  if (status === "free") return "#86efac";
  const qtd = Number(info?.count || 0);
  if (qtd > 0) return "#86efac";
  return "#e5e7eb";
}

async function renderAgendaDetalhe(dia, anchorEl) {
  if (!agendaDetalheTitulo || !agendaDetalheLista || !agendaDetalhePopover) return;

  if (!dia) {
    agendaDetalhePopover.style.display = "none";
    agendaDetalheTitulo.textContent = "Selecione um dia";
    agendaDetalheLista.innerHTML = "";
    return;
  }

  agendaDetalheTitulo.textContent = `Dia ${dataParaBR(dia)}`;
  agendaDetalheLista.innerHTML = "";
  agendaDetalhePopover.style.display = "block";

  if (agendaMensal && anchorEl) {
    const contRect = agendaMensal.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const popWidth = agendaDetalhePopover.offsetWidth || 260;
    const popHeight = agendaDetalhePopover.offsetHeight || 180;

    let left = anchorRect.left - contRect.left;
    let top = anchorRect.bottom - contRect.top + 8;

    if (top + popHeight > contRect.height) {
      top = anchorRect.top - contRect.top - popHeight - 8;
    }

    const maxLeft = contRect.width - popWidth - 8;
    left = Math.max(8, Math.min(left, maxLeft));
    top = Math.max(8, top);

    agendaDetalhePopover.style.left = `${left}px`;
    agendaDetalhePopover.style.top = `${top}px`;
  }

  let ags = [];
  try {
    ags = await carregarAgendamentosDoDia(dia);
  } catch (e) {
    agendaDetalheLista.textContent = "Erro ao carregar agendamentos.";
    return;
  }

  if (!ags.length) {
    agendaDetalheLista.textContent = "Sem agendamentos.";
    return;
  }

  ags.sort((a, b) => a.start - b.start);
  const lista = document.createElement("div");
  lista.style.display = "flex";
  lista.style.flexDirection = "column";
  lista.style.gap = "6px";

  ags.forEach((ag) => {
    const linha = document.createElement("div");
    linha.style.display = "flex";
    linha.style.flexDirection = "column";

    const topo = document.createElement("strong");
    topo.textContent = `${minutosParaHHMM(ag.start)}  ${ag.nome || "Cliente"}`;

    const sub = document.createElement("span");
    sub.textContent = ag.servico || "Servico";
    sub.style.opacity = "0.85";

    linha.appendChild(topo);
    linha.appendChild(sub);
    lista.appendChild(linha);
  });

  agendaDetalheLista.appendChild(lista);
}

async function renderCalendarioMes() {
  if (!calendarioGrid) return;

  const ano = calendarioMesAtual.getFullYear();
  const mes = calendarioMesAtual.getMonth();
  const label = `${nomeMes(mes)} ${ano}`;
  if (labelMesAtual) labelMesAtual.textContent = label;

  calendarioGrid.innerHTML = "";
  calendarioGrid.style.display = "grid";
  calendarioGrid.style.gridTemplateColumns = "repeat(7, 1fr)";
  calendarioGrid.style.gap = "6px";

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  diasSemana.forEach((d) => {
    const h = document.createElement("div");
    h.textContent = d;
    h.style.fontWeight = "bold";
    h.style.fontSize = "12px";
    calendarioGrid.appendChild(h);
  });

  let resumo = [];
  try {
    const servicosMap = await obterServicosMap();
    const duracao = obterDuracaoAgendamento(remarcarAgendamento, servicosMap);
    resumo = await carregarResumoMes(ano, mes + 1, duracao);
  } catch (e) {
    console.error("Erro carregando resumo mensal:", e);
  }

  const mapa = {};
  resumo.forEach((r) => {
    if (!r?.day) return;
    mapa[r.day] = { count: Number(r.count || 0), status: r.status };
  });

  const primeiroDia = new Date(ano, mes, 1);
  const startDow = primeiroDia.getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  for (let i = 0; i < startDow; i++) {
    const vazio = document.createElement("div");
    calendarioGrid.appendChild(vazio);
  }

  for (let d = 1; d <= totalDias; d++) {
    const dayStr = formatYYYYMMDD(ano, mes + 1, d);
    const info = mapa[dayStr] || { count: 0 };
    const qtd = info.count;

    const cell = document.createElement("div");
    cell.setAttribute("data-day", dayStr);
    cell.style.border = "1px solid #eee";
    cell.style.borderRadius = "8px";
    cell.style.padding = "6px";
    cell.style.cursor = "pointer";
    cell.style.minHeight = "44px";
    cell.style.background = "#fff";

    const diaEl = document.createElement("div");
    diaEl.textContent = String(d);
    diaEl.style.fontWeight = "bold";

    const dot = document.createElement("span");
    dot.style.display = "inline-block";
    dot.style.width = "8px";
    dot.style.height = "8px";
    dot.style.borderRadius = "50%";
    dot.style.background = corPorQuantidade(info);
    dot.style.marginTop = "6px";

    const qtdEl = document.createElement("div");
    qtdEl.style.fontSize = "11px";
    qtdEl.style.color = "#666";
    qtdEl.textContent = qtd ? `${qtd} ag.` : "";

    cell.appendChild(diaEl);
    cell.appendChild(dot);
    cell.appendChild(qtdEl);

    calendarioGrid.appendChild(cell);
  }
  adminCache.calendario.ts = Date.now();
}

if (agendaDetalheFechar) {
  agendaDetalheFechar.addEventListener("click", () => {
    if (agendaDetalhePopover) agendaDetalhePopover.style.display = "none";
  });
}

if (calendarioGrid) {
  calendarioGrid.addEventListener("click", async (e) => {
    const alvo = e.target?.closest("[data-day]");
    if (!alvo) return;
    const day = alvo.getAttribute("data-day");
    if (!day) return;
    if (dataAdmin) dataAdmin.value = day;
    await renderAgendaDetalhe(day, alvo);
    await carregarForm(day);
  });
}

if (btnMesPrev) {
  btnMesPrev.addEventListener("click", async () => {
    calendarioMesAtual.setMonth(calendarioMesAtual.getMonth() - 1);
    calendarioMesAtual.setDate(1);
    await renderCalendarioMes();
  });
}

if (btnMesNext) {
  btnMesNext.addEventListener("click", async () => {
    calendarioMesAtual.setMonth(calendarioMesAtual.getMonth() + 1);
    calendarioMesAtual.setDate(1);
    await renderCalendarioMes();
  });
}

async function carregarDiasDescanso() {
  if (!semanaDescanso) return;
  let days = [];
  try {
    const resp = await fetch("/api/weekly-closed", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    days = Array.isArray(json?.days) ? json.days : [];
  } catch (e) {
    console.error("Erro ao carregar dias de descanso:", e);
    return;
  }

  const set = new Set(days.map((d) => Number(d)));
  semanaDescanso.querySelectorAll("input[data-weekday]").forEach((el) => {
    const day = Number(el.getAttribute("data-weekday"));
    el.checked = set.has(day);
  });
}

async function salvarDiasDescanso(silent = false) {
  if (!semanaDescanso) return false;
  const days = Array.from(semanaDescanso.querySelectorAll("input[data-weekday]"))
    .filter((el) => el.checked)
    .map((el) => Number(el.getAttribute("data-weekday")))
    .filter((d) => Number.isFinite(d));

  try {
    const resp = await adminFetch("/api/weekly-closed", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
  } catch (e) {
    console.error("Erro ao salvar dias de descanso:", e);
    if (!silent) alert("Nao foi possivel salvar os dias de descanso.");
    return false;
  }

  if (!silent) alert("Dias de descanso salvos.");
  if (typeof carregarConfigDoDia === "function") {
    delete carregarConfigDoDia._weeklyClosed;
  }
  if (painelAgendamentos && painelAgendamentos.style.display === "block") {
    await renderCalendarioMes();
  }
  return true;
}function hojeYYYYMMDD() {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = String(hoje.getMonth() + 1).padStart(2, "0");
  const d = String(hoje.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function renderConfigsFechadas() {
  if (!listaFechadosForaPadrao) return;
  listaFechadosForaPadrao.innerHTML = "";

  let configs = [];
  try {
    const resp = await fetch("/api/day-settings?limit=200", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    configs = Array.isArray(json?.configs) ? json.configs : [];
  } catch (e) {
    console.error("Erro ao carregar configs:", e);
    listaFechadosForaPadrao.textContent = "Erro ao carregar configs.";
    return;
  }

  const hojeStr = hojeYYYYMMDD();
  const fechados = configs.filter((c) => c?.fechado && c?.day && c.day >= hojeStr);

  if (!fechados.length) {
    listaFechadosForaPadrao.textContent = "Nenhum dia fechado futuro.";
    return;
  }

  fechados.sort((a, b) => String(a.day).localeCompare(String(b.day)));
  fechados.forEach((c) => {
    const linha = document.createElement("div");
    linha.style.display = "flex";
    linha.style.justifyContent = "space-between";
    linha.style.alignItems = "center";
    linha.style.borderBottom = "1px solid #eee";
    linha.style.padding = "8px 0";

    const info = document.createElement("div");
    info.textContent = `Fechado: ${dataParaBR(c.day)}`;

    const btn = document.createElement("button");
    btn.textContent = "Abrir";
    btn.style.width = "auto";
    btn.style.padding = "6px 10px";

    btn.onclick = async () => {
      const ok = confirm(`Marcar o dia ${dataParaBR(c.day)} como aberto?`);
      if (!ok) return;
      try {
        const payload = {
          day: c.day,
          fechado: false,
          diaInicio: Number(c.diaInicio ?? 480),
          diaFim: Number(c.diaFim ?? 1020),
          almocoInicio: Number(c.almocoInicio ?? 720),
          almocoFim: Number(c.almocoFim ?? 780)
        };
        const resp = await adminFetch("/api/day-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
      } catch (e) {
        console.error("Erro ao abrir dia:", e);
        alert("Nao foi possivel abrir este dia.");
        return;
      }
      await renderConfigsFechadas();
      await refreshCalendario();
    };

    linha.appendChild(info);
    linha.appendChild(btn);
    listaFechadosForaPadrao.appendChild(linha);
  });
}
// ================== LOGIN ==================
btnEntrarAdmin.addEventListener("click", async () => {
  const token = adminSenha.value.trim();
  if (!token) {
    alert("Informe o token do admin.");
    return;
  }
  const ok = await validarAdminToken(token);
  if (!ok) {
    alert("Token invalido.");
    return;
  }
  sessionStorage.setItem(adminTokenStorageKey, token);

  adminConteudo.style.display = "block";
  await aplicarTituloStudioAdmin();
  iniciarAutoRefreshAdmin();
  await carregarForm(dataAdmin.value);
  await carregarDiasDescanso();
  await carregarHorarioPadrao();
  await carregarInfoStudio();
  await renderConfigsFechadas();
  if (isVisible(painelPagamentos)) {
    await carregarPagamentosPendentes({ force: true });
  }
  if (isVisible(painelLembretes)) {
    if (isVisible(painelLembretes7d)) {
      await carregarLembretesTipo("7d", { force: true });
    }
    if (isVisible(painelLembretes24h)) {
      await carregarLembretesTipo("24h", { force: true });
    }
  }
  if (painelAgendamentos && painelAgendamentos.style.display === "block") {
    await renderCalendarioMes();
  }
});

renderServicos();


// ================== INIT DATA ==================
(function initDataMin() {
  const hoje = new Date();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");
  const hojeStr = `${yyyy}-${mm}-${dd}`;

  dataAdmin.min = hojeStr;
  dataAdmin.value = hojeStr;
})();

// Mudar data no admin
dataAdmin.addEventListener("change", async () => {
  if (adminConteudo.style.display === "block") {
    await carregarForm(dataAdmin.value);
    if (painelAgendamentos && painelAgendamentos.style.display === "block") {
      await renderCalendarioMes();
    }
  }
});
if (dataHorario) {
  dataHorario.addEventListener("change", async () => {
    if (!dataHorario.value) return;
    if (adminConteudo.style.display === "block") {
      await carregarFormExcecao(dataHorario.value);
    }
  });
}

// ================== SALVAR CONFIG ==================
btnSalvarConfig.addEventListener("click", async () => {
  const dia = dataHorario ? dataHorario.value : "";
  if (!dia) {
    alert("Selecione a data no campo Configurar dia.");
    return;
  }
    if (!dia) {
    alert("Selecione a data.");
    return;
  }

  const fechado = diaFechadoSelect.value === "sim";

  const ini = hhmmParaMinutos(inicioAtendimentoInput.value);
  const fim = hhmmParaMinutos(fimAtendimentoInput.value);
  const almIni = hhmmParaMinutos(inicioAlmocoInput.value);
  const almFim = hhmmParaMinutos(fimAlmocoInput.value);

  if (ini == null || fim == null || almIni == null || almFim == null) {
    alert("Preencha todos os horarios.");
    return;
  }
  if (ini >= fim) {
    alert("Inicio precisa ser antes do fim.");
    return;
  }
  if (almIni > almFim) {
    alert("Almoco invalido (ou coloque igual para desativar).");
    return;
  }

  if (fechado) {
    try {
      const ags = await carregarAgendamentosDoDia(dia);
      if (ags.length) {
        const ok = confirm("Existem agendamentos neste dia. Deseja manter fechado mesmo assim?");
        if (!ok) return;
      }
    } catch (e) {
      console.error("Erro verificando agendamentos:", e);
    }
  }

  try {
    await salvarConfigDoDia(dia, {
      fechado,
      diaInicio: ini,
      diaFim: fim,
      almocoInicio: almIni,
      almocoFim: almFim
    });
  } catch (e) {
    console.error("Erro salvando config:", e);
    alert("Nao foi possivel salvar a configuracao.");
    return;
  }

  alert("Configuracao salva.");
  await renderConfigsFechadas();
  await refreshCalendario();
});
if (btnSalvarPadraoCompleto) {
  btnSalvarPadraoCompleto.addEventListener("click", salvarPadraoCompleto);
}
if (btnSalvarInfoStudio) {
  btnSalvarInfoStudio.addEventListener("click", salvarInfoStudio);
}




