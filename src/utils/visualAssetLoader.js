const IMAGE_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i
const assetPromises = new Map()

function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      callback(value)
    }
    image.decoding = 'async'
    image.onload = () => {
      // onload 已经证明图片可用。decode() 在部分 WebView / 后台标签页中
      // 可能长期不返回，不能让它阻塞完整版首屏和后续比赛预热。
      image.decode?.().catch(() => {})
      finish(resolve, url)
    }
    image.onerror = () => finish(reject, new Error(`图片加载失败：${url}`))
    const timeoutId = window.setTimeout(() => {
      finish(reject, new Error(`图片加载超时：${url}`))
    }, 8000)
    image.src = url
    if (image.complete && image.naturalWidth) image.onload()
  })
}

export function preloadAsset(url) {
  if (!url) return Promise.resolve(url)
  if (assetPromises.has(url)) return assetPromises.get(url)

  const request = (IMAGE_PATTERN.test(url)
    ? preloadImage(url)
    : __DOUYIN_BUILD__
      ? Promise.resolve(url)
      : fetch(url, { cache: 'force-cache' }).then((response) => {
        if (!response.ok) throw new Error(`资源加载失败：${url}（${response.status}）`)
        return response.arrayBuffer()
      }))
    .catch((error) => {
      assetPromises.delete(url)
      throw error
    })

  assetPromises.set(url, request)
  return request
}

export async function preloadAssetUrls(urls, { concurrency = 6, onProgress } = {}) {
  const queue = [...new Set(urls.filter(Boolean))]
  const total = queue.length
  let completed = 0
  const failures = []

  if (!total) {
    onProgress?.({ completed: 0, total: 0, percent: 100 })
    return { completed: 0, total: 0, failures }
  }

  let cursor = 0
  const worker = async () => {
    while (cursor < total) {
      const index = cursor
      cursor += 1
      const url = queue[index]
      try {
        await preloadAsset(url)
      } catch (error) {
        failures.push({ url, error })
      } finally {
        completed += 1
        onProgress?.({
          completed,
          total,
          percent: Math.round((completed / total) * 100),
          url,
        })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker))
  return { completed, total, failures }
}

export async function preloadAssetUrlsSoftly(urls, {
  batchSize = 1,
  pauseMs = 700,
  shouldContinue = () => true,
} = {}) {
  const queue = [...new Set(urls.filter(Boolean))]
  const failures = []

  for (let cursor = 0; cursor < queue.length && shouldContinue(); cursor += batchSize) {
    const batch = queue.slice(cursor, cursor + batchSize)
    const result = await preloadAssetUrls(batch, { concurrency: 1 })
    failures.push(...result.failures)

    if (cursor + batchSize < queue.length && shouldContinue()) {
      await new Promise((resolve) => window.setTimeout(resolve, pauseMs))
    }
  }

  return { failures }
}
