# Sistema de Staff - Documentación de Implementación

## ✅ Completado

1. **Tipos de datos** (`src/types/index.ts`)
   - ✅ `StaffMember`: Definición de miembro del staff
   - ✅ `MatchStaffAssignment`: Asignación de staff a un partido
   - ✅ `AssignedStaffInfo`: Info de staff asignado en resumen
   - ✅ Agregado `staff?: StaffMember[]` a `Tournament`
   - ✅ Agregado `assignedStaff?: MatchStaffAssignment` a `LiveState`
   - ✅ Agregado `staff?: { mesa, referees }` a `GameSummary`

2. **Acciones del Reducer** (`src/types/index.ts`)
   - ✅ `ADD_STAFF_TO_TOURNAMENT`
   - ✅ `UPDATE_STAFF_IN_TOURNAMENT`
   - ✅ `REMOVE_STAFF_FROM_TOURNAMENT`
   - ✅ `SET_MATCH_STAFF`

3. **Reducers implementados** (`src/contexts/game-state-context.tsx:1876-1943`)
   - ✅ Todos los reducers de staff funcionando

4. **UI de Gestión de Staff**
   - ✅ Componente `StaffManagementTab` creado (`src/components/tournaments/staff-management-tab.tsx`)
   - ✅ Integrado en la página de torneo con nueva tab "Staff"

5. **Componente de Selección**
   - ✅ `StaffSelector` creado (`src/components/setup/staff-selector.tsx`)
   - Permite seleccionar 3 personas para Mesa (1 obligatoria)
   - Permite seleccionar 3 árbitros (1 obligatorio)
   - Previene asignaciones duplicadas

---

## 🚧 Pendiente

### 1. Integrar StaffSelector en el Wizard de Setup (`src/app/setup/page.tsx`)

**Ubicación:** Después de la selección de equipos, antes de settings de formato

**Pasos:**

1. **Importar el componente:**
```typescript
import { StaffSelector } from '@/components/setup/staff-selector';
```

2. **Agregar estado local para la asignación de staff:**
```typescript
const [staffAssignment, setStaffAssignment] = useState<MatchStaffAssignment>({
  mesa: [null, null, null],
  referees: [null, null, null]
});
```

3. **Reset del estado cuando cambia el torneo:**
```typescript
// En el useEffect que maneja cambios de torneo:
useEffect(() => {
  // ... código existente ...
  setStaffAssignment({ mesa: [null, null, null], referees: [null, null, null] });
}, [selectedTournamentId]);
```

4. **Obtener el staff del torneo seleccionado:**
```typescript
const tournamentStaff = useMemo(() => {
  if (!isTournamentMatch || !selectedTournamentId) return [];
  const tournament = state.config.tournaments.find(t => t.id === selectedTournamentId);
  return tournament?.staff || [];
}, [isTournamentMatch, selectedTournamentId, state.config.tournaments]);
```

5. **Agregar el componente en el JSX:**
```jsx
{/* Después de la selección de equipos */}
{isTournamentMatch && tournamentStaff.length > 0 && (
  <StaffSelector
    tournamentStaff={tournamentStaff}
    assignment={staffAssignment}
    onAssignmentChange={setStaffAssignment}
  />
)}
```

6. **Guardar la asignación al iniciar el partido:**

Buscar la función que maneja el inicio del partido (probablemente llamada `handleStartGame` o similar), y agregar:

```typescript
// Después de dispatch({ type: 'UPDATE_SELECTED_FT_PROFILE_DATA', ... })
// Antes de router.push('/controls')

if (staffAssignment.mesa[0] || staffAssignment.referees[0]) {
  dispatch({
    type: 'SET_MATCH_STAFF',
    payload: { assignment: staffAssignment }
  });
}
```

**Validación:** Asegurarse de que al menos un puesto de mesa y un árbitro estén asignados si hay staff disponible:

```typescript
// En la validación antes de iniciar
if (tournamentStaff.length > 0) {
  if (!staffAssignment.mesa[0]) {
    toast({
      title: "Staff Requerido",
      description: "Debes asignar al menos una persona en Mesa",
      variant: "destructive"
    });
    return;
  }
  if (!staffAssignment.referees[0]) {
    toast({
      title: "Staff Requerido",
      description: "Debes asignar al menos un Árbitro",
      variant: "destructive"
    });
    return;
  }
}
```

---

### 2. Actualizar Summary Generator (`src/lib/summary-generator.ts`)

**Función:** `generateSummaryData`

**Agregar al final, antes del return:**

```typescript
// Include staff assignment in summary
if (live.assignedStaff && currentTournament?.staff) {
  const mesaStaffInfo: AssignedStaffInfo[] = live.assignedStaff.mesa
    .filter((id): id is string => id !== null)
    .map(id => {
      const staff = currentTournament.staff?.find(s => s.id === id);
      if (!staff) return null;
      return {
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName
      };
    })
    .filter((s): s is AssignedStaffInfo => s !== null);

  const refereesStaffInfo: AssignedStaffInfo[] = live.assignedStaff.referees
    .filter((id): id is string => id !== null)
    .map(id => {
      const staff = currentTournament.staff?.find(s => s.id === id);
      if (!staff) return null;
      return {
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName
      };
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

---

## 📝 Notas Adicionales

### Persistencia
- Los datos de staff se guardan automáticamente en `tournaments.json` dentro del torneo
- La asignación de staff se guarda en `live.json` y luego en el resumen del partido
- Los resúmenes incluyen nombre completo + ID para métricas futuras

### Validación
- Un staff puede tener ambos roles (mesa y referee)
- No se puede asignar la misma persona dos veces en el mismo rol
- Mesa y Árbitro principal son obligatorios (posiciones 0)
- Los demás puestos son opcionales

### UX
- El selector muestra "(ya asignado)" para staff duplicado
- Los selectores se deshabilitan si no hay staff registrado
- Mensajes claros sobre campos obligatorios

---

## 🧪 Plan de Prueba

1. **Crear Staff:**
   - Ir a Torneo → Tab "Staff"
   - Agregar 2-3 personas con diferentes roles

2. **Configurar Partido:**
   - Ir a Setup
   - Seleccionar torneo con staff
   - Verificar que aparece el selector de staff
   - Asignar mesa y árbitros

3. **Durante el Partido:**
   - Verificar que `state.live.assignedStaff` tiene los IDs correctos

4. **Generar Resumen:**
   - Finalizar el partido
   - Verificar que el resumen incluye el staff con nombres completos

5. **Métricas Futuras:**
   - Los IDs permiten hacer queries como:
     - "¿Cuántos partidos arbitró Juan Pérez?"
     - "¿Qué árbitro estuvo en los partidos más reñidos?"
