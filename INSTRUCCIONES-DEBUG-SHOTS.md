# 🔍 Instrucciones para Debuggear el Problema de shotsLog

## ✅ Preparación

1. **Cierra TODOS los navegadores**
   - Es crítico: Chrome, Firefox, Safari, todo
   - Los tabs múltiples pueden causar race conditions

2. **Inicia el servidor limpio**
   ```bash
   npm run dev
   ```

3. **Abre SOLO UN TAB** en el navegador
   - Ve a `http://localhost:3000/controls` (con el control de voz)

4. **Abre la consola del navegador** (F12 o Cmd+Option+I)
   - Ve a la pestaña "Console"

## 🎯 Prueba

1. **Activa el control de voz** (botón del micrófono)

2. **Di un tiro por voz**, por ejemplo:
   ```
   "Tiro de Hazard jugador 26"
   ```

3. **Observa la consola** - deberías ver EXACTAMENTE estos logs en orden:
   ```
   [DEBUG] 🎯 About to dispatch ADD_PLAYER_SHOT: { team: 'home', playerNumber: '26' }
   [DEBUG] 🎯 Dispatch completed
   [DEBUG] 🎯 Reducer: ADD_PLAYER_SHOT received
   [DEBUG] 🎯 Reducer: New shotsLog counts: { home: 1, away: 0, addedShot: {...} }
   [DEBUG] 🎯 Live state changed, persisting to server... { homeShots: 1, awayShots: 0 }
   [DEBUG] 🎯 Current shotsLog after dispatch: { home: 1, away: 0 }
   ```

4. **Espera 2 segundos**

5. **Verifica el archivo** (en otra terminal sin cerrar el servidor):
   ```bash
   cat tmp/new-storage/data/live.json | grep -A 5 '"shotsLog"'
   ```

## 📊 Resultados Esperados

### ✅ Si funciona correctamente:
- Deberías ver TODOS los logs en orden
- El archivo `live.json` debería tener el tiro en `shotsLog.home`
- Ejemplo:
  ```json
  "shotsLog": {
    "home": [
      {
        "id": "...",
        "team": "home",
        "playerNumber": "26",
        "periodText": "1ST",
        ...
      }
    ],
    "away": []
  }
  ```

### ❌ Si NO funciona:

#### Caso 1: No aparece `[DEBUG] 🎯 About to dispatch`
- **Problema**: El evento no se detectó correctamente
- **Causa**: El parsing de voz falló o el evento no tiene team/playerNumber

#### Caso 2: Aparece `About to dispatch` pero NO `Reducer received`
- **Problema**: El dispatch no llegó al reducer
- **Causa**: El contexto de GameState no está disponible o hay error en el middleware

#### Caso 3: Aparece `Reducer received` pero `shotsLog counts` es `{ home: 0, away: 0 }`
- **Problema**: El reducer no está agregando correctamente al array
- **Causa**: Bug en la lógica del reducer (muy improbable)

#### Caso 4: Todos los logs aparecen PERO el archivo queda vacío
- **Problema**: La persistencia no funciona
- **Posibles causas**:
  - `updateGameStateOnServer()` falla silenciosamente
  - El archivo se sobrescribe después por otro evento
  - Permisos de escritura del archivo

## 🐛 Si el Archivo Queda Vacío

Si ves todos los logs correctos pero el archivo queda vacío, prueba esto:

1. **Verifica permisos del archivo**:
   ```bash
   ls -la tmp/new-storage/data/live.json
   ```

2. **Monitorea cambios en tiempo real** (en otra terminal):
   ```bash
   watch -n 0.5 "cat tmp/new-storage/data/live.json | grep -A 2 'shotsLog' | head -5"
   ```
   Luego di el tiro y observa si cambia y luego se sobrescribe

3. **Verifica si hay múltiples procesos** escribiendo:
   ```bash
   lsof | grep live.json
   ```

## 📝 Qué Reportarme

Por favor copia y pega:

1. **Todos los logs de la consola** (los que empiezan con `[DEBUG] 🎯`)
2. **El contenido actual de shotsLog**:
   ```bash
   cat tmp/new-storage/data/live.json | grep -A 10 '"shotsLog"'
   ```
3. **¿Cuántos tabs tenías abiertos?**
4. **¿Recargaste la página después de agregar el tiro?**

Con esta información podré identificar exactamente dónde falla el proceso.

---

**IMPORTANTE**: No recargues la página ni abras más tabs hasta que terminemos el debug.
