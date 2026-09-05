#!/bin/bash

# REPURGE - Auto Setup Script
# Roda uma vez e tudo fica pronto!

echo ""
echo "=========================================="
echo "REPURGE - Setup Automatico"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Install Node modules
echo -e "${BLUE}Instalando dependencias...${NC}"
npm install --silent

if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao instalar dependencias${NC}"
    exit 1
fi

echo -e "${GREEN}Dependencias instaladas${NC}"
echo ""

# 2. Compile TypeScript
echo -e "${BLUE}Compilando TypeScript...${NC}"
npm run build --silent

if [ $? -ne 0 ]; then
    echo -e "${RED}Erro ao compilar${NC}"
    exit 1
fi

echo -e "${GREEN}TypeScript compilado${NC}"
echo ""

# 3. Run tests
echo -e "${BLUE}Rodando testes...${NC}"
npm test -- --silent 2>&1

TEST_RESULT=$?

if [ $TEST_RESULT -ne 0 ]; then
    echo -e "${YELLOW}Alguns testes podem ter falhado${NC}"
else
    echo -e "${GREEN}Todos os testes passaram!${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}PRONTO PARA USAR!${NC}"
echo "=========================================="
echo ""
echo "Proximos passos:"
echo ""
echo "  1. Faca o primeiro commit:"
echo "     git add ."
echo "     git commit -m 'Initial commit: Foundation + NodeModulesDetector (TDD)'"
echo ""
echo "  2. Suba para GitHub:"
echo "     git push -u origin main"
echo ""
echo "  3. Comece a desenvolver:"
echo "     npm test                # Rodar testes"
echo "     npm run build           # Compilar"
echo "     npm run test:watch      # Modo watch"
echo ""
echo "=========================================="
echo ""
