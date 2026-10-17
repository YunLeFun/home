import { definePluginIcon } from '../icon'

/** 暖手宝: a rosy pebble in a knitted sleeve that glows when warm. */
export const handWarmerIcon = definePluginIcon({
  background: ['#ffecdc', '#ffc4a1'],
  shapes: [
    {
      type: 'group',
      when: 'active',
      fill: 'none',
      stroke: 'tone',
      strokeWidth: 2,
      linecap: 'round',
      children: [
        { type: 'path', d: 'M25 15q-2-2.5 0-5', motion: 'float' },
        { type: 'path', d: 'M32 13.5q-2-2.5 0-5', motion: 'float', delay: 0.4 },
        { type: 'path', d: 'M39 15q-2-2.5 0-5', motion: 'float', delay: 0.8 },
      ],
    },
    { type: 'ellipse', cx: 32, cy: 54, rx: 14, ry: 2.6, fill: '#6a2a10', opacity: 0.1 },
    { type: 'ellipse', cx: 32, cy: 36, rx: 14, ry: 17, fill: 'surface' },
    { type: 'ellipse', cx: 32, cy: 36, rx: 14, ry: 17, fill: 'tone', opacity: 0.22, when: 'active', motion: 'pulse', origin: [32, 36] },
    { type: 'path', d: 'M18.3 40C22 44.5 42 44.5 45.7 40C45 48 39.5 53 32 53S19 48 18.3 40Z', fill: '#ffd36b' },
    { type: 'path', d: 'M21.5 45Q32 50 42.5 45', fill: 'none', stroke: '#eab14a', strokeWidth: 1.2, linecap: 'round' },
    { type: 'ellipse', cx: 27, cy: 30.5, rx: 1.5, ry: 2, fill: 'ink' },
    { type: 'ellipse', cx: 37, cy: 30.5, rx: 1.5, ry: 2, fill: 'ink' },
    { type: 'path', d: 'M29.4 34.2Q32 36.4 34.6 34.2', fill: 'none', stroke: 'ink', strokeWidth: 1.4, linecap: 'round' },
    { type: 'circle', cx: 23.4, cy: 34, r: 2.2, fill: '#ffb3a7', opacity: 0.8 },
    { type: 'circle', cx: 40.6, cy: 34, r: 2.2, fill: '#ffb3a7', opacity: 0.8 },
  ],
})
