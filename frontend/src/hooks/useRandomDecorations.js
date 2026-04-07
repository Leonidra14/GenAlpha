import { useMemo } from "react";

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function useRandomDecorations({
  seed = 123,
  starsMin = 18,
  starsRange = 10,
  flightsMin = 6,
  flightsRange = 4,
  starSrc,
  flightSrc,
} = {}) {
  return useMemo(() => {
    const rand = mulberry32(seed);
    const starsCount = starsMin + Math.floor(rand() * starsRange);
    const flightsCount = flightsMin + Math.floor(rand() * flightsRange);
    const items = [];

    const add = (count, type) => {
      for (let i = 0; i < count; i += 1) {
        const left = `${Math.round(rand() * 100)}%`;
        const top = `${Math.round(rand() * 85)}%`;
        const scale = type === "star" ? 0.6 + rand() * 0.9 : 0.75 + rand() * 0.7;
        const rotate = (rand() * 30 - 15).toFixed(1);
        const opacity = (0.18 + rand() * 0.32).toFixed(2);

        items.push({
          id: `${type}-${i}`,
          type,
          src: type === "star" ? starSrc : flightSrc,
          style: {
            left,
            top,
            opacity,
            transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
          },
        });
      }
    };

    add(starsCount, "star");
    add(flightsCount, "flight");
    return items;
  }, [seed, starsMin, starsRange, flightsMin, flightsRange, starSrc, flightSrc]);
}
