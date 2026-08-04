export const PLAYER_MODE_DEMO_ASSIST = Object.freeze({
  schemaVersion: 'player-mode-demo-assist-v1',
  enabled: true,
  speed: 0.85,
  receptionGraceMs: 500,
  passInputBufferMs: 240,
  activePressers: 1,
  coverPlayers: 1,
  defensiveWidth: 1.12,
  coverMinimumDistance: 6.5,
  shapeRefreshMs: 280,
})

export function getPlayerModeDemoAssistProfile(playerMode) {
  return playerMode ? { ...PLAYER_MODE_DEMO_ASSIST } : null
}
