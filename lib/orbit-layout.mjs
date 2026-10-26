// Lay out the rotating card planes by their projected screen edges. Equal
// angular steps alone produce uneven visible gaps under perspective.
export const orbitSlots = 12;
export const orbitIndices = (phase) =>
  Array.from(
    { length: orbitSlots },
    (_, slot) =>
      slot +
      orbitSlots * Math.floor((phase - slot + orbitSlots / 2) / orbitSlots),
  );

export function orbitLayout(
  phase,
  { width = 300, perspective = 1400, depth = 495, gap = 12, tilt = 0.78 } = {},
) {
  const indices = orbitIndices(phase),
    planes = new Map();
  for (const logical of indices) {
    const angle = ((logical - phase) * 2 * Math.PI) / orbitSlots;
    const front = Math.cos(angle),
      rotation = angle * tilt,
      z = (front - 1) * depth;
    const halfCos = (width / 2) * Math.cos(rotation),
      halfSin = (width / 2) * Math.sin(rotation);
    const leftScale = perspective / (perspective - z - halfSin);
    const rightScale = perspective / (perspective - z + halfSin);
    planes.set(logical, {
      logical,
      angle,
      z: front - 1,
      front,
      halfCos,
      leftScale,
      rightScale,
      x: 0,
    });
  }
  const base = Math.floor(phase),
    fraction = phase - base;
  const first = planes.get(base),
    second = planes.get(base + 1);
  const a = -first.rightScale,
    b = second.leftScale;
  const c = ((1 - fraction) * (first.leftScale + first.rightScale)) / 2;
  const d = (fraction * (second.leftScale + second.rightScale)) / 2;
  const edgeGap =
    gap + first.rightScale * first.halfCos + second.leftScale * second.halfCos;
  // Blend the two nearest projected centers around the viewport center. At an
  // integer phase, both choices of anchor give exactly the same layout.
  const center =
    (-(1 - fraction) * (first.rightScale - first.leftScale) * first.halfCos) /
      2 -
    (fraction * (second.rightScale - second.leftScale) * second.halfCos) / 2;
  const determinant = a * d - b * c;
  first.x = (edgeGap * d - b * center) / determinant;
  second.x = (a * center - edgeGap * c) / determinant;
  const min = Math.min(...indices),
    max = Math.max(...indices);
  for (let logical = base - 1; logical >= min; logical--) {
    const card = planes.get(logical),
      next = planes.get(logical + 1);
    card.x =
      (next.leftScale * (next.x - next.halfCos) - gap) / card.rightScale -
      card.halfCos;
  }
  for (let logical = base + 2; logical <= max; logical++) {
    const card = planes.get(logical),
      previous = planes.get(logical - 1);
    card.x =
      (previous.rightScale * (previous.x + previous.halfCos) + gap) /
        card.leftScale +
      card.halfCos;
  }
  return indices.map((logical) => {
    const card = planes.get(logical);
    // Perspective can turn a very oblique plane away from the viewer before
    // its orbit angle reaches 90 degrees. Match CSS backface culling explicitly.
    const facing =
      card.rightScale * (card.x + card.halfCos) >
      card.leftScale * (card.x - card.halfCos);
    return {
      logical,
      x: card.x,
      z: card.z,
      angle: (card.angle * 180) / Math.PI,
      opacity: facing ? Math.max(0, Math.min(1, (card.front + 0.05) / 0.4)) : 0,
      front: card.front,
    };
  });
}
