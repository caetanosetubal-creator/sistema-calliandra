const API_URL = "/api/sheets";

const PRECO_M2_PADRAO = 1408.14;
const JUROS_ANO = 0.12;
const JUROS_MES = Math.pow(1 + JUROS_ANO, 1 / 12) - 1;

const CALLIANDRA = {
  totalEmpreendimento: 84,
  estoqueUP: 53,
  lotesPermutante: 31,
  disponiveisReais: 33,
  vendidosHistoricoUP: 9,
  permutadoUP: 1,
  comercializadosUP: 10,
  reservados: 0,
  metaFinanceiraPeriodo: 4000000,
  metaLotesPeriodo: 23,
  verbaMidia: 540000,
  dataInicioMeta: "2026-04-01",
  dataFimMeta: "2026-06-30"
};

const VENDAS_PERIODO_FIXAS = [
  {
    id: "VENDA-PERIODO-ARACA-19",
    data: "2026-04-01",
    cliente: "Venda realizada no período",
    quadra: "Araçá",
    rua: "Rua Araçá",
    lote: "19",
    area: 294.48,
    valorTabela: 294.48 * PRECO_M2_PADRAO,
    valorFinal: 380000,
    status: "Vendido",
    corretor: "Não informado",
    origem: "Não informada",
    formaPagamento: "Não informada",
    periodoMeta: true
  },
  {
    id: "VENDA-PERIODO-BARU-27",
    data: "2026-04-01",
    cliente: "Venda realizada no período",
    quadra: "Baru",
    rua: "Rua Barú",
    lote: "27",
    area: 372,
    valorTabela: 372 * PRECO_M2_PADRAO,
    valorFinal: 480000,
    status: "Vendido",
    corretor: "Não informado",
    origem: "Não informada",
    formaPagamento: "Não informada",
    periodoMeta: true
  }
];

let CURRENT_USER = null;

let S = {
  raw: {},
  lotes: [],
  vendas: [],
  corretores: [],
  acoes: [],
  midia: [],
  gastos: [],
  cfg: [],
  listas: [],
  usuarios: []
};

document.addEventListener("DOMContentLoaded", () => {
  injectCSS();

  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", fazerLogin);
  }

  const userLocal = readJSON("calliandra_user", null);

  if (userLocal) {
    CURRENT_USER = userLocal;
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
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, senha })
    });

    const json = await res.json();

    const ok = json.ok || json.success || json.raw?.ok || json.raw?.success;

    const usuario =
      json.usuario ||
      json.user ||
      json.raw?.usuario ||
      json.raw?.user ||
      null;

    if (!ok || !usuario) {
      if (msg) {
        msg.innerText =
          json.message ||
          json.error ||
          json.raw?.message ||
          json.raw?.error ||
          "Usuário ou senha inválidos.";
      }
      return;
    }

    CURRENT_USER = usuario;
    localStorage.setItem("calliandra_user", JSON.stringify(usuario));

    await entrarNoSistema();

  } catch (error) {
    console.error(error);
    if (msg) msg.innerText = "Erro ao conectar com a API.";
  }
}

async function entrarNoSistema() {
  document.getElementById("loginScreen")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");

  renderShell();

  await carregarDados();

  aplicarRegrasGerenciais();

  go("dashboard");
}

async function carregarDados() {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getAll" })
    });

    const json = await res.json();

    S.raw = json;

    const data = json.data || json.raw?.data || json.raw || {};

    S.lotes = getSheet(data, "lotes").map(normalizarLote);
    S.usuarios = getSheet(data, "usuarios");
    S.listas = getSheet(data, "listas");
    S.cfg = getSheet(data, "cfg");

    const vendasRemotas = [
      ...getSheet(data, "vendas"),
      ...getSheet(data, "contratos")
    ].map(normalizarVenda);

    S.vendas = mergeLocal("calliandra_vendas", vendasRemotas);
    S.corretores = mergeLocal("calliandra_corretores", montarCorretores(data));
    S.acoes = mergeLocal("calliandra_acoes", getSheet(data, "acoes").map(normalizarAcao));
    S.midia = mergeLocal("calliandra_midia", getSheet(data, "midia").map(normalizarMidia));
    S.gastos = mergeLocal("calliandra_gastos", getSheet(data, "gastos").map(normalizarGasto));

    if (!S.corretores.length) S.corretores = corretoresPadrao();
    if (!S.acoes.length) S.acoes = acoesPadrao();
    if (!S.midia.length) S.midia = midiaPadrao();
    if (!S.gastos.length) S.gastos = gastosPadrao();

  } catch (error) {
    console.error(error);

    S.lotes = [];
    S.vendas = readJSON("calliandra_vendas", []);
    S.corretores = readJSON("calliandra_corretores", corretoresPadrao());
    S.acoes = readJSON("calliandra_acoes", acoesPadrao());
    S.midia = readJSON("calliandra_midia", midiaPadrao());
    S.gastos = readJSON("calliandra_gastos", gastosPadrao());

    toast("Não foi possível carregar a planilha. Usando dados locais.", "err");
  }
}

function aplicarRegrasGerenciais() {
  S.lotes.forEach(lote => {
    const isAraca19 = mesmoLote(lote, "Araçá", "19");
    const isBaru27 = mesmoLote(lote, "Baru", "27") || mesmoLote(lote, "Barú", "27");

    if (isAraca19 || isBaru27) {
      lote.statusGerencial = "Vendido";
      lote.statusSistema = "Vendido";
      lote.vendavel = false;
      lote.periodoMeta = true;
    }

    if (lote.statusSistema === "Garantia GDF") {
      lote.statusGerencial = "Disponível";
      lote.vendavel = true;
    }
  });
}

function getVendasGerenciais() {
  const vendas = [...S.vendas];

  VENDAS_PERIODO_FIXAS.forEach(vendaFixa => {
    const jaExiste = vendas.some(v =>
      mesmoTexto(v.quadra, vendaFixa.quadra) &&
      String(v.lote).trim() === String(vendaFixa.lote).trim()
    );

    if (!jaExiste) {
      vendas.push({
        ...vendaFixa,
        desconto: vendaFixa.valorTabela - vendaFixa.valorFinal,
        comissaoValor: 0
      });
    }
  });

  return vendas;
}

function getVendasPeriodo() {
  return getVendasGerenciais().filter(v => {
    if (v.periodoMeta) return true;

    const data = String(v.data || "");

    if (!data) return false;

    return data >= CALLIANDRA.dataInicioMeta && data <= CALLIANDRA.dataFimMeta && isVendido(v.status);
  });
}

function statsGerenciais() {
  const vendasPeriodo = getVendasPeriodo();

  const realizadoFinanceiro = soma(vendasPeriodo, "valorFinal");
  const valorTabelaPeriodo = soma(vendasPeriodo, "valorTabela");
  const descontoPeriodo = Math.max(valorTabelaPeriodo - realizadoFinanceiro, 0);

  const vendidosPeriodo = vendasPeriodo.length;
  const faltamLotes = Math.max(CALLIANDRA.metaLotesPeriodo - vendidosPeriodo, 0);
  const faltaFinanceira = Math.max(CALLIANDRA.metaFinanceiraPeriodo - realizadoFinanceiro, 0);

  const restritosUP = Math.max(
    CALLIANDRA.estoqueUP -
    CALLIANDRA.disponiveisReais -
    CALLIANDRA.comercializadosUP -
    CALLIANDRA.reservados,
    0
  );

  return {
    baseGestao: CALLIANDRA.estoqueUP,
    totalEmpreendimento: CALLIANDRA.totalEmpreendimento,
    permutante: CALLIANDRA.lotesPermutante,
    disponiveis: CALLIANDRA.disponiveisReais,
    vendidosHistorico: CALLIANDRA.vendidosHistoricoUP,
    permutado: CALLIANDRA.permutadoUP,
    comercializados: CALLIANDRA.comercializadosUP,
    reservados: CALLIANDRA.reservados,
    restritosUP,
    vendasPeriodo,
    vendidosPeriodo,
    realizadoFinanceiro,
    valorTabelaPeriodo,
    descontoPeriodo,
    faltaFinanceira,
    faltamLotes,
    ticketPeriodo: vendidosPeriodo ? realizadoFinanceiro / vendidosPeriodo : 0,
    descontoMedio: vendidosPeriodo ? descontoPeriodo / vendidosPeriodo : 0,
    pctMetaFinanceira: percentual(realizadoFinanceiro, CALLIANDRA.metaFinanceiraPeriodo),
    pctMetaLotes: percentual(vendidosPeriodo, CALLIANDRA.metaLotesPeriodo),
    valorMedioNecessario: faltamLotes ? faltaFinanceira / faltamLotes : 0
  };
}

/* SHELL */

