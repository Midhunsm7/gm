// All world units are "table units": the table is 1.0 wide (x) and 2.0 long (y).
// Player defends y = -L/2 (bottom of screen), the AI defends y = +L/2.
export const TABLE = { W: 1.0, L: 2.0, goalW: 0.4, wallT: 0.07, wallH: 0.07, pocket: 0.18 }
export const PUCK_R = 0.04
export const PADDLE_R = 0.07
export const DT = 1 / 120 // fixed physics timestep
export const PLAYER_MAX_SPEED = 3.2 // the AI is never allowed above this
export const PADDLE_ACCEL = 80
export const PADDLE_GAIN = 25
export const PUCK_MAX_SPEED = 5
export const HOME = [
  { x: 0, y: -0.75 },
  { x: 0, y: 0.75 },
]
export const TARGETS = [3, 5, 7, 10, 15]
export const MILESTONES = [5, 10, 15, 20, 25]
