const app = document.getElementById("app");

document.addEventListener("DOMContentLoaded", () => {
  iniciarSistema();
});

function iniciarSistema() {
  const loginForm = document.getElementById("loginForm");

  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    await fazerLogin();
  });
}

async function fazerLogin() {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  const message = document.getElementById("loginMessage");

  message.innerText = "Entrando no sistema...";

  try {
    const response = await fetch("/api/sheets", {
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

    if (!data.ok) {
      message.innerText = data.message || "Erro no login";
      return;
    }

    localStorage.setItem(
      "calliandra_user",
      JSON.stringify(data.usuario)
    );

    carregarSistema();

  } catch (error) {
    console.error(error);

    message.innerText =
      "Erro ao conectar com a API";
  }
}

function carregarSistema() {
  app.innerHTML = `
    <div class="system-layout">

      <aside class="sidebar">
        <div class="sidebar-logo">
          CALLIANDRA
        </div>

        <div class="sidebar-sub">
          Sistema Comercial
        </div>

        <div class="menu">
          <button class="active" onclick="abrirDashboard()">
            Dashboard
          </button>

          <button onclick="abrirLotes()">
            Lotes
          </button>

          <button onclick="abrirVendas()">
            Vendas
          </button>

          <button onclick="abrirSimulador()">
            Simulador
          </button>

          <button onclick="abrirComissoes()">
            Comissões
          </button>

          <button onclick="abrirCampanhas()">
            Campanhas
          </button>

          <button onclick="abrirMidia()">
            Plano de mídia
          </button>

          <button onclick="abrirFinanceiro()">
            Orçado x realizado
          </button>

          <button onclick="logout()">
            Sair
          </button>
        </div>
      </aside>

      <main class="content" id="content">
      </main>

    </div>
  `;

  abrirDashboard();
}

function abrirDashboard() {
  document.getElementById("content").innerHTML = `
    <h1 class="page-title">
      Dashboard Comercial
    </h1>

    <p class="page-subtitle">
      Visão geral do Residencial Calliandra
    </p>

    <div class="cards-grid">

      <div class="card">
        <div class="card-label">
          Lotes totais
        </div>

        <div class="card-value">
          84
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          Vendidos
        </div>

        <div class="card-value">
          9
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          Vendáveis
        </div>

        <div class="card-value">
          33
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          Disponíveis reais
        </div>

        <div class="card-value">
          24
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          VGV vendido
        </div>

        <div class="card-value">
          R$ 4.148.986
        </div>
      </div>

      <div class="card">
        <div class="card-label">
          Comissão total
        </div>

        <div class="card-value">
          R$ 195.954
        </div>
      </div>

    </div>

    <div class="table-box">

      <div class="table-header">
        Últimas vendas
      </div>

      <table>

        <thead>
          <tr>
            <th>Lote</th>
            <th>Cliente</th>
            <th>Valor</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>

          <tr>
            <td>Araçá 19</td>
            <td>Cliente teste</td>
            <td>R$ 393.935</td>
            <td class="status-ok">
              Vendido
            </td>
          </tr>

          <tr>
            <td>Ipê 07</td>
            <td>Cliente teste</td>
            <td>R$ 428.000</td>
            <td class="status-warning">
              Reservado
            </td>
          </tr>

        </tbody>

      </table>

    </div>
  `;
}

function abrirLotes() {
  document.getElementById("content").innerHTML = `
    <h1 class="page-title">
      Gestão de lotes
    </h1>

    <p class="page-subtitle">
      Controle comercial dos lotes do Calliandra
    </p>

    <div class="table-box">

      <div class="table-header">
        Lista de lotes
      </div>

      <table>

        <thead>
          <tr>
            <th>Lote</th>
            <th>Metragem</th>
            <th>Status</th>
            <th>Preço m²</th>
          </tr>
        </thead>

        <tbody>

          <tr>
            <td>Araçá 19</td>
            <td>294,48 m²</td>
            <td class="status-ok">
              Disponível
            </td>
            <td>R$ 1.408,14</td>
          </tr>

          <tr>
            <td>Ipê 07</td>
            <td>350,00 m²</td>
            <td class="status-warning">
              Reservado
            </td>
            <td>R$ 1.420,00</td>
          </tr>

        </tbody>

      </table>

    </div>
  `;
}

function abrirVendas() {
  document.getElementById("content").innerHTML = `
    <h1 class="page-title">
      Vendas e contratos
    </h1>

    <p class="page-subtitle">
      Gestão comercial e propostas
    </p>

    <div class="table-box">

      <div class="table-header">
        Contratos recentes
      </div>

      <table>

        <thead>
          <tr>
            <th>Cliente</th>
            <th>Lote</th>
            <th>Valor</th>
            <th>Corretor</th>
          </tr>
        </thead>

        <tbody>

          <tr>
            <td>Cliente exemplo</td>
            <td>Araçá 19</td>
            <td>R$ 393.935</td>
            <td>HouseUP</td>
          </tr>

        </tbody>

      </table>

    </div>
  `;
}

function abrirSimulador() {
  document.getElementById("content").innerHTML = `
    <h1 class="page-title">
      Simulador comercial
    </h1>

    <p class="page-subtitle">
      Simulação financeira de vendas
    </p>

    <div class="simulator-box">

      <div class="simulator-grid">

        <label>
          Valor do lote
          <input type="number" id="valorLote" value="393935">
        </label>

        <label>
          Entrada %
          <input type="number" id="entrada" value="30">
        </label>

        <label>
          Parcelas
          <input type="number" id="parcelas" value="36">
        </label>

      </div>

      <button class="primary-btn" onclick="calcularSimulacao()">
        Calcular simulação
      </button>

      <div class="result-box" id="resultadoSimulacao">
        Resultado da simulação
      </div>

    </div>
  `;
}

function calcularSimulacao() {
  const valor =
    Number(document.getElementById("valorLote").value);

  const entrada =
    Number(document.getElementById("entrada").value);

  const parcelas =
    Number(document.getElementById("parcelas").value);

  const valorEntrada =
    valor * (entrada / 100);

  const saldo =
    valor - valorEntrada;

  const parcela =
    saldo / parcelas;

  document.getElementById(
    "resultadoSimulacao"
  ).innerHTML = `
    <strong>Entrada:</strong>
    R$ ${valorEntrada.toLocaleString("pt-BR")} <br><br>

    <strong>Saldo:</strong>
    R$ ${saldo.toLocaleString("pt-BR")} <br><br>

    <strong>${parcelas} parcelas:</strong>
    R$ ${parcela.toLocaleString("pt-BR")}
  `;
}

function abrirComissoes() {
  document.getElementById("content").innerHTML = `
    <h1 class="page-title">
      Comissões
    </h1>

    <p class="page-subtitle">
      Gestão de parceiros e imobiliárias
    </p>
  `;
}

function abrirCampanhas() {
  document.getElementById("content").innerHTML = `
    <h1 class="page-title">
      Campanhas comerciais
    </h1>

    <p class="page-subtitle">
      Controle de campanhas e metas
    </p>
  `;
}

function abrirMidia() {
  document.getElementById("content").innerHTML = `
    <h1 class="page-title">
      Plano de mídia
    </h1>

    <p class="page-subtitle">
      Gestão de mídia e tráfego
    </p>
  `;
}

function abrirFinanceiro() {
  document.getElementById("content").innerHTML = `
    <h1 class="page-title">
      Orçado x realizado
    </h1>

    <p class="page-subtitle">
      Controle financeiro da operação
    </p>
  `;
}

function logout() {
  localStorage.removeItem("calliandra_user");

  location.reload();
}
