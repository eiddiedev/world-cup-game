import React, { useEffect, useRef } from 'react'

/**
 * 像素风雨点覆盖层。
 * 用一块低分辨率 canvas 绘制细短的白色竖向雨丝，再靠 CSS 放大并开启
 * image-rendering: pixelated，得到颗粒感十足的 8-bit 雨点，缓慢匀速降落。
 */
export default function PixelRain({ density = 90, speed = 0.55 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    // jsdom 等环境不支持 canvas 2d，此时不渲染雨点动画
    if (!ctx) return undefined
    // 中等分辨率画布：保留像素感的同时让雨丝更纤细
    const W = 384
    const H = 216
    canvas.width = W
    canvas.height = H

    const drops = Array.from({ length: density }, () => ({
      x: Math.floor(Math.random() * W),
      y: Math.floor(Math.random() * H),
      len: 4 + Math.floor(Math.random() * 6),
      vy: (0.6 + Math.random() * 0.8) * speed,
      alpha: 0.18 + Math.random() * 0.22,
    }))

    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(48, now - last)
      last = now
      ctx.clearRect(0, 0, W, H)
      for (const drop of drops) {
        drop.y += drop.vy * (dt / 16.7)
        if (drop.y > H) {
          drop.y = -drop.len
          drop.x = Math.floor(Math.random() * W)
        }
        ctx.fillStyle = `rgba(168, 198, 222, ${drop.alpha.toFixed(3)})`
        ctx.fillRect(Math.floor(drop.x), Math.floor(drop.y), 1, drop.len)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [density, speed])

  return <canvas ref={canvasRef} className="broadcast-pixel-rain" aria-hidden="true" />
}
