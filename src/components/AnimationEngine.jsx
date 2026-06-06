import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import { getMatchKits } from '../data/teamKits.js'
import { createPhaserMatchScene } from './PhaserMatchScene.js'

const AnimationEngine = forwardRef(({
  myLineup = [],
  opponentLineup = [],
  formation = '4-3-3',
  opponentFormation = '4-3-3',
  myTeam = 'france',
  opponentTeam = 'opponent',
  width = 780,
  height = 480,
  ambientEnabled = true,
  onGoalEffect,
  onOpponentGoalEffect,
  onSaveEffect,
}, ref) => {
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const sceneRef = useRef(null)
  const readyRef = useRef(Promise.resolve(null))
  const callbacksRef = useRef({ onGoalEffect, onOpponentGoalEffect, onSaveEffect })

  callbacksRef.current = { onGoalEffect, onOpponentGoalEffect, onSaveEffect }

  const lineupKey = useMemo(() => (
    myLineup.map(player => `${player.id || player.name}:${player.number}:${player.pos || player.position}`).join('|')
  ), [myLineup])
  const opponentKey = useMemo(() => (
    opponentLineup.map(player => `${player.id || player.name}:${player.number}:${player.pos || player.position}`).join('|')
  ), [opponentLineup])
  const kits = useMemo(() => getMatchKits(myTeam, opponentTeam), [myTeam, opponentTeam])

  useEffect(() => {
    let disposed = false
    let resolveReady
    readyRef.current = new Promise(resolve => { resolveReady = resolve })

    const controller = {
      myLineup,
      opponentLineup,
      formation,
      opponentFormation,
      homeKit: kits.home,
      awayKit: kits.away,
      ambientEnabled,
      get onGoalEffect() { return callbacksRef.current.onGoalEffect },
      get onOpponentGoalEffect() { return callbacksRef.current.onOpponentGoalEffect },
      get onSaveEffect() { return callbacksRef.current.onSaveEffect },
      scene: null,
      resolveReady,
    }

    async function mountGame() {
      const module = await import('phaser')
      if (disposed || !containerRef.current) return
      const Phaser = module.default || module
      const MatchScene = createPhaserMatchScene(Phaser, controller)
      const game = new Phaser.Game({
        type: Phaser.CANVAS,
        width,
        height,
        parent: containerRef.current,
        pixelArt: true,
        antialias: false,
        roundPixels: true,
        backgroundColor: '#163D20',
        scene: [MatchScene],
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width,
          height,
        },
        render: {
          antialias: false,
          pixelArt: true,
          roundPixels: true,
        },
      })
      gameRef.current = game
      readyRef.current.then(scene => {
        if (!disposed) sceneRef.current = scene
      })
    }

    mountGame()

    return () => {
      disposed = true
      sceneRef.current = null
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
      if (containerRef.current) containerRef.current.replaceChildren()
    }
  }, [
    width,
    height,
    formation,
    opponentFormation,
    lineupKey,
    opponentKey,
    kits,
  ])

  useEffect(() => {
    if (sceneRef.current?.controller) {
      sceneRef.current.controller.ambientEnabled = ambientEnabled
    }
  }, [ambientEnabled])

  const withScene = async (method, ...args) => {
    const scene = sceneRef.current || await readyRef.current
    if (!scene || typeof scene[method] !== 'function') return undefined
    return scene[method](...args)
  }

  useImperativeHandle(ref, () => ({
    playEvent: (...args) => withScene('playEvent', ...args),
    playResult: (...args) => withScene('playResult', ...args),
    playAmbientEvent: (...args) => withScene('playAmbientEvent', ...args),
    resetPositions: (...args) => withScene('resetPositions', ...args),
    getState: () => sceneRef.current?.getState() || null,
  }))

  return (
    <div
      ref={containerRef}
      className="phaser-match-engine"
      style={{
        width,
        height,
        maxWidth: '100%',
        maxHeight: '100%',
        margin: '0 auto',
        imageRendering: 'pixelated',
        overflow: 'hidden',
      }}
    />
  )
})

AnimationEngine.displayName = 'AnimationEngine'

export default AnimationEngine
