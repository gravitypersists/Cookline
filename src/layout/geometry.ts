// Lane geometry in px (SPEC §6.3), on the 8pt grid.
export const LANE_PITCH = 24;
export const LANE_OFFSET = 16;
export const LINE_WIDTH = 4;
export const DOT_CENTER = 24;
export const DOT = 16;
export const TERMINAL_DOT = 24;

export const laneX = (lane: number) => LANE_OFFSET + LANE_PITCH * lane;
// Lanes plus 16px of air on either side: 88px for three lanes.
export const gutterWidth = (lanes: number) => LANE_PITCH * lanes + 16;
