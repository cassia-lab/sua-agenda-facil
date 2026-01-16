// ================== TÍTULO ==================
const adminTitulo = document.getElementById("adminTitulo");
adminTitulo.textContent = `Admin - ${window.APP_CONFIG?.nomePagina || "Sua Agenda Fácil"}`;
document.title = adminTitulo.textContent;

const senhaAdminConfig = window.APP_CONFIG?.senhaAdmin || "1234";

// ================== UI ==================
const adminSenha = document.getElementById("adminSenha");
const btnEntrarAdmin = document.getElementById("btnEntrarAdmin");
const adminConteudo = document.getElementById("adminConteudo");

const dataAdmin = document.getElementById("dataAdmin");
const diaFechadoSelect = document.getElementById("diaFechado");
const inicioAtendimentoInput = document.getElementById("inicioAtendimento");
const fimAtendimentoInput = document.getElementById("fimAtendimento");
const inicioAlmocoInput = document.getElementById("inicioAlmoco");
const fimAlmocoInput = document.getElementById("fimAlmoco");
const btnSalvarConfig = document.getElementById("btnSalvarConfig");

const btnConfirmarTodos = document.getElementById("btnConfirmarTodos");
const listaAgendamentos = document.getElementById("listaAgendamentos");
const painelAgendamentos = document.getElementById("painelAgendamentos");
const btnVerAgendamentos = document.getElementById("btnVerAgendamentos");

const novoServicoNome = document.getElementById("novoServicoNome");
const novoServicoDuracao = document.getElementById("novoServicoDuracao");
const btnAdicionarServico = document.getElementById("btnAdicionarServico");
const listaServicos = document.getElementById("listaServicos");
const btnToggleHorarios = document.getElementById("btnToggleHorarios");
const btnToggleServicos = document.getElementById("btnToggleServicos");
const secHorarios = document.getElementById("secHorarios");
const secServicos = document.getElementById("secServicos");
const dataAdminInput = document.getElementById("dataAdmin");


function toggleSection(el) {
  if (!el) return;
  const isHidden = (el.style.display === "none" || el.style.display === "");
  el.style.display = isHidden ? "block" : "none";
}

if (btnToggleHorarios) btnToggleHorarios.addEventListener("click", () => toggleSection(secHorarios));
if (btnToggleServicos) btnToggleServicos.addEventListener("click", () => toggleSection(secServicos));


// ================== PADRÕES ==================
const padrao = {
  diaInicio: 8 * 60,
  diaFim: 17 * 60,
  almocoInicio: 12 * 60,
  almocoFim: 13 * 60
};

