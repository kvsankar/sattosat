/// <reference types="vite/client" />

const embeddedFiles = import.meta.glob('./embedded/*.tle', {
  as: 'raw',
  eager: true,
}) as Record<string, string>;

const embeddedByNorad = new Map<number, string[]>();

for (const [path, text] of Object.entries(embeddedFiles)) {
  const match = path.match(/\/(\d+)\.tle$/);
  if (!match) continue;
  const norad = Number(match[1]);
  if (!embeddedByNorad.has(norad)) {
    embeddedByNorad.set(norad, []);
  }
  embeddedByNorad.get(norad)!.push(text);
}

export function getEmbeddedTleTexts(noradId: number): string[] {
  return embeddedByNorad.get(noradId) ?? [];
}
