/**
 * Shared helper: build a regular XY grid of vertices with a per-vertex
 * height function, triangulated as a standard grid mesh, with analytic
 * normals from the height function's gradient. Pure data (no Three.js) so
 * the three built-in sample generators stay in `src/domain` per CLAUDE.md.
 */

export interface MeshData {
  positions: Float32Array; // xyz triples
  normals: Float32Array; // xyz triples
  indices: Uint32Array;
}

export function buildHeightFieldMesh(
  resolution: number,
  size: number,
  heightFn: (u: number, v: number) => number, // u,v in [-1, 1]
): MeshData {
  const verticesPerSide = resolution + 1;
  const positions = new Float32Array(verticesPerSide * verticesPerSide * 3);
  const normals = new Float32Array(verticesPerSide * verticesPerSide * 3);
  const eps = 1 / resolution;

  for (let j = 0; j <= resolution; j++) {
    for (let i = 0; i <= resolution; i++) {
      const u = (i / resolution) * 2 - 1;
      const v = (j / resolution) * 2 - 1;
      const y = heightFn(u, v);
      const idx = (j * verticesPerSide + i) * 3;
      positions[idx] = u * (size / 2);
      positions[idx + 1] = y;
      positions[idx + 2] = v * (size / 2);

      const dHdu =
        (heightFn(Math.min(1, u + eps), v) - heightFn(Math.max(-1, u - eps), v)) / (2 * eps);
      const dHdv =
        (heightFn(u, Math.min(1, v + eps)) - heightFn(u, Math.max(-1, v - eps))) / (2 * eps);
      const nx = -dHdu;
      const ny = 1;
      const nz = -dHdv;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      normals[idx] = nx / len;
      normals[idx + 1] = ny / len;
      normals[idx + 2] = nz / len;
    }
  }

  const indices = new Uint32Array(resolution * resolution * 6);
  let p = 0;
  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const a = j * verticesPerSide + i;
      const b = a + 1;
      const c = a + verticesPerSide;
      const d = c + 1;
      indices[p++] = a;
      indices[p++] = c;
      indices[p++] = b;
      indices[p++] = b;
      indices[p++] = c;
      indices[p++] = d;
    }
  }

  return { positions, normals, indices };
}
