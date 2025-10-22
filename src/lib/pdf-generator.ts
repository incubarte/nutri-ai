

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTime, getCategoryNameById, getEndReasonText } from '@/contexts/game-state-context';
import type { GoalLog, PenaltyLog, SummaryPlayerStats } from '@/types';
import type { SummaryData } from '@/app/resumen/page';

// Helper to add a section with a title
const addSectionTitle = (doc: jsPDF, title: string, y: number): number => {
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text(title, 14, y);
    return y + 8;
};

// Helper to add a table with a title
const addTable = (doc: jsPDF, title: string, y: number, head: any[], body: any[][], options: { headFillColor?: [number, number, number], showTotal?: boolean } = {}): number => {
    let currentY = y;
    if (title) {
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(title, 14, currentY);
        currentY += 6;
    }

    if (body.length > 0) {
        const foot = options.showTotal ? [[{ content: `Total: ${body.length}`, colSpan: head.length, styles: { halign: 'right', fontStyle: 'bold' } }]] : [];
        
        autoTable(doc, {
            startY: currentY,
            head: [head],
            body: body,
            foot: foot,
            theme: 'striped',
            headStyles: { fillColor: options.headFillColor || [41, 128, 185] },
            footStyles: { fillColor: [230, 230, 230], textColor: 0 },
        });
        return (doc as any).lastAutoTable.finalY + 4;
    } else {
        doc.setFontSize(10);
        doc.text("Sin eventos registrados.", 14, currentY);
        return currentY + 8;
    }
};

