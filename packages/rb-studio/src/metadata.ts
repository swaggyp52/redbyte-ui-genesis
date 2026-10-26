import { getDesignChipMetadata, getDesignChipMetadataForNode } from '@redbyte/rb-apps/domain';
import type { SceneMetadataResolver } from '@redbyte/rb-logic-view/scene';

/** The same symbol metadata Design uses, so the studio draws the same pins. */
export const sceneMetadata: SceneMetadataResolver = (type, node) =>
  node ? getDesignChipMetadataForNode(node) ?? getDesignChipMetadata(type) : getDesignChipMetadata(type);

export function shortHash(value: string | null | undefined, length = 6): string {
  return value ? value.replace(/^run-/, '').slice(0, length) : '—';
}
