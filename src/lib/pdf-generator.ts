

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTime, getCategoryNameById, getEndReasonText, type GameState } from '@/contexts/game-state-context';
import type { GoalLog, PenaltyLog, PlayerData, PlayerStats } from '@/types';

const addTeamSection = (doc: jsPDF, teamName: string, goals: GoalLog[], penalties: PenaltyLog[], playerStats: PlayerStats | undefined, startY: number): number => {
    let currentY = startY;

    const attendedPlayers = playerStats ? Object.entries(playerStats)
        .map(([playerNumber, stats]) => ({
            number: playerNumber,
            ...stats
        }))
        .sort((a,b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999))
        : [];
    
    // --- Estadisticas Section ---
    doc.setFontSize(14);
    doc.text(`${teamName} - Estadísticas de Jugador`, 14, currentY);
    currentY += 2;

    if (attendedPlayers.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: [['#', 'Nombre', 'G', 'A', 'Tiros']],
            body: attendedPlayers.map(p => [
                p.number,
                p.name,
                p.goals,
                p.assists,
                p.shots
            ]),
            theme: 'striped',
            headStyles: { fillColor: [22, 163, 74] },
        });
        currentY = (doc as any).lastAutoTable.finalY;
    } else {
        doc.setFontSize(10);
        doc.text("Sin estadísticas registradas.", 14, currentY + 6);
        currentY += 10;
    }


    // --- Goles Section ---
    currentY += 12;
    doc.setFontSize(14);
    doc.text(`${teamName} - Goles`, 14, currentY);
    currentY += 2;

    if (goals.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: [['Tiempo', 'Periodo', 'Gol', 'Asistencia']],
            body: goals.map(g => [
                formatTime(g.gameTime),
                g.periodText,
                `#${g.scorer?.playerNumber || 'S/N'} ${g.scorer?.playerName || ''}`.trim(),
                g.assist ? `#${g.assist.playerNumber} ${g.assist.playerName || ''}`.trim() : '---'
            ]),
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
        });
        currentY = (doc as any).lastAutoTable.finalY;
    } else {
        doc.setFontSize(10);
        doc.text("Sin goles registrados.", 14, currentY + 6);
        currentY += 10;
    }

    // --- Penalidades Section ---
    currentY += 12;
    doc.setFontSize(14);
    doc.text(`${teamName} - Penalidades`, 14, currentY);
    currentY += 2;

    if (penalties.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: [['Tiempo', 'Periodo', 'Jugador', 'Nombre', 'Duración', 'Estado']],
            body: penalties.map(p => [
                formatTime(p.addGameTime), 
                p.addPeriodText, 
                p.isBenchPenalty ? `Banco (#${p.playerNumber})` : `#${p.playerNumber}`, 
                p.playerName || '---', 
                formatTime(p.initialDuration * 100), 
                getEndReasonText(p.endReason)
            ]),
            theme: 'striped',
            headStyles: { fillColor: [231, 76, 60] },
        });
        currentY = (doc as any).lastAutoTable.finalY;
    } else {
        doc.setFontSize(10);
        doc.text("Sin penalidades registradas.", 14, currentY + 6);
        currentY += 10;
    }
    
    return currentY;
};

export const exportGameSummaryPDF = (state: GameState) => {
    if (!state.config || !state.live) {
        console.error("Cannot generate PDF: game state is not fully loaded.");
        return "error_no_state.pdf";
    }

    const { config, live } = state;
    const doc = new jsPDF();
    const teamTitle = `${live.homeTeamName} vs ${live.awayTeamName}`;
    const categoryName = getCategoryNameById(config.selectedMatchCategory, config.availableCategories) || 'N/A';
    
    const date = new Date();
    const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const filename = `${dateString} - Cat ${categoryName} - ${live.homeTeamName} vs ${live.awayTeamName}.pdf`;

    const finalScore = `${live.score.home} - ${live.score.away}`;

    doc.text(`Resumen del Partido: ${teamTitle} (Cat. ${categoryName})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Fecha: ${date.toLocaleDateString()}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Resultado Final: ${finalScore}`, 14, 29);

    const homeGoals = [...live.score.homeGoals].sort((a, b) => a.timestamp - b.timestamp);
    const awayGoals = [...live.score.awayGoals].sort((a, b) => a.timestamp - b.timestamp);
    const homePenalties = [...live.gameSummary.home.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp);
    const awayPenalties = [...live.gameSummary.away.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp);

    const homeFinalY = addTeamSection(doc, live.homeTeamName, homeGoals, homePenalties, live.gameSummary.home.playerStats, 40);
    doc.addPage();
    addTeamSection(doc, live.awayTeamName, awayGoals, awayPenalties, live.gameSummary.away.playerStats, 20);

    doc.save(filename);
    
    return filename;
};
