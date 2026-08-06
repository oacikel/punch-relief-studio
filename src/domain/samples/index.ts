import { GEOMETRIC_STEPS_SAMPLE_ID, generateGeometricStepsSample } from './geometricSteps';
import { RIPPLE_SAMPLE_ID, generateRippleSample } from './ripple';
import { ROUNDED_RELIEF_SAMPLE_ID, generateRoundedReliefSample } from './roundedRelief';
import type { MeshData } from './meshGrid';

export interface SampleDefinition {
  id: string;
  name: string;
  description: string;
  generate: (resolution?: number, size?: number) => MeshData;
}

export const BUILTIN_SAMPLES: SampleDefinition[] = [
  {
    id: RIPPLE_SAMPLE_ID,
    name: 'Concentric Ripple',
    description: 'A radial sinusoidal wave -- good for testing smooth gradient handling.',
    generate: generateRippleSample,
  },
  {
    id: ROUNDED_RELIEF_SAMPLE_ID,
    name: 'Rounded Relief (Eye)',
    description: 'A rounded, eye-like curved form -- a recognizable organic test shape.',
    generate: generateRoundedReliefSample,
  },
  {
    id: GEOMETRIC_STEPS_SAMPLE_ID,
    name: 'Geometric Steps',
    description: 'Concentric square terraces with hard edges -- easy to inspect height boundaries.',
    generate: generateGeometricStepsSample,
  },
];

export function getSampleById(id: string): SampleDefinition | undefined {
  return BUILTIN_SAMPLES.find((s) => s.id === id);
}
