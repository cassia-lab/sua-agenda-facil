
// ======== ELEMENTOS DA TELA ========
const horariosDiv = document.getElementById("horarios");
const servicoSelect = document.getElementById("servico");
const dataInput = document.getElementById("data");
const tituloPagina = document.getElementById("tituloPagina");
const modalConfirmacao = document.getElementById("modalConfirmacao");
const modalTexto = document.getElementById("modalTexto");
const novoServicoPreco = document.getElementById("novoServicoPreco");


// ======= TÍTULO vindo do config.js =======
const nomePagina = window.APP_CONFIG?.nomePagina || "Sua Agenda Fácil";
tituloPagina.textContent = nomePagina;
document.title = nomePagina;

// ======== CONFIG PADRÃO ========
const padrao = {
  diaInicio: 8 * 60,     // 08:00
  diaFim: 17 * 60,       // 17:00
  almocoInicio: 12 * 60, // 12:00
  almocoFim: 13 * 60,    // 13:00
  passoMinutos: 30
};

// ======== HELPERS ========
function parseYYYYMMDD(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatarDataBR(diaYYYYMMDD) {
  return (diaYYYYMMDD || "").split("-").reverse().join("/");
}

function formatarPrecoBR(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function minutosParaHHMM(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function intervalosConflitam(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function diaSemanaPermitidoUTC(dateObjUTC) {
  const d = dateObjUTC.getUTCDay(); // 0=Dom,1=Seg,2=Ter...
  return d >= 2 && d <= 6; // Terça a Sábado
}

function proximaDataPermitidaLocal() {
  const d = new Date();
  while (true) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const utc = parseYYYYMMDD(`${y}-${m}-${day}`);
    if (diaSemanaPermitidoUTC(utc)) return d;
    d.setDate(d.getDate() + 1);
  }
}

function keyAgendamentos(dia) {
  return `agendamentos:${dia}`;
}

function keyConfigDia(dia) {
  return `configDia:${dia}`;
}

function carregarAgendamentosDoDia(dia) {
  return JSON.parse(localStorage.getItem(keyAgendamentos(dia))) || [];
}

function salvarAgendamentosDoDia(dia, lista) {
  localStorage.setItem(keyAgendamentos(dia), JSON.stringify(lista));
}

function carregarConfigDoDia(dia) {
  return JSON.parse(localStorage.getItem(keyConfigDia(dia))) || {
    fechado: false,
    diaInicio: padrao.diaInicio,
    diaFim: padrao.diaFim,
    almocoInicio: padrao.almocoInicio,
    almocoFim: padrao.almocoFim
  };
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

function servicoTextoSelecionado() {

  // pega o texto visível do option selecionado
  return servicoSelect.options[servicoSelect.selectedIndex]?.text || "Serviço";
}


// ======== SERVIÇOS (CLIENTE) ========

function keyServicos() {
  const slug = window.APP_CONFIG?.slug || "default";
  return `servicos:${slug}`;
}

function servicosPadrao() {
  return [
    { nome: "Pé", duracao: 50, preco: 0 },
    { nome: "Mão", duracao: 60, preco: 0 },
    { nome: "Pé + Mão", duracao: 120, preco: 0 }
  ];
}

function carregarServicos() {
  const raw = localStorage.getItem(keyServicos());
  const s = raw ? JSON.parse(raw) : null;
  const lista = Array.isArray(s) && s.length ? s : servicosPadrao();

  return lista.map(item => ({
    nome: item.nome,
    duracao: Number(item.duracao || 0),
    preco: Number(item.preco || 0)
  })).filter(item => item.nome && item.duracao > 0);
}

function renderSelectServicos() {
  if (!servicoSelect) return;

  const lista = carregarServicos();
  servicoSelect.innerHTML = "";

  lista.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = String(s.duracao);
    opt.textContent = `${s.nome} (${s.duracao} min) — ${formatarPrecoBR(s.preco)}`;
    servicoSelect.appendChild(opt);
  });
}


// ======== PRINCIPAL ========
function gerarHorarios() {
  horariosDiv.innerHTML = "";

  const dia = dataInput.value;
  const duracao = parseInt(servicoSelect.value, 10);

  if (!dia) {
    horariosDiv.textContent = "Selecione uma data para ver os horários.";
    return;
  }

  const dateObjUTC = parseYYYYMMDD(dia);
  if (!diaSemanaPermitidoUTC(dateObjUTC)) {
    horariosDiv.textContent = "Atendimento somente de terça a sábado. Escolha outra data.";
    return;
  }

  const config = carregarConfigDoDia(dia);
  if (config.fechado) {
    horariosDiv.textContent = "Este dia está fechado (sem atendimento).";
    return;
  }

  const agendamentos = carregarAgendamentosDoDia(dia);

  let achou = false;
  for (let start = config.diaInicio; start < config.diaFim; start += padrao.passoMinutos) {
    const end = start + duracao;
    if (!estaDisponivel(start, end, agendamentos, config)) continue;

    achou = true;
    const botao = document.createElement("button");
    botao.textContent = `${minutosParaHHMM(start)} (até ${minutosParaHHMM(end)})`;
    botao.onclick = () => {

  // remove seleção de outros botões
  document
    .querySelectorAll(".horarios button.selecionado")
    .forEach(b => b.classList.remove("selecionado"));

  // marca o botão atual
  botao.classList.add("selecionado");

  // chama o agendamento
  agendar(dia, start, end, duracao);
};

    horariosDiv.appendChild(botao);
  }

  if (!achou) {
    horariosDiv.textContent = "Nenhum horário disponível para esse serviço nessa data.";
  }
}
// guarda o "agendamento pendente" enquanto o modal está aberto
let agendamentoPendente = null;
const btnCancelar = document.getElementById("btnCancelarModal");
if (btnCancelar) btnCancelar.textContent = "OK";


function agendar(dia, start, end, duracao) {
  const config = carregarConfigDoDia(dia);
  const servico = servicoTextoSelecionado();
  const agendamentos = carregarAgendamentosDoDia(dia);

  // evita corrida: se alguém agendou "no meio tempo"
  if (!estaDisponivel(start, end, agendamentos, config)) {
    alert("Esse horário acabou de ficar indisponível. Escolha outro.");
    gerarHorarios();
    return;
  }

  const dataBR = formatarDataBR(dia);
  const horaInicio = minutosParaHHMM(start);
  const horaFim = minutosParaHHMM(end);

  // guarda dados para confirmar depois
  agendamentoPendente = { dia, start, end, duracao, servico, dataBR, horaInicio, horaFim };

  // abre modal
  abrirModalConfirmacao(agendamentoPendente);
}
function abrirModalConfirmacao({ dataBR, horaInicio, horaFim, servico }) {
  const modal = document.getElementById("modalConfirmacao");
  const titulo = document.getElementById("modalTitulo");
  const texto = document.getElementById("modalTexto");
  const nomeInput = document.getElementById("nomeCliente");
  const telInput = document.getElementById("telefoneCliente");
  const btnConfirmar = document.getElementById("btnConfirmarModal");
  const btnCancelar = document.getElementById("btnCancelarModal");

  if (!modal) return;

  if (titulo) titulo.textContent = "Informe seus dados";

  // ✅ aqui não mostra confirmação nenhuma, só limpa
  if (texto) texto.innerHTML = "";

  if (nomeInput) { nomeInput.value = ""; nomeInput.disabled = false; }
  if (telInput) { telInput.value = ""; telInput.disabled = false; }

  if (btnConfirmar) { btnConfirmar.style.display = "block"; btnConfirmar.textContent = "Confirmar"; }
  if (btnCancelar) { btnCancelar.style.display = "block"; btnCancelar.textContent = "Cancelar"; }

  modal.style.display = "flex";
  setTimeout(() => nomeInput && nomeInput.focus(), 50);
}
function fecharModalConfirmacao() {
  const modal = document.getElementById("modalConfirmacao");
  if (modal) modal.style.display = "none";

  // reseta estado visual
  document.getElementById("modalTitulo") && (document.getElementById("modalTitulo").textContent = "Confirmar agendamento");
  const btnCancelar = document.getElementById("btnCancelarModal");
  if (btnCancelar) btnCancelar.textContent = "Cancelar";

  const nomeInput = document.getElementById("nomeCliente");
  const telInput = document.getElementById("telefoneCliente");
  if (nomeInput) nomeInput.removeAttribute("disabled");
  if (telInput) telInput.removeAttribute("disabled");

  const btnOk = document.getElementById("btnOkModal");
  if (btnOk) btnOk.style.display = "block";

  agendamentoPendente = null;
}
// valida + padroniza telefone em 55 + DDD + número
function normalizarTelefoneBR(telefoneRaw) {
  if (!telefoneRaw || !telefoneRaw.trim()) return null;

  let telefone = telefoneRaw.replace(/\D/g, "");
  telefone = telefone.replace(/^0+/, "");

  if (telefone.startsWith("55")) {
    // ok
  } else {
    if (telefone.length === 10 || telefone.length === 11) {
      telefone = "55" + telefone;
    } else {
      return null;
    }
  }
  return telefone;
}
function confirmarAgendamentoDoModal() {
  if (!agendamentoPendente) return;

  const nomeInput = document.getElementById("nomeCliente");
  const telInput = document.getElementById("telefoneCliente");

  const nome = (nomeInput?.value || "").trim();
  if (!nome) {
    alert("Nome é obrigatório.");
    nomeInput && nomeInput.focus();
    return;
  }

  const telefone = normalizarTelefoneBR(telInput?.value || "");
  if (!telefone) {
    alert("Telefone inválido. Digite com DDD (ex: 14 99999-8888).");
    telInput && telInput.focus();
    return;
  }

  const { dia, start, end, servico, dataBR, horaInicio } = agendamentoPendente;

  const config = carregarConfigDoDia(dia);
  const agendamentos = carregarAgendamentosDoDia(dia);

  // checa de novo antes de salvar
  if (!estaDisponivel(start, end, agendamentos, config)) {
    alert("Esse horário acabou de ficar indisponível. Escolha outro.");
    fecharModalConfirmacao();
    gerarHorarios();
    return;
  }

  agendamentos.push({
    start,
    end,
    nome,
    telefone,
    servico
  });

  salvarAgendamentosDoDia(dia, agendamentos);

  // ✅ mostra sucesso NO MODAL (depois de confirmar)
  const titulo = document.getElementById("modalTitulo");
  const texto = document.getElementById("modalTexto");
  const btnConfirmar = document.getElementById("btnConfirmarModal");
  const btnCancelar = document.getElementById("btnCancelarModal");

  if (titulo) titulo.textContent = "Agendamento feito com sucesso ✅";

  if (texto) {
    texto.innerHTML = `
      Esperamos você em <strong>${dataBR}</strong> às <strong>${horaInicio}</strong>.<br>
      Serviço: <strong>${servico}</strong><br><br>
      Aguarde a confirmação pelo WhatsApp.
    `;
  }

  // trava campos e esconde botão confirmar
  if (nomeInput) nomeInput.disabled = true;
  if (telInput) telInput.disabled = true;
  if (btnConfirmar) btnConfirmar.style.display = "none";

  // botão cancelar vira OK e fecha
  if (btnCancelar) {
    btnCancelar.textContent = "OK";
    btnCancelar.onclick = () => fecharModalConfirmacao();
  }

  // mensagem bonita na tela (se existir)
  const msgSucesso = document.getElementById("msgSucesso");
  if (msgSucesso) {
    msgSucesso.style.display = "block";
    msgSucesso.innerHTML = `
      <strong>Agendamento feito com sucesso ✅</strong><br>
      Esperamos você em <strong>${dataBR}</strong> às <strong>${horaInicio}</strong>.<br>
      Serviço: <strong>${servico}</strong><br>
      Aguarde a confirmação pelo WhatsApp.
    `;
    msgSucesso.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  gerarHorarios();
  agendamentoPendente = null;
}

//const dataAdminInput = document.getElementById("dataAdmin");
//const mapaDiaEl = document.getElementById("mapaDia");

//if (dataAdminInput) {
//  dataAdminInput.addEventListener("change", () => {
//    console.log("[MAPA] mudou data:", dataAdminInput.value);
//    renderMapaDoDia(dataAdminInput.value);
//  });

 // console.log("[MAPA] render inicial:", dataAdminInput.value);
  //renderMapaDoDia(dataAdminInput.value);
//}


// ======== INICIALIZAÇÃO ========
(function initData() {
  if (!dataInput) return; // ✅ evita quebrar se o input não existir

  const hoje = new Date();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");

  dataInput.min = `${yyyy}-${mm}-${dd}`;

  // só seta valor se ainda não tiver
  if (!dataInput.value) {
    const prox = proximaDataPermitidaLocal();
    const y2 = prox.getFullYear();
    const m2 = String(prox.getMonth() + 1).padStart(2, "0");
    const d2 = String(prox.getDate()).padStart(2, "0");
    dataInput.value = `${y2}-${m2}-${d2}`;
  }
})();

// ✅ Eventos com proteção
if (servicoSelect) {
  servicoSelect.addEventListener("change", gerarHorarios);
}

if (dataInput) {
  dataInput.addEventListener("change", () => {
    const dia = dataInput.value;
    if (!dia) {
      gerarHorarios();
      return;
    }

    const utc = parseYYYYMMDD(dia);
    if (!diaSemanaPermitidoUTC(utc)) {
      alert("Atendimento somente de terça a sábado. Vou ajustar para a próxima data válida.");
      const prox = proximaDataPermitidaLocal();
      const y2 = prox.getFullYear();
      const m2 = String(prox.getMonth() + 1).padStart(2, "0");
      const d2 = String(prox.getDate()).padStart(2, "0");
      dataInput.value = `${y2}-${m2}-${d2}`;
    }

    gerarHorarios();
  });
}

gerarHorarios();

// ======== INICIALIZAÇÃO (GARANTIR DATA + EVENTOS) ========
(function initData() {
  if (!dataInput) return;

  const hoje = new Date();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");

  // não deixa agendar no passado
  dataInput.min = `${yyyy}-${mm}-${dd}`;

  // se não tiver data selecionada ainda, seta uma válida
  if (!dataInput.value) {
    const prox = proximaDataPermitidaLocal();
    const y2 = prox.getFullYear();
    const m2 = String(prox.getMonth() + 1).padStart(2, "0");
    const d2 = String(prox.getDate()).padStart(2, "0");
    dataInput.value = `${y2}-${m2}-${d2}`;
  }
})();

// Eventos (garantir que existem)
if (servicoSelect) {
  servicoSelect.addEventListener("change", gerarHorarios);
}

if (dataInput) {
  dataInput.addEventListener("change", () => {
    const dia = dataInput.value;
    if (!dia) {
      gerarHorarios();
      return;
    }

    const utc = parseYYYYMMDD(dia);
    if (!diaSemanaPermitidoUTC(utc)) {
      alert("Atendimento somente de terça a sábado. Vou ajustar para a próxima data válida.");
      const prox = proximaDataPermitidaLocal();
      const y2 = prox.getFullYear();
      const m2 = String(prox.getMonth() + 1).padStart(2, "0");
      const d2 = String(prox.getDate()).padStart(2, "0");
      dataInput.value = `${y2}-${m2}-${d2}`;
    }

    gerarHorarios();
  });
}

renderSelectServicos();

gerarHorarios();

// botões do modal
document.getElementById("btnConfirmarModal")?.addEventListener("click", confirmarAgendamentoDoModal);
document.getElementById("btnCancelarModal")?.addEventListener("click", fecharModalConfirmacao);

// fechar modal clicando fora do card (opcional)
document.getElementById("modalConfirmacao")?.addEventListener("click", (e) => {
  if (e.target && e.target.id === "modalConfirmacao") fecharModalConfirmacao();
});


