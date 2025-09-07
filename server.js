require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// --- EFI Bank Config ---
const CLIENT_ID = process.env.EFI_CLIENT_ID;
const CLIENT_SECRET = process.env.EFI_CLIENT_SECRET;
const USE_SANDBOX = process.env.USE_SANDBOX === 'true'; // true = sandbox, false = produção

const EFI_BASE_URL = USE_SANDBOX
  ? 'https://sandbox.efiapi.com.br'
  : 'https://api.efiapi.com.br';

// Token storage
let EFI_TOKEN = null;
let TOKEN_EXPIRE = 0;

// --- Função para gerar token automaticamente ---
async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  if (EFI_TOKEN && now < TOKEN_EXPIRE - 30) return EFI_TOKEN;

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const response = await axios.post(
    `${EFI_BASE_URL}/oauth/token`,
    new URLSearchParams({ grant_type: 'client_credentials' }),
    { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  EFI_TOKEN = response.data.access_token;
  TOKEN_EXPIRE = now + response.data.expires_in;
  console.log('Token gerado com sucesso.');
  return EFI_TOKEN;
}

// --- Middleware de validação ---
const validateBody = (requiredFields) => (req, res, next) => {
  const missing = requiredFields.filter(f => !req.body[f]);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Campos obrigatórios faltando: ${missing.join(', ')}` });
  }
  next();
};

// --- Criar cobrança Pix ---
app.post('/vip/purchase', validateBody(['userId', 'plan']), async (req, res) => {
  try {
    const token = await getToken();
    const { userId, plan, value = 20.0, name = "Cliente VIP", email = "cliente@email.com" } = req.body;

    const response = await axios.post(
      `${EFI_BASE_URL}/v1/pix/charge`,
      {
        value,
        description: `Plano VIP ${plan}`,
        customer: { name, email },
        expiration: 3600
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Retorno padronizado para o Flutter
    res.json({
      chargeId: response.data.chargeId,
      qrCode: response.data.qrCode,
      pixCode: response.data.pixKey || response.data.pixCode || response.data.payload
    });

  } catch (err) {
    console.error("Erro ao criar cobrança:", err.response?.data || err.message || err);
    res.status(500).json({ error: err.response?.data || "Erro ao criar cobrança" });
  }
});

// --- Confirmar pagamento ---
app.get('/vip/confirm/:chargeId', async (req, res) => {
  const { chargeId } = req.params;
  if (!chargeId) return res.status(400).json({ error: "ID da cobrança é obrigatório" });

  try {
    const token = await getToken();
    const response = await axios.get(
      `${EFI_BASE_URL}/v1/pix/charge/${chargeId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const status = response.data.status;
    res.json({ success: status === "PAID" || status === "COMPLETED", status });

  } catch (err) {
    console.error("Erro ao verificar pagamento:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

// --- Erro global ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor' });
});

// --- Porta ---
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
