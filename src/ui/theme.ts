import { Platform } from 'react-native'

export const colors = {
  bg: '#07060c',
  bgGlow: '#1a1033',
  card: '#16141e',
  cardHi: '#1e1b29',
  field: '#232030',
  border: 'rgba(255,255,255,0.07)',
  separator: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  dim: '#8f8a9e',
  faint: '#5f5a6e',
  accent: '#8b7cf6',
  accentHi: '#a99cff',
  accentSoft: 'rgba(139,124,246,0.2)',
  accentDeep: '#4a3aa8',
  danger: '#ff5f6d',
  success: '#3ddc84',
  today: 'rgba(124,92,255,0.38)'
}

export const radius = { card: 22, row: 18, pill: 999 }

export const font = {
  family: Platform.select({ web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif', default: undefined })
}

/** Widest the content gets on a desktop window. */
export const MAX_WIDTH = 640
