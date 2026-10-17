import { definePluginIcon } from '../icon'

/** 扫地机器人: a round little helper with a spinning side brush. */
export const robotVacuumIcon = definePluginIcon({
  background: ['#fff1df', '#ffcfa4'],
  shapes: [
    { type: 'ellipse', cx: 32, cy: 50, rx: 21, ry: 3.4, fill: '#5a3412', opacity: 0.1 },
    {
      type: 'group',
      motion: 'float',
      children: [
        { type: 'ellipse', cx: 32, cy: 39.5, rx: 20, ry: 11.5, fill: '#cdd6e1' },
        { type: 'ellipse', cx: 32, cy: 35, rx: 20, ry: 11.5, fill: 'surface' },
        { type: 'ellipse', cx: 32, cy: 32, rx: 10, ry: 5.2, fill: '#e3e9f1' },
        { type: 'path', d: 'M27 29.6Q32 27.6 37 29.6', fill: 'none', stroke: 'tone', strokeWidth: 1.8, linecap: 'round', motion: 'blink' },
        { type: 'ellipse', cx: 27, cy: 38.5, rx: 1.5, ry: 2.1, fill: 'ink' },
        { type: 'ellipse', cx: 37, cy: 38.5, rx: 1.5, ry: 2.1, fill: 'ink' },
        { type: 'path', d: 'M13.5 38Q32 51 50.5 38', fill: 'none', stroke: '#9aabbf', strokeWidth: 1.4, linecap: 'round', opacity: 0.7 },
      ],
    },
    {
      type: 'group',
      motion: 'spin',
      origin: [15, 46],
      stroke: '#8fa0b6',
      strokeWidth: 1.3,
      linecap: 'round',
      children: [
        { type: 'line', x1: 15, y1: 46, x2: 10, y2: 44 },
        { type: 'line', x1: 15, y1: 46, x2: 16.5, y2: 51 },
        { type: 'line', x1: 15, y1: 46, x2: 19, y2: 42.5 },
      ],
    },
    { type: 'path', d: 'M50 15l1.2 3.3 3.3 1.2-3.3 1.2L50 24l-1.2-3.3-3.3-1.2 3.3-1.2Z', fill: '#ffffff', when: 'active', motion: 'pulse', origin: [50, 19.5] },
  ],
})
