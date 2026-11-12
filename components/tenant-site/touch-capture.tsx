"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureTouch } from "@/lib/attribution/touch-client";

// Records the visitor's first touch (UTM / click id / external referrer) on
// every hosted page view, so forms can report where the lead came from even
// when the chatbot embed is off. Renders nothing.
export function TouchCapture() {
  const pathname = usePathname();
  useEffect(() => {
    captureTouch();
  }, [pathname]);
  return null;
}
