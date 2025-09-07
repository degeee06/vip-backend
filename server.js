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

// --- Token Efí Bank ---
let EFI_TOKEN = process.env.EFI_TOKEN;
const cleanToken = (token) => token?.trim().replace(/\r?\n|\r/g, "");
app.use((req, res, next) => {
  EFI_TOKEN = cleanToken(EFI_TOKEN);
  if (!EFI_TOKEN) return res.status(500).json({ error: "Token Efí Bank não definido" });
  next();
});

// Middleware de validação simples
const validateBody = (requiredFields) => (req, res, next) => {
  const missing = requiredFields.filter(f => !req.body[f]);
  if (missing.length > 0) return res.status(400).json({ error: `Campos obrigatórios faltando: ${missing.join(', ')}` });
  next();
};

// --- Criar cobrança PIX ---
app.post('/vip/purchase', validateBody(['userId', 'plan']), async (req, res) => {
  const { userId, plan } = req.body;

  try {
    const response = await axios.post(
      'https://sandbox.efiapi.com.br/v1/pix/charge', // substitua pelo endpoint produção quando estiver pronto
      {
        value: req.body.value || 20.0,
        description: `Plano VIP ${plan}`,
        customer: {
          name: req.body.name || "Cliente VIP",
          email: req.body.email || "cliente@email.com"
        },
        expiration: 3600 // 1 hora
      },
      { headers: { Authorization: `Bearer ${EFI_TOKEN}` } }
    );

    res.json({
      chargeId: response.data.chargeId,
      qrCode: response.data.qrCode, // base64 do QR
      pixCode: response.data.pixKey // código Pix para copiar e colar
    });
  } catch (err) {
    console.error("Erro completo:", err.response?.data || err.message || err);
    res.status(500).json({ error: err.response?.data || err.message || "Erro ao criar cobrança" });
  }
});

// --- Confirmar pagamento ---
app.get('/vip/confirm/:chargeId', async (req, res) => {
  const { chargeId } = req.params;
  if (!chargeId) return res.status(400).json({ error: "ID da cobrança é obrigatório" });

  try {
    const response = await axios.get(
      `https://sandbox.efiapi.com.br/v1/pix/charge/${chargeId}`,
      { headers: { Authorization: `Bearer ${EFI_TOKEN}` } }
    );

    res.json({ success: response.data.status === "PAID", status: response.data.status });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

// --- Erro global ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor' });
});

// Porta
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
