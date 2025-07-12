"use client";

import { FullscreenToggle } from "@/components/layout/fullscreen-toggle";

export function ScoreboardActions() {
    return (
        <div className="absolute top-2 right-2 z-30">
            <FullscreenToggle />
        </div>
    );
}
