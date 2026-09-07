// Several post-model-load steps (mergeDecorativeMeshes, BIM registration, shadow-caster
// registration, the load-time freeze loop) each do real per-mesh work in a plain
// forEach/map over every mesh in the model. On a small model that's instant; on a heavy
// "high mesh" architectural/furniture-heavy import (thousands of separate meshes) they
// stack up, back-to-back, in the same synchronous task with nothing yielding control back
// to the browser in between - long enough for Chrome to conclude the tab has hung and
// show its own "Page Unresponsive" dialog, even though the work itself would have
// finished fine given a few more seconds.
//
// Processing a batch at a time and yielding via requestAnimationFrame between batches
// keeps the browser's own hang detector satisfied (and the loading toast/spinner actually
// painting) without meaningfully slowing down the total work - the model was never
// interactive during this phase anyway (meshes are still being registered/frozen), so
// there's no correctness reason it needs to be one giant uninterrupted synchronous pass.
export async function runChunked<T>(
  items: T[],
  work: (item: T, index: number) => void,
  chunkSize = 300
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, items.length);
    for (let j = i; j < end; j++) work(items[j], j);
    if (end < items.length) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }
}
