# VendBot 🛒

> Plataforma SaaS de bot de vendas para Discord. Pix, Mercado Pago, Stripe, entrega automática e painel visual em tempo real.

---

## 🚀 Deploy Rápido (Docker)

### 1. Configure o `.env`
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### 2. Variáveis obrigatórias no `.env`
```env
SECRET_KEY=umaChaveLongaSemCaracteresEspeciais123
DISCORD_TOKEN=seu_bot_token
DISCORD_CLIENT_ID=seu_client_id
DISCORD_CLIENT_SECRET=seu_client_secret
DISCORD_REDIRECT_URI=http://localhost:8000/auth/discord/callback
MP_ACCESS_TOKEN=seu_token_mercadopago
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
API_INTERNAL_SECRET=qualquerTextoSecreto123
```

### 3. Suba os containers
```bash
docker compose up --build
```

### 4. Acesse
- **Painel:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs
- **API Health:** http://localhost:8000/health

---

## 📁 Estrutura
```
vendbot/
├── apps/
│   ├── api/        # FastAPI (Python 3.12)
│   ├── bot/        # Discord.js v14 (Node 20)
│   └── panel/      # Next.js 14 + Tailwind
├── packages/
│   └── database/   # Models SQLAlchemy
├── docker-compose.yml
└── .env.example
```

## 🔧 Stack
- **API:** FastAPI + SQLAlchemy async + PostgreSQL + Redis + Celery
- **Bot:** discord.js v14 + Express (servidor interno)
- **Painel:** Next.js 14 + Tailwind CSS + Recharts
- **Infra:** Docker Compose (dev) → Railway/AWS ECS (prod)

## 💳 Gateways Suportados
| Gateway      | Planos       | Métodos          |
|--------------|--------------|------------------|
| Pix Manual   | Todos        | Pix EMV          |
| Mercado Pago | Standard+    | Pix, Cartão      |
| Stripe       | Premium+     | Cartão intl.     |

## 📦 Planos
| Plano      | Preço/mês | Taxa    | Produtos |
|------------|-----------|---------|----------|
| Simples    | Grátis    | 7%      | 5        |
| Standard   | R$29,90   | 4%      | 30       |
| Premium    | R$79,90   | 2%      | Ilimitado|
| Enterprise | R$199,90  | 1%      | Ilimitado|

## 🔐 Segurança
- JWT RS256 com expiração de 7 dias
- Credenciais de gateway criptografadas com Fernet (AES-128)
- Rate limiting por IP via Redis
- Validação HMAC nos webhooks do Mercado Pago
- Segredo interno para comunicação API ↔ Bot
