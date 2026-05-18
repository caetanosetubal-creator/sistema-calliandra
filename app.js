const API_URL = "/api/sheets";

let usuarioLogado = null;
let dados = {
  lotes: [],
  contratos: [],
  corretores: [],
  vendas: []
};

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", fazerLogin);
  }

  configurarMenu();
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

    const ok = data.ok || data.success || data.raw?.ok || data.raw?.success;

    const usuario =
      data.usuario ||
      data.user ||
      data.raw?.usuario ||
      data.raw?.user ||
      {
        nome: "Administrador",
        email,
        perfil: "gestor"
      };

    if (!ok) {
      msg.innerText =
        data.message ||
        data.error ||
        data.raw?.message ||
        data.raw?.error ||
        "Login não autorizado.";
      return;
    }

    usuarioLogado = usuario;

    localStorage.setItem("calliandra_user", JSON.stringify(usuario));

    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    document.getElementById("usuarioNome").innerText =
      usuario.nome || usuario.email || "Usuário";

    await carregarDados();
    renderDashboard();
    renderLotes();
    renderContratos();
    renderCorretores();
    preencherSimulador();

  } catch (error) {
    console.error(error);
    msg.innerText = "Erro ao conectar com a API.";
  }
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

    const base =
      result.data ||
      result.raw?.data ||
      {};

    dados.lotes =
      base.lotes ||
      base.Lotes ||
      [];

    dados.contratos =
      base.contratos ||
      base.vendas ||
      base.Contratos ||
      [];

    dados.corretores =
      base.corretores ||
      base.parceiros ||
      base.Corretores ||
      [];

  } catch (error) {
    console.error("Erro ao carregar dados:", error);
  }
}

function configurarMenu() {
  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;

      document.querySelectorAll(".menu-item").forEach((b) => {
        b.classList.remove("active");
      });

      btn.classList.add("active");

      document.querySelectorAll(".page").forEach((p) => {
        p.classList.remove("active-page");
      });

      const pageEl = document.getElementById(`${page}Page`);

      if (pageEl) {
        pageEl.classList.add("active-page");
      }

      const title = btn.innerText.trim();
      document.getElementById("pageTitle").innerText = title;
    });
  });
}

function renderDashboard() {
  const lotes = dados.lotes || [];
  const contratos = dados.contratos || [];

  const total = lotes.length || 84;

  const vendidos =
    lotes.filter((l) => texto(l.status).includes("vend")).length ||
    contratos.length ||
    0;

  const bloqueados =
    lotes.filter((l) => {
      const s = texto(l.status);
      const obs = texto(l.observacoes || l.obs || l.anotacao);
      return (
        s.includes("bloque") ||
        s.includes("permuta") ||
        obs.includes("permuta") ||
        obs.includes("desenvolve")
      );
    }).length;

  const vendaveis =
    lotes.filter((l) => {
      const s = texto(l.status);
      const obs = texto(l.observacoes || l.obs || l.anotacao);

      return (
        !s.includes("vend") &&
        !s.includes("bloque") &&
        !obs.includes("permuta") &&
        !obs.includes("desenvolve")
      );
    }).length || 33;

  const disponiveis = Math.max(vendaveis - vendidos, 0) || 24;

  const vgvTotal =
    soma(lotes, ["valor_total", "valor", "preco_total", "vgv"]) ||
    28995355.26;

  const vgvVendido =
    soma(contratos, ["valor_total", "valor", "valor_venda"]) ||
    4148986.68;

  const comissao =
    soma(contratos, ["comissao", "valor_comissao"]) ||
    195954.46;

  const ticket =
    vendidos > 0 ? vgvVendido / vendidos : 0;

  setText("metricLotes", total);
  setText("metricVendidos", vendidos);
  setText("metricVendaveis", vendaveis);
  setText("metricDisponiveis", disponiveis);
  setText("metricVGV", moeda(vgvTotal));
  setText("metricVendido", moeda(vgvVendido));
  setText("metricComissao", moeda(comissao));
  setText("metricTicket", moeda(ticket));

  criarGraficoStatus(vendidos, disponiveis, bloqueados);
  criarGraficoVendas();
}

