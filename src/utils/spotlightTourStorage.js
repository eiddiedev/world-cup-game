// 仅记录当前这次页面打开期间完成过的教程。
// 刷新浏览器后模块会重新加载，集合随之清空，方便现场重复演示。
const completedToursThisPage = new Set()

export function hasCompletedSpotlightTour(id) {
  return Boolean(id) && completedToursThisPage.has(id)
}

export function markSpotlightTourComplete(id) {
  if (!id) return
  completedToursThisPage.add(id)
}
