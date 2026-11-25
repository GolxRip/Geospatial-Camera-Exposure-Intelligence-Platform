'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FeedCanvasProps {
  /** Time stops: every later frame is a copy of the last (the freeze and loop attack). */
  frozen?: boolean;
  /** Blur or exposure drift from the camera's baseline, 0 to 1. Applied with a CSS blur on the element. */
  blur?: number;
  /** Declared spec does not match the stream: the picture is letterboxed and pillarboxed. */
  mismatch?: boolean;
  /** Accessible description of what the pane shows. */
  label: string;
  className?: string;
}

const INK = '#0A0C0B';
const BONE = '#E7EAE3';
const BONE_2 = '#A4AAA1';

/** One moving "vehicle" per lane; x is a fraction of the width per second. */
const LANES = [
  { y: 0.58, w: 0.14, h: 0.07, speed: 0.11, phase: 0.1, tone: BONE },
  { y: 0.66, w: 0.1, h: 0.06, speed: -0.08, phase: 0.55, tone: BONE_2 },
  { y: 0.74, w: 0.18, h: 0.09, speed: 0.06, phase: 0.8, tone: BONE },
  { y: 0.83, w: 0.12, h: 0.07, speed: -0.13, phase: 0.3, tone: BONE_2 },
] as const;

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  // horizon and a few static structures, so a frozen frame still reads as a scene
  ctx.strokeStyle = BONE_2;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  ctx.lineTo(w, h * 0.5);
  ctx.stroke();
  for (let i = 0; i < 7; i += 1) {
    const bw = w * (0.05 + ((i * 37) % 7) * 0.012);
    const bh = h * (0.12 + ((i * 53) % 5) * 0.05);
    ctx.fillStyle = BONE_2;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(w * (0.04 + i * 0.14), h * 0.5 - bh, bw, bh);
  }
  ctx.globalAlpha = 1;
  for (const lane of LANES) {
    const span = 1 + lane.w;
    const raw = (lane.phase + lane.speed * t) % span;
    const x = (raw < 0 ? raw + span : raw) - lane.w;
    ctx.fillStyle = lane.tone;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x * w, lane.y * h, lane.w * w, lane.h * h);
  }
  ctx.globalAlpha = 1;
}

/**
 * The feed pane (FRONTEND_SPEC.md sections 7.3, 7.5 and 9.4). It draws a small moving scene on a 2D canvas: vehicles on four
 * lanes. Freezing stops the clock, blur is applied to the element, a spec mismatch letterboxes the picture. The WebGL feed field
 * of the spec replaces this in a later phase; the props stay the same. Under reduced motion it draws one still frame.
 * Drawing pauses while the pane is off screen.
 */
export function FeedCanvas({
  frozen = false,
  blur = 0,
  mismatch = false,
  label,
  className,
}: FeedCanvasProps) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const clock = React.useRef(0);
  const frozenRef = React.useRef(frozen);
  const visible = React.useRef(true);
  const reduced = React.useRef(false);
  React.useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = mq.matches;
    const onMq = () => {
      reduced.current = mq.matches;
      paint();
    };

    let raf = 0;
    let last = 0;

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas!.getBoundingClientRect();
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
    }

    function paint() {
      draw(ctx!, canvas!.width, canvas!.height, clock.current);
    }

    function frame(now: number) {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (!frozenRef.current && !reduced.current) {
        clock.current += dt;
        paint();
      }
      if (visible.current && !reduced.current) raf = requestAnimationFrame(frame);
      else raf = 0;
    }

    function start() {
      if (!raf && visible.current && !reduced.current) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }

    size();
    paint();
    start();

    const ro = new ResizeObserver(() => {
      size();
      paint();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry?.isIntersecting ?? true;
      if (visible.current) start();
    });
    io.observe(canvas);
    mq.addEventListener('change', onMq);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener('change', onMq);
    };
  }, []);

  return (
    <div
      className={cn(
        'relative aspect-video overflow-hidden rounded-panel border border-line bg-ink-0',
        className,
      )}
    >
      <canvas
        ref={ref}
        role="img"
        aria-label={label}
        className="block size-full"
        style={{ filter: blur > 0 ? `blur(${(blur * 7).toFixed(1)}px)` : undefined }}
      />
      {mismatch ? (
        <>
          <span aria-hidden className="absolute inset-x-0 top-0 h-[14%] bg-ink-0" />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[14%] bg-ink-0" />
          <span aria-hidden className="absolute inset-y-0 left-0 w-[12%] bg-ink-0" />
          <span aria-hidden className="absolute inset-y-0 right-0 w-[12%] bg-ink-0" />
        </>
      ) : null}
    </div>
  );
}
