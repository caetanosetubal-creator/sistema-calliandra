const API_URL = "/api/sheets";

const META_VALOR_JUNHO = 4000000;
const META_LOTES_JUNHO = 23;
const TAXA_ANUAL = 0.12;
const TAXA_MENSAL = Math.pow(1 + TAXA_ANUAL, 1 / 12) - 1;

let CURRENT_USER = null;

let S = {
  raw: {},
  lotes: [],
  contratos: [],
  corretores: [],
  midia: [],
  gastos: [],
  acoes: []
};

const VENDIDOS_PERIODO_FIXO = [
  { quadra: "Araçá", lote: "19" },
  { quadra: "Baru", lote: "27" }
];

document.addEventListener("DOMContentLoaded", () => {
  injectRuntimeCSS();

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", fazerLogin);

  const stored = getStoredUser();
  if (stored) {
    CURRENT_USER = stored;
    entrarNoSistema();
  }
});

async function fazerLogin(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value.trim();
  const msg = document.getElementById("loginMessage");

  msg.innerText = "Entrando no sistema...";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, senha })
    });

    const data = await response.json();
    const ok = data.ok || data.success || data.raw?.ok || data.raw?.success;

    if (!ok) {
      msg.innerText = data.message || data.error || data.raw?.message || data.raw?.error || "Login não autorizado.";
      return;
    }

    CURRENT_USER =
      data.usuario ||
      data.user ||
      data.raw?.usuario ||
      data.raw?.user ||
      { nome: "Administrador", email, perfil: "gestor" };

    localStorage.setItem("calliandra_user", JSON.stringify(CURRENT_USER));
    entrarNoSistema();

  } catch (error) {
    console.error(error);
    msg.innerText = "Erro ao conectar com a API.";
  }
}

async function entrarNoSistema() {
  document.getElementById("loginScreen")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");

  renderShell();
  await carregarDados();
  aplicarVendasFixasDoPeriodo();
  go("dashboard");
}

async function carregarDados() {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getAll" })
    });

    const result = await response.json();

    S.raw = result;
    window.CALLIANDRA_RAW = result;

    const base =
      result.data ||
      result.raw?.data ||
      result.raw ||
      result ||
      {};

    S.lotes = extractSheet(base, ["lotes", "Lotes", "LOTES"]).map(normalizarLote);
    S.contratos = mergeLocal("calliandra_contratos", extractSheet(base, ["vendas", "contratos", "Vendas", "Contratos"]).map(normalizarContrato));
    S.corretores = mergeLocal("calliandra_corretores", extractSheet(base, ["corretores", "parceiros", "Corretores", "Parceiros"]).map(normalizarCorretor));
    S.midia = mergeLocal("calliandra_midia", extractSheet(base, ["midia", "plano_midia", "Plano de Mídia", "midia"]).map(normalizarMidia));
    S.gastos = mergeLocal("calliandra_gastos", extractSheet(base, ["gastos", "orcamento", "orçamento", "Orçamento", "Gastos"]).map(normalizarGasto));
    S.acoes = mergeLocal("calliandra_acoes", extractSheet(base, ["acoes", "ações", "cronograma", "Cronograma"]).map(normalizarAcao));

    if (!S.corretores.length) {
      S.corretores = [
        { id: uid(), nome: "Humanize", categoria: "Prata", vendas: 0, comissao: "5%" },
        { id: uid(), nome: "GM", categoria: "Prata", vendas: 0, comissao: "5%" },
        { id: uid(), nome: "Beiramar", categoria: "Ouro", vendas: 0, comissao: "6%" },
        { id: uid(), nome: "MJ", categoria: "Prata", vendas: 0, comissao: "5%" },
        { id: uid(), nome: "Enzo", categoria: "Prata", vendas: 0, comissao: "5%" },
        { id: uid(), nome: "HouseUP", categoria: "Prata", vendas: 0, comissao: "5%" },
        { id: uid(), nome: "Torres Imob", categoria: "Prata", vendas: 0, comissao: "5%" }
      ];
    }

  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    toast("Não foi possível carregar a planilha. Usando dados locais.", "err");
  }
}

