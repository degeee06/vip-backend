// server.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Token via variável de ambiente
let PAGBANK_TOKEN = process.env.PAGBANK_TOKEN;

// Função para limpar o token
const cleanToken = (token) => token?.trim().replace(/\r?\n|\r/g, "");

// Middleware para checar token
app.use((req, res, next) => {
  PAGBANK_TOKEN = cleanToken(PAGBANK_TOKEN);
  if (!PAGBANK_TOKEN) {
    return res.status(500).json({ error: "Token PagBank não definido" });
  }
  next();
});

// Criar cobrança PIX
app.post("/vip/purchase", async (req, res) => {
  const { userId, plan } = req.body;

  if (!userId || !plan) {
    return res.status(400).json({ error: "userId e plan são obrigatórios" });
  }

  try {
    const response = await axios.post(
      "https://sandbox.api.pagseguro.com/orders", // Sandbox
      {
        reference_id: `vip-${userId}`,
        customer: {
          name: "Cliente Teste",
          email: "cliente@test.com",
        },
        items: [
          {
            name: `Plano VIP ${plan}`,
            quantity: 1,
            unit_amount: 1000, // R$ 10,00 em centavos
          },
        ],
        payment_method: {
          type: "PIX"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${PAGBANK_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Extrair código Pix para copy & paste
    const pixCode = response.data.payments?.[0]?.pix?.copy_and_paste_code;

    res.json({
      id: response.data.id,
      pixCode: pixCode || "",
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao criar cobrança" });
  }
});


// Verificar status do pagamento
app.get("/vip/confirm/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: "ID da cobrança é obrigatório" });

  try {
    const response = await axios.get(
      `https://sandbox.api.pagseguro.com/orders/${id}`,
      {
        headers: {
          Authorization: `Bearer ${PAGBANK_TOKEN}`,
        },
      }
    );

    const status = response.data.status; // WAITING, PAID, etc
    res.json({ success: status === "PAID", status });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

// Porta dinâmica do Render
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));

