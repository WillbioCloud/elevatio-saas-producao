#!/bin/bash

# Script para copiar assets da Landing Page para o CRM
# Execute: bash scripts/copy-landing-assets.sh

LANDING_PATH="C:/Users/willbio/Desktop/Landing Page do meu Plano Site+CRM"
CRM_PATH="."

echo "🚀 Copiando assets da Landing Page..."

# Copiar imagens
if [ -d "$LANDING_PATH/public" ]; then
  echo "📁 Copiando pasta public/..."
  cp -r "$LANDING_PATH/public/"* "$CRM_PATH/public/" 2>/dev/null || echo "⚠️  Alguns arquivos podem já existir"
  echo "✅ Assets copiados!"
else
  echo "❌ Pasta public/ não encontrada em: $LANDING_PATH"
fi

echo ""
echo "📋 Próximos passos:"
echo "1. Copie o conteúdo de Home.tsx para src/pages/website/SiteHome.tsx"
echo "2. Copie o conteúdo de Login.tsx para src/pages/website/SiteSignup.tsx"
echo "3. Siga as instruções em INTEGRACAO_LANDING_PAGE.md"
echo ""
echo "✨ Pronto!"