function renderShell() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-top">
        <img src="logo-calliandra-white.png" class="sidebar-logo" onerror="this.style.display='none';document.querySelector('.fallback-logo').style.display='block'">
        <div class="fallback-logo">CALLIANDRA</div>
        <div class="sidebar-subtitle">Sistema Comercial</div>
      </div>

      <nav class="menu">
        ${menuBtn("dashboard", "📊", "Dashboard")}
        ${menuBtn("cronograma", "📅", "Cronograma")}
        ${menuBtn("lotes", "🏡", "Lotes")}
        ${menuBtn("simulador", "🧮", "Simulador")}
        ${menuBtn("contratos", "📋", "Contratos")}
        ${menuBtn("corretores", "🤝", "Corretores")}
        ${menuBtn("midia", "📡", "Plano de mídia")}
        ${menuBtn("orcamento", "💰", "Orçamento")}
        ${menuBtn("relatorios", "📈", "Relatórios")}
        ${menuBtn("mapa", "🗺️", "Mapa comercial")}
        ${menuBtn("configuracoes", "⚙️", "Configurações")}
      </nav>
    </aside>

    <main class="content">
      <header class="topbar">
        <h2 id="pageTitle">Dashboard</h2>
        <div class="user-box">
          <span>${CURRENT_USER?.nome || CURRENT_USER?.email || "Usuário"}</span>
          <button onclick="logout()" class="btn-logout">Sair</button>
        </div>
      </header>

      <section id="view" class="page active-page"></section>
    </main>

    <div id="modalRoot"></div>
    <div id="toastRoot"></div>
  `;
}

function menuBtn(page, icon, label) {
  return `
    <button class="menu-item" data-page="${page}" onclick="go('${page}')">
      <span>${icon}</span>
      ${label}
    </button>
  `;
}

function go(page) {
  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  const titles = {
    dashboard: "Dashboard",
    cronograma: "Cronograma comercial",
    lotes: "Lotes",
    simulador: "Simulador comercial",
    contratos: "Contratos, reservas e propostas",
    corretores: "Corretores e parceiros",
    midia: "Plano de mídia",
    orcamento: "Orçamento x realizado",
    relatorios: "Relatórios",
    mapa: "Mapa comercial",
    configuracoes: "Configurações"
  };

  document.getElementById("pageTitle").innerText = titles[page] || "Calliandra";

  const render = {
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

  render[page]?.();
}

function renderDashboard() {
  const lotes = S.lotes;
  const contratos = S.contratos;

  const total = lotes.length || 84;
  const vendidos = lotes.filter(l => l.statusSistema === "Vendido").length;
  const reservados = lotes.filter(l => l.statusSistema === "Reservado").length;
  const bloqueados = lotes.filter(l => l.statusSistema === "Bloqueado").length;
  const vendaveis = lotes.filter(l => l.vendavel).length || 33;
  const disponiveis = lotes.filter(l => l.statusSistema === "Disponível" && l.vendavel).length || Math.max(vendaveis - vendidos - reservados, 0);

  const vgvTotal = soma(lotes, "valor") || 28995355.26;
  const vgvVendido = soma(contratos.filter(c => isVendido(c.status)), "valorFinal") || valorVendidoPorLotes();
  const vgvDisponivel = soma(lotes.filter(l => l.statusSistema === "Disponível" && l.vendavel), "valor");
  const comissao = soma(contratos, "comissaoValor");
  const ticket = vendidos ? vgvVendido / vendidos : 0;

  const pctValor = pct(vgvVendido, META_VALOR_JUNHO);
  const pctLotes = pct(vendidos, META_LOTES_JUNHO);

  document.getElementById("view").innerHTML = `
    <div class="kpi-row">
      ${kpi("Meta junho", moeda(META_VALOR_JUNHO), `${pctValor}% realizado`, pctValor)}
      ${kpi("Meta lotes", `${vendidos}/${META_LOTES_JUNHO}`, `${pctLotes}% da meta`, pctLotes)}
      ${kpi("VGV vendido", moeda(vgvVendido), "Contratos e vendas do período", pctValor)}
      ${kpi("VGV disponível", moeda(vgvDisponivel || vgvTotal - vgvVendido), "Potencial vendável")}
    </div>

    <div class="cards-grid">
      ${metric("Lotes totais", total)}
      ${metric("Vendidos", vendidos)}
      ${metric("Reservados", reservados)}
      ${metric("Vendáveis", vendaveis)}
      ${metric("Disponíveis reais", disponiveis)}
      ${metric("Bloqueados", bloqueados)}
      ${metric("Comissão total", moeda(comissao))}
      ${metric("Ticket médio", moeda(ticket))}
    </div>

    <div class="dashboard-grid">
      <div class="chart-card">
        <div class="card-title">Metas comerciais até 30 de junho</div>
        <div class="metas-box">
          ${metaCard("VGV", moeda(vgvVendido), moeda(META_VALOR_JUNHO), pctValor)}
          ${metaCard("Unidades", `${vendidos} lotes`, `${META_LOTES_JUNHO} lotes`, pctLotes)}
          ${metaCard("Falta vender", moeda(Math.max(META_VALOR_JUNHO - vgvVendido, 0)), `${Math.max(META_LOTES_JUNHO - vendidos, 0)} lotes restantes`, 100 - pctLotes)}
        </div>
      </div>

      <div class="chart-card">
        <div class="card-title">Pipeline comercial</div>
        ${pipelineRow("Vendidos", vendidos, total)}
        ${pipelineRow("Reservados", reservados, total)}
        ${pipelineRow("Disponíveis", disponiveis, total)}
        ${pipelineRow("Bloqueados", bloqueados, total)}
      </div>
    </div>

    <div class="table-wrapper mt">
      <div class="table-title">Últimas operações comerciais</div>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Cliente</th>
            <th>Lote</th>
            <th>Valor negociado</th>
            <th>Status</th>
            <th>Corretor</th>
          </tr>
        </thead>
        <tbody>
          ${contratos.slice(0, 12).map(c => `
            <tr>
              <td>${c.data || "-"}</td>
              <td>${c.cliente || "-"}</td>
              <td>${c.quadra} ${c.lote}</td>
              <td>${moeda(c.valorFinal)}</td>
              <td>${badge(c.status)}</td>
              <td>${c.corretor || "-"}</td>
            </tr>
          `).join("") || emptyRow(6, "Nenhuma operação cadastrada")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCronograma() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <h3>Cronograma comercial</h3>
      <button class="btn-primary fit" onclick="abrirModalAcao()">Nova ação</button>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Etapa</th>
            <th>Ação</th>
            <th>Responsável</th>
            <th>Data</th>
            <th>Status</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
          ${getAcoes().map(a => `
            <tr>
              <td>${a.etapa}</td>
              <td>${a.acao}</td>
              <td>${a.responsavel}</td>
              <td>${a.data}</td>
              <td>${badge(a.status)}</td>
              <td>${a.obs || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLotes() {
  const lotes = S.lotes;

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <h3>Gestão de lotes</h3>
      <div class="actions-row">
        <input class="search-input" id="buscaLotes" placeholder="Buscar por quadra, lote, status..." oninput="filtrarLotes()">
        <button class="btn-primary fit" onclick="renderSimulador()">Ir para simulador</button>
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Quadra</th>
            <th>Lote</th>
            <th>Área</th>
            <th>Preço m²</th>
            <th>Valor tabela</th>
            <th>Status</th>
            <th>Anotação</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="tbodyLotes">
          ${renderRowsLotes(lotes)}
        </tbody>
      </table>
    </div>
  `;
}

function renderRowsLotes(lotes) {
  if (!lotes.length) return emptyRow(9, "A aba lotes não foi recebida pela API. Verifique o retorno em window.CALLIANDRA_RAW.");

  return lotes.map(l => `
    <tr data-search="${searchText([l.id, l.quadra, l.lote, l.statusSistema, l.anotacao])}">
      <td>${l.id}</td>
      <td>${l.quadra}</td>
      <td>${l.lote}</td>
      <td>${formatArea(l.area)}</td>
      <td>${moeda(l.precoM2)}</td>
      <td>${moeda(l.valor)}</td>
      <td>${badge(l.statusSistema)}</td>
      <td>${l.anotacao || "-"}</td>
      <td>
        <button class="btn-small" onclick="abrirSimuladorComLote('${l.id}')">Simular</button>
      </td>
    </tr>
  `).join("");
}

function filtrarLotes() {
  const q = texto(document.getElementById("buscaLotes").value);
  document.querySelectorAll("#tbodyLotes tr").forEach(tr => {
    tr.style.display = tr.dataset.search.includes(q) ? "" : "none";
  });
}

function renderSimulador(loteId = "") {
  goWithoutLoop("simulador");

  const lotes = S.lotes.filter(l => l.vendavel);

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h3>Simulador comercial</h3>
        <p class="muted">Selecione o lote. O sistema puxa área, preço m², valor de tabela e aplica as regras comerciais do Calliandra.</p>
      </div>
      <button class="btn-ghost" onclick="window.print()">Imprimir simulação</button>
    </div>

    <div class="simulador-grid">
      <div class="sim-card">
        <div class="field">
          <label>Lote</label>
          <select id="simLote" onchange="atualizarSimulador()">
            ${lotes.map(l => `
              <option value="${l.id}" ${l.id === loteId ? "selected" : ""}>
                ${l.quadra} ${l.lote} · ${formatArea(l.area)} · ${moeda(l.valor)}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="field">
          <label>Entrada para financiamento (%)</label>
          <input type="number" id="simEntrada" value="30" min="0" max="100" oninput="atualizarSimulador()">
        </div>

        <div class="field">
          <label>Parcelas</label>
          <input type="number" id="simParcelas" value="36" min="1" max="180" oninput="atualizarSimulador()">
        </div>

        <div class="notice">
          Até 36 parcelas: juros de 12% ao ano, sem correção monetária. Acima de 36 parcelas: juros de 12% ao ano + IPCA. O IPCA não é projetado.
        </div>
      </div>

      <div class="resultado-card">
        <h3>Condições simuladas</h3>
        <div id="resultadoSimulacao"></div>
      </div>
    </div>
  `;

  atualizarSimulador();
}

function abrirSimuladorComLote(id) {
  renderSimulador(id);
}

function atualizarSimulador() {
  const id = document.getElementById("simLote")?.value;
  const lote = S.lotes.find(l => l.id === id) || S.lotes[0];
  if (!lote) return;

  const entradaPct = num(document.getElementById("simEntrada")?.value || 30);
  const parcelas = num(document.getElementById("simParcelas")?.value || 36);

  const avista = simularCondicao(lote.valor, { tipo: "À vista", descontoPct: 5, entradaPct: 100, parcelas: 0 });
  const entrada50 = simularCondicao(lote.valor, { tipo: "Entrada 50%", descontoPct: 2.5, entradaPct: 50, parcelas: 6 });
  const financiamento = simularCondicao(lote.valor, { tipo: `${parcelas} parcelas`, descontoPct: 0, entradaPct, parcelas });

  document.getElementById("resultadoSimulacao").innerHTML = `
    <div class="sim-cab">
      <div>
        <span>Lote selecionado</span>
        <strong>${lote.quadra} ${lote.lote}</strong>
      </div>
      <div>
        <span>Área</span>
        <strong>${formatArea(lote.area)}</strong>
      </div>
      <div>
        <span>Valor tabela</span>
        <strong>${moeda(lote.valor)}</strong>
      </div>
    </div>

    <div class="condicoes-grid">
      ${condicaoCard(avista)}
      ${condicaoCard(entrada50)}
      ${condicaoCard(financiamento)}
    </div>

    <div class="table-wrapper mt">
      <div class="table-title">Tabela Price · ${financiamento.tipo}</div>
      ${tabelaParcelasPrice(financiamento.saldo, financiamento.parcelas)}
    </div>

    <div class="table-wrapper mt">
      <div class="table-title">Tabela SAC · ${financiamento.tipo}</div>
      ${tabelaParcelasSAC(financiamento.saldo, financiamento.parcelas)}
    </div>
  `;
}

function simularCondicao(valorTabela, regra) {
  const desconto = valorTabela * ((regra.descontoPct || 0) / 100);
  const valorFinal = valorTabela - desconto;
  const entrada = valorFinal * ((regra.entradaPct || 0) / 100);
  const saldo = Math.max(valorFinal - entrada, 0);
  const parcela = regra.parcelas > 0 ? parcelaPrice(saldo, regra.parcelas, TAXA_MENSAL) : 0;
  const ipca = regra.parcelas > 36;

  return {
    ...regra,
    valorTabela,
    desconto,
    valorFinal,
    entrada,
    saldo,
    parcela,
    ipca
  };
}

function condicaoCard(c) {
  return `
    <div class="condicao-card ${c.ipca ? "alerta" : ""}">
      <div class="cond-title">${c.tipo}</div>
      <div class="result-line"><span>Valor tabela</span><strong>${moeda(c.valorTabela)}</strong></div>
      <div class="result-line"><span>Desconto</span><strong>${moeda(c.desconto)}</strong></div>
      <div class="result-line"><span>Valor final</span><strong>${moeda(c.valorFinal)}</strong></div>
      <div class="result-line"><span>Entrada</span><strong>${moeda(c.entrada)}</strong></div>
      <div class="result-line"><span>Saldo</span><strong>${moeda(c.saldo)}</strong></div>
      <div class="result-line"><span>Parcela</span><strong>${c.parcelas ? moeda(c.parcela) : "Não se aplica"}</strong></div>
      <div class="notice small">
        ${c.ipca ? "Incide IPCA além dos juros de 12% ao ano. IPCA não projetado." : "Sem correção monetária nas condições até 36 parcelas."}
      </div>
    </div>
  `;
}

function renderContratos() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h3>Contratos, reservas e propostas</h3>
        <p class="muted">Controle comercial do pipeline do Calliandra.</p>
      </div>
      <button class="btn-primary fit" onclick="abrirModalContrato()">Novo contrato</button>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Cliente</th>
            <th>Lote</th>
            <th>Área</th>
            <th>Valor tabela</th>
            <th>Valor negociado</th>
            <th>Desconto</th>
            <th>Status</th>
            <th>Corretor</th>
          </tr>
        </thead>
        <tbody>
          ${S.contratos.map(c => `
            <tr>
              <td>${c.data || "-"}</td>
              <td>${c.cliente || "-"}</td>
              <td>${c.quadra} ${c.lote}</td>
              <td>${formatArea(c.area)}</td>
              <td>${moeda(c.valorTabela)}</td>
              <td>${moeda(c.valorFinal)}</td>
              <td>${moeda(c.desconto)}</td>
              <td>${badge(c.status)}</td>
              <td>${c.corretor || "-"}</td>
            </tr>
          `).join("") || emptyRow(9, "Nenhum contrato, reserva ou proposta cadastrada.")}
        </tbody>
      </table>
    </div>
  `;
}

function abrirModalContrato() {
  const lotes = S.lotes.filter(l => l.vendavel);
  const hoje = new Date().toISOString().slice(0, 10);

  openModal(`
    <div class="modal-card">
      <div class="modal-head">
        <h3>Novo contrato / reserva / proposta</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          ${input("ctData", "Data", "date", hoje)}
          ${input("ctCliente", "Cliente", "text", "")}

          <div class="field">
            <label>Lote</label>
            <select id="ctLote" onchange="preencherContratoPorLote()">
              ${lotes.map(l => `<option value="${l.id}">${l.quadra} ${l.lote}</option>`).join("")}
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
              <option>36 parcelas</option>
              <option>Acima de 36 parcelas</option>
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

        <div class="field">
          <label>Observações</label>
          <textarea id="ctObs" class="textarea"></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary fit" onclick="salvarContrato()">Salvar</button>
      </div>
    </div>
  `);

  preencherContratoPorLote();
}

function preencherContratoPorLote() {
  const id = document.getElementById("ctLote").value;
  const lote = S.lotes.find(l => l.id === id);
  if (!lote) return;

  document.getElementById("ctArea").value = formatArea(lote.area);
  document.getElementById("ctValorTabela").value = moeda(lote.valor);
  document.getElementById("ctValorFinal").value = lote.valor.toFixed(2);
}

async function salvarContrato() {
  const idLote = document.getElementById("ctLote").value;
  const lote = S.lotes.find(l => l.id === idLote);

  const valorTabela = lote?.valor || 0;
  const valorFinal = num(document.getElementById("ctValorFinal").value);
  const desconto = num(document.getElementById("ctDesconto").value) || Math.max(valorTabela - valorFinal, 0);

  const contrato = {
    id: uid(),
    data: document.getElementById("ctData").value,
    cliente: document.getElementById("ctCliente").value,
    idLote,
    quadra: lote?.quadra || "",
    lote: lote?.lote || "",
    area: lote?.area || 0,
    valorTabela,
    desconto,
    valorFinal,
    pagamento: document.getElementById("ctPagamento").value,
    entrada: num(document.getElementById("ctEntrada").value),
    parcelas: num(document.getElementById("ctParcelas").value),
    status: document.getElementById("ctStatus").value,
    corretor: document.getElementById("ctCorretor").value,
    origem: document.getElementById("ctOrigem").value,
    obs: document.getElementById("ctObs").value,
    comissaoValor: calcularComissao(valorFinal, document.getElementById("ctCorretor").value)
  };

  S.contratos.unshift(contrato);
  saveLocal("calliandra_contratos", S.contratos);

  await tryAppend("vendas", contrato);

  aplicarStatusContratoNosLotes();
  closeModal();
  toast("Contrato cadastrado.");
  renderContratos();
}

function renderCorretores() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <h3>Corretores e parceiros</h3>
      <button class="btn-primary fit" onclick="abrirModalCorretor()">Novo corretor</button>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Imobiliária / corretor</th>
            <th>Categoria</th>
            <th>Vendas</th>
            <th>Comissão</th>
            <th>VGV vendido</th>
          </tr>
        </thead>
        <tbody>
          ${S.corretores.map(c => {
            const vendas = S.contratos.filter(v => texto(v.corretor) === texto(c.nome) && isVendido(v.status));
            return `
              <tr>
                <td>${c.nome}</td>
                <td>${badge(c.categoria)}</td>
                <td>${vendas.length}</td>
                <td>${c.comissao}</td>
                <td>${moeda(soma(vendas, "valorFinal"))}</td>
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
    <div class="modal-card">
      <div class="modal-head">
        <h3>Novo corretor / imobiliária</h3>
        <button onclick="closeModal()">×</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          ${input("crNome", "Nome", "text", "")}

          <div class="field">
            <label>Categoria</label>
            <select id="crCategoria">
              <option>Bronze</option>
              <option selected>Prata</option>
              <option>Ouro</option>
            </select>
          </div>

          ${input("crComissao", "Comissão", "text", "5%")}
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary fit" onclick="salvarCorretor()">Salvar</button>
      </div>
    </div>
  `);
}

async function salvarCorretor() {
  const corretor = {
    id: uid(),
    nome: document.getElementById("crNome").value,
    categoria: document.getElementById("crCategoria").value,
    comissao: document.getElementById("crComissao").value,
    vendas: 0
  };

  if (!corretor.nome) return toast("Informe o nome do corretor.", "err");

  S.corretores.push(corretor);
  saveLocal("calliandra_corretores", S.corretores);
  await tryAppend("corretores", corretor);

  closeModal();
  toast("Corretor cadastrado.");
  renderCorretores();
}

function renderMidia() {
  const itens = getMidia();

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <h3>Plano de mídia</h3>
      <button class="btn-primary fit" onclick="abrirModalMidia()">Nova ação de mídia</button>
    </div>

    <div class="cards-grid">
      ${metric("Verba prevista", moeda(soma(itens, "previsto")))}
      ${metric("Verba executada", moeda(soma(itens, "realizado")))}
      ${metric("Leads", soma(itens, "leads"))}
      ${metric("CPL médio", moeda(soma(itens, "realizado") / Math.max(soma(itens, "leads"), 1)))}
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
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map(m => `
            <tr>
              <td>${m.campanha}</td>
              <td>${m.canal}</td>
              <td>${m.objetivo}</td>
              <td>${m.periodo}</td>
              <td>${moeda(m.previsto)}</td>
              <td>${moeda(m.realizado)}</td>
              <td>${m.leads}</td>
              <td>${badge(m.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderOrcamento() {
  const gastos = getGastos();

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <h3>Orçamento x realizado</h3>
      <button class="btn-primary fit" onclick="abrirModalGasto()">Novo item</button>
    </div>

    <div class="cards-grid">
      ${metric("Orçamento previsto", moeda(soma(gastos, "previsto")))}
      ${metric("Realizado", moeda(soma(gastos, "realizado")))}
      ${metric("Saldo", moeda(soma(gastos, "previsto") - soma(gastos, "realizado")))}
      ${metric("% executado", `${pct(soma(gastos, "realizado"), soma(gastos, "previsto"))}%`)}
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Microação</th>
            <th>Previsto</th>
            <th>Realizado</th>
            <th>Saldo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${gastos.map(g => `
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
  const vendidos = S.contratos.filter(c => isVendido(c.status));

  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <h3>Relatórios executivos</h3>
      <button class="btn-ghost" onclick="window.print()">Imprimir relatório</button>
    </div>

    <div class="dashboard-grid">
      <div class="chart-card">
        <div class="card-title">Vendas por corretor</div>
        ${ranking(vendidos, "corretor")}
      </div>

      <div class="chart-card">
        <div class="card-title">Vendas por origem</div>
        ${ranking(vendidos, "origem")}
      </div>

      <div class="chart-card">
        <div class="card-title">Vendas por quadra</div>
        ${ranking(vendidos, "quadra")}
      </div>

      <div class="chart-card">
        <div class="card-title">Resumo financeiro</div>
        ${pipelineRow("Meta financeira", soma(vendidos, "valorFinal"), META_VALOR_JUNHO, true)}
        ${pipelineRow("Meta de lotes", vendidos.length, META_LOTES_JUNHO)}
        ${pipelineRow("Comissões", soma(vendidos, "comissaoValor"), soma(vendidos, "valorFinal"), true)}
      </div>
    </div>
  `;
}

function renderMapa() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <div>
        <h3>Mapa comercial</h3>
        <p class="muted">Área preparada para receber o mapa do empreendimento com lotes vendidos, reservados, disponíveis e bloqueados.</p>
      </div>
    </div>

    <div class="map-placeholder">
      <strong>Mapa ainda não carregado</strong>
      <p>Quando você subir o mapa, vamos aplicar a camada de status comercial por lote.</p>
      <div class="legend">
        <span><i class="dot vendido"></i> Vendido</span>
        <span><i class="dot reservado"></i> Reservado</span>
        <span><i class="dot disponivel"></i> Disponível</span>
        <span><i class="dot bloqueado"></i> Bloqueado</span>
      </div>
    </div>
  `;
}

function renderConfiguracoes() {
  document.getElementById("view").innerHTML = `
    <div class="section-header">
      <h3>Configurações comerciais</h3>
    </div>

    <div class="config-box">
      <div class="form-grid">
        ${input("cfgMetaValor", "Meta financeira até junho", "text", moeda(META_VALOR_JUNHO), true)}
        ${input("cfgMetaLotes", "Meta de lotes até junho", "text", META_LOTES_JUNHO, true)}
        ${input("cfgJuros", "Juros financiamento", "text", "12% ao ano", true)}
        ${input("cfgIPCA", "Regra IPCA", "text", "Acima de 36 parcelas", true)}
      </div>

      <div class="notice">
        Regras comerciais aplicadas: à vista com 5% de desconto; entrada de 50% com 2,5% de desconto; até 36 parcelas com juros de 12% ao ano sem correção; acima de 36 parcelas com juros de 12% ao ano + IPCA, sem projeção automática do índice.
      </div>
    </div>
  `;
}

/* MODAIS AUXILIARES */

function abrirModalMidia() {
  openModal(`
    <div class="modal-card">
      <div class="modal-head"><h3>Nova ação de mídia</h3><button onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <div class="form-grid">
          ${input("mdCampanha", "Campanha", "text", "")}
          ${input("mdCanal", "Canal", "text", "")}
          ${input("mdObjetivo", "Objetivo", "text", "")}
          ${input("mdPeriodo", "Período", "text", "")}
          ${input("mdPrevisto", "Previsto", "number", "0")}
          ${input("mdRealizado", "Realizado", "number", "0")}
          ${input("mdLeads", "Leads", "number", "0")}
          ${input("mdStatus", "Status", "text", "Planejado")}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary fit" onclick="salvarMidia()">Salvar</button>
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
  saveLocal("calliandra_midia", S.midia);
  await tryAppend("midia", item);
  closeModal();
  renderMidia();
}

function abrirModalGasto() {
  openModal(`
    <div class="modal-card">
      <div class="modal-head"><h3>Novo item de orçamento</h3><button onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <div class="form-grid">
          ${input("gtCategoria", "Categoria", "text", "")}
          ${input("gtItem", "Microação", "text", "")}
          ${input("gtPrevisto", "Previsto", "number", "0")}
          ${input("gtRealizado", "Realizado", "number", "0")}
          ${input("gtStatus", "Status", "text", "Planejado")}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary fit" onclick="salvarGasto()">Salvar</button>
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
  saveLocal("calliandra_gastos", S.gastos);
  await tryAppend("gastos", item);
  closeModal();
  renderOrcamento();
}

function abrirModalAcao() {
  openModal(`
    <div class="modal-card">
      <div class="modal-head"><h3>Nova ação de cronograma</h3><button onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <div class="form-grid">
          ${input("acEtapa", "Etapa", "text", "")}
          ${input("acAcao", "Ação", "text", "")}
          ${input("acResp", "Responsável", "text", "")}
          ${input("acData", "Data", "date", "")}
          ${input("acStatus", "Status", "text", "Planejado")}
          ${input("acObs", "Observações", "text", "")}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary fit" onclick="salvarAcao()">Salvar</button>
      </div>
    </div>
  `);
}

async function salvarAcao() {
  const item = {
    id: uid(),
    etapa: val("acEtapa"),
    acao: val("acAcao"),
    responsavel: val("acResp"),
    data: val("acData"),
    status: val("acStatus"),
    obs: val("acObs")
  };

  S.acoes.push(item);
  saveLocal("calliandra_acoes", S.acoes);
  await tryAppend("acoes", item);
  closeModal();
  renderCronograma();
}

/* DATA NORMALIZATION */

function extractSheet(base, names) {
  for (const name of names) {
    const v = base?.[name];
    if (Array.isArray(v)) return v;
    if (Array.isArray(v?.rows)) return v.rows;
    if (Array.isArray(v?.data)) return v.data;
  }

  return [];
}

function normalizarLote(row, index) {
  if (Array.isArray(row)) {
    return finalizarLote({
      id: row[0] || `L${index + 1}`,
      empreendimento: row[1] || "Residencial Calliandra",
      quadra: row[3] || "",
      lote: row[4] || "",
      area: num(row[5]),
      classificacao: row[11] || "",
      precoM2: num(row[12]) || 1408.14,
      anotacao: row[13] || "",
      statusOriginal: row[14] || ""
    });
  }

  return finalizarLote({
    id: pick(row, ["id_lote", "id", "codigo", "código"]) || `L${index + 1}`,
    empreendimento: pick(row, ["empreendimento", "condominio", "condomínio"]) || "Residencial Calliandra",
    quadra: pick(row, ["quadra", "alameda", "rua", "nome_quadra"]) || "",
    lote: pick(row, ["lote", "numero", "número", "num_lote"]) || pick(row, ["id_lote", "id"]) || "",
    area: num(pick(row, ["area", "área", "metragem", "m2", "m²"])),
    classificacao: pick(row, ["classificacao", "classificação", "tipo", "tipologia"]) || "",
    precoM2: num(pick(row, ["preco_m2", "preço_m2", "valor_m2", "preco m2", "preço m²"])) || 1408.14,
    valor: num(pick(row, ["valor_total", "valor", "preco_total", "preço_total", "vgv"])),
    anotacao: pick(row, ["observacoes", "observações", "obs", "anotacao", "anotação"]) || "",
    statusOriginal: pick(row, ["status", "situacao", "situação"]) || ""
  });
}

function finalizarLote(l) {
  l.valor = l.valor || l.area * l.precoM2;

  const all = texto([l.statusOriginal, l.anotacao, l.classificacao].join(" "));
  const vendido = isLoteVendido(l);
  const reservado = all.includes("reserv");
  const bloqueado =
    all.includes("bloque") ||
    all.includes("permuta") ||
    all.includes("permutante") ||
    all.includes("desenvolve") ||
    all.includes("comprometido");

  l.vendavel = !bloqueado || all.includes("garantia") || all.includes("gdf");

  if (vendido) l.statusSistema = "Vendido";
  else if (reservado) l.statusSistema = "Reservado";
  else if (bloqueado && !all.includes("garantia")) l.statusSistema = "Bloqueado";
  else l.statusSistema = "Disponível";

  return l;
}

function normalizarContrato(row) {
  if (Array.isArray(row)) {
    return {
      id: row[0] || uid(),
      data: row[1] || "",
      cliente: row[2] || "",
      quadra: row[3] || "",
      lote: row[4] || "",
      area: num(row[5]),
      valorTabela: num(row[6]),
      valorFinal: num(row[7]),
      desconto: num(row[8]),
      status: row[9] || "Contrato",
      corretor: row[10] || "",
      origem: row[11] || "",
      comissaoValor: num(row[12])
    };
  }

  return {
    id: pick(row, ["id", "id_contrato"]) || uid(),
    data: pick(row, ["data", "Data"]) || "",
    cliente: pick(row, ["cliente", "nome", "nome_cliente"]) || "",
    quadra: pick(row, ["quadra", "alameda"]) || "",
    lote: pick(row, ["lote", "id_lote"]) || "",
    area: num(pick(row, ["area", "metragem", "m2"])),
    valorTabela: num(pick(row, ["valorTabela", "valor_tabela", "valor_lote", "valor"])),
    valorFinal: num(pick(row, ["valorFinal", "valor_final", "valor_negociado", "valor"])),
    desconto: num(pick(row, ["desconto", "desconto_concedido"])),
    status: pick(row, ["status", "situacao"]) || "Contrato",
    corretor: pick(row, ["corretor", "parceiro", "imobiliaria", "imobiliária"]) || "",
    origem: pick(row, ["origem", "canal"]) || "",
    comissaoValor: num(pick(row, ["comissao", "comissão", "valor_comissao"]))
  };
}

function normalizarCorretor(row) {
  if (Array.isArray(row)) {
    return { id: row[0] || uid(), nome: row[1] || row[0] || "", categoria: row[2] || "Prata", vendas: num(row[3]), comissao: row[4] || "5%" };
  }

  return {
    id: pick(row, ["id", "id_corretor"]) || uid(),
    nome: pick(row, ["nome", "corretor", "parceiro", "imobiliaria", "imobiliária"]) || "",
    categoria: pick(row, ["categoria"]) || "Prata",
    vendas: num(pick(row, ["vendas"])),
    comissao: pick(row, ["comissao", "comissão"]) || "5%"
  };
}

function normalizarMidia(row) {
  return {
    id: pick(row, ["id"]) || uid(),
    campanha: pick(row, ["campanha", "acao", "ação"]) || "Campanha Calliandra",
    canal: pick(row, ["canal"]) || "-",
    objetivo: pick(row, ["objetivo"]) || "-",
    periodo: pick(row, ["periodo", "período"]) || "-",
    previsto: num(pick(row, ["previsto", "verba_prevista"])),
    realizado: num(pick(row, ["realizado", "executado", "verba_executada"])),
    leads: num(pick(row, ["leads"])),
    status: pick(row, ["status"]) || "Planejado"
  };
}

function normalizarGasto(row) {
  return {
    id: pick(row, ["id"]) || uid(),
    categoria: pick(row, ["categoria"]) || "-",
    item: pick(row, ["item", "microacao", "microação", "acao", "ação"]) || "-",
    previsto: num(pick(row, ["previsto", "orcado", "orçado"])),
    realizado: num(pick(row, ["realizado", "pago", "executado"])),
    status: pick(row, ["status"]) || "Planejado"
  };
}

function normalizarAcao(row) {
  return {
    id: pick(row, ["id"]) || uid(),
    etapa: pick(row, ["etapa", "fase"]) || "-",
    acao: pick(row, ["acao", "ação", "atividade"]) || "-",
    responsavel: pick(row, ["responsavel", "responsável"]) || "-",
    data: pick(row, ["data"]) || "-",
    status: pick(row, ["status"]) || "Planejado",
    obs: pick(row, ["obs", "observacoes", "observações"]) || ""
  };
}

function aplicarVendasFixasDoPeriodo() {
  for (const vendido of VENDIDOS_PERIODO_FIXO) {
    const lote = S.lotes.find(l => same(l.quadra, vendido.quadra) && same(l.lote, vendido.lote));
    if (lote) lote.statusSistema = "Vendido";

    const exists = S.contratos.some(c => same(c.quadra, vendido.quadra) && same(c.lote, vendido.lote));

    if (!exists && lote) {
      S.contratos.unshift({
        id: uid(),
        data: "2026-06",
        cliente: "Venda do período",
        quadra: lote.quadra,
        lote: lote.lote,
        area: lote.area,
        valorTabela: lote.valor,
        desconto: 0,
        valorFinal: lote.valor,
        status: "Vendido",
        corretor: "",
        origem: "",
        comissaoValor: 0,
        obs: "Venda informada para apuração da meta de abril a junho."
      });
    }
  }

  aplicarStatusContratoNosLotes();
}

function aplicarStatusContratoNosLotes() {
  S.lotes.forEach(l => {
    const contrato = S.contratos.find(c => same(c.quadra, l.quadra) && same(c.lote, l.lote));
    if (contrato && isVendido(contrato.status)) l.statusSistema = "Vendido";
    if (contrato && texto(contrato.status).includes("reserv")) l.statusSistema = "Reservado";
  });
}

/* HELPERS */

function getAcoes() {
  if (S.acoes.length) return S.acoes;

  return [
    { etapa: "Venda antecipada", acao: "Conversão de leads aquecidos", responsavel: "Comercial", data: "Até 19/06", status: "Em andamento", obs: "Meta: mais 6 unidades" },
    { etapa: "Lançamento", acao: "Evento oficial de lançamento", responsavel: "Marketing/Comercial", data: "20/06", status: "Planejado", obs: "Meta: 10 unidades no dia" },
    { etapa: "Pós-lançamento", acao: "Follow-up e fechamento", responsavel: "Comercial", data: "Até 30/06", status: "Planejado", obs: "Meta: mais 5 unidades" }
  ];
}

function getMidia() {
  if (S.midia.length) return S.midia;

  return [
    { campanha: "Pré-lançamento", canal: "Meta Ads", objetivo: "Geração de leads", periodo: "Maio/Junho", previsto: 30000, realizado: 0, leads: 0, status: "Em andamento" },
    { campanha: "Lançamento", canal: "Google/Meta/WhatsApp", objetivo: "Conversão e presença no evento", periodo: "20/06", previsto: 40000, realizado: 0, leads: 0, status: "Planejado" },
    { campanha: "Pós-lançamento", canal: "Remarketing", objetivo: "Fechamento", periodo: "Até 30/06", previsto: 20000, realizado: 0, leads: 0, status: "Planejado" }
  ];
}

function getGastos() {
  if (S.gastos.length) return S.gastos;

  return [
    { categoria: "Mídia", item: "Meta Ads", previsto: 30000, realizado: 0, status: "Planejado" },
    { categoria: "Mídia", item: "Google Ads", previsto: 15000, realizado: 0, status: "Planejado" },
    { categoria: "Evento", item: "Lançamento", previsto: 25000, realizado: 0, status: "Planejado" },
    { categoria: "Produção", item: "Peças e vídeos", previsto: 20000, realizado: 0, status: "Planejado" }
  ];
}

function kpi(label, value, sub, fill = 0) {
  return `
    <div class="card-metric kpi-enhanced">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${sub || ""}</small>
      <div class="mini-bar"><i style="width:${Math.min(fill,100)}%"></i></div>
    </div>
  `;
}

function metric(label, value) {
  return `<div class="card-metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function metaCard(label, value, target, percent) {
  return `
    <div class="meta-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>Meta: ${target}</small>
      <div class="mini-bar"><i style="width:${Math.min(percent,100)}%"></i></div>
      <em>${percent}%</em>
    </div>
  `;
}

function pipelineRow(label, value, total, money = false) {
  const percent = pct(value, total);
  return `
    <div class="pipeline-row">
      <div>
        <strong>${label}</strong>
        <span>${money ? moeda(value) : value} de ${money ? moeda(total) : total}</span>
      </div>
      <div class="pipeline-bar"><i style="width:${Math.min(percent,100)}%"></i></div>
      <b>${percent}%</b>
    </div>
  `;
}

function ranking(items, key) {
  const map = {};

  items.forEach(i => {
    const k = i[key] || "Não informado";
    map[k] = (map[k] || 0) + num(i.valorFinal);
  });

  const rows = Object.entries(map)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 8);

  if (!rows.length) return `<div class="empty">Sem dados cadastrados.</div>`;

  return rows.map(([name, value], i) => `
    <div class="ranking-row">
      <b>${i + 1}</b>
      <span>${name}</span>
      <strong>${moeda(value)}</strong>
    </div>
  `).join("");
}

function tabelaParcelasPrice(saldo, parcelas) {
  if (!saldo || !parcelas) return `<div class="empty">Sem saldo financiado.</div>`;

  const p = parcelaPrice(saldo, parcelas, TAXA_MENSAL);
  let restante = saldo;
  let rows = "";

  for (let i = 1; i <= Math.min(parcelas, 12); i++) {
    const juros = restante * TAXA_MENSAL;
    const amort = p - juros;
    restante -= amort;

    rows += `
      <tr>
        <td>${i}</td>
        <td>${moeda(p)}</td>
        <td>${moeda(amort)}</td>
        <td>${moeda(juros)}</td>
        <td>${moeda(Math.max(restante,0))}</td>
      </tr>
    `;
  }

  return `
    <table>
      <thead>
        <tr><th>Parcela</th><th>Valor</th><th>Amortização</th><th>Juros</th><th>Saldo</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="muted table-note">Exibindo as 12 primeiras parcelas.</div>
  `;
}

function tabelaParcelasSAC(saldo, parcelas) {
  if (!saldo || !parcelas) return `<div class="empty">Sem saldo financiado.</div>`;

  const amort = saldo / parcelas;
  let restante = saldo;
  let rows = "";

  for (let i = 1; i <= Math.min(parcelas, 12); i++) {
    const juros = restante * TAXA_MENSAL;
    const parcela = amort + juros;
    restante -= amort;

    rows += `
      <tr>
        <td>${i}</td>
        <td>${moeda(parcela)}</td>
        <td>${moeda(amort)}</td>
        <td>${moeda(juros)}</td>
        <td>${moeda(Math.max(restante,0))}</td>
      </tr>
    `;
  }

  return `
    <table>
      <thead>
        <tr><th>Parcela</th><th>Valor</th><th>Amortização</th><th>Juros</th><th>Saldo</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="muted table-note">Exibindo as 12 primeiras parcelas.</div>
  `;
}

function parcelaPrice(valor, parcelas, taxa) {
  if (!valor || !parcelas) return 0;
  return valor * (taxa / (1 - Math.pow(1 + taxa, -parcelas)));
}

function calcularComissao(valor, corretorNome) {
  const c = S.corretores.find(x => texto(x.nome) === texto(corretorNome));
  const cat = texto(c?.categoria || "prata");

  let pctComissao = 0.05;
  if (cat.includes("bronze")) pctComissao = 0.04;
  if (cat.includes("ouro")) pctComissao = 0.06;

  return valor * pctComissao;
}

function valorVendidoPorLotes() {
  return soma(S.lotes.filter(l => l.statusSistema === "Vendido"), "valor");
}

function isLoteVendido(l) {
  if (VENDIDOS_PERIODO_FIXO.some(v => same(v.quadra, l.quadra) && same(v.lote, l.lote))) return true;
  return S.contratos.some(c => same(c.quadra, l.quadra) && same(c.lote, l.lote) && isVendido(c.status));
}

function isVendido(status) {
  const s = texto(status);
  return s.includes("vend") || s.includes("contrato") || s.includes("pago");
}

function badge(t) {
  const s = texto(t);
  let cls = "tag";
  if (s.includes("vend") || s.includes("pago") || s.includes("contrato")) cls += " disponivel";
  if (s.includes("reserv")) cls += " reservado";
  if (s.includes("bloque")) cls += " bloqueado";
  return `<span class="${cls}">${t || "-"}</span>`;
}

function input(id, label, type, value = "", disabled = false) {
  return `
    <div class="field">
      <label>${label}</label>
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

async function tryAppend(sheet, values) {
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "appendRow", sheet, values })
    });
  } catch (e) {
    console.warn("Salvo localmente. Backend não confirmou gravação.", e);
  }
}

function mergeLocal(key, arr) {
  const local = readLocal(key);
  const base = Array.isArray(arr) ? arr : [];
  return [...local, ...base.filter(b => !local.some(l => l.id && b.id && l.id === b.id))];
}

function saveLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data || []));
}

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}

function val(id) {
  return document.getElementById(id)?.value || "";
}

function pick(obj, keys) {
  if (!obj) return "";
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }

  const normalized = {};
  Object.keys(obj).forEach(k => normalized[texto(k)] = obj[k]);

  for (const k of keys) {
    const found = normalized[texto(k)];
    if (found !== undefined && found !== null && found !== "") return found;
  }

  return "";
}

function soma(arr, field) {
  return (arr || []).reduce((s, i) => s + num(i[field]), 0);
}

function num(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;

  return Number(
    String(v)
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  ) || 0;
}

function moeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(a, b) {
  if (!b) return 0;
  return Math.round((num(a) / num(b)) * 100);
}

function formatArea(v) {
  return `${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

function texto(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function same(a,b) {
  return texto(a) === texto(b);
}

function searchText(arr) {
  return texto(arr.join(" "));
}

function uid() {
  return `ID-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="empty">${msg}</td></tr>`;
}

function goWithoutLoop(page) {
  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
  document.getElementById("pageTitle").innerText = "Simulador comercial";
}

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("calliandra_user") || "null"); }
  catch { return null; }
}

function logout() {
  localStorage.removeItem("calliandra_user");
  location.reload();
}

function toast(msg, type = "ok") {
  const root = document.getElementById("toastRoot");
  if (!root) return alert(msg);

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerText = msg;
  root.appendChild(el);

  setTimeout(() => el.remove(), 3200);
}

function injectRuntimeCSS() {
  const css = `
    .fallback-logo{display:none;color:#fff;font-size:28px;letter-spacing:.16em;font-weight:800;margin-bottom:14px}
    .menu-item span{display:inline-block;width:24px}
    .fit{width:auto!important;padding-left:18px!important;padding-right:18px!important}
    .btn-ghost{border:1px solid var(--borda);background:#fff;border-radius:12px;padding:10px 14px;color:var(--verde);font-weight:800;cursor:pointer}
    .actions-row{display:flex;gap:10px;align-items:center}
    .search-input{height:44px;border:1px solid var(--borda);border-radius:12px;padding:0 14px;min-width:300px}
    .muted{color:#777;font-size:13px;margin-top:4px}
    .mt{margin-top:22px}
    .table-title{font-size:15px;font-weight:800;color:var(--verde);padding:18px 20px;border-bottom:1px solid var(--borda)}
    .kpi-enhanced small{display:block;color:#777;margin-top:8px;font-size:12px}
    .mini-bar{height:6px;background:#eee7db;border-radius:99px;margin-top:12px;overflow:hidden}
    .mini-bar i{display:block;height:100%;background:var(--bordo);border-radius:99px}
    .metas-box{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .meta-card{border:1px solid var(--borda);border-radius:16px;padding:18px;background:#fff}
    .meta-card span{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#777;font-weight:800}
    .meta-card strong{display:block;margin-top:8px;font-size:22px;color:var(--verde)}
    .meta-card small{display:block;margin-top:4px;color:#777}
    .meta-card em{display:block;margin-top:8px;font-style:normal;font-weight:800;color:var(--bordo)}
    .pipeline-row{display:grid;grid-template-columns:150px 1fr 52px;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--borda)}
    .pipeline-row strong{display:block;color:var(--verde)}
    .pipeline-row span{font-size:12px;color:#777}
    .pipeline-bar{height:9px;background:#eee7db;border-radius:99px;overflow:hidden}
    .pipeline-bar i{display:block;height:100%;background:var(--verde);border-radius:99px}
    .tag.reservado{background:#fff2d6;color:#8a651b}
    .tag.bloqueado{background:#eee;color:#666}
    .sim-cab{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px;background:#f8f4ed;border-radius:16px;padding:16px;margin-bottom:18px}
    .sim-cab span{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#777;font-weight:800}
    .sim-cab strong{display:block;margin-top:4px;color:var(--verde);font-size:18px}
    .condicoes-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .condicao-card{border:1px solid var(--borda);border-radius:18px;padding:16px;background:#fff}
    .condicao-card.alerta{border-color:#ead7a9;background:#fffaf0}
    .cond-title{font-size:16px;font-weight:900;color:var(--verde);margin-bottom:10px}
    .notice.small{font-size:11px;padding:10px;margin-top:12px}
    .table-note{padding:10px 14px}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999;display:flex;align-items:center;justify-content:center;padding:24px}
    .modal-card{background:#fff;border-radius:22px;max-width:920px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 30px 80px rgba(0,0,0,.22)}
    .modal-head{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;background:var(--verde);color:#fff}
    .modal-head h3{font-size:20px}
    .modal-head button{border:0;background:transparent;color:#fff;font-size:30px;cursor:pointer}
    .modal-body{padding:24px}
    .modal-actions{padding:18px 24px;border-top:1px solid var(--borda);display:flex;justify-content:flex-end;gap:10px}
    .form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    .textarea{min-height:90px;border:1px solid var(--borda);border-radius:13px;padding:12px;font-family:inherit}
    .ranking-row{display:grid;grid-template-columns:34px 1fr 140px;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--borda)}
    .ranking-row b{background:var(--areia-2);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:var(--verde)}
    .ranking-row strong{text-align:right;color:var(--verde)}
    .map-placeholder{background:#fff;border:1px dashed var(--borda);border-radius:24px;padding:48px;text-align:center;box-shadow:var(--sombra)}
    .map-placeholder strong{font-size:24px;color:var(--verde)}
    .map-placeholder p{margin-top:10px;color:#777}
    .legend{display:flex;justify-content:center;gap:18px;margin-top:24px;flex-wrap:wrap}
    .dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px}
    .dot.vendido{background:#8f5f55}.dot.reservado{background:#d8aa51}.dot.disponivel{background:#123f36}.dot.bloqueado{background:#d8cfc3}
    .empty{text-align:center;color:#777;padding:22px!important}
    #toastRoot{position:fixed;right:18px;bottom:18px;z-index:1000;display:grid;gap:8px}
    .toast{background:var(--verde);color:#fff;padding:12px 16px;border-radius:12px;box-shadow:var(--sombra);font-weight:800}
    .toast.err{background:#9b2f2f}
    @media(max-width:1100px){.condicoes-grid,.metas-box,.sim-cab{grid-template-columns:1fr}.form-grid{grid-template-columns:1fr}.actions-row{flex-direction:column;align-items:stretch}.search-input{min-width:0;width:100%}}
  `;

  const style = document.createElement("style");
  style.innerHTML = css;
  document.head.appendChild(style);
}
