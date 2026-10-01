import type { VariantInput } from '../../types/product';

export function comboKey(sizeId: number, colorId: number): string {
  return `${sizeId}-${colorId}`;
}

export function computeActiveVariants(
  selectedSizeIds: Set<number>,
  selectedColorIds: Set<number>,
  disabledCombos: Set<string>,
): VariantInput[] {
  const result: VariantInput[] = [];
  for (const sizeId of selectedSizeIds) {
    for (const colorId of selectedColorIds) {
      if (!disabledCombos.has(comboKey(sizeId, colorId))) {
        result.push({ sizeId, colorId });
      }
    }
  }
  return result;
}
