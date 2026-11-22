import { definePluginIcon } from '../icon'
import { cloudPath, sleevePath } from './outline'

/** The home's three-lobed cloud in a warm yellow sleeve. */
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
        { type: 'path', d: 'M23 16q-2-2.5 0-5', motion: 'float' },
        { type: 'path', d: 'M32 10q-2-2.5 0-5', motion: 'float', delay: 0.4 },
        { type: 'path', d: 'M41 16q-2-2.5 0-5', motion: 'float', delay: 0.8 },
      ],
    },
    { type: 'ellipse', cx: 32, cy: 54, rx: 14, ry: 2.6, fill: '#6a2a10', opacity: 0.1 },
    { type: 'path', d: cloudPath, fill: 'surface' },
    { type: 'path', d: cloudPath, fill: 'tone', opacity: 0.22, when: 'active' },
    { type: 'path', d: sleevePath, fill: '#ffc658' },
    { type: 'path', d: 'M20 45Q32 48 44 45', fill: 'none', stroke: '#ffe096', strokeWidth: 1.3, linecap: 'round' },
    { type: 'ellipse', cx: 26, cy: 32, rx: 1.5, ry: 2, fill: 'ink' },
    { type: 'ellipse', cx: 38, cy: 32, rx: 1.5, ry: 2, fill: 'ink' },
    { type: 'path', d: 'M30 36Q32 38 34 36', fill: 'none', stroke: 'ink', strokeWidth: 1.4, linecap: 'round' },
    { type: 'ellipse', cx: 21, cy: 36, rx: 2.6, ry: 1.6, fill: '#ffb3a7' },
    { type: 'ellipse', cx: 43, cy: 36, rx: 2.6, ry: 1.6, fill: '#ffb3a7' },
  ],
})
