#!/bin/bash

# Script para ejecutar la migración de playerIds en goles
# Uso: ./scripts/run-fix-goal-ids.sh

echo "🚀 Ejecutando migración de playerIds..."
echo ""

# Ejecutar con tsx
npx tsx scripts/fix-goal-player-ids.ts

echo ""
echo "✅ Script completado!"
