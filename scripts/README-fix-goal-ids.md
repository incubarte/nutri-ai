# Script de Migración: Fix Goal Player IDs

## Descripción

Este script corrige los summaries de partidos existentes agregando el `playerId` a los goles, asistencias y segundas asistencias.

**Problema que resuelve:** Anteriormente, los goles solo guardaban el número de casaca del jugador (`playerNumber`), lo que causaba problemas cuando un jugador cambiaba de número entre partidos. Ahora se guarda también el ID único del jugador (`playerId`).

## ¿Qué hace el script?

1. Lee todos los torneos desde `tournaments.json`
2. Para cada torneo:
   - Lee todos los partidos
   - Para cada partido con summary:
     - Lee el summary.json
     - Para cada gol (home y away):
       - Si el gol NO tiene `playerId` pero SÍ tiene `playerName`:
         - Busca el jugador en los equipos del torneo por nombre
         - Agrega el `playerId` correspondiente
     - Guarda el summary actualizado
3. Muestra un resumen de la migración

## Uso

Hay tres formas de ejecutar el script:

### Opción 1: Con npm (recomendado)
```bash
npm run fix:goal-ids
```

### Opción 2: Con el script shell
```bash
./scripts/run-fix-goal-ids.sh
```

### Opción 3: Directamente con tsx
```bash
npx tsx scripts/fix-goal-player-ids.ts
```

## Salida del script

El script mostrará:
- 🏆 Cada torneo procesado
- 📄 Cada partido procesado
- ✅ Jugadores encontrados y corregidos
- ❌ Jugadores no encontrados (posibles problemas)
- ⚠️ Advertencias (ej: jugador encontrado en equipo diferente)
- 📊 Resumen final con estadísticas

### Ejemplo de salida:
```
🔧 Iniciando migración de playerIds en goles...

📁 Data directory: /path/to/storage/data

📋 Cargados 2 torneos

🏆 Procesando torneo: ACEMHH 2024 (8a422a4c-1953-4abd-acae-bf5cd358ef9c)

  📄 Partido: c348664e-45b8-4ffd-9d92-29149eb26a81 vs 601d9fd3-4641-4e47-97df-b643f60eb178
    ✅ Scorer: RODRIGUEZ JUAN -> player-id-123
    ✅ Assist: GOMEZ PEDRO -> player-id-456
  ✨ Actualizado: 2 goles corregidos

==================================================
📊 Resumen de la migración:
  - Summaries procesados: 15
  - Summaries actualizados: 8
  - Goles corregidos: 24
==================================================

✅ Migración completada!
```

## Notas importantes

- ✅ El script es **seguro** - solo actualiza summaries que necesitan corrección
- ✅ **No modifica** goles que ya tienen `playerId`
- ✅ Busca jugadores por **nombre** en los equipos del torneo
- ⚠️ Si un jugador no se encuentra, mostrará un error pero continuará con los demás
- ⚠️ Si un jugador cambió de equipo, el script puede encontrarlo en otro equipo (muestra advertencia)

## ¿Cuándo ejecutar este script?

- **Una sola vez** después de implementar el sistema de `playerId`
- Para corregir datos históricos de partidos anteriores
- Si importas datos de summaries antiguos

## Compatibilidad

- Los goles que ya tienen `playerId` no se modifican
- Los goles sin `playerName` no se pueden corregir (se necesita el nombre para buscar)
- El sistema funciona con y sin `playerId` (compatibilidad hacia atrás)

## Backup

**Importante:** Antes de ejecutar el script en producción, se recomienda hacer un backup de la carpeta `storage/data`:

```bash
cp -r storage/data storage/data-backup-$(date +%Y%m%d)
```

## Troubleshooting

### Problema: "No se encontró: NOMBRE_JUGADOR"
**Solución:** El jugador no existe en los equipos del torneo con ese nombre exacto. Verifica:
- El nombre está escrito exactamente igual en el roster del equipo
- El jugador está en el equipo correcto del torneo
- No hay espacios extra o caracteres especiales

### Problema: Script no encuentra summaries
**Solución:** Verifica que la variable de entorno `STORAGE_PATH` esté configurada correctamente, o que exista la carpeta `storage/data` en la raíz del proyecto.
