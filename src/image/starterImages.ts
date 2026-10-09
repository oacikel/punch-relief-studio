/** License-clean 2D starter artwork for the import picker. Every pattern
 * below is generated procedurally (plain canvas drawing calls), so none of
 * it carries any third-party rights -- the same guarantee `BUILTIN_SAMPLES`
 * (see `src/domain/samples`) gives for the 3D samples. */
export interface Starter2D {
  id: string;
  name: string;
  description: string;
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
}

const INK = '#1f2a24';

function drawDotGrid(ctx: CanvasRenderingContext2D, size: number): void {
  const columns = 10;
  const cell = size / columns;
  ctx.fillStyle = INK;
  for (let row = 0; row < columns; row++) {
    for (let col = 0; col < columns; col++) {
      const cx = cell * (col + 0.5);
      const cy = cell * (row + 0.5);
      const distanceFromCenter = Math.hypot(cx - size / 2, cy - size / 2) / (size / 2);
      const radius = Math.max(1, (cell / 2.2) * (1 - distanceFromCenter));
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawChevronBands(ctx: CanvasRenderingContext2D, size: number): void {
  const bandHeight = size / 10;
  const zigzagWidth = size / 8;
  ctx.strokeStyle = INK;
  ctx.lineWidth = bandHeight * 0.55;
  for (let y = -bandHeight; y < size + bandHeight; y += bandHeight) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += zigzagWidth) {
      const step = Math.round(x / zigzagWidth);
      const offset = step % 2 === 0 ? bandHeight / 2 : -bandHeight / 2;
      ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }
}

function drawSpiralCoil(ctx: CanvasRenderingContext2D, size: number): void {
  const center = size / 2;
  const maxRadius = size * 0.45;
  const turns = 6;
  const steps = 480;
  ctx.strokeStyle = INK;
  ctx.lineWidth = size * 0.018;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    const radius = t * maxRadius;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export const TWO_D_STARTERS: Starter2D[] = [
  {
    id: 'starter-dot-grid',
    name: 'Dot Grid',
    description: 'A grid of dots that shrink toward the edges -- a gentle, even starting texture.',
    draw: drawDotGrid,
  },
  {
    id: 'starter-chevron-bands',
    name: 'Chevron Bands',
    description: 'Zig-zagging horizontal bands -- a bold repeating stripe pattern.',
    draw: drawChevronBands,
  },
  {
    id: 'starter-spiral-coil',
    name: 'Spiral Coil',
    description: 'A single coiled line winding out from the center.',
    draw: drawSpiralCoil,
  },
];

export function getTwoDStarterById(id: string): Starter2D | undefined {
  return TWO_D_STARTERS.find((starter) => starter.id === id);
}

/** Renders a starter's pattern to an offscreen canvas and packages it as a
 * PNG `File`, so it can be handed to the exact same `onImageSelected` path
 * a dropped image file uses. */
export async function createStarterImageFile(starter: Starter2D, size: number): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not render the starter image.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  starter.draw(ctx, size);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render the starter image.');
  return new File([blob], `${starter.id}.png`, { type: 'image/png' });
}
