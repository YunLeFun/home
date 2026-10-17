import { definePluginIcon } from '../icon'

/** 云端空调: a cloud-white split unit that breathes tinted air while running. */
export const airConditionerIcon = definePluginIcon({
  background: ['#e2f0ff', '#b3d5f7'],
  shapes: [
    { type: 'ellipse', cx: 32, cy: 37.5, rx: 22, ry: 3, fill: '#0f2a4a', opacity: 0.08 },
    { type: 'rect', x: 8, y: 14, width: 48, height: 21, rx: 9, fill: 'surface' },
    { type: 'rect', x: 12, y: 27, width: 40, height: 2, rx: 1, fill: '#dfe8f2' },
    {
      type: 'group',
      fill: '#cfe1f4',
      children: [
        { type: 'circle', cx: 16.5, cy: 21.5, r: 2.6 },
        { type: 'circle', cx: 20, cy: 20.2, r: 3.3 },
        { type: 'circle', cx: 23.5, cy: 21.5, r: 2.6 },
        { type: 'rect', x: 14, y: 21.5, width: 12, height: 2.7, rx: 1.35 },
      ],
    },
    { type: 'circle', cx: 47, cy: 21, r: 1.8, fill: 'tone', motion: 'blink', origin: [47, 21] },
    { type: 'rect', x: 14, y: 31, width: 36, height: 2.6, rx: 1.3, fill: '#c9d6e4', when: 'idle' },
    { type: 'path', d: 'M14 31h36l-2.4 4.2H16.4Z', fill: '#c9d6e4', linejoin: 'round', when: 'active' },
    {
      type: 'group',
      when: 'active',
      stroke: 'tone',
      strokeWidth: 2.4,
      linecap: 'round',
      fill: 'none',
      children: [
        { type: 'path', d: 'M21 40q-2 3.5 0 7t0 7', motion: 'flow' },
        { type: 'path', d: 'M32 40q-2 3.5 0 7t0 7', motion: 'flow', delay: 0.35 },
        { type: 'path', d: 'M43 40q-2 3.5 0 7t0 7', motion: 'flow', delay: 0.7 },
      ],
    },
  ],
})
