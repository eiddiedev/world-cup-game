export async function loadPhaser() {
  const module = await import('phaser')
  return module.default || module
}

