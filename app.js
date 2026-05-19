const API_URL = "/api/sheets";

const CONFIG = {
  totalLotes: 84,
  lotesPermutante: 31,
  estoqueUP: 53,
  disponiveisReais: 33,
  bloqueados: 36,
  vendidosHistorico: 9,
  permutados: 1,
  comercializadosTotal: 10,
  reservados: 0,
  metaValorJunho: 4000000,
  metaLotesJunho: 23,
  vendidosPeriodo: 2,
  vendidosPeriodoLotes: [
    { quadra: "Araçá", lote: "19" },
    { quadra: "Baru", lote: "27" }
  ],
  verbaMidia: 540000,
  jurosAno: 0.12
};

const TAXA_MENSAL = Math.pow(1 + CONFIG.jurosAno, 1 / 12) - 1;

let CURRENT_USER = null;

let S = {
  raw: {},
  lotes: [],
  usuarios: [],
  listas: [],
  cfg: [],
  contratos: [],
  corretores: [],
  acoes: [],
  midia: [],
  gastos: []
};

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", fazerLogin);
  }

  const stored = readJSON("calliandra_user", null);

  if (stored) {
    CURRENT_USER = stored;
    entrarNoSistema();
  }
});

async function fazerLogin(event) {
  if (event) event.preventDefault();

  const email = document.getElementById("email")?.value.trim() || "";
  const senha = document.getElementById("senha")?.value.trim() || "";
  const msg = document.getElementById("loginMessage");

  if (!email || !senha) {
    if (msg) msg.innerText = "Informe e-mail e senha.";
    return;
  }

  if (msg) msg.innerText = "Entrando no sistema...";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "login",
        email,
        senha
      })
    });

    const data = await response.json();

    console.log("LOGIN RESPONSE:", data);

    const ok =
      data.ok ||
      data.success ||
      data.raw?.ok ||
      data.raw?.success;

    const usuario =
      data.usuario ||
      data.user ||
      data.raw?.usuario ||
      data.raw?.user ||
      null;

    if (!ok || !usuario) {
      if (msg) {
        msg.innerText =
          data.message ||
          data.error ||
          data.raw?.message ||
          data.raw?.error ||
          "Usuário ou senha inválidos.";
      }
      return;
    }

    CURRENT_USER = usuario;

    localStorage.setItem("calliandra_user", JSON.stringify(usuario));

    if (msg) msg.innerText = "Login realizado com sucesso.";

    await entrarNoSistema();

  } catch (error) {
    console.error("ERRO LOGIN:", error);
    if (msg) msg.innerText = "Erro ao conectar com a API.";
  }
}

async function entrarNoSistema() {
  document.getElementById("loginScreen")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");

  renderShell();

  await carregarDados();

  marcarVendasPeriodo();
  aplicarContratosLocaisNosLotes();

  go("dashboard");
}

