import { useEffect, useRef, useState } from "react";
import upImg from "@/assets/microbus/up.png";
import downImg from "@/assets/microbus/down.png";
import rightImg from "@/assets/microbus/right.png";
import leftImg from "@/assets/microbus/left.png";

const VIEWS = [upImg, rightImg, downImg, leftImg];
const carImg = rightImg;

const SIZE = 128;
let imgs: HTMLImageElement[] | null = null;
let img: HTMLImageElement | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const cache = new Map<string, string>();

function ensureImage() {
  if (imgs || typeof window === "undefined") return;
  let n = 0;
  imgs = VIEWS.map((src) => {
    const i = new Image();
    i.onload = () => {
      if (++n === VIEWS.length) {
        loaded = true;
        listeners.forEach((l) => l());
      }
    };
    i.src = src;
    return i;
  });
  img = imgs[1];
}

/** Re-renders the caller once the car image has loaded. */
export function useCarIconReady() {
  const [, setTick] = useState(0);
  useEffect(() => {
    ensureImage();
    if (loaded) return;
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return loaded;
}

/** Data URL of the car rotated to `heading` degrees (0 = north). */
export function carIconUrl(heading = 0, opts: { faded?: boolean; ring?: string } = {}) {
  ensureImage();
  const h = Math.round((((heading % 360) + 360) % 360) / 90) % 4;
  if (!loaded || !imgs) return VIEWS[h];
  const view = imgs[h];
  const key = `${h}|${opts.faded ? 1 : 0}|${opts.ring ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d")!;
  if (opts.ring) {
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = opts.ring + "33";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = opts.ring;
    ctx.stroke();
  }
  ctx.globalAlpha = opts.faded ? 0.45 : 1;
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const d = SIZE * 0.88;
  ctx.drawImage(view, -d / 2, -d / 2, d, d);
  const url = c.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

export function carIcon(heading = 0, opts: { faded?: boolean; ring?: string; size?: number } = {}): google.maps.Icon {
  const s = opts.size ?? 60;
  return {
    url: carIconUrl(heading, opts),
    scaledSize: new google.maps.Size(s, s),
    anchor: new google.maps.Point(s / 2, s / 2),
  };
}

type LL = { lat: number; lng: number };

export function computeHeading(a: LL, b: LL): number | null {
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLng = (b.lng - a.lng) * toR;
  const dist = Math.sqrt(dLat ** 2 + (Math.cos(a.lat * toR) * dLng) ** 2) * 6371000;
  if (dist < 5) return null;
  const y = Math.sin(dLng) * Math.cos(b.lat * toR);
  const x = Math.cos(a.lat * toR) * Math.sin(b.lat * toR) - Math.sin(a.lat * toR) * Math.cos(b.lat * toR) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Tracks heading per id from successive positions. */
export function useHeadings() {
  const ref = useRef(new Map<string, { pos: LL; heading: number }>());
  return (id: string, lat: number, lng: number) => {
    const prev = ref.current.get(id);
    if (!prev) {
      ref.current.set(id, { pos: { lat, lng }, heading: 0 });
      return 0;
    }
    const h = computeHeading(prev.pos, { lat, lng });
    if (h !== null) ref.current.set(id, { pos: { lat, lng }, heading: h });
    return ref.current.get(id)!.heading;
  };
}
