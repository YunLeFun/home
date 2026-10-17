import { definePluginIcon } from '../icon'

/** 云端电视: a slim screen that lights up with a sunny cloudscape. */
export const televisionIcon = definePluginIcon({
  background: ['#eeeaff', '#c8c4f5'],
  shapes: [
    { type: 'ellipse', cx: 32, cy: 54, rx: 18, ry: 2.4, fill: '#251d5a', opacity: 0.1 },
    { type: 'path', d: 'M24 45l-3.4 7.5M40 45l3.4 7.5', stroke: 'ink', strokeWidth: 2.4, linecap: 'round' },
    { type: 'rect', x: 9, y: 13, width: 46, height: 33, rx: 6, fill: '#2f3647' },
    { type: 'rect', x: 12, y: 16, width: 40, height: 26, rx: 3.5, fill: '#1c2232' },
    { type: 'path', d: 'M14.5 18h9l-6 11h-3Z', fill: '#ffffff', opacity: 0.07, when: 'idle' },
    {
      type: 'group',
      when: 'active',
      children: [
        { type: 'rect', x: 12, y: 16, width: 40, height: 26, rx: 3.5, fill: '#a3d2f6' },
        { type: 'circle', cx: 44, cy: 23, r: 3.4, fill: '#fff3c4', motion: 'pulse', origin: [44, 23] },
        {
          type: 'group',
          fill: '#ffffff',
          motion: 'float',
          children: [
            { type: 'circle', cx: 21, cy: 25, r: 2.4 },
            { type: 'circle', cx: 24, cy: 23.6, r: 3 },
            { type: 'circle', cx: 27, cy: 25, r: 2.4 },
          ],
        },
        { type: 'path', d: 'M12 36Q21 29 32 34.5T52 32.5V38.5A3.5 3.5 0 0 1 48.5 42H15.5A3.5 3.5 0 0 1 12 38.5Z', fill: '#9bd09f' },
        { type: 'path', d: 'M12 39.5Q26 33.5 52 38.5A3.5 3.5 0 0 1 48.5 42H15.5A3.5 3.5 0 0 1 12 39.5Z', fill: '#6fb07a' },
      ],
    },
    { type: 'circle', cx: 32, cy: 44, r: 0.9, fill: 'tone' },
  ],
})