// ================== STORAGE KEYS ==================
function keyAgendamentos(dia) {
  return `agendamentos:${dia}`;
}
function keyConfigDia(dia) {
  return `configDia:${dia}`;
}
// ================== STORAGE OPS ==================
function carregarAgendamentosDoDia(dia) {
  return JSON.parse(localStorage.getItem(keyAgendamentos(dia))) || [];
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

function salvarConfigDoDia(dia, cfg) {
  localStorage.setItem(keyConfigDia(dia), JSON.stringify(cfg));
}
function renderMapaDoDia(dia) {
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

  // config do dia
  const config = (typeof carregarConfigDoDia === "function")
    ? carregarConfigDoDia(dia)
    : { fechado:false, diaInicio:480, diaFim:1020, almocoInicio:720, almocoFim:780 };

  // agendamentos do dia
  const agendamentos = (typeof carregarAgendamentosDoDia === "function")
    ? carregarAgendamentosDoDia(dia)
    : (JSON.parse(localStorage.getItem(`agendamentos:${dia}`)) || []);

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
      const tel  = ag.telefone || "";
      const precoTxt = (ag.preco != null && String(ag.preco).trim() !== "")
        ? ` — ${String(ag.preco).startsWith("R$") ? ag.preco : `R$ ${ag.preco}`}`
        : "";

      const linha1 = document.createElement("div");
      linha1.style.fontSize = "13px";
      linha1.style.fontWeight = "600";
      linha1.textContent = `${serv}${precoTxt}`;
      //linha1.textContent = `Ocupado • ${serv}${precoTxt}`;

      const linha2 = document.createElement("div");
      linha2.style.fontSize = "12px";
      linha2.style.color = "#333";
      linha2.textContent = `${nome} • ${tel}`;

      const acoes = document.createElement("div");
      acoes.style.display = "flex";
      acoes.style.flexDirection = "column";
      acoes.style.gap = "8px";
      acoes.style.marginTop = "10px";
      acoes.style.alignItems = "flex-end";

      const btnWpp = document.createElement("button");
      btnWpp.textContent = "Confirmar (WhatsApp)";
      btnWpp.style.width = "auto";

      btnWpp.onclick = () => {
        // se você já tem uma função pronta, usamos ela:
        if (typeof abrirConfirmacaoWhatsApp === "function") {
          abrirConfirmacaoWhatsApp(dia, ag);
          return;
        }

        // fallback simples
        const telefone = String(ag.telefone || "").replace(/\D/g, "");
        if (!telefone) {
          alert("Sem telefone no agendamento.");
          return;
        }

        const dataBR = (dia || "").split("-").reverse().join("/");
        const msg =
`Olá ${nome}! 😊
Seu horário está confirmado ✅

Serviço: ${serv}
Data: ${dataBR}
Horário: ${hhmm(ag.start)} - ${hhmm(ag.end)}

Qualquer coisa, responda por aqui.`;

        window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`, "_blank");
      };

      const btnApagar = document.createElement("button");
      btnApagar.textContent = "Apagar";
      btnApagar.style.width = "auto";

      btnApagar.onclick = () => {
        const ok = confirm("Apagar este agendamento?");
        if (!ok) return;

        const lista = carregarAgendamentosDoDia(dia);
        const idx = lista.findIndex(a =>
          a.start === ag.start &&
          a.end === ag.end &&
          (a.telefone || "") === (ag.telefone || "") &&
          (a.nome || "") === (ag.nome || "") &&
          (a.servico || "") === (ag.servico || "")
        );

        if (idx >= 0) {
          lista.splice(idx, 1);
          salvarAgendamentosDoDia(dia, lista);
          renderMapaDoDia(dia);
          // se você ainda tiver lista antiga, atualiza também:
          if (typeof renderAgendamentos === "function") renderAgendamentos(dia);
        }
      };

      //acoes.appendChild(btnWpp);
      //acoes.appendChild(btnApagar);

      direita.appendChild(linha1);
      direita.appendChild(linha2);
      //direita.appendChild(acoes);
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

function confirmarAgendamentoAdmin(dia, start, telefone, servico) {
  if (!telefone) {
    alert("Esse agendamento não tem telefone.");
    return;
  }

  const ags = carregarAgendamentosDoDia(dia);
  const ag = ags.find(a => a.start === start);
  if (!ag) return;

  const dataBR = formatarDataBR(dia);
  const msg =
`Olá ${ag.nome || ""}! Confirmando seu horário ✅

Serviço: ${ag.servico || servico || ""}
Data: ${dataBR}
Hora: ${minutosParaHHMM(ag.start)}

Qualquer imprevisto é só avisar.`;

  const url = `https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

function apagarAgendamentoAdmin(dia, start) {
  const ok = confirm("Apagar esse agendamento?");
  if (!ok) return;

  const ags = carregarAgendamentosDoDia(dia);
  const novo = ags.filter(a => a.start !== start);
  salvarAgendamentosDoDia(dia, novo);

  // re-render
  renderMapaDoDia(dia);
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
function keyServicos() {
  // por enquanto, 1 lista por página (cliente)
  const slug = window.APP_CONFIG?.slug || "default";
  return `servicos:${slug}`;
}

function servicosPadrao() {
  return [
    { nome: "Pé", duracao: 50 },
    { nome: "Mão", duracao: 60 },
    { nome: "Pé + Mão", duracao: 120 }
  ];
}

function carregarServicos() {
  const s = JSON.parse(localStorage.getItem(keyServicos()));
  return Array.isArray(s) && s.length ? s : servicosPadrao();
}

function salvarServicos(lista) {
  localStorage.setItem(keyServicos(), JSON.stringify(lista));
}
// adicionar função //
function renderServicos() {
  const servicos = carregarServicos();
  listaServicos.innerHTML = "";

  servicos.forEach((s, idx) => {
    const linha = document.createElement("div");
    linha.style.display = "flex";
    linha.style.justifyContent = "space-between";
    linha.style.alignItems = "center";
    linha.style.borderBottom = "1px solid #eee";
    linha.style.padding = "8px 0";
    linha.style.gap = "10px";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${s.nome}</strong><br>
    <span>${s.duracao} min</span> • <span>${formatarPrecoBR(s.preco)}</span>`;

    function formatarPrecoBR(v) {
      const n = Number(v || 0);
      return n.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    }

    // ✅ botão EDITAR
    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.style.width = "auto";
    btnEditar.style.padding = "6px 10px";
    btnEditar.style.marginTop = "0";

    btnEditar.onclick = () => {
      const novoNome = prompt("Nome do serviço:", s.nome);
      if (!novoNome || !novoNome.trim()) return;

      const novaDur = parseInt(prompt("Duração em minutos", String(s.duracao)), 10);
      if (!novaDur || novaDur < 10) {
        alert("Duração inválida. Ex: 50, 60, 120.");
        return;
      }
      const precoAtual = (s.preco ?? 0);
      const novoPrecoRaw = prompt("Preço (ex: 55,00):", String(precoAtual).replace(".", ","));
      if (!novoPrecoRaw || !novoPrecoRaw.trim()) return;

      const novoPreco = parseFloat(novoPrecoRaw.replace(".", "").replace(",", "."));
      if (!novoPreco || novoPreco <= 0) {
        alert("Preço inválido.");
        return;
      }

      servicos[idx] = { nome: novoNome.trim(), duracao: novaDur, preco: novoPreco };
      salvarServicos(servicos);
      renderServicos();
      alert("Serviço atualizado ✅");
    };

    // ✅ botão APAGAR
    const btnApagar = document.createElement("button");
    btnApagar.textContent = "Apagar";
    btnApagar.style.width = "auto";
    btnApagar.style.padding = "6px 10px";
    btnApagar.style.marginTop = "0";

    btnApagar.onclick = () => {
      const ok = confirm(`Apagar o serviço "${s.nome}"?`);
      if (!ok) return;
      servicos.splice(idx, 1);
      salvarServicos(servicos);
      renderServicos();
      alert("Serviço removido ✅");
    };

    // Agrupa botões (fica mais bonito)
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

function limparAgendamentos() {
  const ok = confirm("Tem certeza? Isso apagará TODOS os agendamentos.");
  if (!ok) return;

  Object.keys(localStorage)
    .filter(k => k.startsWith("agendamentos:"))
    .forEach(k => localStorage.removeItem(k));

  alert("Agenda limpa com sucesso ✅");
  renderAgendaAdmin(); // se existir
}
// Adicionar o botão de adicionar serviço //
if (btnAdicionarServico) {
  btnAdicionarServico.addEventListener("click", () => {
    const nome = (novoServicoNome.value || "").trim();
    const dur = parseInt(novoServicoDuracao.value, 10);
    const precoRaw = (novoServicoPreco.value || "").trim();

    if (!nome) {
      alert("Digite o nome do serviço.");
      return;
    }

    if (!dur || dur < 10) {
      alert("Duração inválida.");
      return;
    }

    if (!precoRaw) {
      alert("Digite o preço. Ex: 55,00");
      return;
    }

    // aceita 55, 55,00 ou 55.00
    const preco = parseFloat(precoRaw.replace(".", "").replace(",", "."));
    if (!preco || preco <= 0) {
      alert("Preço inválido.");
      return;
    }

    const servicos = carregarServicos();
    servicos.push({
      nome,
      duracao: dur,
      preco: preco
    });

    salvarServicos(servicos);

    novoServicoNome.value = "";
    novoServicoDuracao.value = "";
    novoServicoPreco.value = "";

    renderServicos();
    alert("Serviço adicionado ✅");
  });
}

if (dataAdminInput) {
  // 1️⃣ define a data inicial (se ainda não tiver)
  if (!dataAdminInput.value) {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const dd = String(hoje.getDate()).padStart(2, "0");
    dataAdminInput.value = `${yyyy}-${mm}-${dd}`;
  }

  // 2️⃣ primeira renderização (IMPORTANTE)
  renderMapaDoDia(dataAdminInput.value);

  // 3️⃣ re-renderiza quando o admin muda a data
dataAdminInput.addEventListener("change", () => {
  const dia = dataAdminInput.value;
  renderMapaDoDia(dia);
  //renderAgendamentosDoDia?.(dia);
});


}


// ================== RENDER ==================
function renderAgendamentos(dia) {
  const listaAgendamentos = document.getElementById("listaAgendamentos");
  if (!listaAgendamentos) return; // <- IMPORTANTE (você removeu do HTML)

  const ags = carregarAgendamentosDoDia(dia).sort((a, b) => a.start - b.start);

  if (!ags.length) {
    listaAgendamentos.textContent = "Nenhum agendamento para este dia.";
    return;
  }

  listaAgendamentos.innerHTML = "";

  ags.forEach((ag, index) => {
    const linha = document.createElement("div");
    linha.style.display = "flex";
    linha.style.justifyContent = "space-between";
    linha.style.alignItems = "center";
    linha.style.gap = "10px";
    linha.style.padding = "10px 0";
    linha.style.borderBottom = "1px solid #eee";

    const info = document.createElement("div");
    info.style.display = "flex";
    info.style.flexDirection = "column";

    const topo = document.createElement("strong");
    topo.textContent = `${minutosParaHHMM(ag.start)} - ${minutosParaHHMM(ag.end)} | ${ag.servico || "Serviço"}`;

    const baixo = document.createElement("span");
    baixo.textContent = `${ag.nome || "Sem nome"} • ${ag.telefone || "Sem telefone"}`;

    info.appendChild(topo);
    info.appendChild(baixo);

    const botoes = document.createElement("div");
    botoes.style.display = "flex";
    botoes.style.flexDirection = "column";
    botoes.style.gap = "8px";

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.style.width = "auto";
    btnEditar.style.padding = "6px 10px";

    btnEditar.onclick = () => {
      const novoNome = prompt("Nome do serviço:", s.nome);
      if (!novoNome || !novoNome.trim()) return;

      const novaDur = parseInt(prompt("Duração em minutos:", String(s.duracao)), 10);
      if (!novaDur || novaDur < 10) {
        alert("Duração inválida.");
        return;
      }

      s.nome = novoNome.trim();
      s.duracao = novaDur;

      salvarServicos(servicos);
      renderServicos();
      alert("Serviço atualizado ✅");
    };

    // Confirmar individual (WhatsApp)
    const btnConfirmar = document.createElement("button");
    btnConfirmar.textContent = "Confirmar (WhatsApp)";
    btnConfirmar.style.width = "auto";
    btnConfirmar.style.padding = "6px 10px";
    btnConfirmar.style.marginTop = "0";

    btnConfirmar.onclick = () => {
      const url = abrirConfirmacaoWhatsApp(dia, ag);
      if (!url) {
        alert("Este agendamento está sem telefone do cliente.");
        return;
      }
      window.open(url, "_blank");
    };

    // Apagar
    const btnApagar = document.createElement("button");
    btnApagar.textContent = "Apagar";
    btnApagar.style.width = "auto";
    btnApagar.style.padding = "6px 10px";
    btnApagar.style.marginTop = "0";

    btnApagar.onclick = () => {
      const ok = confirm(
        `Apagar agendamento de ${ag.nome || "cliente"} (${ag.servico || "serviço"}) às ${minutosParaHHMM(ag.start)} do dia ${dia}?`
      );
      if (!ok) return;

      const listaAtual = carregarAgendamentosDoDia(dia);
      listaAtual.splice(index, 1);
      localStorage.setItem(keyAgendamentos(dia), JSON.stringify(listaAtual));

      renderAgendamentos(dia);
      alert("Agendamento apagado ✅");
    };

    botoes.appendChild(btnConfirmar);
    botoes.appendChild(btnApagar);

    linha.appendChild(info);
    linha.appendChild(botoes);
    listaAgendamentos.appendChild(linha);
  });
}

function carregarForm(dia) {
  const cfg = carregarConfigDoDia(dia);

  diaFechadoSelect.value = cfg.fechado ? "sim" : "nao";
  inicioAtendimentoInput.value = minutosParaHHMM(cfg.diaInicio);
  fimAtendimentoInput.value = minutosParaHHMM(cfg.diaFim);
  inicioAlmocoInput.value = minutosParaHHMM(cfg.almocoInicio);
  fimAlmocoInput.value = minutosParaHHMM(cfg.almocoFim);

  renderMapaDoDia(dia);
}

btnVerAgendamentos?.addEventListener("click", () => {
  const aberto = painelAgendamentos.style.display === "block";
  painelAgendamentos.style.display = aberto ? "none" : "block";

  // quando abrir, renderiza a lista do dia atual
  if (!aberto) {
    const dia = document.getElementById("dataAdmin")?.value;
    if (dia) renderAgendamentos?.(dia);
  }
});

// ================== LOGIN ==================
btnEntrarAdmin.addEventListener("click", () => {
  if (adminSenha.value !== senhaAdminConfig) {
    alert("Senha incorreta.");
    return;
  }

  adminConteudo.style.display = "block";
  carregarForm(dataAdmin.value);
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
dataAdmin.addEventListener("change", () => {
  if (adminConteudo.style.display === "block") {
    carregarForm(dataAdmin.value);
  }
});

// ================== SALVAR CONFIG ==================
btnSalvarConfig.addEventListener("click", () => {
  const dia = dataAdmin.value;
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
    alert("Preencha todos os horários.");
    return;
  }
  if (ini >= fim) {
    alert("Início precisa ser antes do fim.");
    return;
  }
  if (almIni > almFim) {
    alert("Almoço inválido (ou coloque igual para desativar).");
    return;
  }

  salvarConfigDoDia(dia, {
    fechado,
    diaInicio: ini,
    diaFim: fim,
    almocoInicio: almIni,
    almocoFim: almFim
  });

  alert("Configuração salva ✅");
  carregarForm(dia);
});

// ================== CONFIRMAR TODOS ==================
if (btnConfirmarTodos) {
  btnConfirmarTodos.addEventListener("click", () => {
    if (adminConteudo.style.display !== "block") {
      alert("Entre no admin primeiro.");
      return;
    }

    const dia = dataAdmin.value;
    if (!dia) {
      alert("Selecione uma data.");
      return;
    }

    const ags = carregarAgendamentosDoDia(dia).sort((a, b) => a.start - b.start);
    if (!ags.length) {
      alert("Não há agendamentos neste dia.");
      return;
    }

    const ok = confirm(
      `Vou abrir confirmações no WhatsApp para este dia.\n\nDica: permita pop-ups.\n\nContinuar?`
    );
    if (!ok) return;

    let i = 0;
    let enviados = 0;
    let semTelefone = 0;

    const delayMs = 800;

    function abrirProximo() {
      if (i >= ags.length) {
        alert(
          `Confirmações prontas ✅\n\n` +
          `Abertos no WhatsApp: ${enviados}\n` +
          `Sem telefone (pulados): ${semTelefone}`
        );
        return;
      }

      const ag = ags[i];
      i++;

      const url = abrirConfirmacaoWhatsApp(dia, ag);

      if (!url) {
        semTelefone++;
        setTimeout(abrirProximo, 50);
        return;
      }

      enviados++;
      window.open(url, "_blank");
      setTimeout(abrirProximo, delayMs);
    }

    abrirProximo();
  });
}
