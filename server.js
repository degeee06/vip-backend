require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Token PagBank
let PAGBANK_TOKEN = process.env.PAGBANK_TOKEN;
const cleanToken = (token) => token?.trim().replace(/\r?\n|\r/g, "");

// Middleware para checar token
app.use((req, res, next) => {
  PAGBANK_TOKEN = cleanToken(PAGBANK_TOKEN);
  if (!PAGBANK_TOKEN) return res.status(500).json({ error: "Token PagBank não definido" });
  next();
});

// Middleware simples de validação de body
const validateBody = (requiredFields) => (req, res, next) => {
  const missing = requiredFields.filter(f => !req.body[f]);
  if (missing.length > 0) return res.status(400).json({ error: `Campos obrigatórios faltando: ${missing.join(', ')}` });
  next();
};

// Criar cobrança PIX
app.post('/vip/purchase', validateBody(['userId', 'plan']), async (req, res) => {
  const { userId, plan } = req.body;
  try {
    const response = await axios.post(
      'https://sandbox.api.pagseguro.com/orders',
      {
        reference_id: `vip-${userId}`,
        customer: { name: "Cliente Teste", email: "cliente@test.com" },
        items: [{ name: `Plano VIP ${plan}`, quantity: 1, unit_amount: 1000 }],
        payments: [{ type: "PIX" }],
      },
      { headers: { Authorization: `Bearer ${PAGBANK_TOKEN}`, "Content-Type": "application/json" } }
    );

    const payment = response.data.payments?.[0]?.pix || {};
    res.json({
      id: response.data.id,
      pixCode: payment.copy_and_paste_code || "",
      qrImageBase64: payment.qr_code?.base64 || "",
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao criar cobrança" });
  }
});

// Confirmar pagamento
app.get('/vip/confirm/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "ID da cobrança é obrigatório" });

  try {
    const response = await axios.get(`https://sandbox.api.pagseguro.com/orders/${id}`, {
      headers: { Authorization: `Bearer ${PAGBANK_TOKEN}` }
    });
    const status = response.data.status;
    res.json({ success: status === "PAID", status });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

// Middleware de erro global (final)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor' });
});

// Porta dinâmica do Render
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
