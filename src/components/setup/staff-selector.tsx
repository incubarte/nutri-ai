"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users, UserCheck, AlertTriangle } from "lucide-react";
import type { StaffMember, MatchStaffAssignment } from "@/types";

interface StaffSelectorProps {
  tournamentStaff: StaffMember[];
  assignment: MatchStaffAssignment;
  onAssignmentChange: (assignment: MatchStaffAssignment) => void;
}

export function StaffSelector({ tournamentStaff, assignment, onAssignmentChange }: StaffSelectorProps) {
  const mesaStaff = tournamentStaff.filter(s => s.roles.includes('mesa'));
  const refereeStaff = tournamentStaff.filter(s => s.roles.includes('referee'));

  const handleMesaChange = (index: number, staffId: string | null) => {
    const newMesa = [...assignment.mesa];
    newMesa[index] = staffId;
    onAssignmentChange({ ...assignment, mesa: newMesa });
  };

  const handleRefereeChange = (index: number, staffId: string | null) => {
    const newReferees = [...assignment.referees];
    newReferees[index] = staffId;
    onAssignmentChange({ ...assignment, referees: newReferees });
  };

  const getStaffDisplayName = (staff: StaffMember) => {
    return `${staff.firstName} ${staff.lastName}`;
  };

  const isStaffUsedInMesa = (staffId: string) => {
    return assignment.mesa.filter(id => id === staffId).length;
  };

  const isStaffUsedInReferees = (staffId: string) => {
    return assignment.referees.filter(id => id === staffId).length;
  };

  if (tournamentStaff.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Personal del Partido (Opcional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay staff registrado en este torneo. Puedes agregarlo en la pestaña de Staff del torneo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4" />
          Personal del Partido (Opcional)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mesa Section */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Mesa</Label>
          <div className="space-y-2">
            {[0, 1, 2].map((index) => {
              const labels = ['Principal', '2º Mesa', '3º Mesa'];
              return (
              <div key={`mesa-${index}`} className="space-y-1">
                <Label className="text-sm font-normal">
                  {labels[index]} {index === 0 && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={assignment.mesa[index] || "none"}
                  onValueChange={(value) => handleMesaChange(index, value === "none" ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={index === 0 ? "Selecciona una persona (Obligatorio)" : "Selecciona una persona (Opcional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Sin asignar</span>
                    </SelectItem>
                    {mesaStaff.map((staff) => {
                      const timesUsed = isStaffUsedInMesa(staff.id);
                      const isCurrentSelection = assignment.mesa[index] === staff.id;

                      return (
                        <SelectItem
                          key={staff.id}
                          value={staff.id}
                          disabled={timesUsed > 0 && !isCurrentSelection}
                        >
                          {getStaffDisplayName(staff)}
                          {timesUsed > 0 && !isCurrentSelection && " (ya asignado)"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
            })}
          </div>
        </div>

        <Separator />

        {/* Referees Section */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Árbitros</Label>
          <div className="space-y-2">
            {[0, 1, 2].map((index) => {
              const labels = ['Principal', '2º Árbitro', '3º Árbitro'];
              return (
              <div key={`referee-${index}`} className="space-y-1">
                <Label className="text-sm font-normal">
                  {labels[index]} {index === 0 && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={assignment.referees[index] || "none"}
                  onValueChange={(value) => handleRefereeChange(index, value === "none" ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={index === 0 ? "Selecciona un árbitro (Obligatorio)" : "Selecciona un árbitro (Opcional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Sin asignar</span>
                    </SelectItem>
                    {refereeStaff.map((staff) => {
                      const timesUsed = isStaffUsedInReferees(staff.id);
                      const isCurrentSelection = assignment.referees[index] === staff.id;

                      return (
                        <SelectItem
                          key={staff.id}
                          value={staff.id}
                          disabled={timesUsed > 0 && !isCurrentSelection}
                        >
                          {getStaffDisplayName(staff)}
                          {timesUsed > 0 && !isCurrentSelection && " (ya asignado)"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
            })}
          </div>
        </div>

        {assignment.mesa[0] === null && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Debes asignar al menos una persona en Mesa
          </p>
        )}

        {assignment.referees[0] === null && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Debes asignar al menos un Árbitro
          </p>
        )}
      </CardContent>
    </Card>
  );
}
