import { definePluginIcon } from '../icon'

// Petal outline of the ElpsyCN electric fan, radius 90 around its hub.
const PETAL = 'M0 -10C16 -10 29 -23 29 -39C29 -67.2 16 -90 0 -90C-16 -90 -29 -67.2 -29 -39C-29 -23 -16 -10 0 -10Z'

/** 云端风扇: the ElpsyCN electric fan, its three petals spinning with the speed. */
export const fanIcon = definePluginIcon({
  background: ['#e0f7ec', '#a7dfc3'],
  shapes: [
    { type: 'ellipse', cx: 32, cy: 55, rx: 13, ry: 2.6, fill: '#0f3a2a', opacity: 0.1 },
    { type: 'ellipse', cx: 32, cy: 52.5, rx: 12, ry: 4, fill: 'surface' },
    { type: 'rect', x: 30, y: 37, width: 4, height: 16, rx: 2, fill: 'surface' },
    { type: 'circle', cx: 32, cy: 25, r: 17, fill: '#ffffff', opacity: 0.35 },
    {
      type: 'group',
      motion: 'spin',
      origin: [32, 25],
      fill: '#7fbfe9',
      children: [0, 120, 240].map(angle => ({
        type: 'path' as const,
        d: PETAL,
        transform: `translate(32 25) rotate(${angle}) skewX(-8) scale(0.15)`,
      })),
    },
    { type: 'circle', cx: 32, cy: 25, r: 17, fill: 'none', stroke: 'surface', strokeWidth: 2.2 },
    { type: 'circle', cx: 32, cy: 25, r: 9.5, fill: 'none', stroke: 'surface', strokeWidth: 0.8, opacity: 0.7 },
    { type: 'circle', cx: 32, cy: 25, r: 3.8, fill: 'surface', stroke: '#a9bccf', strokeWidth: 0.8 },
    { type: 'circle', cx: 32, cy: 25, r: 1.6, fill: 'tone' },
  ],
})
