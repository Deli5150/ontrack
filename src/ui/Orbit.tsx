import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, Platform, View } from 'react-native'
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg'

// The home screen's centerpiece: a glowing planet with one moon per active subscription, sized by
// what it costs, circling slowly.

interface Moon {
  id: string
  cost: number
}

export function Orbit({ moons, size }: { moons: Moon[]; size: number }) {
  const spin = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 180_000, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }))
    loop.start()
    return () => loop.stop()
  }, [spin])
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  const c = size / 2
  const ring = size * 0.4
  const planet = size * 0.2
  const placed = useMemo(() => {
    const max = Math.max(1, ...moons.map((m) => m.cost))
    const n = moons.length
    return moons.map((m, i) => {
      const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
      return { id: m.id, x: c + Math.cos(a) * ring, y: c + Math.sin(a) * ring, r: size * (0.012 + 0.03 * Math.sqrt(m.cost / max)) }
    })
  }, [moons, c, ring, size])

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ff7a45" stopOpacity="0.35" />
            <Stop offset="0.5" stopColor="#c03f86" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#6d3bd1" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="planet" cx="42%" cy="35%" r="70%">
            <Stop offset="0" stopColor="#ffc46b" />
            <Stop offset="0.45" stopColor="#ff8a3d" />
            <Stop offset="0.8" stopColor="#f04a6f" />
            <Stop offset="1" stopColor="#d4317a" />
          </RadialGradient>
          <RadialGradient id="swirl" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffe0a3" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#ffe0a3" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="pink" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ff3d8b" stopOpacity="0.7" />
            <Stop offset="1" stopColor="#ff3d8b" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={size * 0.36} fill="url(#glow)" />
        <Circle cx={c} cy={c} r={ring} stroke="rgba(214,200,255,0.4)" strokeWidth={1.2} fill="none" />
        <G>
          <Circle cx={c} cy={c} r={planet} fill="url(#planet)" />
          <Ellipse cx={c - planet * 0.25} cy={c - planet * 0.15} rx={planet * 0.6} ry={planet * 0.28} fill="url(#swirl)" transform={`rotate(-18 ${c} ${c})`} />
          <Ellipse cx={c + planet * 0.2} cy={c + planet * 0.45} rx={planet * 0.75} ry={planet * 0.32} fill="url(#pink)" transform={`rotate(-12 ${c} ${c})`} />
          <Ellipse cx={c + planet * 0.35} cy={c - planet * 0.35} rx={planet * 0.35} ry={planet * 0.18} fill="url(#swirl)" />
        </G>
      </Svg>
      <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size}>
          {placed.map((m) => (
            <Circle key={m.id} cx={m.x} cy={m.y} r={m.r} fill="url(#moon)" />
          ))}
          <Defs>
            <RadialGradient id="moon" cx="40%" cy="35%" r="70%">
              <Stop offset="0" stopColor="#f3eeff" />
              <Stop offset="0.6" stopColor="#d4c8ff" />
              <Stop offset="1" stopColor="#a996f0" />
            </RadialGradient>
          </Defs>
        </Svg>
      </Animated.View>
    </View>
  )
}
