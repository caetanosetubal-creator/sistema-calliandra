// app.js

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

    message.innerText = "Login realizado com sucesso";

    carregarDashboard();

  } catch (error) {
    console.error(error);

    message.innerText =
      "Erro ao conectar com a API";
  }
}

async function carregarDashboard() {
  app.innerHTML = `
    <div class="dashboard">
      <div class="dashboard-header">
        <h1 class="dashboard-title">
          Sistema Comercial Calliandra
        </h1>

        <p class="dashboard-subtitle">
          Residencial Calliandra · Urbanizadora Paranoazinho
        </p>
      </div>

      <div id="cardsGrid" class="cards-grid">
        <div class="card">
          <div class="card-label">
            Carregando dashboard...
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const response = await fetch(
      "/api/sheets?action=getDashboard"
    );

    const result = await response.json();

    if (!result.ok) {
      renderErroDashboard(
        result.message || "Erro ao carregar dashboard"
      );

      return;
    }

    renderDashboard(result.data);

  } catch (error) {
    console.error(error);

    renderErroDashboard(
      "Erro ao conectar com dashboard"
    );
  }
}

function renderErroDashboard(message) {
  const grid =
    document.getElementById("cardsGrid");

  grid.innerHTML = `
    <div class="card">
      <div class="card-label">
        Erro
      </div>

      <div class="card-secondary">
        ${message}
      </div>
    </div>
  `;
}

function renderDashboard(data) {
  const grid =
    document.getElementById("cardsGrid");

  grid.innerHTML = `
    ${card(
      "Lotes totais",
      numero(data.total_lotes)
    )}

    ${card(
      "Vendidos",
      numero(data.vendidos)
    )}

    ${card(
      "Reservados",
      numero(data.reservados)
    )}

    ${card(
      "Vendáveis",
      numero(data.vendaveis)
    )}

    ${card(
      "Disponíveis reais",
      numero(data.disponiveis_reais)
    )}

    ${card(
      "Bloqueados",
      numero(data.bloqueados)
    )}

    ${card(
      "VGV total",
      moeda(data.vgv_total)
    )}

    ${card(
      "VGV vendido",
      moeda(data.vgv_vendido)
    )}

    ${card(
      "Comissão total",
      moeda(data.comissao_total)
    )}

    ${card(
      "Líquido pós comissão",
      moeda(data.liquido_pos_comissao)
    )}

    ${card(
      "Ticket médio",
      moeda(data.ticket_medio)
    )}

    ${card(
      "Mídia realizada",
      moeda(data.midia_total)
    )}
  `;
}

function card(label, value) {
  return `
    <div class="card">
      <div class="card-label">
        ${label}
      </div>

      <div class="card-value">
        ${value}
      </div>
    </div>
  `;
}

function moeda(valor) {
  return Number(valor || 0)
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
}

function numero(valor) {
  return Number(valor || 0)
    .toLocaleString("pt-BR");
}