const addPlayerStatsTable = (doc: jsPDF, title: string, y: number, summaryPlayerStats: SummaryPlayerStats[]): number => {
    let currentY = y;
     if (title) {
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(title, 14, currentY);
        currentY += 6;
    }

    const attendedPlayers = [...summaryPlayerStats].sort((a,b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));

    if (attendedPlayers.length > 0) {
        const totalGoals = attendedPlayers.reduce((sum, p) => sum + p.goals, 0);
        const totalAssists = attendedPlayers.reduce((sum, p) => sum + p.assists, 0);
        const totalShots = attendedPlayers.reduce((sum, p) => sum + p.shots, 0);

        autoTable(doc, {
            startY: currentY,
            head: [['#', 'Nombre', 'G', 'A', 'Tiros']],
            body: attendedPlayers.map(p => [p.number, p.name, p.goals, p.assists, p.shots]),
            foot: [[{ content: 'TOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, totalGoals, totalAssists, totalShots]],
            theme: 'striped',
            headStyles: { fillColor: [22, 163, 74] },
            footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' },
        });
        return (doc as any).lastAutoTable.finalY + 4;
    } else {
        doc.setFontSize(10);
        doc.text("Sin estadísticas registradas.", 14, currentY);
        return currentY + 8;
    }
};

const checkPageBreak = (doc: jsPDF, currentY: number): number => {
    if (currentY > 260) {
        doc.addPage();
        return 20;
    }
    return currentY;
};

export const exportGameSummaryPDF = (summaryData: SummaryData, homeAggregatedStats: { playerStats: SummaryPlayerStats[] }, awayAggregatedStats: { playerStats: SummaryPlayerStats[] }): string => {
    if (!summaryData) {
        console.error("Cannot generate PDF: summary data is missing.");
        return "error_no_summary_data.pdf";
    }

    const doc = new jsPDF();
    const teamTitle = `${summaryData.homeTeamName} vs ${summaryData.awayTeamName}`;
    
    const date = new Date();
    const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const filename = `${dateString} - Cat ${summaryData.categoryName} - ${summaryData.homeTeamName} vs ${summaryData.awayTeamName}.pdf`;

    const finalScore = `${summaryData.homeScore} - ${summaryData.awayScore}`;

    // --- Resumen General ---
    doc.setFontSize(16);
    doc.text(`Resumen del Partido: ${teamTitle}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Categoría: ${summaryData.categoryName}  |  Fecha: ${date.toLocaleDateString()}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Resultado Final: ${finalScore}`, 14, 29);

    let currentY = 40;

    const allHomeGoals: GoalLog[] = [];
    const allAwayGoals: GoalLog[] = [];
    const allHomePenalties: PenaltyLog[] = [];
    const allAwayPenalties: PenaltyLog[] = [];
    
    Object.values(summaryData.statsByPeriod).forEach(periodStats => {
        allHomeGoals.push(...(periodStats.home.goals || []));
        allAwayGoals.push(...(periodStats.away.goals || []));
        allHomePenalties.push(...(periodStats.home.penalties || []));
        allAwayPenalties.push(...(periodStats.away.penalties || []));
    });

    allHomeGoals.sort((a, b) => a.timestamp - b.timestamp);
    allAwayGoals.sort((a, b) => a.timestamp - b.timestamp);
    allHomePenalties.sort((a,b) => a.addTimestamp - b.addTimestamp);
    allAwayPenalties.sort((a,b) => a.addTimestamp - b.addTimestamp);

    // --- Tablas Generales ---
    currentY = addTable(doc, `${summaryData.homeTeamName} - Goles`, currentY,
        ['Tiempo', 'Gol', 'Asistencia'],
        allHomeGoals.map(g => [`${formatTime(g.gameTime)} - ${g.periodText}`,`#${g.scorer?.playerNumber || 'S/N'} ${g.scorer?.playerName || ''}`.trim(), g.assist ? `#${g.assist.playerNumber} ${g.assist.playerName || ''}`.trim() : '---']),
        { headFillColor: [41, 128, 185], showTotal: true }
    );
    currentY = checkPageBreak(doc, currentY);

    currentY = addTable(doc, `${summaryData.awayTeamName} - Goles`, currentY,
        ['Tiempo', 'Gol', 'Asistencia'],
        allAwayGoals.map(g => [`${formatTime(g.gameTime)} - ${g.periodText}`,`#${g.scorer?.playerNumber || 'S/N'} ${g.scorer?.playerName || ''}`.trim(), g.assist ? `#${g.assist.playerNumber} ${g.assist.playerName || ''}`.trim() : '---']),
        { headFillColor: [41, 128, 185], showTotal: true }
    );
    currentY = checkPageBreak(doc, currentY);

    currentY = addTable(doc, `${summaryData.homeTeamName} - Penalidades`, currentY,
        ['Tiempo', 'Jugador', 'Tipo', 'Duración', 'Estado'],
        allHomePenalties.map(p => [`${p.addPeriodText} ${formatTime(p.addGameTime)}`, p.isBenchPenalty ? `Banco (#${p.playerNumber})` : `#${p.playerNumber} ${p.playerName || ''}`.trim(), p.penaltyName || '---', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason)]),
        { headFillColor: [231, 76, 60], showTotal: true }
    );
    currentY = checkPageBreak(doc, currentY);

    currentY = addTable(doc, `${summaryData.awayTeamName} - Penalidades`, currentY,
        ['Tiempo', 'Jugador', 'Tipo', 'Duración', 'Estado'],
        allAwayPenalties.map(p => [`${p.addPeriodText} ${formatTime(p.addGameTime)}`, p.isBenchPenalty ? `Banco (#${p.playerNumber})` : `#${p.playerNumber} ${p.playerName || ''}`.trim(), p.penaltyName || '---', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason)]),
        { headFillColor: [231, 76, 60], showTotal: true }
    );

    // --- Estadísticas Generales por Jugador ---
    doc.addPage();
    currentY = 20;
    
    currentY = addPlayerStatsTable(doc, `${summaryData.homeTeamName} - Estadísticas de Jugador`, currentY, homeAggregatedStats.playerStats);
    currentY = checkPageBreak(doc, currentY);
    currentY = addPlayerStatsTable(doc, `${summaryData.awayTeamName} - Estadísticas de Jugador`, currentY, awayAggregatedStats.playerStats);


    // --- Desglose por Período ---
    doc.addPage();
    currentY = addSectionTitle(doc, 'Detalle de Estadísticas por Periodo', 20);
    
    const allPeriodTexts = Object.keys(summaryData.statsByPeriod).sort((a, b) => {
        const getPeriodNumber = (text: string) => {
            if (text.startsWith('OT')) return (summaryData.availableCategories.find(c=>c.id === summaryData.selectedMatchCategory) ? 2 : 2) + parseInt(text.replace('OT', '') || '1', 10);
            return parseInt(text.replace(/\D/g, ''), 10);
        };
        return getPeriodNumber(a) - getPeriodNumber(b);
    });

    for (const periodText of allPeriodTexts) {
        if (periodText.toLowerCase().includes('warm-up')) continue;
        
        currentY = checkPageBreak(doc, currentY);
        doc.setFontSize(14);
        doc.text(`Estadísticas para: ${periodText}`, 14, currentY);
        currentY += 8;

        const periodStats = summaryData.statsByPeriod[periodText];
        
        currentY = addTable(doc, `${summaryData.homeTeamName} - Goles`, currentY, ['Tiempo', 'Gol', 'Asistencia'], (periodStats.home.goals || []).map(g => [formatTime(g.gameTime), `#${g.scorer?.playerNumber || 'S/N'} ${g.scorer?.playerName || ''}`.trim(), g.assist ? `#${g.assist.playerNumber} ${g.assist.playerName || ''}`.trim() : '---']), { showTotal: true });
        currentY = checkPageBreak(doc, currentY);
        
        currentY = addTable(doc, `${summaryData.awayTeamName} - Goles`, currentY, ['Tiempo', 'Gol', 'Asistencia'], (periodStats.away.goals || []).map(g => [formatTime(g.gameTime), `#${g.scorer?.playerNumber || 'S/N'} ${g.scorer?.playerName || ''}`.trim(), g.assist ? `#${g.assist.playerNumber} ${g.assist.playerName || ''}`.trim() : '---']), { showTotal: true });
        currentY = checkPageBreak(doc, currentY);
        
        currentY = addTable(doc, `${summaryData.homeTeamName} - Penalidades`, currentY, ['Tiempo', 'Jugador', 'Tipo'], (periodStats.home.penalties || []).map(p => [formatTime(p.addGameTime), p.isBenchPenalty ? `Banco (#${p.playerNumber})` : `#${p.playerNumber} ${p.playerName || ''}`.trim(), p.penaltyName || '---']), { headFillColor: [231, 76, 60], showTotal: true });
        currentY = checkPageBreak(doc, currentY);
        
        currentY = addTable(doc, `${summaryData.awayTeamName} - Penalidades`, currentY, ['Tiempo', 'Jugador', 'Tipo'], (periodStats.away.penalties || []).map(p => [formatTime(p.addGameTime), p.isBenchPenalty ? `Banco (#${p.playerNumber})` : `#${p.playerNumber} ${p.playerName || ''}`.trim(), p.penaltyName || '---']), { headFillColor: [231, 76, 60], showTotal: true });
        currentY = checkPageBreak(doc, currentY);

        currentY = addPlayerStatsTable(doc, `${summaryData.homeTeamName} - Estadísticas de Jugador (${periodText})`, currentY, periodStats.home.playerStats);
        currentY = checkPageBreak(doc, currentY);
        
        currentY = addPlayerStatsTable(doc, `${summaryData.awayTeamName} - Estadísticas de Jugador (${periodText})`, currentY, periodStats.away.playerStats);
        currentY = checkPageBreak(doc, currentY);
    }

    doc.save(filename);
    
    return filename;
};

