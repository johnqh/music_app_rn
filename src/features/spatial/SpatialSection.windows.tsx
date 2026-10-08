import type { SpatialSectionProps } from './SpatialSection';

export type { SpatialSectionProps } from './SpatialSection';

// Do not import SpatialView/Skia on a platform without its native renderer.
export function SpatialSection(_props: SpatialSectionProps) {
  return null;
}