function renderShell() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand-box">
        <img
          src="./assets/logo-calliandra-white.png"
          class="sidebar-logo"
          alt="Residencial Calliandra"
          onerror="this.style.display='none';document.getElementById('brandFallback').style.display='block';"
        />
        <div id="brandFallback" class="brand-fallback">Calliandra</div>
        <div class="sidebar-subtitle">Sistema comercial</div>
      </div>

      <nav class="menu">
        ${menuButton("dashboard", "Dashboard")}
        ${menuButton("lotes", "Lotes")}
        ${menuButton("simulador", "Simulador")}
        ${menuButton("contratos", "Contratos")}
        ${menuButton("corretores", "Corretores")}
        ${menuButton("plano", "Plano de ação")}
        ${menuButton("midia", "Plano de mídia")}
        ${menuButton("financeiro", "Físico-financeiro")}
        ${menuButton("relatorios", "Relatórios")}
        ${menuButton("mapa", "Mapa comercial")}
        ${menuButton("configuracoes", "Configurações")}
      </nav>
    </aside>

    <main class="content">
      <header class="topbar">
        <div>
          <h1 id="pageTitle">Dashboard</h1>
          <p id="pageSubtitle">Residencial Calliandra · Urbanizadora Paranoazinho</p>
        </div>

        <div class="userbox">
          <span>${CURRENT_USER?.nome || CURRENT_USER?.email || "Usuário"}</span>
          <button onclick="logout()" class="btn-logout">Sair</button>
        </div>
      </header>

      <section id="view" class="view"></section>
    </main>
  `;
}

function menuButton(page, label) {
  return `<button class="menu-item" data-page="${page}" onclick="go('${page}')">${label}</button>`;
}

function go(page) {
  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  const titles = {
    dashboard: ["Dashboard", "Visão executiva do estoque comercial da UP"],
    lotes: ["Lotes", "Inventário comercial e disponibilidade"],
    simulador: ["Simulador", "Condições comerciais, Price, SAC e IPCA"],
    contratos: ["Contratos", "Vendas, reservas, propostas e negociações"],
    corretores: ["Corretores", "Parceiros, categorias e comissão"],
    plano: ["Plano de ação", "Ações por fase para atingir a meta"],
    midia: ["Plano de mídia", "Verba, canais, leads e performance"],
    financeiro: ["Físico-financeiro", "Previsto, realizado e saldo"],
    relatorios: ["Relatórios", "Leitura executiva para diretoria"],
    mapa: ["Mapa comercial", "Leitura visual de disponibilidade"],
    configuracoes: ["Configurações", "Regras e parâmetros do sistema"]
  };

  document.getElementById("pageTitle").innerText = titles[page]?.[0] || "Sistema";
  document.getElementById("pageSubtitle").innerText = titles[page]?.[1] || "";

  const renders = {
    dashboard: renderDashboard,
    lotes: renderLotes,
    simulador: renderSimulador,
    contratos: renderContratos,
    corretores: renderCorretores,
    plano: renderPlano,
    midia: renderMidia,
    financeiro: renderFinanceiro,
    relatorios: renderRelatorios,
    mapa: renderMapa,
    configuracoes: renderConfiguracoes
  };

  renders[page]?.();
}

/* DASHBOARD */

function renderDashboard() {
  const s = statsGerenciais();

  document.getElementById("view").innerHTML = `
    <div class="executive-alert">
      <strong>Base de gestão comercial</strong>
      <span>Este painel considera como régua principal os 53 lotes da UP. Os 31 lotes do permutante ficam fora do VGV, da meta e da leitura comercial.</span>
    </div>

    <div class="kpi-grid">
      ${kpi("Estoque UP", s.baseGestao, "Base real de gestão comercial")}
      ${kpi("Disponíveis para venda", s.disponiveis, "Inclui lotes em garantia GDF", s.disponiveis, s.baseGestao)}
      ${kpi("Comercializados UP", s.comercializados, "9 vendidos + 1 permutado", s.comercializados, s.baseGestao)}
      ${kpi("Restritos UP", s.restritosUP, "Fora da venda imediata", s.restritosUP, s.baseGestao)}
    </div>

    <div class="kpi-grid">
      ${kpi("Realizado no período", moeda(s.realizadoFinanceiro), `${s.pctMetaFinanceira}% da meta de ${moeda(CALLIANDRA.metaFinanceiraPeriodo)}`, s.realizadoFinanceiro, CALLIANDRA.metaFinanceiraPeriodo)}
      ${kpi("Unidades no período", `${s.vendidosPeriodo}/${CALLIANDRA.metaLotesPeriodo}`, `${s.pctMetaLotes}% da meta quantitativa`, s.vendidosPeriodo, CALLIANDRA.metaLotesPeriodo)}
      ${kpi("Faltam vender", s.faltamLotes, `Para atingir 23 lotes até 30/06`)}
      ${kpi("Falta financeiro", moeda(s.faltaFinanceira), `Média necessária por lote: ${moeda(s.valorMedioNecessario)}`)}
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-head">
          <h3>Leitura da meta abril-junho</h3>
          <span class="tag">01/04 a 30/06</span>
        </div>

        ${progressLine("Meta financeira", s.realizadoFinanceiro, CALLIANDRA.metaFinanceiraPeriodo, true)}
        ${progressLine("Meta de unidades", s.vendidosPeriodo, CALLIANDRA.metaLotesPeriodo, false)}

        <div class="insight-box">
          <strong>Diagnóstico</strong>
          <p>A meta financeira está em ${s.pctMetaFinanceira}% e a meta quantitativa em ${s.pctMetaLotes}%. O maior desafio gerencial é volume: ainda faltam ${s.faltamLotes} lotes para alcançar a meta de 23 unidades.</p>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Composição do estoque UP</h3>
          <span class="tag">Base 53</span>
        </div>

        <div class="donut-row">
          ${donutChart([
            { label: "Disponíveis", value: s.disponiveis, color: "#173d37" },
            { label: "Comercializados", value: s.comercializados, color: "#ac4a4a" },
            { label: "Restritos", value: s.restritosUP, color: "#d6cdbf" }
          ])}

          <div class="legend-list">
            ${legendItem("#173d37", "Disponíveis", s.disponiveis)}
            ${legendItem("#ac4a4a", "Comercializados", s.comercializados)}
            ${legendItem("#d6cdbf", "Restritos UP", s.restritosUP)}
            ${legendItem("#7d756b", "Permutante fora da régua", s.permutante)}
          </div>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-card-head">
        <h3>Vendas já consideradas na meta do período</h3>
        <span>${moeda(s.realizadoFinanceiro)} realizados</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Lote</th>
            <th>Área</th>
            <th>Valor tabela</th>
            <th>Valor fechado</th>
            <th>Desconto</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${s.vendasPeriodo.map(v => `
            <tr>
              <td>${v.quadra} ${v.lote}</td>
              <td>${area(v.area)}</td>
              <td>${moeda(v.valorTabela)}</td>
              <td><strong>${moeda(v.valorFinal)}</strong></td>
              <td>${moeda(v.valorTabela - v.valorFinal)}</td>
              <td>${badge(v.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* LOTES */

function renderLotes() {
  const s = statsGerenciais();

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Inventário de lotes</h2>
        <p>Use esta aba para consultar lote, metragem, preço de tabela, status e disponibilidade comercial.</p>
      </div>

      <div class="actions-row">
        <input id="buscaLotes" class="search-input" placeholder="Buscar rua, quadra, lote ou status..." oninput="filtrarLotes()">
        <select id="filtroStatus" class="search-input" onchange="filtrarLotes()">
          <option value="">Todos os status</option>
          <option value="disponivel">Disponíveis</option>
          <option value="vendido">Vendidos</option>
          <option value="garantia">Garantia GDF</option>
          <option value="permutante">Permutante</option>
          <option value="fora">Fora de venda</option>
        </select>
      </div>
    </div>

    <div class="mini-grid">
      ${mini("Estoque UP", s.baseGestao)}
      ${mini("Disponíveis", s.disponiveis)}
      ${mini("Comercializados", s.comercializados)}
      ${mini("Permutante fora do VGV", s.permutante)}
    </div>

    <div class="table-card">
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
    return `<tr><td colspan="10" class="empty">Nenhum lote foi carregado da planilha.</td></tr>`;
  }

  return lotes.map(l => `
    <tr data-search="${texto([l.id, l.quadra, l.rua, l.lote, l.statusSistema, l.statusGerencial, l.observacoes].join(" "))}">
      <td>${l.id}</td>
      <td>${l.quadra || "-"}</td>
      <td>${l.rua || "-"}</td>
      <td>${l.lote || "-"}</td>
      <td>${area(l.area)}</td>
      <td>${moeda(l.precoM2)}</td>
      <td>${moeda(l.valorTabela)}</td>
      <td>${badge(l.statusSistema)}</td>
      <td>${l.observacoes || l.anotacao || l.motivoBloqueio || "-"}</td>
      <td>
        <button class="btn-small" onclick="renderSimulador('${l.id}')">Simular</button>
      </td>
    </tr>
  `).join("");
}

function filtrarLotes() {
  const busca = texto(document.getElementById("buscaLotes")?.value || "");
  const status = texto(document.getElementById("filtroStatus")?.value || "");

  document.querySelectorAll("#tbodyLotes tr").forEach(tr => {
    const search = tr.dataset.search || "";
    const okBusca = !busca || search.includes(busca);
    const okStatus = !status || search.includes(status);

    tr.style.display = okBusca && okStatus ? "" : "none";
  });
}

/* SIMULADOR */

function renderSimulador(loteId = "") {
  const listaLotes = getLotesSimulaveis();

  const selectedId = loteId || listaLotes[0]?.id || "";

  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === "simulador");
  });

  document.getElementById("pageTitle").innerText = "Simulador";
  document.getElementById("pageSubtitle").innerText = "Condições comerciais, Price, SAC e IPCA";

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Simulação comercial</h2>
        <p>Selecione o lote e escolha a condição. O sistema puxa metragem e valor de tabela automaticamente.</p>
      </div>
      <button class="btn-ghost" onclick="window.print()">Imprimir simulação</button>
    </div>

    <div class="sim-grid">
      <div class="card">
        <div class="field">
          <label>Lote</label>
          <select id="simLote" onchange="atualizarSimulacao()">
            ${listaLotes.map(l => `
              <option value="${l.id}" ${l.id === selectedId ? "selected" : ""}>
                ${l.quadra} ${l.lote} · ${area(l.area)} · ${moeda(l.valorTabela)} · ${l.statusSistema}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="field">
          <label>Condição</label>
          <select id="simCondicao" onchange="aplicarCondicaoSimulador(); atualizarSimulacao();">
            <option value="avista">À vista · 5% de desconto</option>
            <option value="entrada50">Entrada de 50% · 2,5% de desconto</option>
            <option value="ate36" selected>Financiamento até 36x · 12% a.a. sem correção</option>
            <option value="acima36">Financiamento acima de 36x · 12% a.a. + IPCA</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>

        <div class="field">
          <label>Entrada (%)</label>
          <input id="simEntradaPct" type="number" min="0" max="100" value="30" oninput="atualizarSimulacao()">
        </div>

        <div class="field">
          <label>Parcelas</label>
          <input id="simParcelas" type="number" min="0" max="180" value="36" oninput="atualizarSimulacao()">
        </div>

        <div class="field">
          <label>Desconto adicional negociado (R$)</label>
          <input id="simDescontoExtra" type="number" min="0" value="0" oninput="atualizarSimulacao()">
        </div>

        <div class="notice">
          Até 36 parcelas: juros de 12% ao ano, sem correção monetária. Acima de 36 parcelas: juros de 12% ao ano + IPCA. O sistema não projeta o IPCA, apenas registra a incidência.
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Resultado</h3>
          <span id="simStatus"></span>
        </div>

        <div id="resultadoSimulacao"></div>
      </div>
    </div>
  `;

  aplicarCondicaoSimulador();
  atualizarSimulacao();
}

function getLotesSimulaveis() {
  const disponiveis = S.lotes.filter(l =>
    l.vendavel ||
    l.statusSistema === "Disponível" ||
    l.statusSistema === "Garantia GDF"
  );

  if (disponiveis.length) return disponiveis;

  return S.lotes;
}

function aplicarCondicaoSimulador() {
  const cond = document.getElementById("simCondicao")?.value;
  const entrada = document.getElementById("simEntradaPct");
  const parcelas = document.getElementById("simParcelas");

  if (!entrada || !parcelas) return;

  if (cond === "avista") {
    entrada.value = 100;
    parcelas.value = 0;
  }

  if (cond === "entrada50") {
    entrada.value = 50;
    parcelas.value = 36;
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
  const entradaPct = num(document.getElementById("simEntradaPct")?.value);
  const parcelas = num(document.getElementById("simParcelas")?.value);
  const descontoExtra = num(document.getElementById("simDescontoExtra")?.value);

  let descontoPct = 0;

  if (cond === "avista") descontoPct = 5;
  if (cond === "entrada50") descontoPct = 2.5;

  const descontoAutomatico = lote.valorTabela * (descontoPct / 100);
  const descontoTotal = descontoAutomatico + descontoExtra;
  const valorNegociado = Math.max(lote.valorTabela - descontoTotal, 0);
  const entradaValor = valorNegociado * (entradaPct / 100);
  const saldo = Math.max(valorNegociado - entradaValor, 0);
  const parcelaPrice = parcelas > 0 ? calcPrice(saldo, parcelas, JUROS_MES) : 0;
  const sac = parcelas > 0 ? calcSAC(saldo, parcelas, JUROS_MES) : null;
  const temIPCA = parcelas > 36;

  document.getElementById("simStatus").innerHTML = temIPCA ? badge("IPCA") : badge("Sem correção");

  document.getElementById("resultadoSimulacao").innerHTML = `
    <div class="result-grid">
      ${resultItem("Lote", `${lote.quadra} ${lote.lote}`)}
      ${resultItem("Área", area(lote.area))}
      ${resultItem("Valor tabela", moeda(lote.valorTabela))}
      ${resultItem("Desconto automático", moeda(descontoAutomatico))}
      ${resultItem("Desconto adicional", moeda(descontoExtra))}
      ${resultItem("Valor negociado", moeda(valorNegociado))}
      ${resultItem("Entrada", moeda(entradaValor))}
      ${resultItem("Saldo financiado", moeda(saldo))}
      ${resultItem("Parcela Price", parcelas ? moeda(parcelaPrice) : "Não se aplica")}
      ${resultItem("SAC primeira", sac ? moeda(sac.primeira) : "Não se aplica")}
      ${resultItem("SAC última", sac ? moeda(sac.ultima) : "Não se aplica")}
      ${resultItem("Parcelas", parcelas || "Não se aplica")}
    </div>

    <div class="notice ${temIPCA ? "warn" : ""}">
      ${temIPCA
        ? "Atenção: acima de 36 parcelas há incidência de IPCA durante o contrato. O sistema registra a regra, mas não projeta o índice."
        : "Condição dentro de até 36 parcelas: juros de 12% ao ano, sem correção monetária."}
    </div>

    <div class="grid-2" style="margin-top:22px">
      <div class="table-card compact">
        <div class="table-card-head">
          <h3>Price · primeiras 12 parcelas</h3>
        </div>
        ${tabelaPrice(saldo, parcelas)}
      </div>

      <div class="table-card compact">
        <div class="table-card-head">
          <h3>SAC · primeiras 12 parcelas</h3>
        </div>
        ${tabelaSAC(saldo, parcelas)}
      </div>
    </div>
  `;
}

/* CONTRATOS */

function renderContratos() {
  const vendas = getVendasGerenciais();
  const vendasPeriodo = getVendasPeriodo();

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Contratos e propostas</h2>
        <p>Cadastro de vendas, reservas e propostas com lote, preço de tabela, desconto, valor fechado, corretor e origem.</p>
      </div>
      <button class="btn-primary btn-fit" onclick="abrirModalContrato()">Novo contrato</button>
    </div>

    <div class="mini-grid">
      ${mini("Registros", vendas.length)}
      ${mini("VGV no período", moeda(soma(vendasPeriodo, "valorFinal")))}
      ${mini("Desconto no período", moeda(soma(vendasPeriodo, "valorTabela") - soma(vendasPeriodo, "valorFinal")))}
      ${mini("Ticket no período", moeda(media(vendasPeriodo, "valorFinal")))}
    </div>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Cliente</th>
            <th>Lote</th>
            <th>Área</th>
            <th>Valor tabela</th>
            <th>Valor fechado</th>
            <th>Desconto</th>
            <th>Status</th>
            <th>Corretor</th>
            <th>Origem</th>
          </tr>
        </thead>
        <tbody>
          ${vendas.map(v => `
            <tr>
              <td>${v.data || "-"}</td>
              <td>${v.cliente || "-"}</td>
              <td>${v.quadra || "-"} ${v.lote || ""}</td>
              <td>${area(v.area)}</td>
              <td>${moeda(v.valorTabela)}</td>
              <td><strong>${moeda(v.valorFinal)}</strong></td>
              <td>${moeda((v.valorTabela || 0) - (v.valorFinal || 0))}</td>
              <td>${badge(v.status)}</td>
              <td>${v.corretor || "Não informado"}</td>
              <td>${v.origem || "Não informada"}</td>
            </tr>
          `).join("") || `<tr><td colspan="10" class="empty">Nenhum contrato cadastrado.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function abrirModalContrato() {
  const lotes = getLotesSimulaveis();

  openModal(`
    <div class="modal">
      <div class="modal-head">
        <h3>Novo contrato / proposta</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          ${fieldInput("ctData", "Data", "date", new Date().toISOString().slice(0, 10))}
          ${fieldInput("ctCliente", "Nome do cliente", "text", "")}

          <div class="field">
            <label>Lote</label>
            <select id="ctLote" onchange="preencherContratoPorLote()">
              ${lotes.map(l => `<option value="${l.id}">${l.quadra} ${l.lote} · ${area(l.area)} · ${moeda(l.valorTabela)}</option>`).join("")}
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

          ${fieldInput("ctArea", "Metragem", "text", "", true)}
          ${fieldInput("ctValorTabela", "Valor tabela", "text", "", true)}
          ${fieldInput("ctDesconto", "Desconto concedido", "number", "0")}
          ${fieldInput("ctValorFinal", "Valor negociado", "number", "0")}

          <div class="field">
            <label>Forma de pagamento</label>
            <select id="ctPagamento">
              <option>À vista</option>
              <option>Entrada de 50%</option>
              <option>Financiamento até 36 parcelas</option>
              <option>Financiamento acima de 36 parcelas</option>
              <option>Personalizado</option>
            </select>
          </div>

          <div class="field">
            <label>Corretor / imobiliária</label>
            <select id="ctCorretor">
              ${S.corretores.map(c => `<option>${c.nome}</option>`).join("")}
            </select>
          </div>

          ${fieldInput("ctOrigem", "Origem do lead", "text", "")}
        </div>

        <div class="field" style="margin-top:16px">
          <label>Observações</label>
          <textarea id="ctObs"></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary btn-fit" onclick="salvarContrato()">Salvar</button>
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
  document.getElementById("ctValorTabela").value = moeda(lote.valorTabela);
  document.getElementById("ctValorFinal").value = lote.valorTabela.toFixed(2);
}

async function salvarContrato() {
  const idLote = document.getElementById("ctLote")?.value;
  const lote = S.lotes.find(l => l.id === idLote);

  if (!lote) {
    toast("Selecione um lote válido.", "err");
    return;
  }

  const valorFinal = num(document.getElementById("ctValorFinal")?.value);
  const descontoManual = num(document.getElementById("ctDesconto")?.value);
  const desconto = descontoManual || Math.max(lote.valorTabela - valorFinal, 0);
  const corretor = document.getElementById("ctCorretor")?.value || "";

  const venda = {
    id: uid(),
    data: document.getElementById("ctData")?.value || "",
    cliente: document.getElementById("ctCliente")?.value || "",
    quadra: lote.quadra,
    rua: lote.rua,
    lote: lote.lote,
    area: lote.area,
    valorTabela: lote.valorTabela,
    desconto,
    valorFinal,
    status: document.getElementById("ctStatus")?.value || "Contrato",
    corretor,
    origem: document.getElementById("ctOrigem")?.value || "",
    formaPagamento: document.getElementById("ctPagamento")?.value || "",
    obs: document.getElementById("ctObs")?.value || "",
    comissaoValor: calcularComissao(valorFinal, corretor)
  };

  S.vendas.unshift(venda);

  saveJSON("calliandra_vendas", S.vendas);

  await tryAppend("vendas", venda);

  aplicarRegrasGerenciais();

  closeModal();
  toast("Contrato salvo.");
  renderContratos();
}

/* CORRETORES */

function renderCorretores() {
  const vendas = getVendasGerenciais();

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Corretores e parceiros</h2>
        <p>Beiramar como categoria Ouro com comissão padrão de 5%. Parceiros Prata com comissão padrão de 4,5%.</p>
      </div>
      <button class="btn-primary btn-fit" onclick="abrirModalCorretor()">Novo parceiro</button>
    </div>

    <div class="table-card">
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
            const vendasCorretor = vendas.filter(v => mesmoTexto(v.corretor, c.nome) && isVendido(v.status));
            const vgv = soma(vendasCorretor, "valorFinal");
            return `
              <tr>
                <td>${c.nome}</td>
                <td>${badge(c.categoria)}</td>
                <td>${c.comissao}</td>
                <td>${vendasCorretor.length}</td>
                <td>${moeda(vgv)}</td>
                <td>${moeda(soma(vendasCorretor, "comissaoValor"))}</td>
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
        <h3>Novo parceiro comercial</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          ${fieldInput("crNome", "Nome da imobiliária / corretor", "text", "")}

          <div class="field">
            <label>Categoria</label>
            <select id="crCategoria" onchange="document.getElementById('crComissao').value = this.value === 'Ouro' ? '5%' : '4,5%'">
              <option>Prata</option>
              <option>Ouro</option>
              <option>Bronze</option>
            </select>
          </div>

          ${fieldInput("crComissao", "Comissão padrão", "text", "4,5%")}
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
    comissao: document.getElementById("crComissao")?.value || "4,5%"
  };

  S.corretores.push(corretor);

  saveJSON("calliandra_corretores", S.corretores);

  await tryAppend("corretores", corretor);

  closeModal();
  toast("Parceiro cadastrado.");
  renderCorretores();
}

/* PLANO DE AÇÃO */

function renderPlano() {
  const fases = ["Venda antecipada", "Lançamento", "Pós-lançamento", "Manutenção"];

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Plano de ação</h2>
        <p>Transforma o cronograma em uma ferramenta de execução: ação, prazo, responsável, custo, prioridade e status.</p>
      </div>
      <button class="btn-primary btn-fit" onclick="abrirModalAcao()">Nova ação</button>
    </div>

    ${fases.map((fase, i) => {
      const acoes = S.acoes.filter(a => mesmoTexto(a.fase, fase));

      return `
        <div class="phase-card ${i === 0 ? "open" : ""}">
          <div class="phase-head" onclick="this.parentElement.classList.toggle('open')">
            <div>
              <h3>${fase}</h3>
              <p>${acoes.length} ações · ${moeda(soma(acoes, "orcamento"))} previsto</p>
            </div>
            <button class="btn-small">+</button>
          </div>

          <div class="phase-body">
            <div class="table-card compact">
              <table>
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th>Responsável</th>
                    <th>Prazo</th>
                    <th>Orçamento</th>
                    <th>Status</th>
                    <th>Prioridade</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  ${acoes.map(a => `
                    <tr>
                      <td>${a.acao}</td>
                      <td>${a.responsavel || "-"}</td>
                      <td>${a.data || "-"}</td>
                      <td>${moeda(a.orcamento)}</td>
                      <td>${badge(a.status)}</td>
                      <td>${a.prioridade || "-"}</td>
                      <td>${a.obs || "-"}</td>
                    </tr>
                  `).join("") || `<tr><td colspan="7" class="empty">Nenhuma ação cadastrada.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function abrirModalAcao() {
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <h3>Nova ação</h3>
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

          ${fieldInput("acAcao", "Ação", "text", "")}
          ${fieldInput("acResponsavel", "Responsável", "text", "")}
          ${fieldInput("acData", "Prazo", "text", "")}
          ${fieldInput("acOrcamento", "Orçamento", "number", "0")}

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

          ${fieldInput("acObs", "Observação", "text", "")}
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary btn-fit" onclick="salvarAcao()">Salvar</button>
      </div>
    </div>
  `);
}

async function salvarAcao() {
  const acao = {
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

  S.acoes.push(acao);
  saveJSON("calliandra_acoes", S.acoes);
  await tryAppend("acoes", acao);

  closeModal();
  toast("Ação salva.");
  renderPlano();
}

/* MÍDIA */

function renderMidia() {
  const previsto = soma(S.midia, "previsto");
  const realizado = soma(S.midia, "realizado");
  const leads = soma(S.midia, "leads");

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Plano de mídia</h2>
        <p>Controle de verba, canais, leads, CPL e status das campanhas.</p>
      </div>
      <button class="btn-primary btn-fit" onclick="abrirModalMidia()">Nova mídia</button>
    </div>

    <div class="kpi-grid">
      ${kpi("Verba referência", moeda(CALLIANDRA.verbaMidia), "Planejamento macro")}
      ${kpi("Previsto no plano", moeda(previsto), `${percentual(previsto, CALLIANDRA.verbaMidia)}% da verba`)}
      ${kpi("Realizado", moeda(realizado), `${percentual(realizado, previsto)}% do previsto`)}
      ${kpi("Leads", leads, `CPL médio: ${moeda(realizado / Math.max(leads, 1))}`)}
    </div>

    <div class="table-card">
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

function abrirModalMidia() {
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <h3>Nova ação de mídia</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          ${fieldInput("mdCampanha", "Campanha", "text", "")}
          ${fieldInput("mdCanal", "Canal", "text", "")}
          ${fieldInput("mdObjetivo", "Objetivo", "text", "")}
          ${fieldInput("mdPeriodo", "Período", "text", "")}
          ${fieldInput("mdPrevisto", "Previsto", "number", "0")}
          ${fieldInput("mdRealizado", "Realizado", "number", "0")}
          ${fieldInput("mdLeads", "Leads", "number", "0")}

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
  const midia = {
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

  S.midia.push(midia);
  saveJSON("calliandra_midia", S.midia);
  await tryAppend("midia", midia);

  closeModal();
  toast("Mídia salva.");
  renderMidia();
}

/* FÍSICO-FINANCEIRO */

function renderFinanceiro() {
  const previsto = soma(S.acoes, "orcamento") + soma(S.gastos, "previsto");
  const realizado = soma(S.gastos, "realizado");
  const saldo = previsto - realizado;

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Cronograma físico-financeiro</h2>
        <p>Integra plano de ação, orçamento previsto, execução e saldo.</p>
      </div>
      <button class="btn-primary btn-fit" onclick="abrirModalGasto()">Novo item</button>
    </div>

    <div class="kpi-grid">
      ${kpi("Previsto", moeda(previsto))}
      ${kpi("Realizado", moeda(realizado))}
      ${kpi("Saldo", moeda(saldo))}
      ${kpi("Execução", `${percentual(realizado, previsto)}%`)}
    </div>

    <div class="table-card">
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

function abrirModalGasto() {
  openModal(`
    <div class="modal">
      <div class="modal-head">
        <h3>Novo item financeiro</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          ${fieldInput("gtCategoria", "Categoria", "text", "")}
          ${fieldInput("gtItem", "Item", "text", "")}
          ${fieldInput("gtPrevisto", "Previsto", "number", "0")}
          ${fieldInput("gtRealizado", "Realizado", "number", "0")}

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
  const gasto = {
    id: uid(),
    categoria: val("gtCategoria"),
    item: val("gtItem"),
    previsto: num(val("gtPrevisto")),
    realizado: num(val("gtRealizado")),
    status: val("gtStatus")
  };

  S.gastos.push(gasto);
  saveJSON("calliandra_gastos", S.gastos);
  await tryAppend("gastos", gasto);

  closeModal();
  toast("Item salvo.");
  renderFinanceiro();
}

/* RELATÓRIOS */

function renderRelatorios() {
  const s = statsGerenciais();
  const vendasPeriodo = s.vendasPeriodo;

  const rankingParceiros = agrupar(vendasPeriodo, "corretor");
  const rankingOrigem = agrupar(vendasPeriodo, "origem");
  const rankingQuadra = agrupar(vendasPeriodo, "quadra");

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Relatório executivo</h2>
        <p>Leitura gerencial focada em decisão: estoque da UP, meta, vendas, desconto, origem e próximos movimentos.</p>
      </div>
      <button class="btn-ghost" onclick="window.print()">Imprimir relatório</button>
    </div>

    <div class="executive-report">
      <div class="report-title">
        <h2>Calliandra · Relatório comercial</h2>
        <p>Período de meta: 01/04 a 30/06 · Base de gestão: 53 lotes da UP</p>
      </div>

      <div class="kpi-grid">
        ${kpi("Realizado", moeda(s.realizadoFinanceiro), `${s.pctMetaFinanceira}% da meta financeira`)}
        ${kpi("Unidades vendidas", `${s.vendidosPeriodo}/${CALLIANDRA.metaLotesPeriodo}`, `${s.pctMetaLotes}% da meta de unidades`)}
        ${kpi("Ticket médio", moeda(s.ticketPeriodo))}
        ${kpi("Desconto médio", moeda(s.descontoMedio))}
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-head">
            <h3>Resumo do estoque UP</h3>
            <span class="tag">Base 53</span>
          </div>

          ${progressLine("Disponíveis reais", s.disponiveis, s.baseGestao, false)}
          ${progressLine("Comercializados", s.comercializados, s.baseGestao, false)}
          ${progressLine("Restritos UP", s.restritosUP, s.baseGestao, false)}

          <div class="insight-box">
            <strong>Nota gerencial</strong>
            <p>Os 31 lotes do permutante não entram no VGV nem na meta. A leitura comercial deve concentrar disponibilidade, proposta e conversão sobre o estoque UP.</p>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Risco da meta</h3>
            <span class="tag alert">Atenção</span>
          </div>

          ${progressLine("Meta financeira", s.realizadoFinanceiro, CALLIANDRA.metaFinanceiraPeriodo, true)}
          ${progressLine("Meta de unidades", s.vendidosPeriodo, CALLIANDRA.metaLotesPeriodo, false)}

          <div class="insight-box danger">
            <strong>Leitura objetiva</strong>
            <p>Faltam ${s.faltamLotes} lotes e ${moeda(s.faltaFinanceira)} até 30/06. A meta quantitativa está mais pressionada que a meta financeira.</p>
          </div>
        </div>
      </div>

      <div class="grid-3">
        <div class="card">
          <div class="card-head">
            <h3>Parceiros</h3>
          </div>
          ${barRanking(rankingParceiros)}
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Origem dos leads</h3>
          </div>
          ${barRanking(rankingOrigem)}
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Vendas por quadra</h3>
          </div>
          ${barRanking(rankingQuadra)}
        </div>
      </div>

      <div class="table-card">
        <div class="table-card-head">
          <h3>Vendas do período</h3>
          <span>${moeda(s.realizadoFinanceiro)} realizados</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Lote</th>
              <th>Área</th>
              <th>Valor tabela</th>
              <th>Valor fechado</th>
              <th>Desconto</th>
              <th>Parceiro</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            ${vendasPeriodo.map(v => `
              <tr>
                <td>${v.quadra} ${v.lote}</td>
                <td>${area(v.area)}</td>
                <td>${moeda(v.valorTabela)}</td>
                <td><strong>${moeda(v.valorFinal)}</strong></td>
                <td>${moeda(v.valorTabela - v.valorFinal)}</td>
                <td>${v.corretor || "Não informado"}</td>
                <td>${v.origem || "Não informada"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Recomendações executivas</h3>
        </div>

        <div class="recommendations">
          <div>
            <strong>1. Separar régua institucional e régua comercial</strong>
            <p>84 lotes é informação do empreendimento. Para gestão, usar 53 lotes UP.</p>
          </div>

          <div>
            <strong>2. Focar velocidade de conversão</strong>
            <p>A meta pede 21 novos contratos até 30/06. O gargalo está em volume, não apenas em VGV.</p>
          </div>

          <div>
            <strong>3. Qualificar relatório de origem</strong>
            <p>Os próximos contratos precisam registrar parceiro e origem para medir mídia e performance comercial.</p>
          </div>

          <div>
            <strong>4. Usar mapa como régua de abordagem</strong>
            <p>Lotes brancos e amarelos devem alimentar prioridade de prospecção. Lotes pretos devem sair da régua de venda.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* MAPA */

function renderMapa() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Mapa comercial</h2>
        <p>Leitura visual do estoque. Branco e amarelo são comercializáveis. Preto representa vendido. A Casa Calliandra não está disponível para venda.</p>
      </div>
    </div>

    <div class="map-grid">
      <div class="map-box">
        <img
          src="./assets/mapa-unidades.png"
          alt="Mapa de unidades Calliandra"
          onerror="this.style.display='none';document.getElementById('mapPlaceholder').style.display='grid';"
        />

        <div id="mapPlaceholder" class="map-placeholder" style="display:none">
          <div>
            <h2>Mapa ainda não carregado</h2>
            <p>Suba a imagem como <strong>assets/mapa-unidades.png</strong>.</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Como ler o mapa</h3>
        </div>

        <div class="legend-list big">
          ${legendItem("#ffffff", "Bolinha branca", "Disponível para venda")}
          ${legendItem("#ffdb56", "Amarelo", "Garantia GDF, mas disponível para venda")}
          ${legendItem("#111111", "Preto", "Vendido")}
          ${legendItem("#d35ad8", "Roxo", "Casa Calliandra, fora de venda")}
          ${legendItem("#ac4a4a", "Vermelho", "Indisponível / fora do estoque imediato")}
        </div>

        <div class="insight-box">
          <strong>Diretriz gerencial</strong>
          <p>O mapa deve orientar a ação comercial, mas o dashboard deve usar a régua do estoque UP: 53 lotes, 33 disponíveis reais, 10 comercializados e 10 restritos.</p>
        </div>
      </div>
    </div>
  `;
}

/* CONFIGURAÇÕES */

function renderConfiguracoes() {
  const s = statsGerenciais();

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h2>Configurações</h2>
        <p>Parâmetros comerciais aplicados nesta versão.</p>
      </div>
    </div>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>Parâmetro</th>
            <th>Valor</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Total do empreendimento</td><td>${CALLIANDRA.totalEmpreendimento}</td><td>Informação institucional</td></tr>
          <tr><td>Estoque comercial UP</td><td>${CALLIANDRA.estoqueUP}</td><td>Base de gestão comercial</td></tr>
          <tr><td>Lotes do permutante</td><td>${CALLIANDRA.lotesPermutante}</td><td>Fora do VGV e da meta</td></tr>
          <tr><td>Disponíveis reais</td><td>${CALLIANDRA.disponiveisReais}</td><td>Inclui garantia GDF</td></tr>
          <tr><td>Comercializados</td><td>${CALLIANDRA.comercializadosUP}</td><td>9 vendidos + 1 permutado</td></tr>
          <tr><td>Restritos UP</td><td>${s.restritosUP}</td><td>Saldo técnico fora de venda imediata</td></tr>
          <tr><td>Meta financeira</td><td>${moeda(CALLIANDRA.metaFinanceiraPeriodo)}</td><td>Até 30/06</td></tr>
          <tr><td>Meta unidades</td><td>${CALLIANDRA.metaLotesPeriodo}</td><td>Até 30/06</td></tr>
          <tr><td>Juros</td><td>12% ao ano</td><td>Até 36x sem correção</td></tr>
          <tr><td>IPCA</td><td>Acima de 36x</td><td>Sem projeção automática</td></tr>
        </tbody>
      </table>
    </div>

    <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn-ghost" onclick="testarAPI()">Testar API</button>
      <button class="btn-ghost" onclick="limparDadosLocais()">Limpar dados locais</button>
    </div>
  `;
}

/* NORMALIZAÇÃO */

function getSheet(data, key) {
  const normalizedKey = texto(key);
  const found = Object.keys(data || {}).find(k => texto(k) === normalizedKey);

  if (!found) return [];

  const value = data[found];

  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;

  return [];
}

function normalizarLote(row, index) {
  const id = pick(row, ["id_lote", "id", "codigo", "código"]) || `LOTE-${index + 1}`;

  const quadra = limparNomeQuadra(pick(row, ["quadra", "setor", "bloco"]) || "");
  const rua = pick(row, ["rua", "logradouro"]) || "";
  const loteNumero = String(pick(row, ["lote", "numero", "número"]) || "").trim();

  const areaLote = num(pick(row, ["area_m2", "area", "área", "metragem", "m2", "m²"]));
  const precoM2 = num(pick(row, ["preco_m2_base", "preco_m2", "preço_m2", "valor_m2"])) || PRECO_M2_PADRAO;
  const valorTabela = num(pick(row, ["valor_tabela", "valor_total", "valor", "preco_total", "preço_total"])) || areaLote * precoM2;

  const statusBruto = [
    pick(row, ["status_lote", "status"]),
    pick(row, ["status_venda"]),
    pick(row, ["origem_status"]),
    pick(row, ["proprietario_origem", "proprietário_origem"]),
    pick(row, ["estoque_comercial"]),
    pick(row, ["vendavel", "vendável"]),
    pick(row, ["motivo_bloqueio"]),
    pick(row, ["anotacao_lote", "anotação", "anotacao"]),
    pick(row, ["observacoes", "observações", "obs"])
  ].join(" ");

  const t = texto(statusBruto);

  let statusSistema = "Disponível";
  let vendavel = true;

  if (t.includes("permutante")) {
    statusSistema = "Permutante";
    vendavel = false;
  } else if (t.includes("casa calliandra")) {
    statusSistema = "Casa Calliandra";
    vendavel = false;
  } else if (t.includes("garantia") || t.includes("gdf")) {
    statusSistema = "Garantia GDF";
    vendavel = true;
  } else if (t.includes("vendido") || t.includes("pago") || t.includes("contrato assinado")) {
    statusSistema = "Vendido";
    vendavel = false;
  } else if (t.includes("reserv")) {
    statusSistema = "Reservado";
    vendavel = false;
  } else if (
    t.includes("bloque") ||
    t.includes("indispon") ||
    t.includes("desenvolve") ||
    t.includes("nao vender") ||
    t.includes("não vender")
  ) {
    statusSistema = "Fora de venda";
    vendavel = false;
  }

  return {
    id,
    quadra,
    rua,
    lote: loteNumero,
    area: areaLote,
    precoM2,
    valorTabela,
    statusSistema,
    statusGerencial: statusSistema === "Garantia GDF" ? "Disponível" : statusSistema,
    vendavel,
    observacoes: pick(row, ["observacoes", "observações", "obs"]) || "",
    anotacao: pick(row, ["anotacao_lote", "anotação", "anotacao"]) || "",
    motivoBloqueio: pick(row, ["motivo_bloqueio"]) || "",
    raw: row
  };
}

function normalizarVenda(row) {
  const valorTabela = num(pick(row, ["valor_tabela", "valor_lote", "preco_tabela", "preço_tabela"]));
  const valorFinal = num(pick(row, ["valor_final", "valor_negociado", "valor_venda", "valor"])) || valorTabela;

  return {
    id: pick(row, ["id", "id_venda", "id_contrato"]) || uid(),
    data: pick(row, ["data", "data_venda", "criado_em"]) || "",
    cliente: pick(row, ["cliente", "nome", "nome_cliente"]) || "",
    quadra: limparNomeQuadra(pick(row, ["quadra"]) || ""),
    rua: pick(row, ["rua"]) || "",
    lote: String(pick(row, ["lote", "id_lote"]) || "").trim(),
    area: num(pick(row, ["area_m2", "area", "metragem", "m2"])),
    valorTabela,
    valorFinal,
    desconto: num(pick(row, ["desconto", "desconto_concedido"])) || Math.max(valorTabela - valorFinal, 0),
    status: pick(row, ["status", "status_venda", "situacao"]) || "Contrato",
    corretor: pick(row, ["corretor", "parceiro", "parceiro_comercial", "imobiliaria", "imobiliária"]) || "Não informado",
    origem: pick(row, ["origem", "origem_lead", "canal"]) || "Não informada",
    formaPagamento: pick(row, ["forma_pagamento", "pagamento"]) || "",
    comissaoValor: num(pick(row, ["comissao", "comissão", "valor_comissao"]))
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
  const aba = getSheet(data, "corretores");

  if (aba.length) {
    return aba.map(row => {
      const nome = pick(row, ["nome", "parceiro", "parceiro_comercial", "imobiliaria", "imobiliária"]) || "";
      const categoria = pick(row, ["categoria", "categoria_parceiro"]) || (texto(nome).includes("beiramar") ? "Ouro" : "Prata");
      const comissao = pick(row, ["comissao", "comissão"]) || (categoria === "Ouro" ? "5%" : "4,5%");

      return {
        id: pick(row, ["id", "id_corretor"]) || uid(),
        nome,
        categoria,
        comissao
      };
    });
  }

  return corretoresPadrao();
}

/* PADRÕES */

function corretoresPadrao() {
  return [
    { id: uid(), nome: "Humanize", categoria: "Prata", comissao: "4,5%" },
    { id: uid(), nome: "GM", categoria: "Prata", comissao: "4,5%" },
    { id: uid(), nome: "Beiramar", categoria: "Ouro", comissao: "5%" },
    { id: uid(), nome: "MJ", categoria: "Prata", comissao: "4,5%" },
    { id: uid(), nome: "Enzo", categoria: "Prata", comissao: "4,5%" },
    { id: uid(), nome: "HouseUP", categoria: "Prata", comissao: "4,5%" },
    { id: uid(), nome: "Torres Imob", categoria: "Prata", comissao: "4,5%" }
  ];
}

function acoesPadrao() {
  return [
    { id: uid(), fase: "Venda antecipada", acao: "Revisar carteira de leads aquecidos", responsavel: "Comercial", data: "Semanal", orcamento: 0, status: "Em andamento", prioridade: "Alta", obs: "Priorizar leads com visita, simulação ou atendimento avançado." },
    { id: uid(), fase: "Venda antecipada", acao: "Rodada de fechamento com corretores", responsavel: "House/Parceiros", data: "Até 19/06", orcamento: 0, status: "Planejada", prioridade: "Alta", obs: "Transformar interesse em proposta formal." },
    { id: uid(), fase: "Venda antecipada", acao: "Campanha de urgência pré-lançamento", responsavel: "Marketing", data: "Até 19/06", orcamento: 60000, status: "Planejada", prioridade: "Alta", obs: "Comunicar janela de condição antes da virada de valores." },
    { id: uid(), fase: "Lançamento", acao: "Evento oficial de lançamento", responsavel: "Marketing/Comercial", data: "20/06", orcamento: 120000, status: "Planejada", prioridade: "Alta", obs: "Meta de 10 unidades no dia." },
    { id: uid(), fase: "Lançamento", acao: "Plantão de simulações e propostas", responsavel: "Comercial", data: "20/06", orcamento: 15000, status: "Planejada", prioridade: "Alta", obs: "Equipe pronta para fechamento." },
    { id: uid(), fase: "Pós-lançamento", acao: "Remarketing para visitantes e leads do evento", responsavel: "Marketing", data: "21/06 a 30/06", orcamento: 50000, status: "Planejada", prioridade: "Alta", obs: "Recuperar indecisos." },
    { id: uid(), fase: "Pós-lançamento", acao: "Mutirão de fechamento das propostas pendentes", responsavel: "Comercial", data: "Até 30/06", orcamento: 0, status: "Planejada", prioridade: "Alta", obs: "Converter proposta em contrato." },
    { id: uid(), fase: "Manutenção", acao: "Relatório semanal para diretoria", responsavel: "Gestão Comercial", data: "Toda segunda", orcamento: 0, status: "Em andamento", prioridade: "Média", obs: "VGV, estoque, mídia, corretores e gargalos." }
  ];
}

function midiaPadrao() {
  return [
    { id: uid(), campanha: "Venda antecipada", canal: "Meta Ads", objetivo: "Leads qualificados e remarketing", periodo: "Até 19/06", previsto: 120000, realizado: 0, leads: 0, status: "Planejado" },
    { id: uid(), campanha: "Venda antecipada", canal: "Google Ads", objetivo: "Busca ativa por lotes e condomínio", periodo: "Até 19/06", previsto: 65000, realizado: 0, leads: 0, status: "Planejado" },
    { id: uid(), campanha: "Lançamento", canal: "Meta + Google + WhatsApp", objetivo: "Convite e conversão para evento", periodo: "20/06", previsto: 170000, realizado: 0, leads: 0, status: "Planejado" },
    { id: uid(), campanha: "Lançamento", canal: "Produção audiovisual", objetivo: "Vídeos, reels, criativos e depoimentos", periodo: "Junho", previsto: 85000, realizado: 0, leads: 0, status: "Planejado" },
    { id: uid(), campanha: "Pós-lançamento", canal: "Remarketing", objetivo: "Recuperar leads e fechar propostas", periodo: "21/06 a 30/06", previsto: 70000, realizado: 0, leads: 0, status: "Planejado" },
    { id: uid(), campanha: "Apoio comercial", canal: "Landing pages e materiais", objetivo: "Suporte à House e parceiros", periodo: "Junho", previsto: 30000, realizado: 0, leads: 0, status: "Planejado" }
  ];
}

function gastosPadrao() {
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

function kpi(label, value, sub = "", current = null, total = null) {
  const pct = current !== null && total !== null ? percentual(current, total) : null;

  return `
    <div class="kpi-card">
      <span>${label}</span>
      <strong>${value}</strong>
      ${sub ? `<small>${sub}</small>` : ""}
      ${pct !== null ? `<div class="progress"><i style="width:${Math.min(pct, 100)}%"></i></div>` : ""}
    </div>
  `;
}

function mini(label, value) {
  return `
    <div class="mini-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function progressLine(label, value, total, money) {
  const pct = percentual(value, total);

  return `
    <div class="progress-line">
      <div>
        <strong>${label}</strong>
        <span>${money ? moeda(value) : value} de ${money ? moeda(total) : total}</span>
      </div>
      <div class="bar"><i style="width:${Math.min(pct, 100)}%"></i></div>
      <b>${pct}%</b>
    </div>
  `;
}

function donutChart(items) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  let start = 0;

  const parts = items.map(item => {
    const deg = item.value / total * 360;
    const str = `${item.color} ${start}deg ${start + deg}deg`;
    start += deg;
    return str;
  });

  return `<div class="donut" style="background:conic-gradient(${parts.join(",")})"></div>`;
}

function legendItem(color, label, value) {
  return `
    <div class="legend-item">
      <i style="background:${color}"></i>
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function resultItem(label, value) {
  return `
    <div class="result-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function badge(value) {
  const label = value || "-";
  const t = texto(label);

  let cls = "tag";

  if (t.includes("vend") || t.includes("pago") || t.includes("contrato")) cls += " sold";
  else if (t.includes("dispon") || t.includes("garantia")) cls += " available";
  else if (t.includes("reserv")) cls += " reserved";
  else if (t.includes("alert") || t.includes("aten") || t.includes("ipca")) cls += " alert";
  else if (t.includes("permut") || t.includes("fora") || t.includes("bloque")) cls += " blocked";

  return `<span class="${cls}">${label}</span>`;
}

function barRanking(rows) {
  if (!rows.length) {
    return `<div class="empty small">Sem dados suficientes para ranking.</div>`;
  }

  const maior = Math.max(...rows.map(r => r.valor), 1);
  const total = rows.reduce((a, b) => a + b.valor, 0) || 1;

  return rows.map(r => `
    <div class="rank-row">
      <div>
        <strong>${r.nome}</strong>
        <span>${r.qtd} venda(s) · ${moeda(r.valor)}</span>
      </div>
      <div class="bar"><i style="width:${percentual(r.valor, maior)}%"></i></div>
      <b>${percentual(r.valor, total)}%</b>
    </div>
  `).join("");
}

function fieldInput(id, label, type, value = "", disabled = false) {
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <input id="${id}" type="${type}" value="${value}" ${disabled ? "disabled" : ""}>
    </div>
  `;
}

/* MODAL / TOAST */

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

/* TABELAS FINANCEIRAS */

function calcPrice(valor, parcelas, taxa) {
  if (!valor || !parcelas) return 0;
  return valor * (taxa / (1 - Math.pow(1 + taxa, -parcelas)));
}

function calcSAC(valor, parcelas, taxa) {
  if (!valor || !parcelas) return null;

  const amortizacao = valor / parcelas;
  const primeira = amortizacao + valor * taxa;
  const ultima = amortizacao + amortizacao * taxa;

  return { amortizacao, primeira, ultima };
}

function tabelaPrice(valor, parcelas) {
  if (!valor || !parcelas) return `<div class="empty small">Sem saldo financiado.</div>`;

  const pmt = calcPrice(valor, parcelas, JUROS_MES);
  let saldo = valor;
  let rows = "";

  for (let i = 1; i <= Math.min(parcelas, 12); i++) {
    const juros = saldo * JUROS_MES;
    const amortizacao = pmt - juros;
    saldo -= amortizacao;

    rows += `
      <tr>
        <td>${i}</td>
        <td>${moeda(pmt)}</td>
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
          <th>#</th>
          <th>Parcela</th>
          <th>Amortização</th>
          <th>Juros</th>
          <th>Saldo</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function tabelaSAC(valor, parcelas) {
  if (!valor || !parcelas) return `<div class="empty small">Sem saldo financiado.</div>`;

  const amortizacao = valor / parcelas;
  let saldo = valor;
  let rows = "";

  for (let i = 1; i <= Math.min(parcelas, 12); i++) {
    const juros = saldo * JUROS_MES;
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
          <th>#</th>
          <th>Parcela</th>
          <th>Amortização</th>
          <th>Juros</th>
          <th>Saldo</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* API */

async function tryAppend(sheet, values) {
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "appendRow", sheet, values })
    });
  } catch (error) {
    console.warn("Registro mantido localmente. Falha ao gravar na planilha.", error);
  }
}

async function testarAPI() {
  try {
    const res = await fetch(`${API_URL}?action=getAll`);
    const json = await res.json();

    console.log(json);

    toast(json.ok ? "API respondendo." : "API respondeu com erro.", json.ok ? "ok" : "err");
  } catch (error) {
    console.error(error);
    toast("Falha ao testar API.", "err");
  }
}

/* HELPERS */

function pick(obj, keys) {
  if (!obj) return "";

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }

  const normalized = {};

  Object.keys(obj).forEach(k => {
    normalized[texto(k)] = obj[k];
  });

  for (const key of keys) {
    const value = normalized[texto(key)];
    if (value !== undefined && value !== null && value !== "") return value;
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

function soma(list, field) {
  return (list || []).reduce((total, item) => total + num(item?.[field]), 0);
}

function media(list, field) {
  if (!list || !list.length) return 0;
  return soma(list, field) / list.length;
}

function percentual(value, total) {
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

function mesmoTexto(a, b) {
  return texto(a) === texto(b);
}

function mesmoLote(lote, quadra, numero) {
  return texto(lote.quadra).includes(texto(quadra)) && String(lote.lote).trim() === String(numero).trim();
}

function limparNomeQuadra(value) {
  const t = texto(value);

  if (t.includes("araca")) return "Araçá";
  if (t.includes("baru") || t.includes("barú")) return "Baru";
  if (t.includes("araticum")) return "Araticum";
  if (t.includes("murici")) return "Murici";
  if (t.includes("pequi")) return "Pequi";
  if (t.includes("buriti")) return "Buriti";

  return value;
}

function isVendido(status) {
  const s = texto(status);
  return s.includes("vend") || s.includes("pago") || s.includes("contrato");
}

function agrupar(list, field) {
  const map = {};

  (list || []).forEach(item => {
    const nome = item[field] || "Não informado";
    if (!map[nome]) map[nome] = { nome, qtd: 0, valor: 0 };
    map[nome].qtd += 1;
    map[nome].valor += num(item.valorFinal);
  });

  return Object.values(map).sort((a, b) => b.valor - a.valor);
}

function calcularComissao(valor, corretorNome) {
  const corretor = S.corretores.find(c => mesmoTexto(c.nome, corretorNome));
  const categoria = texto(corretor?.categoria || "Prata");

  let pct = 0.045;

  if (categoria.includes("ouro")) pct = 0.05;
  if (categoria.includes("bronze")) pct = 0.04;

  return valor * pct;
}

function mergeLocal(key, remote) {
  const local = readJSON(key, []);
  const result = [...local];

  (remote || []).forEach(item => {
    if (!item.id || !result.some(x => x.id === item.id)) {
      result.push(item);
    }
  });

  return result;
}

function saveJSON(key, data) {
  localStorage.setItem(key, JSON.stringify(data || []));
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
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

function limparDadosLocais() {
  localStorage.removeItem("calliandra_vendas");
  localStorage.removeItem("calliandra_corretores");
  localStorage.removeItem("calliandra_acoes");
  localStorage.removeItem("calliandra_midia");
  localStorage.removeItem("calliandra_gastos");

  toast("Dados locais limpos. Recarregue a página.");
}

/* CSS DE REFORÇO */

function injectCSS() {
  const style = document.createElement("style");

  style.innerHTML = `
    :root {
      --verde:#173d37;
      --verde2:#0b2924;
      --marsala:#ac4a4a;
      --laranja:#e8924c;
      --marfim:#f5edde;
      --marfim2:#eee5d7;
      --texto:#1d2925;
      --muted:#75726d;
      --borda:rgba(23,61,55,.14);
      --sombra:0 18px 42px rgba(19,31,28,.10);
      --radius:22px;
    }

    body {
      background:var(--marfim);
      color:var(--texto);
      font-family:Montserrat, Arial, sans-serif;
    }

    .hidden { display:none!important; }

    #app {
      min-height:100vh;
      display:flex;
    }

    .sidebar {
      width:286px;
      position:fixed;
      inset:0 auto 0 0;
      background:var(--verde);
      padding:26px 22px;
      color:#fff;
      z-index:30;
    }

    .sidebar-logo {
      width:220px;
      max-width:100%;
      display:block;
      margin-bottom:18px;
    }

    .brand-fallback {
      display:none;
      font-family:serif;
      font-size:38px;
      margin-bottom:18px;
      color:#fff;
    }

    .sidebar-subtitle {
      text-transform:uppercase;
      letter-spacing:.26em;
      font-size:11px;
      color:rgba(255,255,255,.58);
      padding-bottom:24px;
      margin-bottom:20px;
      border-bottom:1px solid rgba(255,255,255,.14);
    }

    .menu {
      display:grid;
      gap:8px;
    }

    .menu-item {
      border:0;
      background:transparent;
      color:rgba(255,255,255,.72);
      padding:13px 14px;
      border-radius:14px;
      text-align:left;
      font-weight:800;
      cursor:pointer;
    }

    .menu-item:hover,
    .menu-item.active {
      background:rgba(255,255,255,.12);
      color:#fff;
    }

    .content {
      margin-left:286px;
      width:calc(100% - 286px);
      min-height:100vh;
    }

    .topbar {
      height:76px;
      background:rgba(255,255,255,.86);
      border-bottom:1px solid var(--borda);
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 32px;
      position:sticky;
      top:0;
      z-index:20;
      backdrop-filter:blur(10px);
    }

    .topbar h1 {
      color:var(--verde);
      font-size:24px;
      margin:0;
    }

    .topbar p {
      margin:4px 0 0;
      color:var(--muted);
      font-size:12px;
    }

    .userbox {
      display:flex;
      gap:14px;
      align-items:center;
      color:var(--muted);
      font-size:13px;
      font-weight:700;
    }

    .view {
      padding:32px;
    }

    .btn-primary,
    .btn-ghost,
    .btn-logout,
    .btn-small {
      border:1px solid var(--borda);
      background:#fff;
      color:var(--verde);
      border-radius:12px;
      padding:10px 14px;
      font-weight:900;
      cursor:pointer;
    }

    .btn-primary {
      background:var(--verde);
      color:#fff;
      border-color:var(--verde);
    }

    .btn-fit {
      width:auto;
      height:46px;
      padding:0 20px;
    }

    .btn-small {
      padding:7px 10px;
      font-size:12px;
    }

    .section-header {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:20px;
      margin-bottom:22px;
    }

    .section-header h2 {
      color:var(--verde);
      font-size:28px;
      margin:0 0 6px;
    }

    .section-header p {
      color:var(--muted);
      margin:0;
      font-size:13px;
      line-height:1.5;
    }

    .actions-row {
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }

    .search-input,
    .field input,
    .field select,
    .field textarea {
      height:46px;
      border:1px solid var(--borda);
      border-radius:14px;
      background:#fff;
      padding:0 14px;
      outline:none;
      min-width:180px;
      font-size:14px;
    }

    .field textarea {
      height:96px;
      padding:12px 14px;
    }

    .field {
      display:grid;
      gap:7px;
      margin-bottom:14px;
    }

    .field label {
      font-size:11px;
      font-weight:900;
      text-transform:uppercase;
      letter-spacing:.1em;
      color:var(--verde);
    }

    .executive-alert {
      background:#fff;
      border:1px solid var(--borda);
      border-left:6px solid var(--verde);
      box-shadow:var(--sombra);
      border-radius:18px;
      padding:18px 20px;
      margin-bottom:20px;
      display:grid;
      gap:6px;
    }

    .executive-alert strong {
      color:var(--verde);
      font-size:15px;
    }

    .executive-alert span {
      color:var(--muted);
      font-size:13px;
      line-height:1.5;
    }

    .kpi-grid {
      display:grid;
      grid-template-columns:repeat(4,minmax(170px,1fr));
      gap:18px;
      margin-bottom:20px;
    }

    .mini-grid {
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:14px;
      margin-bottom:20px;
    }

    .kpi-card,
    .mini-card,
    .card,
    .table-card,
    .phase-card {
      background:#fff;
      border:1px solid var(--borda);
      border-radius:var(--radius);
      box-shadow:var(--sombra);
    }

    .kpi-card {
      padding:22px;
    }

    .kpi-card span,
    .mini-card span {
      display:block;
      text-transform:uppercase;
      letter-spacing:.12em;
      color:var(--muted);
      font-size:11px;
      font-weight:900;
      margin-bottom:11px;
    }

    .kpi-card strong {
      display:block;
      color:var(--verde);
      font-size:26px;
      line-height:1.1;
    }

    .kpi-card small {
      display:block;
      color:var(--muted);
      margin-top:8px;
      font-size:12px;
      line-height:1.35;
    }

    .mini-card {
      padding:16px 18px;
    }

    .mini-card strong {
      color:var(--verde);
      font-size:22px;
    }

    .progress {
      margin-top:14px;
      height:8px;
      border-radius:999px;
      background:var(--marfim2);
      overflow:hidden;
    }

    .progress i {
      display:block;
      height:100%;
      background:var(--marsala);
      border-radius:999px;
    }

    .grid-2 {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:22px;
      margin-bottom:22px;
    }

    .grid-3 {
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:22px;
      margin-bottom:22px;
    }

    .card {
      padding:22px;
    }

    .card-head,
    .table-card-head {
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:center;
      margin-bottom:16px;
    }

    .card-head h3,
    .table-card-head h3 {
      margin:0;
      color:var(--verde);
      font-size:17px;
    }

    .table-card-head {
      padding:18px 20px;
      margin:0;
      border-bottom:1px solid var(--borda);
    }

    .table-card-head span {
      color:var(--muted);
      font-size:13px;
      font-weight:800;
    }

    .progress-line,
    .rank-row {
      display:grid;
      grid-template-columns:170px 1fr 58px;
      gap:14px;
      align-items:center;
      padding:12px 0;
      border-bottom:1px solid var(--borda);
    }

    .progress-line:last-child,
    .rank-row:last-child {
      border-bottom:0;
    }

    .progress-line strong,
    .rank-row strong {
      display:block;
      color:var(--verde);
      font-size:13px;
    }

    .progress-line span,
    .rank-row span {
      color:var(--muted);
      font-size:12px;
    }

    .bar {
      height:10px;
      background:var(--marfim2);
      border-radius:999px;
      overflow:hidden;
    }

    .bar i {
      display:block;
      height:100%;
      background:var(--verde);
      border-radius:999px;
    }

    .insight-box {
      background:#fbf7ef;
      border:1px solid var(--borda);
      border-radius:16px;
      padding:15px;
      margin-top:18px;
    }

    .insight-box strong {
      display:block;
      color:var(--verde);
      margin-bottom:6px;
    }

    .insight-box p {
      margin:0;
      color:var(--muted);
      font-size:13px;
      line-height:1.5;
    }

    .insight-box.danger {
      background:#fff1ed;
      border-color:rgba(172,74,74,.26);
    }

    .donut-row {
      display:flex;
      gap:24px;
      align-items:center;
    }

    .donut {
      width:178px;
      height:178px;
      border-radius:50%;
      position:relative;
      flex:0 0 auto;
    }

    .donut::after {
      content:"";
      position:absolute;
      inset:46px;
      background:#fff;
      border-radius:50%;
    }

    .legend-list {
      display:grid;
      gap:10px;
      flex:1;
    }

    .legend-list.big {
      gap:14px;
    }

    .legend-item {
      display:grid;
      grid-template-columns:14px 1fr auto;
      gap:10px;
      align-items:center;
      font-size:13px;
      color:var(--texto);
    }

    .legend-item i {
      width:14px;
      height:14px;
      border-radius:50%;
      border:1px solid var(--borda);
    }

    .legend-item strong {
      color:var(--verde);
    }

    .table-card {
      overflow:auto;
      margin-bottom:22px;
    }

    .table-card.compact {
      box-shadow:none;
      margin-bottom:0;
    }

    table {
      width:100%;
      border-collapse:collapse;
      min-width:880px;
      font-size:13px;
    }

    th {
      background:var(--verde);
      color:#fff;
      text-align:left;
      padding:14px 16px;
      text-transform:uppercase;
      letter-spacing:.08em;
      font-size:11px;
      white-space:nowrap;
    }

    td {
      padding:14px 16px;
      border-bottom:1px solid var(--borda);
      white-space:nowrap;
      vertical-align:middle;
    }

    tbody tr:hover {
      background:#fbf7ef;
    }

    .tag {
      display:inline-flex;
      border-radius:999px;
      padding:5px 10px;
      font-size:11px;
      font-weight:900;
      background:var(--marfim2);
      color:var(--verde);
    }

    .tag.sold {
      background:rgba(172,74,74,.13);
      color:var(--marsala);
    }

    .tag.available {
      background:rgba(23,61,55,.12);
      color:var(--verde);
    }

    .tag.reserved,
    .tag.alert {
      background:#fff2d5;
      color:#8d6517;
    }

    .tag.blocked {
      background:#eee;
      color:#666;
    }

    .sim-grid {
      display:grid;
      grid-template-columns:390px 1fr;
      gap:22px;
      align-items:start;
    }

    .result-grid {
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:12px;
    }

    .result-item {
      background:#fbf7ef;
      border:1px solid var(--borda);
      border-radius:16px;
      padding:14px;
      display:grid;
      gap:6px;
    }

    .result-item span {
      color:var(--muted);
      font-size:11px;
      text-transform:uppercase;
      letter-spacing:.08em;
      font-weight:900;
    }

    .result-item strong {
      color:var(--verde);
      font-size:15px;
    }

    .notice {
      margin-top:16px;
      padding:14px;
      border-radius:16px;
      background:#fff8ed;
      border:1px solid rgba(232,146,76,.38);
      color:#76551f;
      font-size:13px;
      line-height:1.5;
    }

    .notice.warn {
      border-color:rgba(172,74,74,.35);
      background:#fff1ed;
      color:#7e3131;
    }

    .phase-card {
      margin-bottom:16px;
      overflow:hidden;
    }

    .phase-head {
      padding:18px 20px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      cursor:pointer;
    }

    .phase-head h3 {
      margin:0;
      color:var(--verde);
    }

    .phase-head p {
      margin:4px 0 0;
      color:var(--muted);
      font-size:13px;
    }

    .phase-body {
      display:none;
      padding:18px;
      border-top:1px solid var(--borda);
    }

    .phase-card.open .phase-body {
      display:block;
    }

    .map-grid {
      display:grid;
      grid-template-columns:1.4fr .6fr;
      gap:22px;
      align-items:start;
    }

    .map-box {
      background:#fff;
      border:1px solid var(--borda);
      border-radius:var(--radius);
      box-shadow:var(--sombra);
      overflow:hidden;
    }

    .map-box img {
      width:100%;
      display:block;
    }

    .map-placeholder {
      min-height:420px;
      display:grid;
      place-items:center;
      padding:32px;
      text-align:center;
    }

    .recommendations {
      display:grid;
      grid-template-columns:repeat(2,1fr);
      gap:14px;
    }

    .recommendations div {
      background:#fbf7ef;
      border:1px solid var(--borda);
      border-radius:16px;
      padding:16px;
    }

    .recommendations strong {
      color:var(--verde);
      display:block;
      margin-bottom:6px;
    }

    .recommendations p {
      color:var(--muted);
      margin:0;
      font-size:13px;
      line-height:1.5;
    }

    .empty {
      padding:24px!important;
      color:var(--muted);
      text-align:center;
    }

    .empty.small {
      padding:14px!important;
      font-size:13px;
    }

    .modal-overlay {
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.45);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:24px;
      z-index:100;
    }

    .modal {
      width:min(960px,100%);
      background:#fff;
      border-radius:24px;
      overflow:auto;
      max-height:92vh;
      box-shadow:0 28px 90px rgba(0,0,0,.25);
    }

    .modal-head {
      background:var(--verde);
      color:#fff;
      padding:20px 24px;
      display:flex;
      justify-content:space-between;
      align-items:center;
    }

    .modal-head h3 {
      margin:0;
    }

    .modal-head button {
      border:0;
      background:transparent;
      color:#fff;
      font-size:30px;
      cursor:pointer;
    }

    .modal-body {
      padding:24px;
    }

    .modal-actions {
      border-top:1px solid var(--borda);
      padding:18px 24px;
      display:flex;
      justify-content:flex-end;
      gap:10px;
    }

    .form-grid {
      display:grid;
      grid-template-columns:repeat(2,1fr);
      gap:16px;
    }

    #toastRoot {
      position:fixed;
      right:18px;
      bottom:18px;
      z-index:200;
      display:grid;
      gap:8px;
    }

    .toast {
      background:var(--verde);
      color:#fff;
      padding:12px 16px;
      border-radius:13px;
      box-shadow:var(--sombra);
      font-weight:800;
      font-size:13px;
    }

    .toast.err {
      background:var(--marsala);
    }

    @media (max-width:1180px) {
      .kpi-grid,
      .mini-grid,
      .grid-3 {
        grid-template-columns:repeat(2,1fr);
      }

      .grid-2,
      .sim-grid,
      .map-grid {
        grid-template-columns:1fr;
      }
    }

    @media (max-width:860px) {
      #app {
        display:block;
      }

      .sidebar {
        position:relative;
        width:100%;
      }

      .content {
        margin-left:0;
        width:100%;
      }

      .topbar {
        height:auto;
        padding:18px;
        align-items:flex-start;
        flex-direction:column;
        gap:12px;
      }

      .view {
        padding:20px;
      }

      .kpi-grid,
      .mini-grid,
      .grid-3,
      .form-grid,
      .result-grid,
      .recommendations {
        grid-template-columns:1fr;
      }

      .section-header {
        flex-direction:column;
      }
    }
  `;

  document.head.appendChild(style);
}