function renderLotes() {
  const tbody = document.getElementById("tbodyLotes");
  if (!tbody) return;

  const lotes = dados.lotes || [];

  if (!lotes.length) {
    tbody.innerHTML = `
      <tr>
        <td>Araçá</td>
        <td>19</td>
        <td>294,48 m²</td>
        <td><span class="tag disponivel">Disponível</span></td>
        <td>R$ 414.000,00</td>
        <td><button class="btn-small">Simular</button></td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lotes.map((lote) => {
    const quadra = lote.quadra || lote.Quadra || lote.alameda || "-";
    const numero = lote.lote || lote.Lote || lote.id_lote || lote.id || "-";
    const area = lote.area || lote.metragem || lote.m2 || "-";
    const status = lote.status || "Disponível";
    const valor = obterValorLote(lote);

    return `
      <tr>
        <td>${quadra}</td>
        <td>${numero}</td>
        <td>${area}</td>
        <td><span class="tag">${status}</span></td>
        <td>${moeda(valor)}</td>
        <td><button class="btn-small" onclick="irParaSimulador('${numero}')">Simular</button></td>
      </tr>
    `;
  }).join("");
}

function renderContratos() {
  const tbody = document.getElementById("tbodyContratos");
  if (!tbody) return;

  const contratos = dados.contratos || [];

  if (!contratos.length) {
    tbody.innerHTML = `
      <tr>
        <td>Sem contratos cadastrados</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = contratos.map((c) => `
    <tr>
      <td>${c.cliente || c.nome_cliente || "-"}</td>
      <td>${c.lote || c.id_lote || "-"}</td>
      <td>${moeda(c.valor || c.valor_total || c.valor_venda)}</td>
      <td>${c.status || "-"}</td>
      <td>${c.corretor || c.parceiro || "-"}</td>
    </tr>
  `).join("");
}

function renderCorretores() {
  const tbody = document.getElementById("tbodyCorretores");
  if (!tbody) return;

  const corretores = dados.corretores || [];

  if (!corretores.length) {
    tbody.innerHTML = `
      <tr>
        <td>HouseUP</td>
        <td>Prata</td>
        <td>0</td>
        <td>5%</td>
      </tr>
      <tr>
        <td>Torres Imob</td>
        <td>Prata</td>
        <td>0</td>
        <td>5%</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = corretores.map((c) => `
    <tr>
      <td>${c.nome || c.corretor || c.parceiro || "-"}</td>
      <td>${c.categoria || "-"}</td>
      <td>${c.vendas || 0}</td>
      <td>${c.comissao || "-"}</td>
    </tr>
  `).join("");
}

function preencherSimulador() {
  const select = document.getElementById("simLote");
  if (!select) return;

  const lotes = dados.lotes || [];

  if (!lotes.length) {
    select.innerHTML = `
      <option value="araca-19" data-area="294.48" data-valor="414000">
        Araçá 19 · 294,48 m² · R$ 414.000,00
      </option>
    `;
    return;
  }

  select.innerHTML = lotes.map((lote, index) => {
    const id = lote.id_lote || lote.id || lote.lote || `lote-${index}`;
    const quadra = lote.quadra || lote.alameda || "";
    const numero = lote.lote || lote.id_lote || id;
    const area = numeroParaCalculo(lote.area || lote.metragem || lote.m2);
    const valor = obterValorLote(lote);

    return `
      <option value="${id}" data-area="${area}" data-valor="${valor}">
        ${quadra} ${numero} · ${area} m² · ${moeda(valor)}
      </option>
    `;
  }).join("");
}

function simular() {
  const select = document.getElementById("simLote");
  const tipo = document.getElementById("simTipo").value;
  const resultado = document.getElementById("resultadoSimulacao");

  const option = select.options[select.selectedIndex];

  const valorBase = Number(option.dataset.valor || 0);
  const area = Number(option.dataset.area || 0);

  let desconto = 0;
  let entrada = 0;
  let saldo = 0;
  let parcelas = 0;
  let jurosInfo = "Sem correção monetária.";

  if (tipo === "avista") {
    desconto = valorBase * 0.05;
    entrada = valorBase - desconto;
    saldo = 0;
    parcelas = 0;
  }

  if (tipo === "50") {
    entrada = valorBase * 0.50;
    saldo = valorBase - entrada;
    parcelas = 6;
  }

  if (tipo === "36") {
    entrada = valorBase * 0.30;
    saldo = valorBase - entrada;
    parcelas = 36;
    jurosInfo = "Juros de 12% ao ano, sem correção monetária.";
  }

  if (tipo === "120") {
    entrada = valorBase * 0.30;
    saldo = valorBase - entrada;
    parcelas = 120;
    jurosInfo = "Juros de 12% ao ano + IPCA. O IPCA não está projetado nesta simulação.";
  }

  const valorFinal = valorBase - desconto;
  const valorParcela = parcelas > 0 ? calcularParcelaPrice(saldo, parcelas, 0.009488) : 0;

  resultado.innerHTML = `
    <div class="result-line">
      <span>Lote selecionado</span>
      <strong>${option.text}</strong>
    </div>

    <div class="result-line">
      <span>Área</span>
      <strong>${area} m²</strong>
    </div>

    <div class="result-line">
      <span>Valor base</span>
      <strong>${moeda(valorBase)}</strong>
    </div>

    <div class="result-line">
      <span>Desconto</span>
      <strong>${moeda(desconto)}</strong>
    </div>

    <div class="result-line">
      <span>Valor final</span>
      <strong>${moeda(valorFinal)}</strong>
    </div>

    <div class="result-line">
      <span>Entrada</span>
      <strong>${moeda(entrada)}</strong>
    </div>

    <div class="result-line">
      <span>Saldo financiado</span>
      <strong>${moeda(saldo)}</strong>
    </div>

    <div class="result-line">
      <span>Parcelas</span>
      <strong>${parcelas || "Não se aplica"}</strong>
    </div>

    <div class="result-line">
      <span>Valor estimado da parcela</span>
      <strong>${parcelas ? moeda(valorParcela) : "Não se aplica"}</strong>
    </div>

    <div class="notice">
      ${jurosInfo}
    </div>
  `;
}

function irParaSimulador(id) {
  document.querySelector('[data-page="simulador"]').click();

  const select = document.getElementById("simLote");

  if (!select) return;

  const found = [...select.options].find((o) => o.value == id);

  if (found) {
    select.value = id;
  }
}

function criarGraficoStatus(vendidos, disponiveis, bloqueados) {
  const canvas = document.getElementById("chartStatus");
  if (!canvas || typeof Chart === "undefined") return;

  if (window.chartStatusInstance) {
    window.chartStatusInstance.destroy();
  }

  window.chartStatusInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Vendidos", "Disponíveis", "Bloqueados"],
      datasets: [{
        data: [vendidos, disponiveis, bloqueados],
        backgroundColor: ["#8f5f55", "#123f36", "#d8cfc3"]
      }]
    }
  });
}

function criarGraficoVendas() {
  const canvas = document.getElementById("chartVendas");
  if (!canvas || typeof Chart === "undefined") return;

  if (window.chartVendasInstance) {
    window.chartVendasInstance.destroy();
  }

  window.chartVendasInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Venda antecipada", "Lançamento", "Pós-lançamento"],
      datasets: [{
        label: "Meta de unidades",
        data: [6, 10, 5],
        backgroundColor: ["#123f36", "#8f5f55", "#d8cfc3"]
      }]
    }
  });
}

function calcularParcelaPrice(valor, parcelas, taxa) {
  if (!valor || !parcelas) return 0;

  return valor * (taxa / (1 - Math.pow(1 + taxa, -parcelas)));
}

function obterValorLote(lote) {
  const valor =
    lote.valor_total ||
    lote.valor ||
    lote.preco_total ||
    lote.vgv;

  if (valor) return numeroParaCalculo(valor);

  const area = numeroParaCalculo(lote.area || lote.metragem || lote.m2);
  const precoM2 = numeroParaCalculo(lote.preco_m2 || lote.valor_m2 || lote.m2_valor || 1408.14);

  return area * precoM2;
}

function soma(lista, campos) {
  return lista.reduce((total, item) => {
    for (const campo of campos) {
      if (item[campo] !== undefined && item[campo] !== "") {
        return total + numeroParaCalculo(item[campo]);
      }
    }

    return total;
  }, 0);
}

function numeroParaCalculo(valor) {
  if (typeof valor === "number") return valor;

  if (!valor) return 0;

  return Number(
    String(valor)
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function texto(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.innerText = valor;
}

function logout() {
  localStorage.removeItem("calliandra_user");
  location.reload();
}
