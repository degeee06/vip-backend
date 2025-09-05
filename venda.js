const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Coloque seu token aqui
const PAGBANK_TOKEN = "ccbd38b0-97e8-41e8-8454-182a7eb5491ce42bd9cb4fa6ac2410880d3a2f06a495a404-0f41-4ae5-aed6-aeb9b3b427ea";

// Criar cobrança PIX
app.post("/vip/purchase", async (req, res) => {
  const { userId, plan } = req.body;

  try {
    const response = await axios.post(
      "https://sandbox.api.pagseguro.com/orders", // Troque para produção depois
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
            unit_amount: 1000, // em centavos → R$ 10,00
          },
        ],
        qr_codes: [
          {
            amount: {
              value: 1000,
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${PAGBANK_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao criar cobrança" });
  }
});

// Verificar status do pagamento
app.get("/vip/confirm/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const response = await axios.get(
      `https://sandbox.api.pagseguro.com/orders/${id}`,
      {
        headers: {
          Authorization: `Bearer ${PAGBANK_TOKEN}`,
        },
      }
    );

    const status = response.data.status; // PAID, WAITING, etc
    res.json({ success: status === "PAID", status });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
