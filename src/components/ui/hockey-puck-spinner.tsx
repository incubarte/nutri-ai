import { cn } from "@/lib/utils";

export const HockeyPuckSpinner = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 100"
      className={cn("w-24 h-auto", className)}
    >
      {/* Player 1 (Left) */}
      <g id="player1">
        <circle cx="40" cy="50" r="10" fill="hsl(var(--primary))" />
        <path d="M40 60 V 80 H 35" stroke="hsl(var(--primary))" strokeWidth="4" fill="none" />
        <path d="M40 65 L 20 85 H 10" stroke="hsl(var(--primary))" strokeWidth="4" fill="none" />
      </g>

      {/* Player 2 (Right) */}
      <g id="player2">
        <circle cx="160" cy="50" r="10" fill="hsl(var(--destructive))" />
        <path d="M160 60 V 80 H 165" stroke="hsl(var(--destructive))" strokeWidth="4" fill="none" />
        <path d="M160 65 L 180 85 H 190" stroke="hsl(var(--destructive))" strokeWidth="4" fill="none" />
      </g>
      
      {/* Puck */}
      <g className="animate-pass-puck">
         <ellipse cx="45" cy="85" rx="8" ry="3" fill="hsl(var(--foreground))" />
      </g>
    </svg>
  );
};
