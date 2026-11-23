"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { Reel } from "@/lib/signature/showcase";

// ---------------------------------------------------------------------------
// A silent reel that plays by itself while it is on screen and stops when it
// is not. Nothing downloads beyond the poster until it comes into view. Anyone
// can pause it (it runs longer than five seconds), and a visitor who asks
// their device for less motion gets the poster and a Play button instead.
// ---------------------------------------------------------------------------

export function LoopVideo({ reel, label }: { reel: Reel; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const stopped = useRef(false); // the visitor pressed Pause
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true; // React does not always write the attribute; browsers refuse to autoplay without it
    stopped.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const watch = new IntersectionObserver(
      ([seen]) => {
        if (seen.isIntersecting && !stopped.current) {
          video.play().catch((e) => console.warn("reel did not start by itself", e));
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 },
    );
    watch.observe(video);
    return () => watch.disconnect();
  }, []);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      stopped.current = false;
      video.play().catch((e) => console.warn("reel did not start", e));
    } else {
      stopped.current = true;
      video.pause();
    }
  };

  return (
    <div className="relative" style={{ aspectRatio: `${reel.w} / ${reel.h}`, backgroundColor: "#101010" }}>
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: "cover" }}
        poster={reel.poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={reel.srcSmall} type="video/mp4" media="(max-width: 700px)" />
        <source src={reel.src} type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause the reel" : "Play the reel"}
        className="absolute flex items-center justify-center"
        style={{ right: 12, bottom: 12, width: 44, height: 44, borderRadius: 2, backgroundColor: "rgba(16,16,16,0.72)", color: "#fff" }}
      >
        {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
      </button>
    </div>
  );
}
