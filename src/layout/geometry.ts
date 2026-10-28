// Lane geometry in px (SPEC §6.3).
export const LANE_PITCH = 28;
export const LANE_OFFSET = 14;
export const LINE_WIDTH = 4;
export const DOT_CENTER = 24;
export const DOT = 16;
export const TERMINAL_DOT = 22;

export const laneX = (lane: number) => LANE_OFFSET + LANE_PITCH * lane;
export const gutterWidth = (lanes: number) => LANE_PITCH * lanes + 8;
