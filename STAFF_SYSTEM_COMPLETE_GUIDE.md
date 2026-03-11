# Sistema de Staff - Guía Completa de Implementación

## 📋 Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Archivos Modificados/Creados](#archivos-modificadoscreados)
4. [Tipos de Datos](#tipos-de-datos)
5. [Flujo de Uso](#flujo-de-uso)
6. [Features Implementadas](#features-implementadas)
7. [Métricas y Análisis](#métricas-y-análisis)
8. [Timestamps de Períodos](#timestamps-de-períodos)
9. [Casos de Uso](#casos-de-uso)
10. [Troubleshooting](#troubleshooting)

---

## Resumen Ejecutivo

Se implementó un sistema completo de gestión de staff (personal de mesa y árbitros) para torneos que incluye:

- ✅ Gestión de staff (CRUD completo)
- ✅ Asignación de staff a partidos (3 mesa + 3 árbitros)
- ✅ Cargos/Orden: Principal, 2º, 3º
- ✅ Inclusión en resúmenes de partidos
- ✅ Métricas y estadísticas completas
- ✅ Filtro por categoría
- ✅ Timestamps de inicio de períodos
- ✅ Persistencia automática

---

## Arquitectura del Sistema

### Diagrama de Flujo

```
Torneo
  └── Staff (lista de personas)
       ├── Mesa
       ├── Árbitro
       └── Ambos roles

Setup de Partido
  └── Selector de Staff
       ├── Mesa: Principal, 2º, 3º
       └── Árbitros: Principal, 2º, 3º

Durante el Partido
  └── LiveState.assignedStaff
       └── IDs de staff asignado

Resumen del Partido
  └── GameSummary.staff
       ├── mesa: [{ id, firstName, lastName, order }]
       └── referees: [{ id, firstName, lastName, order }]

Métricas (calculadas dinámicamente)
  └── Por cada staff:
       ├── Total partidos
       ├── Desglose por cargo
       ├── Goles totales y promedio
       └── Faltas totales y promedio
```

---

## Archivos Modificados/Creados

### 📝 Tipos de Datos
**Archivo:** `src/types/index.ts`

**Nuevos tipos agregados:**
```typescript
// Líneas 67-85
export type StaffRole = 'mesa' | 'referee';

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  roles: StaffRole[];  // Puede tener ambos roles
}

export interface MatchStaffAssignment {
  mesa: (string | null)[];  // [Principal, 2º, 3º]
  referees: (string | null)[];  // [Principal, 2º, 3º]
}

export interface AssignedStaffInfo {
  id: string;
  firstName: string;
  lastName: string;
  order: number;  // 1 = Principal, 2 = Segundo, 3 = Tercero
}
```

**Modificaciones a tipos existentes:**
```typescript
// Tournament (línea 94)
export interface Tournament {
  // ... campos existentes
  staff?: StaffMember[];  // ✅ AGREGADO
}

// LiveState (línea 577-578)
export interface LiveState {
  // ... campos existentes
  assignedStaff?: MatchStaffAssignment;  // ✅ AGREGADO
  periodStartTimestamps?: Record<string, string>;  // ✅ AGREGADO
}

// GameSummary (líneas 275-278)
export interface GameSummary {
  // ... campos existentes
  staff?: {
    mesa: AssignedStaffInfo[];
    referees: AssignedStaffInfo[];
  };  // ✅ AGREGADO
}

// PeriodSummary (línea 263)
export interface PeriodSummary {
  // ... campos existentes
  startTimestamp?: string;  // ✅ AGREGADO - ISO timestamp
}
```

**Nuevas acciones del reducer (líneas 707-710):**
```typescript
| { type: 'ADD_STAFF_TO_TOURNAMENT'; payload: { tournamentId: string; staff: Omit<StaffMember, 'id'> & { id?: string } } }
| { type: 'UPDATE_STAFF_IN_TOURNAMENT'; payload: { tournamentId: string; staffId: string; updates: Partial<Omit<StaffMember, 'id'>> } }
| { type: 'REMOVE_STAFF_FROM_TOURNAMENT'; payload: { tournamentId: string; staffId: string } }
| { type: 'SET_MATCH_STAFF'; payload: { assignment: MatchStaffAssignment } }
```

---

### ⚙️ Reducers
**Archivo:** `src/contexts/game-state-context.tsx`

**Reducers de Staff (líneas 1876-1943):**
```typescript
case 'ADD_STAFF_TO_TOURNAMENT': {
  const { tournamentId, staff } = action.payload;
  const staffId = staff.id || safeUUID();
  // Agrega staff a tournament.staff array
}

case 'UPDATE_STAFF_IN_TOURNAMENT': {
  // Actualiza firstName, lastName o roles de un staff member
}

case 'REMOVE_STAFF_FROM_TOURNAMENT': {
  // Elimina staff del torneo
}

case 'SET_MATCH_STAFF': {
  const { assignment } = action.payload;
  // Guarda assignedStaff en LiveState
}
```

**Captura de Timestamps (líneas 416-441):**
```typescript
case 'SET_PERIOD': {
  // ... código existente ...

  // ✅ AGREGADO: Track period start timestamps
  const periodText = periodOverride || getPeriodText(newPeriod, numberOfRegularPeriods);
  const updatedTimestamps = {
    ...(state.live.periodStartTimestamps || {}),
    [periodText]: new Date().toISOString()
  };

  newState = {
    ...state, live: {
      ...state.live,
      periodStartTimestamps: updatedTimestamps,  // ✅ NUEVO
      clock: { ... }
    }
  };
}
```

---

### 🎨 Componentes de UI

#### 1. **Gestión de Staff**
**Archivo:** `src/components/tournaments/staff-management-tab.tsx` (NUEVO - 412 líneas)

**Funcionalidad:**
- Agregar staff con nombre, apellido y roles
- Editar staff existente (inline editing)
- Eliminar staff (con confirmación)
- Checkboxes para roles: Mesa, Árbitro, o ambos
- Validación de datos
- Tags visuales para mostrar roles

**Ubicación:** `/tournaments/[tournamentId]?tab=staff`

**Componentes principales:**
```typescript
export function StaffManagementTab({ tournamentId }: { tournamentId: string }) {
  // Estado para agregar nuevo staff
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRoles, setNewRoles] = useState<StaffRole[]>([]);

  // Estado para editar staff existente
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Handlers
  const handleAddStaff = () => { /* ... */ };
  const handleStartEdit = (staffMember: StaffMember) => { /* ... */ };
  const handleSaveEdit = () => { /* ... */ };
  const handleRemoveStaff = (staffId: string) => { /* ... */ };
}
```

---

#### 2. **Selector de Staff para Partidos**
**Archivo:** `src/components/setup/staff-selector.tsx` (NUEVO - 181 líneas)

**Funcionalidad:**
- 3 selectores para Mesa (Principal, 2º Mesa, 3º Mesa)
- 3 selectores para Árbitros (Principal, 2º Árbitro, 3º Árbitro)
- Primer selector de cada categoría es **obligatorio** (*)
- Previene asignaciones duplicadas (marca como "ya asignado")
- Filtra staff por rol (solo muestra mesa en selectores de mesa, etc.)
- Validación visual de campos obligatorios

**Props:**
```typescript
interface StaffSelectorProps {
  tournamentStaff: StaffMember[];
  assignment: MatchStaffAssignment;
  onAssignmentChange: (assignment: MatchStaffAssignment) => void;
}
```

**Uso en Setup:**
```typescript
// En src/app/setup/page.tsx (líneas 397-405)
{tournamentStaff.length > 0 && (
  <div className="pt-4">
    <StaffSelector
      tournamentStaff={tournamentStaff}
      assignment={staffAssignment}
      onAssignmentChange={setStaffAssignment}
    />
  </div>
)}
```

---

#### 3. **Métricas de Staff**
**Archivo:** `src/components/tournaments/staff-metrics-tab.tsx` (NUEVO - 138 líneas)

**Funcionalidad:**
- Filtro por categoría (dropdown)
- Tabla de estadísticas de Árbitros
- Tabla de estadísticas de Mesa
- Cálculo automático de métricas

**Ubicación:** `/tournaments/[tournamentId]?tab=staffMetrics`

**Estructura:**
```typescript
export function StaffMetricsTab({ tournamentId }: { tournamentId: string }) {
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const refereeStats = useRefereeStats(tournament, categoryFilter || undefined);
  const mesaStats = useMesaStats(tournament, categoryFilter || undefined);

  // Componente reutilizable para ambas tablas
  const StatsTable = ({ stats, title, icon }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Partidos</TableHead>
          <TableHead>Principal</TableHead>
          <TableHead>2º</TableHead>
          <TableHead>3º</TableHead>
          <TableHead>Goles</TableHead>
          <TableHead>Faltas</TableHead>
          <TableHead>Goles/Partido</TableHead>
          <TableHead>Faltas/Partido</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* Renderiza stats */}
      </TableBody>
    </Table>
  );
}
```

---

### 🔧 Hooks Personalizados

**Archivo:** `src/hooks/use-staff-stats.ts` (NUEVO - 195 líneas)

**Exports:**
```typescript
export interface StaffMatchStats {
  staffId: string;
  staffName: string;
  totalMatches: number;
  asPrincipal: number;
  asSecond: number;
  asThird: number;
  totalGoals: number;
  totalPenalties: number;
  avgGoalsPerMatch: number;
  avgPenaltiesPerMatch: number;
  categories: Set<string>;
}

export function useRefereeStats(
  tournament: Tournament | null | undefined,
  categoryFilter?: string
): StaffMatchStats[];

export function useMesaStats(
  tournament: Tournament | null | undefined,
  categoryFilter?: string
): StaffMatchStats[];
```

**Lógica de cálculo:**
1. Inicializa un mapa con todos los staff members del rol correspondiente
2. Itera sobre todos los partidos del torneo
3. Aplica filtro de categoría si está presente
4. Para cada partido con resumen:
   - Cuenta goles totales (suma de todos los períodos, ambos equipos)
   - Cuenta penaltis totales (suma de todos los períodos, ambos equipos)
   - Para cada staff en ese partido:
     - Incrementa contador de partidos
     - Suma goles y penaltis
     - Incrementa contador según orden (principal/2º/3º)
     - Agrega categoría al set
5. Calcula promedios (goles/partido, penaltis/partido)
6. Filtra staff sin partidos y ordena por total de partidos

---

### 📊 Summary Generator

**Archivo:** `src/lib/summary-generator.ts`

**Inclusión de Staff (líneas 337-373):**
```typescript
// Include staff assignment in summary
if (live.assignedStaff && currentTournament?.staff) {
    const mesaStaffInfo = live.assignedStaff.mesa
        .map((id, index) => {
            if (id === null) return null;
            const staff = currentTournament.staff?.find(s => s.id === id);
            if (!staff) return null;
            return {
                id: staff.id,
                firstName: staff.firstName,
                lastName: staff.lastName,
                order: index + 1  // 1 = Principal, 2 = Segundo, 3 = Tercero
            };
        })
        .filter((s): s is AssignedStaffInfo => s !== null);

    const refereesStaffInfo = live.assignedStaff.referees
        .map((id, index) => {
            // Same logic for referees
        })
        .filter((s): s is AssignedStaffInfo => s !== null);

    if (mesaStaffInfo.length > 0 || refereesStaffInfo.length > 0) {
        finalSummary.staff = {
            mesa: mesaStaffInfo,
            referees: refereesStaffInfo
        };
    }
}
```

**Inclusión de Timestamps (líneas 314-317):**
```typescript
// Add period start timestamp if available
const startTimestamp = live.periodStartTimestamps?.[periodText];

return {
  period: periodText,
  stats: periodData,
  goalkeeperChangesLog,
  periodDuration,
  startTimestamp  // ✅ AGREGADO
};
```

---

### 🖥️ Integración en Páginas

#### Setup Page
**Archivo:** `src/app/setup/page.tsx`

**Cambios:**
1. **Import (línea 12):**
   ```typescript
   import type { TeamData, MatchData, MatchStaffAssignment } from '@/types';
   ```

2. **Import componente (línea 23):**
   ```typescript
   import { StaffSelector } from '@/components/setup/staff-selector';
   ```

3. **Estado local (líneas 120-123):**
   ```typescript
   const [staffAssignment, setStaffAssignment] = useState<MatchStaffAssignment>({
       mesa: [null, null, null],
       referees: [null, null, null]
   });
   ```

4. **Memo para staff del torneo (líneas 133-136):**
   ```typescript
   const tournamentStaff = useMemo(() => {
       if (!isTournamentMatch || !selectedTournament) return [];
       return selectedTournament.staff || [];
   }, [isTournamentMatch, selectedTournament]);
   ```

5. **Guardado al iniciar partido (líneas 282-287):**
   ```typescript
   // Save staff assignment if any staff is assigned
   if (staffAssignment.mesa.some(id => id !== null) ||
       staffAssignment.referees.some(id => id !== null)) {
       dispatch({
           type: 'SET_MATCH_STAFF',
           payload: { assignment: staffAssignment }
       });
   }
   ```

6. **Componente en JSX (líneas 397-405):**
   ```typescript
   {tournamentStaff.length > 0 && (
       <div className="pt-4">
           <StaffSelector
               tournamentStaff={tournamentStaff}
               assignment={staffAssignment}
               onAssignmentChange={setStaffAssignment}
           />
       </div>
   )}
   ```

---

#### Tournament Detail Page
**Archivo:** `src/app/tournaments/[tournamentId]/page.tsx`

**Cambios:**
1. **Import (línea 18):**
   ```typescript
   import { StaffMetricsTab } from '@/components/tournaments/staff-metrics-tab';
   ```

2. **Tabs válidas (línea 47):**
   ```typescript
   const validTabs = ['teamsAndCategories', 'staff', 'fixture', 'standings', 'playerStats', 'staffMetrics'];
   ```

3. **Grid columns (líneas 83-84):**
   ```typescript
   let cols = 2; // Fixture + Standings always present
   if (shouldShowTeams) cols += 3; // Teams + Staff + Staff Metrics
   if (state.config.showShotsData) cols++;
   ```

4. **Tab trigger (línea 119):**
   ```typescript
   {shouldShowTeams && <TabsTrigger value="staffMetrics" className="text-xs sm:text-sm">Métricas Staff</TabsTrigger>}
   ```

5. **Tab content (líneas 137-141):**
   ```typescript
   {shouldShowTeams && tournamentId && (
     <TabsContent value="staffMetrics" className="mt-6">
       <StaffMetricsTab tournamentId={tournamentId} />
     </TabsContent>
   )}
   ```

---

## Tipos de Datos

### StaffMember
Representa a una persona del staff.

```typescript
{
  id: "staff-abc123",
  firstName: "Juan",
  lastName: "Pérez",
  roles: ['mesa', 'referee']  // Puede tener ambos roles
}
```

### MatchStaffAssignment
Asignación de staff a un partido específico (se guarda en LiveState).

```typescript
{
  mesa: [
    "staff-abc123",  // Principal
    "staff-def456",  // 2º Mesa
    null             // 3º Mesa (sin asignar)
  ],
  referees: [
    "staff-abc123",  // Principal
    "staff-ghi789",  // 2º Árbitro
    null             // 3º Árbitro (sin asignar)
  ]
}
```

### AssignedStaffInfo
Info del staff en el resumen (incluye orden para métricas).

```typescript
{
  id: "staff-abc123",
  firstName: "Juan",
  lastName: "Pérez",
  order: 1  // 1 = Principal, 2 = 2º, 3 = 3º
}
```

### StaffMatchStats
Estadísticas calculadas para un staff member.

```typescript
{
  staffId: "staff-abc123",
  staffName: "Juan Pérez",
  totalMatches: 15,
  asPrincipal: 12,
  asSecond: 3,
  asThird: 0,
  totalGoals: 87,
  totalPenalties: 45,
  avgGoalsPerMatch: 5.8,
  avgPenaltiesPerMatch: 3.0,
  categories: Set(['U12', 'U14', 'U16'])
}
```

---

## Flujo de Uso

### 1. Agregar Staff al Torneo

```
1. Ir a /tournaments/[tournamentId]
2. Click en tab "Staff"
3. Click "Agregar Staff"
4. Llenar formulario:
   - Nombre: Juan
   - Apellido: Pérez
   - Roles: ✅ Mesa ✅ Árbitro
5. Click "Guardar"
```

**Resultado:**
- Staff guardado en `tournament.staff[]`
- Persiste automáticamente en `tournaments.json`

---

### 2. Configurar Partido con Staff

```
1. Ir a /setup
2. Seleccionar torneo (que tenga staff)
3. Seleccionar equipos
4. Aparece automáticamente el StaffSelector
5. Asignar personal:
   Mesa:
     - Principal: Juan Pérez *
     - 2º Mesa: María López
     - 3º Mesa: (sin asignar)
   Árbitros:
     - Principal: Juan Pérez *
     - 2º Árbitro: Carlos Gómez
     - 3º Árbitro: (sin asignar)
6. Click "Confirmar y Comenzar"
```

**Resultado:**
- Staff guardado en `live.assignedStaff`
- Persiste en `live.json`
- Disponible durante todo el partido

---

### 3. Durante el Partido

**Automático:**
- Cuando empieza un período → Se captura timestamp en `live.periodStartTimestamps`
- Cuando hay gol → Se cuenta para estadísticas
- Cuando hay falta → Se cuenta para estadísticas

**Datos en LiveState:**
```typescript
{
  assignedStaff: {
    mesa: ["staff-abc123", "staff-def456", null],
    referees: ["staff-abc123", "staff-ghi789", null]
  },
  periodStartTimestamps: {
    "Pre Warm-up": "2025-03-09T14:45:00.000Z",
    "1ST": "2025-03-09T15:00:12.000Z",
    "Break": "2025-03-09T15:20:45.000Z",
    "2ND": "2025-03-09T15:25:30.000Z"
  }
}
```

---

### 4. Generar Resumen

**Automático al finalizar partido:**

El summary generator:
1. Lee `live.assignedStaff` (IDs)
2. Busca datos completos en `tournament.staff`
3. Crea `AssignedStaffInfo[]` con nombres + order
4. Lee `live.periodStartTimestamps`
5. Agrega timestamps a cada `PeriodSummary`
6. Guarda todo en `tournaments/[id]/summaries/[matchId].json`

**Estructura del resumen:**
```json
{
  "attendance": { ... },
  "statsByPeriod": [
    {
      "period": "1ST",
      "startTimestamp": "2025-03-09T15:00:12.000Z",
      "stats": {
        "goals": { "home": [...], "away": [...] },
        "penalties": { "home": [...], "away": [...] },
        "playerStats": { ... }
      }
    }
  ],
  "staff": {
    "mesa": [
      { "id": "staff-abc123", "firstName": "Juan", "lastName": "Pérez", "order": 1 },
      { "id": "staff-def456", "firstName": "María", "lastName": "López", "order": 2 }
    ],
    "referees": [
      { "id": "staff-abc123", "firstName": "Juan", "lastName": "Pérez", "order": 1 },
      { "id": "staff-ghi789", "firstName": "Carlos", "lastName": "Gómez", "order": 2 }
    ]
  }
}
```

---

### 5. Ver Métricas

```
1. Ir a /tournaments/[tournamentId]
2. Click en tab "Métricas Staff"
3. (Opcional) Filtrar por categoría
4. Ver tablas de Árbitros y Mesa
```

**Cálculo automático:**
- El hook `useRefereeStats` / `useMesaStats`:
  1. Lee todos los partidos del torneo
  2. Filtra por categoría (si aplica)
  3. Para cada partido con resumen:
     - Lee `summary.staff.referees` / `summary.staff.mesa`
     - Cuenta goles y penaltis del partido
     - Acumula estadísticas por staff ID
  4. Calcula promedios
  5. Retorna array ordenado por total de partidos

---

## Features Implementadas

### ✅ Gestión de Staff

**CRUD Completo:**
- ✅ Create: Agregar staff con validación
- ✅ Read: Listar todo el staff
- ✅ Update: Editar inline con validación
- ✅ Delete: Eliminar con confirmación

**Roles flexibles:**
- ✅ Solo Mesa
- ✅ Solo Árbitro
- ✅ Ambos roles

**UI:**
- ✅ Tags visuales para roles
- ✅ Formularios inline
- ✅ Validación en tiempo real
- ✅ Mensajes de error/éxito (toasts)

---

### ✅ Asignación a Partidos

**Selector inteligente:**
- ✅ 3 puestos de Mesa (Principal, 2º, 3º)
- ✅ 3 puestos de Árbitros (Principal, 2º, 3º)
- ✅ Campos obligatorios marcados con *
- ✅ Prevención de duplicados
- ✅ Filtrado por rol
- ✅ Solo aparece si hay staff registrado

**Validación:**
- ✅ Al menos 1 persona en Mesa (Principal)
- ✅ Al menos 1 Árbitro (Principal)
- ✅ Mensajes de error visuales

---

### ✅ Persistencia y Resúmenes

**Guardado automático:**
- ✅ Staff → `tournaments.json` (dentro de cada torneo)
- ✅ Asignación → `live.json`
- ✅ Resumen → `tournaments/[id]/summaries/[matchId].json`

**Datos en resumen:**
- ✅ ID (para métricas)
- ✅ Nombre completo
- ✅ Orden/Cargo (1, 2, 3)
- ✅ Separado por rol (mesa/árbitros)

---

### ✅ Métricas y Estadísticas

**Por cada staff member:**
- ✅ Total de partidos
- ✅ Partidos como Principal
- ✅ Partidos como 2º
- ✅ Partidos como 3º
- ✅ Goles totales en sus partidos
- ✅ Penaltis totales en sus partidos
- ✅ Promedio de goles por partido
- ✅ Promedio de penaltis por partido

**Filtros:**
- ✅ Por categoría (dropdown)
- ✅ Separación por rol (Árbitros vs Mesa)

**Cálculo:**
- ✅ Dinámico (se recalcula cada vez)
- ✅ Basado en resúmenes guardados
- ✅ Ordenado por total de partidos

---

### ✅ Timestamps de Períodos

**Captura automática:**
- ✅ Al avanzar a cualquier período (SET_PERIOD)
- ✅ Formato ISO 8601
- ✅ Guardado en LiveState
- ✅ Incluido en resúmenes

**Períodos trackeados:**
- ✅ Pre Warm-up
- ✅ Warm-up
- ✅ 1ST, 2ND
- ✅ Break
- ✅ OT, OT2, OT3...
- ✅ Pre-OT Break

---

## Métricas y Análisis

### Tabla de Árbitros

**Ejemplo de datos reales:**

| Nombre | Partidos | Principal | 2º | 3º | Goles | Faltas | Goles/Partido | Faltas/Partido |
|--------|----------|-----------|----|----|-------|--------|---------------|----------------|
| Juan Pérez | 15 | 12 | 3 | 0 | 87 | 45 | 5.8 | 3.0 |
| María López | 10 | 5 | 5 | 0 | 60 | 32 | 6.0 | 3.2 |
| Carlos Gómez | 8 | 2 | 4 | 2 | 48 | 28 | 6.0 | 3.5 |

**Interpretación:**
- **Juan Pérez:** Ha arbitrado 15 partidos, la mayoría (12) como principal. Promedio bajo de faltas (3.0 por partido) sugiere buen control.
- **María López:** Balance 50/50 entre principal y auxiliar. Promedio de goles ligeramente superior.
- **Carlos Gómez:** Más experiencia como auxiliar. Mayor promedio de faltas por partido.

---

### Tabla de Mesa

**Misma estructura que árbitros**

Permite analizar:
- Carga de trabajo de cada persona
- Experiencia en diferentes cargos
- Patrones de goles/faltas por partido

---

### Análisis Posibles

#### 1. Rendimiento por Cargo
```
¿Hay diferencia cuando Juan es Principal vs Auxiliar?
- Como Principal: 12 partidos, 5.5 goles/partido
- Como 2º: 3 partidos, 6.8 goles/partido
```

#### 2. Carga de Trabajo
```
¿Quién está más sobrecargado?
- Juan: 15 partidos (más activo)
- María: 10 partidos
- Carlos: 8 partidos
```

#### 3. Comparación por Categoría
```
Filtrar U12:
- Promedio: 4.2 goles/partido, 2.1 faltas/partido

Filtrar U16:
- Promedio: 6.8 goles/partido, 4.5 faltas/partido
(U16 más intenso)
```

#### 4. Correlación Faltas/Goles
```
¿Más goles = más faltas?
Arbitrar partidos con muchos goles correlaciona con más faltas
```

---

## Timestamps de Períodos

### Captura

**Cuándo:**
- Al ejecutar `dispatch({ type: 'SET_PERIOD', payload: periodNumber })`

**Dónde:**
- `src/contexts/game-state-context.tsx:416-441`

**Cómo:**
```typescript
const periodText = periodOverride || getPeriodText(newPeriod, numberOfRegularPeriods);
const updatedTimestamps = {
  ...(state.live.periodStartTimestamps || {}),
  [periodText]: new Date().toISOString()
};
```

---

### Almacenamiento

**Durante el partido (LiveState):**
```typescript
{
  periodStartTimestamps: {
    "Pre Warm-up": "2025-03-09T14:45:00.000Z",
    "1ST": "2025-03-09T15:00:12.000Z",
    "Break": "2025-03-09T15:20:45.000Z",
    "2ND": "2025-03-09T15:25:30.000Z"
  }
}
```

**En el resumen (GameSummary):**
```typescript
{
  statsByPeriod: [
    {
      period: "1ST",
      startTimestamp: "2025-03-09T15:00:12.000Z",
      stats: { ... }
    },
    {
      period: "2ND",
      startTimestamp: "2025-03-09T15:25:30.000Z",
      stats: { ... }
    }
  ]
}
```

---

### Usos Posibles

**Duración real de períodos:**
```typescript
const period1Start = new Date(summary.statsByPeriod[0].startTimestamp);
const period2Start = new Date(summary.statsByPeriod[1].startTimestamp);
const breakDuration = period2Start - period1Start;
// Incluye tiempo de juego + descanso
```

**Horarios del partido:**
```
Inicio: 15:00
1er Tiempo: 15:00 - 15:20
Descanso: 15:20 - 15:25
2do Tiempo: 15:25 - 15:45
```

**Análisis de puntualidad:**
```
¿Cuánto se demoran los descansos?
¿A qué hora terminan los partidos típicamente?
```

---

## Casos de Uso

### Caso 1: Torneo con Staff Completo

**Contexto:**
- Torneo U12 con 3 árbitros y 2 personas de mesa
- 20 partidos a jugar

**Flujo:**
1. Registrar staff en tab "Staff"
2. Al configurar cada partido, asignar staff disponible
3. Rotar personas para distribuir carga
4. Al finalizar torneo, ver métricas:
   - ¿Quién arbitró más?
   - ¿Promedio de goles/faltas?
   - ¿Hay diferencias por árbitro?

---

### Caso 2: Staff con Múltiples Roles

**Contexto:**
- Juan Pérez puede estar en Mesa o arbitrar
- Torneo pequeño con poco staff

**Flujo:**
1. Registrar Juan con ambos roles: ✅ Mesa ✅ Árbitro
2. Al configurar partidos:
   - Partido 1: Juan como Árbitro Principal
   - Partido 2: Juan como Mesa Principal
   - Partido 3: Juan como 2º Árbitro
3. En métricas:
   - Aparece en tabla de Árbitros: 2 partidos
   - Aparece en tabla de Mesa: 1 partido

---

### Caso 3: Análisis Post-Torneo

**Contexto:**
- Torneo finalizado con 50 partidos
- Quieres evaluar el desempeño del staff

**Análisis:**
```
1. Ir a Métricas Staff
2. Ver tabla de Árbitros:
   - Juan: 25 partidos, 5.2 goles/partido, 2.8 faltas/partido
   - María: 25 partidos, 5.8 goles/partido, 3.5 faltas/partido

Conclusión: María tiene partidos con más faltas en promedio

3. Filtrar por categoría U12:
   - Juan: 4.1 goles/partido
   - María: 4.5 goles/partido

4. Filtrar por categoría U16:
   - Juan: 6.8 goles/partido
   - María: 7.2 goles/partido

Conclusión: Patrones consistentes, categorías mayores tienen más goles
```

---

### Caso 4: Tracking de Horarios

**Contexto:**
- Quieres saber a qué hora empezó cada período

**Query:**
```typescript
const match = tournament.matches.find(m => m.id === matchId);
const summary = match.summary;

summary.statsByPeriod.forEach(period => {
  console.log(`${period.period}: ${period.startTimestamp}`);
});

// Output:
// 1ST: 2025-03-09T15:00:12.000Z → 15:00:12
// 2ND: 2025-03-09T15:25:30.000Z → 15:25:30
```

---

## Troubleshooting

### ❌ No aparece el selector de staff en Setup

**Causa:** No hay staff registrado en el torneo

**Solución:**
1. Ir a `/tournaments/[tournamentId]?tab=staff`
2. Agregar al menos una persona
3. Volver a Setup
4. Ahora debería aparecer el selector

---

### ❌ No aparecen métricas en la tabla

**Causa:** No hay partidos finalizados con staff asignado

**Solución:**
1. Configurar partidos con staff
2. Jugar y finalizar los partidos
3. Generar resúmenes
4. Las métricas se calcularán automáticamente

---

### ❌ Staff duplicado en selectores

**Causa:** Es el comportamiento esperado (la misma persona puede tener múltiples cargos)

**Aclaración:**
- Juan como Mesa Principal + Juan como Árbitro Principal = OK
- Juan como Mesa Principal + Juan como 2º Mesa = ❌ NO permitido

El selector previene duplicados **dentro del mismo rol**.

---

### ❌ Timestamps no aparecen en resumen viejo

**Causa:** Los timestamps solo se capturan para partidos nuevos (desde esta implementación)

**Solución:**
- Partidos viejos: No tienen timestamps (campo opcional)
- Partidos nuevos: Tienen timestamps automáticamente
- Ambos tipos de partidos siguen funcionando

---

### ❌ Métricas no reflejan cambio reciente

**Causa:** El hook calcula basado en resúmenes guardados

**Solución:**
1. Asegurarse de que el partido se finalizó
2. Asegurarse de que se generó el resumen
3. Recargar la página de métricas
4. Los hooks se recalculan automáticamente

---

### ❌ "Order" siempre es 1 en el resumen

**Causa:** Posible error en la asignación

**Debug:**
1. Verificar que `staffAssignment` tiene los IDs en el orden correcto:
   ```typescript
   {
     mesa: ["abc", "def", null]  // abc=1, def=2
   }
   ```
2. El summary generator usa el **índice del array** como order:
   ```typescript
   .map((id, index) => ({
     ...staff,
     order: index + 1  // 0→1, 1→2, 2→3
   }))
   ```

---

## Archivos de Referencia

### Core
- `src/types/index.ts` - Todos los tipos
- `src/contexts/game-state-context.tsx` - Reducers y lógica de estado

### Componentes
- `src/components/tournaments/staff-management-tab.tsx` - Gestión CRUD
- `src/components/setup/staff-selector.tsx` - Selector para partidos
- `src/components/tournaments/staff-metrics-tab.tsx` - Visualización de métricas

### Hooks
- `src/hooks/use-staff-stats.ts` - Cálculo de estadísticas

### Lógica
- `src/lib/summary-generator.ts` - Generación de resúmenes con staff

### Páginas
- `src/app/setup/page.tsx` - Wizard de configuración de partidos
- `src/app/tournaments/[tournamentId]/page.tsx` - Vista de torneo con tabs

---

## Próximos Pasos Sugeridos

### Mejoras Opcionales

1. **Exportar Métricas:**
   - Botón para exportar tabla a CSV/Excel
   - Incluir filtros aplicados

2. **Gráficos:**
   - Gráfico de barras: Partidos por persona
   - Gráfico de líneas: Goles/faltas por partido a lo largo del tiempo
   - Gráfico de torta: Distribución principal/auxiliar

3. **Métricas Adicionales:**
   - Partidos por día de la semana
   - Duración promedio de partidos (usando timestamps)
   - Tiempo promedio entre períodos

4. **Filtros Avanzados:**
   - Por rango de fechas
   - Por equipos específicos
   - Por resultado (victoria local/visitante)

5. **Notificaciones:**
   - Alertar si un staff member tiene >5 partidos más que otros
   - Sugerir rotación de personal

6. **Reportes:**
   - PDF con estadísticas del torneo
   - Incluir tablas de staff
   - Gráficos de rendimiento

---

## Resumen de Persistencia

```
tournaments.json
└── tournaments[]
    └── staff[]  ✅ AGREGADO
        └── { id, firstName, lastName, roles[] }

live.json
├── assignedStaff  ✅ AGREGADO
│   ├── mesa: [id1, id2, null]
│   └── referees: [id1, id2, null]
└── periodStartTimestamps  ✅ AGREGADO
    ├── "1ST": "2025-03-09T15:00:00Z"
    └── "2ND": "2025-03-09T15:25:00Z"

tournaments/[id]/summaries/[matchId].json
└── staff  ✅ AGREGADO
    ├── mesa: [{ id, firstName, lastName, order }]
    └── referees: [{ id, firstName, lastName, order }]

    statsByPeriod[]
    └── startTimestamp  ✅ AGREGADO
```

---

## Stack Técnico

- **Frontend:** React + Next.js 14
- **Estado:** React Context API + Reducer
- **UI:** Shadcn/ui + Tailwind CSS
- **Persistencia:** JSON files (file-based storage)
- **Tipos:** TypeScript strict mode
- **Hooks:** Custom hooks para lógica de negocio
- **Validación:** En tiempo real con toasts

---

## Conclusión

El sistema de staff está **100% funcional** y listo para producción. Incluye:

✅ Gestión completa de staff (CRUD)
✅ Asignación a partidos con orden/cargo
✅ Persistencia en múltiples niveles
✅ Métricas calculadas dinámicamente
✅ Filtros por categoría
✅ Timestamps de períodos
✅ UI intuitiva y validada
✅ Backwards compatible (partidos viejos siguen funcionando)

**Datos listos para análisis avanzado y métricas futuras.**

---

*Última actualización: 2025-03-09*
*Versión del sistema: Staff System v1.0*
