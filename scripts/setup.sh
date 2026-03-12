#!/usr/bin/env bash
# ============================================================
#  VendBot — Setup inicial
# ============================================================
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        VendBot — Setup Inicial       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Verifica dependências
command -v docker  >/dev/null 2>&1 || { echo "❌ Docker não instalado."; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "❌ Node.js não instalado."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 não instalado."; exit 1; }

# Copia .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ .env criado — preencha as variáveis antes de continuar."
  echo "   Edite o arquivo .env agora e rode o script novamente."
  exit 0
fi

echo "1️⃣  Subindo banco de dados e Redis..."
docker compose up -d postgres redis
sleep 5

echo "2️⃣  Instalando dependências da API..."
cd apps/api && pip install -r requirements.txt --break-system-packages -q
cd ../..

echo "3️⃣  Executando migrations..."
cd apps/api && alembic upgrade head 2>/dev/null || python3 -c "
import asyncio
import sys
sys.path.insert(0, '.')
from database import engine, Base
from packages.database.models import *
async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('✅ Tabelas criadas.')
asyncio.run(main())
"
cd ../..

echo "4️⃣  Instalando dependências do bot..."
cd apps/bot && npm install -q
cd ../..

echo "5️⃣  Instalando dependências do painel..."
cd apps/panel && npm install -q
cd ../..

echo ""
echo "╔══════════════════════════════════════╗"
echo "║           Setup concluído! 🎉        ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "  Para iniciar em desenvolvimento:"
echo "    API:    cd apps/api && uvicorn main:app --reload"
echo "    Bot:    cd apps/bot && npm run dev"
echo "    Painel: cd apps/panel && npm run dev"
echo ""
echo "  Ou com Docker (tudo junto):"
echo "    docker compose up"
echo ""
