import { definePluginIcon } from '../icon'

// Petal outline of the ElpsyCN electric fan, radius 90 around its hub.
const PETAL = 'M0 -10C16 -10 29 -23 29 -39C29 -67.2 16 -90 0 -90C-16 -90 -29 -67.2 -29 -39C-29 -23 -16 -10 0 -10Z'

/**
 * 云端风扇, 晴空清风: the ElpsyCN line-art fan with sky blue petals on a
 * warm white tile. While it runs, the petals spin with the speed and soft
 * breeze lines pulse at its sides in the device's tone.
 */
export const fanIcon = definePluginIcon({
  background: ['#fbf6ee', '#ecdfca'],
  backgroundDark: ['#4a4239', '#332d27'],
  shapes: [
    { type: 'ellipse', cx: 32, cy: 55.5, rx: 13, ry: 2.4, fill: '#5a3d1e', opacity: 0.1 },
    { type: 'ellipse', cx: 32, cy: 52.5, rx: 12, ry: 3.8, fill: 'surface', stroke: 'ink', strokeWidth: 1.2 },
    { type: 'rect', x: 30, y: 38, width: 4, height: 14, rx: 2, fill: 'surface', stroke: 'ink', strokeWidth: 1.2 },
    { type: 'circle', cx: 32, cy: 25, r: 17, fill: 'surface', stroke: 'ink', strokeWidth: 1.6 },
    { type: 'circle', cx: 32, cy: 25, r: 13.6, fill: '#eaf4fb' },
    {
      type: 'group',
      motion: 'spin',
      origin: [32, 25],
      fill: '#8cc8ee',
      children: [0, 120, 240].map(angle => ({
        type: 'path' as const,
        d: PETAL,
        transform: `translate(32 25) rotate(${angle}) skewX(-8) scale(0.15)`,
      })),
    },
    { type: 'circle', cx: 32, cy: 25, r: 3.4, fill: 'surface', stroke: 'ink', strokeWidth: 1 },
    { type: 'circle', cx: 32, cy: 25, r: 1.3, fill: 'tone' },
    {
      type: 'group',
      when: 'active',
      fill: 'none',
      stroke: 'tone',
      strokeWidth: 2,
      linecap: 'round',
      children: [
        { type: 'path', d: 'M52.5 18q3.5 7 0 14', motion: 'blink' },
        { type: 'path', d: 'M11.5 18q-3.5 7 0 14', motion: 'blink' },
        { type: 'path', d: 'M57 15q5 10 0 20', opacity: 0.55, motion: 'blink', delay: 0.5 },
        { type: 'path', d: 'M7 15q-5 10 0 20', opacity: 0.55, motion: 'blink', delay: 0.5 },
      ],
    },
  ],
})
