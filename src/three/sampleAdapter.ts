/**
 * Convert pure sample MeshData (src/domain/samples) into a Three.js
 * BufferGeometry. This is the only place sample generation touches
 * Three.js, keeping the generators themselves framework-free and unit
 * testable.
 */
import * as THREE from 'three';
import type { MeshData } from '@/domain/samples/meshGrid';

export function meshDataToGeometry(mesh: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