function renderShell() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <aside class="sidebar">
      <img
        src="./assets/logo-calliandra-white.png"
        alt="Residencial Calliandra"
        class="sidebar-logo"
        onerror="this.style.display='none';document.getElementById('sidebarLogoFallback').style.display='block';"
      />
      <div id="sidebarLogoFallback" class="sidebar-logo-fallback">Calliandra</div>
      <div class="sidebar-subtitle">Sistema comercial</div>

      <nav class="menu">
        ${menuButton("dashboard", "📊", "Dashboard")}
        ${menuButton("cronograma", "📅", "Plano de ação")}
        ${menuButton("lotes", "🏡", "Lotes")}
        ${menuButton("simulador", "🧮", "Simulador")}
        ${menuButton("contratos", "📋", "Contratos")}
        ${menuButton("corretores", "🤝", "Corretores")}
        ${menuButton("midia", "📡", "Plano de mídia")}
        ${menuButton("orcamento", "💰", "Físico-financeiro")}
        ${menuButton("relatorios", "📈", "Relatórios")}
        ${menuButton("mapa", "🗺️", "Mapa comercial")}
        ${menuButton("configuracoes", "⚙️", "Configurações")}
      </nav>
    </aside>

    <main class="content">
      <header class="topbar">
        <h1 id="pageTitle">Dashboard</h1>
        <div class="userbox">
          <span>${CURRENT_USER?.nome || CURRENT_USER?.email || "Usuário"}</span>
          <button class="btn-logout" onclick="logout()">Sair</button>
        </div>
      </header>

      <section id="view" class="view"></section>
    </main>
  `;
}

function menuButton(page, icon, label) {
  return `
    <button class="menu-item" data-page="${page}" onclick="go('${page}')">
      <span>${icon}</span>
      ${label}
    </button>
  `;
}

async function carregarDados() {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "getAll"
      })
    });

    const result = await response.json();

    console.log("GETALL RESPONSE:", result);

    S.raw = result;

    const data =
      result.data ||
      result.raw?.data ||
      result.raw ||
      {};

    S.lotes = getSheet(data, "lotes").map(normalizarLote);
    S.usuarios = getSheet(data, "usuarios");
    S.listas = getSheet(data, "listas");
    S.cfg = getSheet(data, "cfg");

    S.contratos = mergeLocal("calliandra_contratos", getSheet(data, "vendas").map(normalizarContrato));
    S.corretores = mergeLocal("calliandra_corretores", montarCorretores(data));
    S.acoes = mergeLocal("calliandra_acoes", getSheet(data, "acoes").map(normalizarAcao));
    S.midia = mergeLocal("calliandra_midia", getSheet(data, "midia").map(normalizarMidia));
    S.gastos = mergeLocal("calliandra_gastos", getSheet(data, "gastos").map(normalizarGasto));

    if (!S.acoes.length) S.acoes = getAcoesPadrao();
    if (!S.midia.length) S.midia = getMidiaPadrao();
    if (!S.gastos.length) S.gastos = getGastosPadrao();

  } catch (error) {
    console.error("ERRO CARREGAR DADOS:", error);
    toast("Não foi possível carregar os dados da planilha.", "err");

    S.lotes = [];
    S.contratos = readJSON("calliandra_contratos", []);
    S.corretores = getCorretoresPadrao();
    S.acoes = getAcoesPadrao();
    S.midia = getMidiaPadrao();
    S.gastos = getGastosPadrao();
  }
}

function getSheet(data, key) {
  const normalizedKey = texto(key);

  const foundKey = Object.keys(data || {}).find(k => texto(k) === normalizedKey);

  if (!foundKey) return [];

  const value = data[foundKey];

  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;

  return [];
}

function normalizarLote(row, index) {
  const id = pick(row, ["id_lote", "id", "codigo", "código"]) || `L${index + 1}`;

  const lote = {
    id,
    empreendimento: pick(row, ["empreendimento"]) || "Residencial Calliandra",
    quadra: pick(row, ["quadra"]) || "",
    rua: pick(row, ["rua"]) || "",
    lote: pick(row, ["lote", "numero", "número"]) || "",
    area: num(pick(row, ["area_m2", "area", "área", "metragem", "m2", "m²"])),
    frente: pick(row, ["frente_m", "frente"]) || "",
    fundo: pick(row, ["fundo_m", "fundo"]) || "",
    lateral1: pick(row, ["lateral_1_m", "lateral_1"]) || "",
    lateral2: pick(row, ["lateral_2_m", "lateral_2"]) || "",
    tipologia: pick(row, ["tipologia"]) || "",
    precoM2: num(pick(row, ["preco_m2_base", "preco_m2", "preço_m2", "valor_m2"])) || 1408.14,
    precoM2Final: num(pick(row, ["preco_m2_final"])) || 0,
    valor: num(pick(row, ["valor_tabela", "valor_total", "valor", "preco_total", "preço_total"])),
    fator: pick(row, ["fator"]) || "",
    statusComercial: pick(row, ["status_comercial", "status_venda", "status"]) || "",
    statusLote: pick(row, ["status_lote", "situacao", "situação"]) || "",
    proprietarioOrigem: pick(row, ["proprietario_origem", "proprietário_origem", "origem"]) || "",
    origemStatus: pick(row, ["origem_status"]) || "",
    observacoes: pick(row, ["observacoes", "observações", "obs"]) || "",
    anotacao: pick(row, ["anotacao_lote", "anotacao", "anotação"]) || "",
    vendavelOriginal: pick(row, ["vendavel", "vendável"]) || "",
    motivoBloqueio: pick(row, ["motivo_bloqueio"]) || "",
    podeVenderComObservacao: pick(row, ["pode_vender_com_observacao"]) || "",
    estoqueComercial: pick(row, ["estoque_comercial"]) || "",
    raw: row
  };

  lote.valor = lote.valor || lote.area * lote.precoM2;

  const baseTexto = texto([
    lote.statusComercial,
    lote.statusLote,
    lote.proprietarioOrigem,
    lote.origemStatus,
    lote.observacoes,
    lote.anotacao,
    lote.vendavelOriginal,
    lote.motivoBloqueio,
    lote.estoqueComercial
  ].join(" "));

  const isCasa =
    baseTexto.includes("casa calliandra") ||
    texto(lote.rua).includes("casa calliandra");

  const isGarantiaGDF =
    baseTexto.includes("garantia gdf") ||
    baseTexto.includes("garantia ao gdf") ||
    baseTexto.includes("gdf");

  const isPermutante =
    baseTexto.includes("permutante");

  const isPermutado =
    baseTexto.includes("permutado");

  const isVendido =
    baseTexto.includes("vendido") ||
    baseTexto.includes("contrato") ||
    baseTexto.includes("pago");

  const isReservado =
    baseTexto.includes("reservado") ||
    baseTexto.includes("reserva");

  const vendaNaoPermitida =
    baseTexto.includes("nao") ||
    baseTexto.includes("não");

  const isBloqueado =
    baseTexto.includes("bloqueado") ||
    baseTexto.includes("desenvolve") ||
    baseTexto.includes("comprometido") ||
    baseTexto.includes("indisponivel") ||
    baseTexto.includes("indisponível") ||
    isPermutante ||
    isCasa ||
    vendaNaoPermitida;

  lote.isCasaCalliandra = isCasa;
  lote.isGarantiaGDF = isGarantiaGDF;
  lote.isPermutante = isPermutante;
  lote.isPermutado = isPermutado;

  lote.vendavel =
    !isCasa &&
    !isPermutante &&
    (!isBloqueado || isGarantiaGDF) &&
    !isVendido &&
    !isPermutado;

  if (isVendido) lote.statusSistema = "Vendido";
  else if (isPermutado) lote.statusSistema = "Permutado";
  else if (isReservado) lote.statusSistema = "Reservado";
  else if (isCasa) lote.statusSistema = "Casa Calliandra";
  else if (isPermutante) lote.statusSistema = "Permutante";
  else if (isGarantiaGDF) lote.statusSistema = "Garantia GDF";
  else if (isBloqueado) lote.statusSistema = "Bloqueado";
  else lote.statusSistema = "Disponível";

  return lote;
}

function normalizarContrato(row) {
  const quadra = pick(row, ["quadra"]) || "";
  const rua = pick(row, ["rua"]) || "";
  const lote = pick(row, ["lote", "id_lote"]) || "";

  const valorTabela = num(pick(row, [
    "valor_tabela",
    "valor_lote",
    "valor",
    "preco_tabela"
  ]));

  const valorFinal = num(pick(row, [
    "valor_final",
    "valor_negociado",
    "valor_venda",
    "valor"
  ])) || valorTabela;

  return {
    id: pick(row, ["id", "id_contrato", "id_venda"]) || uid(),
    data: pick(row, ["data", "data_venda", "criado_em"]) || "",
    cliente: pick(row, ["cliente", "nome", "nome_cliente"]) || "",
    quadra,
    rua,
    lote,
    area: num(pick(row, ["area_m2", "area", "metragem", "m2"])),
    valorTabela,
    valorFinal,
    desconto: num(pick(row, ["desconto", "desconto_concedido"])),
    status: pick(row, ["status_venda", "status", "situacao"]) || "Contrato",
    corretor: pick(row, ["parceiro_comercial", "corretor", "parceiro", "imobiliaria", "imobiliária"]) || "",
    origem: pick(row, ["origem_lead", "origem", "canal"]) || "",
    formaPagamento: pick(row, ["forma_pagamento", "pagamento"]) || "",
    tipoOperacao: pick(row, ["tipo_operacao", "tipo_operação"]) || "",
    comissaoValor: num(pick(row, ["comissao", "comissão", "valor_comissao"])),
    raw: row
  };
}

function normalizarAcao(row) {
  return {
    id: pick(row, ["id", "id_acao"]) || uid(),
    fase: pick(row, ["fase", "fase_comercial", "etapa"]) || "Venda antecipada",
    acao: pick(row, ["acao", "ação", "atividade"]) || "",
    responsavel: pick(row, ["responsavel", "responsável"]) || "",
    data: pick(row, ["data", "prazo"]) || "",
    orcamento: num(pick(row, ["orcamento", "orçamento", "custo", "valor"])),
    status: pick(row, ["status", "status_acao"]) || "Planejada",
    prioridade: pick(row, ["prioridade"]) || "Média",
    obs: pick(row, ["obs", "observacoes", "observações"]) || ""
  };
}

function normalizarMidia(row) {
  return {
    id: pick(row, ["id"]) || uid(),
    campanha: pick(row, ["campanha", "acao", "ação"]) || "Campanha Calliandra",
    canal: pick(row, ["canal", "canais_midia"]) || "",
    objetivo: pick(row, ["objetivo"]) || "",
    periodo: pick(row, ["periodo", "período"]) || "",
    previsto: num(pick(row, ["previsto", "orcamento", "orçamento"])),
    realizado: num(pick(row, ["realizado", "executado"])),
    leads: num(pick(row, ["leads"])),
    status: pick(row, ["status"]) || "Planejado"
  };
}

function normalizarGasto(row) {
  return {
    id: pick(row, ["id"]) || uid(),
    categoria: pick(row, ["categoria", "categoria_orcamento"]) || "",
    item: pick(row, ["item", "microacao", "microação", "acao", "ação"]) || "",
    previsto: num(pick(row, ["previsto", "orcado", "orçado"])),
    realizado: num(pick(row, ["realizado", "executado", "pago"])),
    status: pick(row, ["status"]) || "Planejado"
  };
}

function montarCorretores(data) {
  const corretoresAba = getSheet(data, "corretores");

  if (corretoresAba.length) {
    return corretoresAba.map(normalizarCorretor);
  }

  const parceiros = getSheet(data, "listas")
    .map(row => pick(row, ["parceiro_comercial", "parceiro", "nome"]))
    .filter(Boolean);

  const unicos = [...new Set(parceiros)];

  if (!unicos.length) return getCorretoresPadrao();

  return unicos.map(nome => {
    const categoria = texto(nome).includes("beiramar") || texto(nome).includes("benamar") ? "Ouro" : "Prata";
    return {
      id: uid(),
      nome,
      categoria,
      vendas: 0,
      comissao: categoria === "Ouro" ? "5%" : "4,5%"
    };
  });
}

function normalizarCorretor(row) {
  const nome = pick(row, [
    "parceiro_comercial",
    "nome",
    "corretor",
    "parceiro",
    "imobiliaria",
    "imobiliária"
  ]) || "";

  const categoria = pick(row, ["categoria_parceiro", "categoria"]) || "Prata";

  let comissao = pick(row, ["comissao", "comissão"]) || "";

  if (!comissao) {
    comissao = texto(categoria).includes("ouro") ? "5%" : "4,5%";
  }

  return {
    id: pick(row, ["id", "id_corretor"]) || uid(),
    nome,
    categoria,
    vendas: num(pick(row, ["vendas"])),
    comissao
  };
}

function getCorretoresPadrao() {
  return [
    { id: uid(), nome: "Humanize", categoria: "Prata", vendas: 0, comissao: "4,5%" },
    { id: uid(), nome: "GM", categoria: "Prata", vendas: 0, comissao: "4,5%" },
    { id: uid(), nome: "Beiramar", categoria: "Ouro", vendas: 0, comissao: "5%" },
    { id: uid(), nome: "MJ", categoria: "Prata", vendas: 0, comissao: "4,5%" },
    { id: uid(), nome: "Enzo", categoria: "Prata", vendas: 0, comissao: "4,5%" },
    { id: uid(), nome: "HouseUP", categoria: "Prata", vendas: 0, comissao: "4,5%" },
    { id: uid(), nome: "Torres Imob", categoria: "Prata", vendas: 0, comissao: "4,5%" }
  ];
}

function marcarVendasPeriodo() {
  CONFIG.vendidosPeriodoLotes.forEach(item => {
    const lote = S.lotes.find(l =>
      same(l.quadra, item.quadra) &&
      same(l.lote, item.lote)
    );

    if (lote) {
      lote.statusSistema = "Vendido";
      lote.vendavel = false;
    }
  });
}

function aplicarContratosLocaisNosLotes() {
  S.contratos.forEach(c => {
    const lote = S.lotes.find(l =>
      same(l.quadra, c.quadra) &&
      same(l.lote, c.lote)
    );

    if (!lote) return;

    if (isVendido(c.status)) {
      lote.statusSistema = "Vendido";
      lote.vendavel = false;
    }

    if (texto(c.status).includes("reserv")) {
      lote.statusSistema = "Reservado";
      lote.vendavel = false;
    }
  });
}

function go(page) {
  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  const titles = {
    dashboard: "Dashboard",
    cronograma: "Plano de ação",
    lotes: "Lotes",
    simulador: "Simulador comercial",
    contratos: "Contratos",
    corretores: "Corretores",
    midia: "Plano de mídia",
    orcamento: "Cronograma físico-financeiro",
    relatorios: "Relatórios",
    mapa: "Mapa comercial",
    configuracoes: "Configurações"
  };

  document.getElementById("pageTitle").innerText = titles[page] || "Sistema Comercial";

  const renders = {
    dashboard: renderDashboard,
    cronograma: renderCronograma,
    lotes: renderLotes,
    simulador: renderSimulador,
    contratos: renderContratos,
    corretores: renderCorretores,
    midia: renderMidia,
    orcamento: renderOrcamento,
    relatorios: renderRelatorios,
    mapa: renderMapa,
    configuracoes: renderConfiguracoes
  };

  renders[page]?.();
}

function dashboardStats() {
  const lotes = S.lotes || [];

  const total = lotes.length || CONFIG.totalLotes;

  const disponiveisCalc = lotes.filter(l =>
    l.statusSistema === "Disponível" ||
    l.statusSistema === "Garantia GDF"
  ).length;

  const vendidosCalc = lotes.filter(l => l.statusSistema === "Vendido").length;
  const permutadosCalc = lotes.filter(l => l.statusSistema === "Permutado").length;
  const reservadosCalc = lotes.filter(l => l.statusSistema === "Reservado").length;
  const bloqueadosCalc = lotes.filter(l =>
    ["Bloqueado", "Permutante", "Casa Calliandra"].includes(l.statusSistema)
  ).length;

  const vgvTotal = soma(lotes, "valor");
  const vgvDisponivel = soma(lotes.filter(l => l.vendavel), "valor");
  const vgvVendido = soma(lotes.filter(l => l.statusSistema === "Vendido"), "valor");
  const vgvMetaPeriodo = soma(
    CONFIG.vendidosPeriodoLotes
      .map(item => lotes.find(l => same(l.quadra, item.quadra) && same(l.lote, item.lote)))
      .filter(Boolean),
    "valor"
  );

  return {
    total,
    estoqueUP: CONFIG.estoqueUP,
    permutante: CONFIG.lotesPermutante,
    disponiveis: disponiveisCalc || CONFIG.disponiveisReais,
    vendidos: vendidosCalc || CONFIG.vendidosHistorico,
    permutados: permutadosCalc || CONFIG.permutados,
    comercializados: (vendidosCalc + permutadosCalc) || CONFIG.comercializadosTotal,
    reservados: reservadosCalc || CONFIG.reservados,
    bloqueados: bloqueadosCalc || CONFIG.bloqueados,
    metaValor: CONFIG.metaValorJunho,
    metaLotes: CONFIG.metaLotesJunho,
    vendidosPeriodo: CONFIG.vendidosPeriodo,
    faltamLotes: CONFIG.metaLotesJunho - CONFIG.vendidosPeriodo,
    vgvTotal,
    vgvDisponivel,
    vgvVendido,
    vgvMetaPeriodo,
    ticketMedio: vendidosCalc ? vgvVendido / vendidosCalc : 0
  };
}

function renderDashboard() {
  const s = dashboardStats();
  const pctValor = pct(s.vgvMetaPeriodo, s.metaValor);
  const pctLotes = pct(s.vendidosPeriodo, s.metaLotes);

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Visão comercial do Calliandra</h2>
        <p class="muted">Controle de estoque, metas, lotes comercializados e desempenho até 30 de junho.</p>
      </div>
      <div class="actions-row">
        <button class="btn-ghost" onclick="carregarDados().then(()=>{marcarVendasPeriodo();aplicarContratosLocaisNosLotes();renderDashboard();})">Atualizar dados</button>
        <button class="btn-ghost" onclick="window.print()">Imprimir</button>
      </div>
    </div>

    <div class="cards-grid">
      ${metric("Lotes totais", s.total, "Total do empreendimento")}
      ${metric("Estoque UP", `${s.estoqueUP}`, "53 lotes comercializáveis pela UP")}
      ${metric("Disponíveis reais", `${s.disponiveis}`, `33 disponíveis de ${s.estoqueUP}`)}
      ${metric("Bloqueados", s.bloqueados, "Inclui permutante, casa e restrições")}
      ${metric("Vendidos", s.vendidos, "Histórico comercial")}
      ${metric("Permutado", s.permutados, "Comercialização sem venda direta")}
      ${metric("Comercializados", s.comercializados, "9 vendidos + 1 permutado")}
      ${metric("Reservados", s.reservados, "Nenhuma reserva ativa")}
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">Meta de vendas de 01/04 a 30/06</div>
        <div class="grid-3">
          ${metric("Meta financeira", moeda(s.metaValor), `${pctValor}% realizado no período`, pctValor)}
          ${metric("Meta unidades", `${s.vendidosPeriodo}/${s.metaLotes}`, `${pctLotes}% da meta quantitativa`, pctLotes)}
          ${metric("Faltam vender", s.faltamLotes, "Lotes para bater a meta de junho")}
        </div>

        <div style="margin-top:18px">
          ${pipelineRow("Meta financeira", s.vgvMetaPeriodo, s.metaValor, true)}
          ${pipelineRow("Meta unidades", s.vendidosPeriodo, s.metaLotes, false)}
        </div>

        <div class="notice">
          A meta de 23 lotes considera vendas entre 01/04 e 30/06. No período, já constam Araçá 19 e Baru 27. Faltam 21 lotes.
        </div>
      </div>

      <div class="card">
        <div class="card-title">Resumo de estoque</div>
        ${pipelineRow("Disponíveis reais", s.disponiveis, s.estoqueUP, false)}
        ${pipelineRow("Comercializados", s.comercializados, s.total, false)}
        ${pipelineRow("Bloqueados", s.bloqueados, s.total, false)}
        ${pipelineRow("Permutante", s.permutante, s.total, false)}
      </div>
    </div>

    <div class="table-wrapper">
      <div class="table-title">Lotes vendidos no período da meta</div>
      <table>
        <thead>
          <tr>
            <th>Quadra</th>
            <th>Lote</th>
            <th>Área</th>
            <th>Valor tabela</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${CONFIG.vendidosPeriodoLotes.map(item => {
            const lote = S.lotes.find(l => same(l.quadra, item.quadra) && same(l.lote, item.lote));
            return `
              <tr>
                <td>${item.quadra}</td>
                <td>${item.lote}</td>
                <td>${lote ? area(lote.area) : "-"}</td>
                <td>${lote ? moeda(lote.valor) : "-"}</td>
                <td>${badge("Vendido")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCronograma() {
  const fases = ["Venda antecipada", "Lançamento", "Pós-lançamento", "Manutenção"];

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Plano de ação comercial</h2>
        <p class="muted">Cronograma operacional e físico-financeiro por fase, com ação, data, custo, status e responsável.</p>
      </div>
      <button class="btn-primary btn-fit" onclick="abrirModalAcao()">Nova ação</button>
    </div>

    ${fases.map((fase, index) => {
      const acoes = S.acoes.filter(a => same(a.fase, fase));

      return `
        <div class="phase-card ${index === 0 ? "open" : ""}">
          <div class="phase-head" onclick="this.parentElement.classList.toggle('open')">
            <div>
              <h3>${fase}</h3>
              <p class="muted">${acoes.length} ações · ${moeda(soma(acoes, "orcamento"))} previsto</p>
            </div>
            <button class="btn-small" type="button">+</button>
          </div>

          <div class="phase-body">
            <div class="table-wrapper" style="margin-top:0">
              <table>
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th>Responsável</th>
                    <th>Data</th>
                    <th>Orçamento</th>
                    <th>Status</th>
                    <th>Prioridade</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  ${acoes.map(a => `
                    <tr>
                      <td>${a.acao || "-"}</td>
                      <td>${a.responsavel || "-"}</td>
                      <td>${a.data || "-"}</td>
                      <td>${moeda(a.orcamento)}</td>
                      <td>${badge(a.status)}</td>
                      <td>${a.prioridade || "-"}</td>
                      <td>${a.obs || "-"}</td>
                    </tr>
                  `).join("") || emptyRow(7, "Nenhuma ação cadastrada para esta fase.")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function renderLotes() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Gestão de lotes</h2>
        <p class="muted">Inventário comercial do Calliandra com status, metragem, valor e disponibilidade real.</p>
      </div>

      <div class="actions-row">
        <input id="buscaLotes" class="search-input" placeholder="Buscar lote, rua, quadra ou status..." oninput="filtrarLotes()">
        <button class="btn-ghost" onclick="renderSimulador()">Simular venda</button>
      </div>
    </div>

    <div class="cards-grid">
      ${metric("Total", CONFIG.totalLotes)}
      ${metric("Disponíveis reais", dashboardStats().disponiveis)}
      ${metric("Bloqueados", dashboardStats().bloqueados)}
      ${metric("Comercializados", dashboardStats().comercializados)}
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Quadra</th>
            <th>Rua</th>
            <th>Lote</th>
            <th>Área</th>
            <th>Preço m²</th>
            <th>Valor tabela</th>
            <th>Status</th>
            <th>Observação</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody id="tbodyLotes">
          ${rowsLotes(S.lotes)}
        </tbody>
      </table>
    </div>
  `;
}

function rowsLotes(lotes) {
  if (!lotes.length) {
    return emptyRow(10, "Nenhum lote foi carregado da planilha.");
  }

  return lotes.map(l => `
    <tr data-search="${texto([l.id, l.quadra, l.rua, l.lote, l.statusSistema, l.observacoes, l.anotacao].join(" "))}">
      <td>${l.id}</td>
      <td>${l.quadra || "-"}</td>
      <td>${l.rua || "-"}</td>
      <td>${l.lote || "-"}</td>
      <td>${area(l.area)}</td>
      <td>${moeda(l.precoM2)}</td>
      <td>${moeda(l.valor)}</td>
      <td>${badge(l.statusSistema)}</td>
      <td>${l.motivoBloqueio || l.anotacao || l.observacoes || "-"}</td>
      <td><button class="btn-small" onclick="renderSimulador('${l.id}')">Simular</button></td>
    </tr>
  `).join("");
}

function filtrarLotes() {
  const busca = texto(document.getElementById("buscaLotes")?.value || "");

  document.querySelectorAll("#tbodyLotes tr").forEach(tr => {
    tr.style.display = tr.dataset.search.includes(busca) ? "" : "none";
  });
}

function renderSimulador(loteId = "") {
  const lotes = S.lotes.filter(l =>
    l.statusSistema === "Disponível" ||
    l.statusSistema === "Garantia GDF" ||
    l.vendavel
  );

  const lista = lotes.length ? lotes : S.lotes;

  document.getElementById("pageTitle").innerText = "Simulador comercial";
  document.querySelectorAll(".menu-item").forEach(btn => btn.classList.toggle("active", btn.dataset.page === "simulador"));

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Simulador comercial</h2>
        <p class="muted">Simulação por lote, com desconto à vista, entrada de 50%, financiamento Price e SAC.</p>
      </div>
      <button class="btn-ghost" onclick="window.print()">Imprimir simulação</button>
    </div>

    <div class="simulador-grid">
      <div class="card">
        <div class="field">
          <label>Lote</label>
          <select id="simLote" onchange="atualizarSimulacao()">
            ${lista.map(l => `
              <option value="${l.id}" ${l.id === loteId ? "selected" : ""}>
                ${l.quadra} ${l.lote} · ${area(l.area)} · ${moeda(l.valor)} · ${l.statusSistema}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="field" style="margin-top:14px">
          <label>Condição comercial</label>
          <select id="simCondicao" onchange="ajustarCondicao(); atualizarSimulacao();">
            <option value="avista">À vista · 5% de desconto</option>
            <option value="entrada50">Entrada 50% · 2,5% de desconto</option>
            <option value="ate36" selected>Financiamento até 36x · 12% a.a.</option>
            <option value="acima36">Financiamento acima de 36x · 12% a.a. + IPCA</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>

        <div class="field" style="margin-top:14px">
          <label>Entrada (%)</label>
          <input id="simEntrada" type="number" value="30" min="0" max="100" oninput="atualizarSimulacao()">
        </div>

        <div class="field" style="margin-top:14px">
          <label>Parcelas</label>
          <input id="simParcelas" type="number" value="36" min="0" max="180" oninput="atualizarSimulacao()">
        </div>

        <div class="field" style="margin-top:14px">
          <label>Desconto adicional negociado (R$)</label>
          <input id="simDescontoExtra" type="number" value="0" min="0" oninput="atualizarSimulacao()">
        </div>

        <div class="notice">
          À vista: 5% de desconto. Entrada de 50%: 2,5% de desconto. Até 36 parcelas: juros de 12% ao ano sem correção monetária. Acima de 36 parcelas: juros de 12% ao ano + IPCA, sem projeção automática do índice.
        </div>
      </div>

      <div class="card">
        <div class="card-title">Resultado da simulação</div>
        <div id="resultadoSimulacao"></div>
      </div>
    </div>
  `;

  ajustarCondicao();
  atualizarSimulacao();
}

function ajustarCondicao() {
  const cond = document.getElementById("simCondicao")?.value;
  const entrada = document.getElementById("simEntrada");
  const parcelas = document.getElementById("simParcelas");

  if (!entrada || !parcelas) return;

  if (cond === "avista") {
    entrada.value = 100;
    parcelas.value = 0;
  }

  if (cond === "entrada50") {
    entrada.value = 50;
    parcelas.value = 6;
  }

  if (cond === "ate36") {
    entrada.value = 30;
    parcelas.value = 36;
  }

  if (cond === "acima36") {
    entrada.value = 30;
    parcelas.value = 120;
  }
}

function atualizarSimulacao() {
  const id = document.getElementById("simLote")?.value;
  const lote = S.lotes.find(l => l.id === id);

  if (!lote) {
    document.getElementById("resultadoSimulacao").innerHTML = `<div class="empty">Nenhum lote selecionado.</div>`;
    return;
  }

  const cond = document.getElementById("simCondicao")?.value || "ate36";
  const entradaPct = num(document.getElementById("simEntrada")?.value);
  const parcelas = num(document.getElementById("simParcelas")?.value);
  const descontoExtra = num(document.getElementById("simDescontoExtra")?.value);

  let descontoPct = 0;

  if (cond === "avista") descontoPct = 5;
  if (cond === "entrada50") descontoPct = 2.5;

  const descontoAutomatico = lote.valor * (descontoPct / 100);
  const descontoTotal = descontoAutomatico + descontoExtra;
  const valorFinal = Math.max(lote.valor - descontoTotal, 0);
  const entradaValor = valorFinal * (entradaPct / 100);
  const saldo = Math.max(valorFinal - entradaValor, 0);
  const parcelaPriceValor = parcelas > 0 ? parcelaPrice(saldo, parcelas, TAXA_MENSAL) : 0;
  const sac = parcelas > 0 ? parcelaSAC(saldo, parcelas, TAXA_MENSAL) : null;
  const temIPCA = parcelas > 36;

  document.getElementById("resultadoSimulacao").innerHTML = `
    <div class="grid-3">
      <div class="cond-card">
        <h4>Lote</h4>
        <div class="result-line"><span>Quadra</span><strong>${lote.quadra || "-"}</strong></div>
        <div class="result-line"><span>Lote</span><strong>${lote.lote || "-"}</strong></div>
        <div class="result-line"><span>Área</span><strong>${area(lote.area)}</strong></div>
        <div class="result-line"><span>Status</span><strong>${lote.statusSistema}</strong></div>
      </div>

      <div class="cond-card">
        <h4>Preço</h4>
        <div class="result-line"><span>Valor tabela</span><strong>${moeda(lote.valor)}</strong></div>
        <div class="result-line"><span>Desconto automático</span><strong>${moeda(descontoAutomatico)}</strong></div>
        <div class="result-line"><span>Desconto adicional</span><strong>${moeda(descontoExtra)}</strong></div>
        <div class="result-line"><span>Valor negociado</span><strong>${moeda(valorFinal)}</strong></div>
      </div>

      <div class="cond-card ${temIPCA ? "alert" : ""}">
        <h4>Pagamento</h4>
        <div class="result-line"><span>Entrada</span><strong>${moeda(entradaValor)}</strong></div>
        <div class="result-line"><span>Saldo</span><strong>${moeda(saldo)}</strong></div>
        <div class="result-line"><span>Parcelas</span><strong>${parcelas || "Não se aplica"}</strong></div>
        <div class="result-line"><span>Price</span><strong>${parcelas ? moeda(parcelaPriceValor) : "Não se aplica"}</strong></div>
      </div>
    </div>

    <div class="notice">
      ${temIPCA
        ? "Atenção: esta simulação ultrapassa 36 parcelas. O contrato deve prever juros de 12% ao ano + IPCA. O sistema não projeta o IPCA, apenas registra a incidência."
        : "Condição dentro de até 36 parcelas: juros de 12% ao ano, sem correção monetária."}
    </div>

    <div class="grid-2" style="margin-top:22px">
      <div class="table-wrapper" style="margin-top:0">
        <div class="table-title">Tabela Price · primeiras 12 parcelas</div>
        ${tabelaPrice(saldo, parcelas)}
      </div>

      <div class="table-wrapper" style="margin-top:0">
        <div class="table-title">Tabela SAC · primeiras 12 parcelas</div>
        ${tabelaSac(saldo, parcelas)}
      </div>
    </div>
  `;
}

function renderContratos() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Contratos, reservas e propostas</h2>
        <p class="muted">Cadastro de operações comerciais com lote, metragem, preço de tabela, desconto, valor negociado, corretor e origem.</p>
      </div>
      <button class="btn-primary btn-fit" onclick="abrirModalContrato()">Novo contrato</button>
    </div>

    <div class="cards-grid">
      ${metric("Contratos locais", S.contratos.length)}
      ${metric("VGV cadastrado", moeda(soma(S.contratos, "valorFinal")))}
      ${metric("Comissões", moeda(soma(S.contratos, "comissaoValor")))}
      ${metric("Ticket médio", moeda(media(S.contratos, "valorFinal")))}
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Cliente</th>
            <th>Quadra</th>
            <th>Lote</th>
            <th>Área</th>
            <th>Valor tabela</th>
            <th>Desconto</th>
            <th>Valor negociado</th>
            <th>Status</th>
            <th>Corretor</th>
            <th>Origem</th>
          </tr>
        </thead>
        <tbody>
          ${S.contratos.map(c => `
            <tr>
              <td>${c.data || "-"}</td>
              <td>${c.cliente || "-"}</td>
              <td>${c.quadra || "-"}</td>
              <td>${c.lote || "-"}</td>
              <td>${area(c.area)}</td>
              <td>${moeda(c.valorTabela)}</td>
              <td>${moeda(c.desconto)}</td>
              <td>${moeda(c.valorFinal)}</td>
              <td>${badge(c.status)}</td>
              <td>${c.corretor || "-"}</td>
              <td>${c.origem || "-"}</td>
            </tr>
          `).join("") || emptyRow(11, "Nenhum contrato cadastrado.")}
        </tbody>
      </table>
    </div>
  `;
}

function abrirModalContrato() {
  const lotes = S.lotes.filter(l =>
    l.statusSistema === "Disponível" ||
    l.statusSistema === "Garantia GDF" ||
    l.vendavel
  );

  const hoje = new Date().toISOString().slice(0, 10);

  openModal(`
    <div class="modal">
      <div class="modal-head">
        <h3>Novo contrato / reserva / proposta</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          ${input("ctData", "Data", "date", hoje)}
          ${input("ctCliente", "Nome do cliente", "text", "")}

          <div class="field">
            <label>Lote</label>
            <select id="ctLote" onchange="preencherContratoPorLote()">
              ${lotes.map(l => `<option value="${l.id}">${l.quadra} ${l.lote} · ${area(l.area)} · ${moeda(l.valor)}</option>`).join("")}
            </select>
          </div>

          <div class="field">
            <label>Status</label>
            <select id="ctStatus">
              <option>Proposta</option>
              <option>Reserva</option>
              <option>Contrato</option>
              <option>Vendido</option>
              <option>Pago</option>
              <option>Cancelado</option>
            </select>
          </div>

          ${input("ctArea", "Metragem", "text", "", true)}
          ${input("ctValorTabela", "Valor tabela", "text", "", true)}
          ${input("ctDesconto", "Desconto concedido", "number", "0")}
          ${input("ctValorFinal", "Valor negociado", "number", "0")}

          <div class="field">
            <label>Forma de pagamento</label>
            <select id="ctPagamento">
              <option>À vista</option>
              <option>Entrada 50%</option>
              <option>Financiamento até 36 parcelas</option>
              <option>Financiamento acima de 36 parcelas</option>
              <option>Personalizado</option>
            </select>
          </div>

          ${input("ctEntrada", "Entrada", "number", "0")}
          ${input("ctParcelas", "Parcelas", "number", "0")}

          <div class="field">
            <label>Corretor / imobiliária</label>
            <select id="ctCorretor">
              ${S.corretores.map(c => `<option>${c.nome}</option>`).join("")}
            </select>
          </div>

          ${input("ctOrigem", "Origem do lead", "text", "")}
        </div>

        <div class="field" style="margin-top:16px">
          <label>Observações</label>
          <textarea id="ctObs"></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary btn-fit" onclick="salvarContrato()">Salvar contrato</button>
      </div>
    </div>
  `);

  preencherContratoPorLote();
}

function preencherContratoPorLote() {
  const id = document.getElementById("ctLote")?.value;
  const lote = S.lotes.find(l => l.id === id);

  if (!lote) return;

  document.getElementById("ctArea").value = area(lote.area);
  document.getElementById("ctValorTabela").value = moeda(lote.valor);
  document.getElementById("ctValorFinal").value = lote.valor.toFixed(2);
}

async function salvarContrato() {
  const idLote = document.getElementById("ctLote")?.value;
  const lote = S.lotes.find(l => l.id === idLote);

  if (!lote) {
    toast("Selecione um lote válido.", "err");
    return;
  }

  const valorFinal = num(document.getElementById("ctValorFinal")?.value);
  const descontoInformado = num(document.getElementById("ctDesconto")?.value);
  const desconto = descontoInformado || Math.max(lote.valor - valorFinal, 0);
  const corretor = document.getElementById("ctCorretor")?.value || "";

  const contrato = {
    id: uid(),
    data: document.getElementById("ctData")?.value || "",
    cliente: document.getElementById("ctCliente")?.value || "",
    idLote,
    quadra: lote.quadra,
    rua: lote.rua,
    lote: lote.lote,
    area: lote.area,
    valorTabela: lote.valor,
    desconto,
    valorFinal,
    status: document.getElementById("ctStatus")?.value || "Contrato",
    formaPagamento: document.getElementById("ctPagamento")?.value || "",
    entrada: num(document.getElementById("ctEntrada")?.value),
    parcelas: num(document.getElementById("ctParcelas")?.value),
    corretor,
    origem: document.getElementById("ctOrigem")?.value || "",
    obs: document.getElementById("ctObs")?.value || "",
    comissaoValor: calcularComissao(valorFinal, corretor)
  };

  S.contratos.unshift(contrato);
  saveJSON("calliandra_contratos", S.contratos);

  await tryAppend("vendas", contrato);

  aplicarContratosLocaisNosLotes();

  closeModal();
  toast("Contrato salvo.");
  renderContratos();
}

function renderCorretores() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Corretores e parceiros</h2>
        <p class="muted">Cadastro de imobiliárias, categoria, vendas, comissão padrão e VGV por parceiro.</p>
      </div>
      <button class="btn-primary btn-fit" onclick="abrirModalCorretor()">Novo corretor</button>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Parceiro</th>
            <th>Categoria</th>
            <th>Comissão padrão</th>
            <th>Vendas</th>
            <th>VGV vendido</th>
            <th>Comissão estimada</th>
          </tr>
        </thead>
        <tbody>
          ${S.corretores.map(c => {
            const vendas = S.contratos.filter(v => same(v.corretor, c.nome) && isVendido(v.status));
            const vgv = soma(vendas, "valorFinal");
            return `
              <tr>
                <td>${c.nome}</td>
                <td>${badge(c.categoria)}</td>
                <td>${c.comissao}</td>
                <td>${vendas.length}</td>
                <td>${moeda(vgv)}</td>
                <td>${moeda(soma(vendas, "comissaoValor"))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function abrirModalCorretor() {
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <h3>Novo corretor / imobiliária</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          ${input("crNome", "Nome do parceiro", "text", "")}

          <div class="field">
            <label>Categoria</label>
            <select id="crCategoria" onchange="document.getElementById('crComissao').value = this.value === 'Ouro' ? '5%' : '4,5%'">
              <option>Prata</option>
              <option>Ouro</option>
              <option>Bronze</option>
            </select>
          </div>

          ${input("crComissao", "Comissão padrão", "text", "4,5%")}
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary btn-fit" onclick="salvarCorretor()">Salvar</button>
      </div>
    </div>
  `);
}

async function salvarCorretor() {
  const nome = document.getElementById("crNome")?.value.trim();

  if (!nome) {
    toast("Informe o nome do parceiro.", "err");
    return;
  }

  const corretor = {
    id: uid(),
    nome,
    categoria: document.getElementById("crCategoria")?.value || "Prata",
    comissao: document.getElementById("crComissao")?.value || "4,5%",
    vendas: 0
  };

  S.corretores.push(corretor);
  saveJSON("calliandra_corretores", S.corretores);

  await tryAppend("corretores", corretor);

  closeModal();
  toast("Corretor cadastrado.");
  renderCorretores();
}

function renderMidia() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Plano de mídia</h2>
        <p class="muted">Template de planejamento de mídia para lançamento, remarketing, performance, conteúdo e conversão.</p>
      </div>
      <button class="btn-primary btn-fit" onclick="abrirModalMidia()">Nova ação de mídia</button>
    </div>

    <div class="cards-grid">
      ${metric("Verba planejada", moeda(CONFIG.verbaMidia), "Orçamento de referência")}
      ${metric("Previsto no plano", moeda(soma(S.midia, "previsto")))}
      ${metric("Realizado", moeda(soma(S.midia, "realizado")))}
      ${metric("Leads", soma(S.midia, "leads"))}
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Canal</th>
            <th>Objetivo</th>
            <th>Período</th>
            <th>Previsto</th>
            <th>Realizado</th>
            <th>Leads</th>
            <th>CPL</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${S.midia.map(m => `
            <tr>
              <td>${m.campanha}</td>
              <td>${m.canal}</td>
              <td>${m.objetivo}</td>
              <td>${m.periodo}</td>
              <td>${moeda(m.previsto)}</td>
              <td>${moeda(m.realizado)}</td>
              <td>${m.leads}</td>
              <td>${moeda(m.realizado / Math.max(m.leads, 1))}</td>
              <td>${badge(m.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderOrcamento() {
  const totalPrevisto = soma(S.acoes, "orcamento") + soma(S.gastos, "previsto");
  const realizado = soma(S.gastos, "realizado");

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Cronograma físico-financeiro</h2>
        <p class="muted">Consolidação de ações comerciais, orçamento previsto e realizado.</p>
      </div>
      <button class="btn-primary btn-fit" onclick="abrirModalGasto()">Novo item financeiro</button>
    </div>

    <div class="cards-grid">
      ${metric("Previsto", moeda(totalPrevisto))}
      ${metric("Realizado", moeda(realizado))}
      ${metric("Saldo", moeda(totalPrevisto - realizado))}
      ${metric("Execução", `${pct(realizado, totalPrevisto)}%`)}
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Item</th>
            <th>Previsto</th>
            <th>Realizado</th>
            <th>Saldo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${S.gastos.map(g => `
            <tr>
              <td>${g.categoria}</td>
              <td>${g.item}</td>
              <td>${moeda(g.previsto)}</td>
              <td>${moeda(g.realizado)}</td>
              <td>${moeda(g.previsto - g.realizado)}</td>
              <td>${badge(g.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRelatorios() {
  const s = dashboardStats();

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Relatórios executivos</h2>
        <p class="muted">Resumo para acompanhamento da diretoria e gestão comercial.</p>
      </div>
      <button class="btn-ghost" onclick="window.print()">Imprimir relatório</button>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">Resumo de estoque</div>
        ${pipelineRow("Disponíveis reais", s.disponiveis, s.estoqueUP, false)}
        ${pipelineRow("Comercializados", s.comercializados, s.total, false)}
        ${pipelineRow("Bloqueados", s.bloqueados, s.total, false)}
        ${pipelineRow("Meta do período", s.vendidosPeriodo, s.metaLotes, false)}
      </div>

      <div class="card">
        <div class="card-title">Vendas por parceiro</div>
        ${ranking(S.contratos.filter(c => isVendido(c.status)), "corretor")}
      </div>

      <div class="card">
        <div class="card-title">Vendas por origem</div>
        ${ranking(S.contratos.filter(c => isVendido(c.status)), "origem")}
      </div>

      <div class="card">
        <div class="card-title">Vendas por quadra</div>
        ${ranking(S.contratos.filter(c => isVendido(c.status)), "quadra")}
      </div>
    </div>
  `;
}

function renderMapa() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Mapa comercial</h2>
        <p class="muted">Mapa de unidades para consulta visual de lotes indisponíveis, disponíveis, vendidos, garantia GDF e Casa Calliandra.</p>
      </div>
    </div>

    <div class="map-box">
      <img
        src="./assets/mapa-unidades.png"
        alt="Mapa de unidades Calliandra"
        onerror="this.style.display='none';document.getElementById('mapPlaceholder').style.display='grid';"
      />

      <div id="mapPlaceholder" class="map-placeholder" style="display:none">
        <div>
          <h2 style="color:var(--verde);margin-bottom:10px">Mapa ainda não carregado</h2>
          <p class="muted">Suba a imagem do mapa no GitHub em <strong>assets/mapa-unidades.png</strong>.</p>
        </div>
      </div>

      <div class="legend">
        <span><i class="dot vendido"></i>Lotes indisponíveis</span>
        <span><i class="dot disponivel"></i>Lotes disponíveis</span>
        <span><i class="dot bloqueado"></i>Lotes vendidos</span>
        <span><i class="dot casa"></i>Casa Calliandra</span>
        <span><i class="dot garantia"></i>Garantia GDF</span>
      </div>
    </div>
  `;
}

function renderConfiguracoes() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Configurações</h2>
        <p class="muted">Parâmetros comerciais fixados para esta versão do sistema.</p>
      </div>
    </div>

    <div class="cards-grid">
      ${metric("Meta valor", moeda(CONFIG.metaValorJunho))}
      ${metric("Meta unidades", CONFIG.metaLotesJunho)}
      ${metric("Juros", "12% a.a.")}
      ${metric("IPCA", "Acima de 36x")}
    </div>

    <div class="card">
      <div class="card-title">Regras comerciais aplicadas</div>
      <p class="muted">
        À vista com 5% de desconto. Entrada de 50% com 2,5% de desconto.
        Financiamento até 36 parcelas com juros de 12% ao ano, sem correção monetária.
        A partir de 37 parcelas, juros de 12% ao ano + IPCA, sem projeção automática do índice.
        Casa Calliandra não disponível para venda. Lotes do permutante não entram no estoque comercial atual.
      </p>

      <div style="margin-top:18px">
        <button class="btn-ghost" onclick="testarAPI()">Testar API</button>
        <button class="btn-ghost" onclick="limparDadosLocais()">Limpar dados locais</button>
      </div>
    </div>
  `;
}

/* MODAIS EXTRAS */

function abrirModalAcao() {
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <h3>Nova ação do plano comercial</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div class="field">
            <label>Fase</label>
            <select id="acFase">
              <option>Venda antecipada</option>
              <option>Lançamento</option>
              <option>Pós-lançamento</option>
              <option>Manutenção</option>
            </select>
          </div>

          ${input("acAcao", "Ação", "text", "")}
          ${input("acResponsavel", "Responsável", "text", "")}
          ${input("acData", "Data/prazo", "text", "")}
          ${input("acOrcamento", "Orçamento", "number", "0")}

          <div class="field">
            <label>Status</label>
            <select id="acStatus">
              <option>Planejada</option>
              <option>Em andamento</option>
              <option>Concluída</option>
              <option>Atrasada</option>
            </select>
          </div>

          <div class="field">
            <label>Prioridade</label>
            <select id="acPrioridade">
              <option>Alta</option>
              <option>Média</option>
              <option>Baixa</option>
            </select>
          </div>

          ${input("acObs", "Observações", "text", "")}
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary btn-fit" onclick="salvarAcao()">Salvar ação</button>
      </div>
    </div>
  `);
}

async function salvarAcao() {
  const item = {
    id: uid(),
    fase: val("acFase"),
    acao: val("acAcao"),
    responsavel: val("acResponsavel"),
    data: val("acData"),
    orcamento: num(val("acOrcamento")),
    status: val("acStatus"),
    prioridade: val("acPrioridade"),
    obs: val("acObs")
  };

  S.acoes.push(item);
  saveJSON("calliandra_acoes", S.acoes);
  await tryAppend("acoes", item);

  closeModal();
  toast("Ação cadastrada.");
  renderCronograma();
}

function abrirModalMidia() {
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <h3>Nova ação de mídia</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          ${input("mdCampanha", "Campanha", "text", "")}
          ${input("mdCanal", "Canal", "text", "")}
          ${input("mdObjetivo", "Objetivo", "text", "")}
          ${input("mdPeriodo", "Período", "text", "")}
          ${input("mdPrevisto", "Previsto", "number", "0")}
          ${input("mdRealizado", "Realizado", "number", "0")}
          ${input("mdLeads", "Leads", "number", "0")}

          <div class="field">
            <label>Status</label>
            <select id="mdStatus">
              <option>Planejado</option>
              <option>Em andamento</option>
              <option>Concluído</option>
              <option>Pausado</option>
            </select>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary btn-fit" onclick="salvarMidia()">Salvar</button>
      </div>
    </div>
  `);
}

async function salvarMidia() {
  const item = {
    id: uid(),
    campanha: val("mdCampanha"),
    canal: val("mdCanal"),
    objetivo: val("mdObjetivo"),
    periodo: val("mdPeriodo"),
    previsto: num(val("mdPrevisto")),
    realizado: num(val("mdRealizado")),
    leads: num(val("mdLeads")),
    status: val("mdStatus")
  };

  S.midia.push(item);
  saveJSON("calliandra_midia", S.midia);
  await tryAppend("midia", item);

  closeModal();
  toast("Ação de mídia cadastrada.");
  renderMidia();
}

function abrirModalGasto() {
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <h3>Novo item financeiro</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          ${input("gtCategoria", "Categoria", "text", "")}
          ${input("gtItem", "Item", "text", "")}
          ${input("gtPrevisto", "Previsto", "number", "0")}
          ${input("gtRealizado", "Realizado", "number", "0")}

          <div class="field">
            <label>Status</label>
            <select id="gtStatus">
              <option>Planejado</option>
              <option>Em andamento</option>
              <option>Concluído</option>
              <option>Atrasado</option>
            </select>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary btn-fit" onclick="salvarGasto()">Salvar</button>
      </div>
    </div>
  `);
}

async function salvarGasto() {
  const item = {
    id: uid(),
    categoria: val("gtCategoria"),
    item: val("gtItem"),
    previsto: num(val("gtPrevisto")),
    realizado: num(val("gtRealizado")),
    status: val("gtStatus")
  };

  S.gastos.push(item);
  saveJSON("calliandra_gastos", S.gastos);
  await tryAppend("gastos", item);

  closeModal();
  toast("Item financeiro cadastrado.");
  renderOrcamento();
}

/* PADRÕES */

function getAcoesPadrao() {
  return [
    { id: uid(), fase: "Venda antecipada", acao: "Revisar carteira de leads aquecidos", responsavel: "Comercial", data: "Semanal", orcamento: 0, status: "Em andamento", prioridade: "Alta", obs: "Foco em leads com visita, simulação ou atendimento avançado." },
    { id: uid(), fase: "Venda antecipada", acao: "Rodada de follow-up com corretores", responsavel: "House/Parceiros", data: "Até 19/06", orcamento: 0, status: "Planejada", prioridade: "Alta", obs: "Cobrar proposta concreta por lote." },
    { id: uid(), fase: "Venda antecipada", acao: "Campanha de urgência pré-lançamento", responsavel: "Marketing", data: "Até 19/06", orcamento: 60000, status: "Planejada", prioridade: "Alta", obs: "Comunicar virada de valores no lançamento." },
    { id: uid(), fase: "Lançamento", acao: "Evento oficial de lançamento", responsavel: "Marketing/Comercial", data: "20/06", orcamento: 120000, status: "Planejada", prioridade: "Alta", obs: "Meta de 10 unidades no dia." },
    { id: uid(), fase: "Lançamento", acao: "Plantão de simulações e propostas", responsavel: "Comercial", data: "20/06", orcamento: 15000, status: "Planejada", prioridade: "Alta", obs: "Equipe preparada para fechamento no evento." },
    { id: uid(), fase: "Pós-lançamento", acao: "Remarketing para visitantes e leads do evento", responsavel: "Marketing", data: "21/06 a 30/06", orcamento: 50000, status: "Planejada", prioridade: "Alta", obs: "Foco nos indecisos." },
    { id: uid(), fase: "Pós-lançamento", acao: "Fechamento das propostas pendentes", responsavel: "Comercial", data: "Até 30/06", orcamento: 0, status: "Planejada", prioridade: "Alta", obs: "Converter propostas em contrato." },
    { id: uid(), fase: "Manutenção", acao: "Relatório semanal para diretoria", responsavel: "Gestão Comercial", data: "Toda segunda", orcamento: 0, status: "Em andamento", prioridade: "Média", obs: "VGV, lotes, mídia, corretores e gargalos." }
  ];
}

function getMidiaPadrao() {
  return [
    { id: uid(), campanha: "Venda antecipada", canal: "Meta Ads", objetivo: "Leads qualificados e remarketing", periodo: "Até 19/06", previsto: 120000, realizado: 0, leads: 0, status: "Planejado" },
    { id: uid(), campanha: "Venda antecipada", canal: "Google Ads", objetivo: "Busca ativa por condomínio/lotes", periodo: "Até 19/06", previsto: 65000, realizado: 0, leads: 0, status: "Planejado" },
    { id: uid(), campanha: "Lançamento", canal: "Meta + Google + WhatsApp", objetivo: "Convite e conversão para o evento", periodo: "20/06", previsto: 170000, realizado: 0, leads: 0, status: "Planejado" },
    { id: uid(), campanha: "Lançamento", canal: "Produção audiovisual", objetivo: "Vídeos, depoimentos, reels e criativos", periodo: "Junho", previsto: 85000, realizado: 0, leads: 0, status: "Planejado" },
    { id: uid(), campanha: "Pós-lançamento", canal: "Remarketing", objetivo: "Recuperar leads e fechar propostas", periodo: "21/06 a 30/06", previsto: 70000, realizado: 0, leads: 0, status: "Planejado" },
    { id: uid(), campanha: "Apoio comercial", canal: "Materiais e landing pages", objetivo: "Suporte ao corretor e à House", periodo: "Junho", previsto: 30000, realizado: 0, leads: 0, status: "Planejado" }
  ];
}

function getGastosPadrao() {
  return [
    { id: uid(), categoria: "Mídia", item: "Meta Ads", previsto: 120000, realizado: 0, status: "Planejado" },
    { id: uid(), categoria: "Mídia", item: "Google Ads", previsto: 65000, realizado: 0, status: "Planejado" },
    { id: uid(), categoria: "Evento", item: "Lançamento oficial", previsto: 120000, realizado: 0, status: "Planejado" },
    { id: uid(), categoria: "Produção", item: "Audiovisual e criativos", previsto: 85000, realizado: 0, status: "Planejado" },
    { id: uid(), categoria: "Comercial", item: "Materiais para corretores", previsto: 30000, realizado: 0, status: "Planejado" },
    { id: uid(), categoria: "Pós-lançamento", item: "Remarketing e reforço", previsto: 70000, realizado: 0, status: "Planejado" }
  ];
}

/* COMPONENTES */

function metric(label, value, sub = "", progress = null) {
  return `
    <div class="card metric">
      <span>${label}</span>
      <strong>${value}</strong>
      ${sub ? `<small>${sub}</small>` : ""}
      ${progress !== null ? `<div class="progress"><i style="width:${Math.min(progress, 100)}%"></i></div>` : ""}
    </div>
  `;
}

function pipelineRow(label, value, total, money) {
  const percentual = pct(value, total);

  return `
    <div class="pipeline-row">
      <div>
        <strong>${label}</strong>
        <span>${money ? moeda(value) : value} de ${money ? moeda(total) : total}</span>
      </div>
      <div class="bar"><i style="width:${Math.min(percentual, 100)}%"></i></div>
      <strong>${percentual}%</strong>
    </div>
  `;
}

function badge(value) {
  const label = value || "-";
  const t = texto(label);

  let cls = "tag";

  if (t.includes("vend") || t.includes("contrato") || t.includes("pago") || t.includes("conclu")) cls += " vendido";
  else if (t.includes("dispon")) cls += " disponivel";
  else if (t.includes("reserv")) cls += " reservado";
  else if (t.includes("garantia") || t.includes("gdf")) cls += " garantia";
  else if (t.includes("casa")) cls += " casa";
  else if (t.includes("permut")) cls += " permutante";
  else if (t.includes("bloque") || t.includes("indispon")) cls += " bloqueado";

  return `<span class="${cls}">${label}</span>`;
}

function input(id, label, type, value = "", disabled = false) {
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <input id="${id}" type="${type}" value="${value}" ${disabled ? "disabled" : ""}>
    </div>
  `;
}

function openModal(html) {
  document.getElementById("modalRoot").innerHTML = `<div class="modal-overlay">${html}</div>`;
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

function toast(message, type = "ok") {
  const root = document.getElementById("toastRoot");

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerText = message;

  root.appendChild(el);

  setTimeout(() => el.remove(), 3200);
}

function emptyRow(cols, message) {
  return `<tr><td colspan="${cols}" class="empty">${message}</td></tr>`;
}

function ranking(items, field) {
  const map = {};

  items.forEach(item => {
    const key = item[field] || "Não informado";
    map[key] = (map[key] || 0) + num(item.valorFinal);
  });

  const rows = Object.entries(map).sort((a, b) => b[1] - a[1]);

  if (!rows.length) return `<div class="empty">Sem dados cadastrados.</div>`;

  return rows.map(([key, value], index) => `
    <div class="pipeline-row">
      <div>
        <strong>${index + 1}. ${key}</strong>
        <span>${moeda(value)}</span>
      </div>
      <div class="bar"><i style="width:${Math.min(pct(value, rows[0][1]), 100)}%"></i></div>
      <strong>${pct(value, soma(items, "valorFinal"))}%</strong>
    </div>
  `).join("");
}

/* FINANCEIRO */

function parcelaPrice(valor, parcelas, taxa) {
  if (!valor || !parcelas) return 0;
  return valor * (taxa / (1 - Math.pow(1 + taxa, -parcelas)));
}

function parcelaSAC(valor, parcelas, taxa) {
  if (!valor || !parcelas) return null;

  const amortizacao = valor / parcelas;
  const primeira = amortizacao + valor * taxa;
  const ultima = amortizacao + amortizacao * taxa;

  return { amortizacao, primeira, ultima };
}

function tabelaPrice(valor, parcelas) {
  if (!valor || !parcelas) return `<div class="empty">Sem saldo financiado.</div>`;

  const p = parcelaPrice(valor, parcelas, TAXA_MENSAL);
  let saldo = valor;
  let rows = "";

  for (let i = 1; i <= Math.min(parcelas, 12); i++) {
    const juros = saldo * TAXA_MENSAL;
    const amortizacao = p - juros;
    saldo -= amortizacao;

    rows += `
      <tr>
        <td>${i}</td>
        <td>${moeda(p)}</td>
        <td>${moeda(amortizacao)}</td>
        <td>${moeda(juros)}</td>
        <td>${moeda(Math.max(saldo, 0))}</td>
      </tr>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Parcela</th>
          <th>Valor</th>
          <th>Amortização</th>
          <th>Juros</th>
          <th>Saldo</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function tabelaSac(valor, parcelas) {
  if (!valor || !parcelas) return `<div class="empty">Sem saldo financiado.</div>`;

  const amortizacao = valor / parcelas;
  let saldo = valor;
  let rows = "";

  for (let i = 1; i <= Math.min(parcelas, 12); i++) {
    const juros = saldo * TAXA_MENSAL;
    const parcela = amortizacao + juros;
    saldo -= amortizacao;

    rows += `
      <tr>
        <td>${i}</td>
        <td>${moeda(parcela)}</td>
        <td>${moeda(amortizacao)}</td>
        <td>${moeda(juros)}</td>
        <td>${moeda(Math.max(saldo, 0))}</td>
      </tr>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Parcela</th>
          <th>Valor</th>
          <th>Amortização</th>
          <th>Juros</th>
          <th>Saldo</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function calcularComissao(valor, corretorNome) {
  const corretor = S.corretores.find(c => same(c.nome, corretorNome));
  const categoria = texto(corretor?.categoria || "Prata");

  let percentual = 0.045;

  if (categoria.includes("ouro")) percentual = 0.05;
  if (categoria.includes("bronze")) percentual = 0.04;

  return valor * percentual;
}

/* API */

async function tryAppend(sheet, values) {
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "appendRow",
        sheet,
        values
      })
    });
  } catch (error) {
    console.warn("Não foi possível gravar na planilha. Registro mantido localmente.", error);
  }
}

async function testarAPI() {
  try {
    const response = await fetch(`${API_URL}?action=getAll`);
    const data = await response.json();
    console.log("TESTE API:", data);
    toast(data.ok ? "API respondendo corretamente." : "API respondeu com erro.", data.ok ? "ok" : "err");
  } catch (error) {
    console.error(error);
    toast("Falha ao testar API.", "err");
  }
}

/* LOCAL STORAGE */

function mergeLocal(key, remote) {
  const local = readJSON(key, []);
  const base = Array.isArray(remote) ? remote : [];

  const merged = [...local];

  base.forEach(item => {
    if (!item.id || !merged.some(x => x.id === item.id)) {
      merged.push(item);
    }
  });

  return merged;
}

function saveJSON(key, data) {
  localStorage.setItem(key, JSON.stringify(data || []));
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function limparDadosLocais() {
  localStorage.removeItem("calliandra_contratos");
  localStorage.removeItem("calliandra_corretores");
  localStorage.removeItem("calliandra_acoes");
  localStorage.removeItem("calliandra_midia");
  localStorage.removeItem("calliandra_gastos");
  toast("Dados locais limpos. Recarregue a página.");
}

/* HELPERS */

function pick(obj, keys) {
  if (!obj) return "";

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }

  const normalized = {};

  Object.keys(obj).forEach(k => {
    normalized[texto(k)] = obj[k];
  });

  for (const key of keys) {
    const value = normalized[texto(key)];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function num(value) {
  if (typeof value === "number") return value;

  if (!value) return 0;

  return Number(
    String(value)
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  ) || 0;
}

function soma(list, field) {
  return (list || []).reduce((total, item) => total + num(item?.[field]), 0);
}

function media(list, field) {
  if (!list || !list.length) return 0;
  return soma(list, field) / list.length;
}

function moeda(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function area(value) {
  return `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} m²`;
}

function pct(value, total) {
  if (!total) return 0;
  return Math.round((num(value) / num(total)) * 100);
}

function texto(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function same(a, b) {
  return texto(a) === texto(b);
}

function isVendido(status) {
  const s = texto(status);
  return s.includes("vend") || s.includes("contrato") || s.includes("pago");
}

function val(id) {
  return document.getElementById(id)?.value || "";
}

function uid() {
  return `ID-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
}

function logout() {
  localStorage.removeItem("calliandra_user");
  location.reload();
}
