import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Wholesail — Your wholesale business, fully automated.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          backgroundColor: "#F9F7F4",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "72px 80px",
          position: "relative",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "5px",
            backgroundColor: "#2A52BE",
            display: "flex",
          }}
        />

        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Sail icon */}
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
          >
            <path
              d="M16 2L16 28L6 28C6 28 14 16 16 2Z"
              fill="#2A52BE"
              opacity="0.9"
            />
            <path
              d="M18 8L18 28L26 28C26 28 20 18 18 8Z"
              fill="#2A52BE"
              opacity="0.55"
            />
            <path
              d="M4 29L28 29"
              stroke="#2A52BE"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <span
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "28px",
              fontWeight: "700",
              letterSpacing: "0.08em",
              color: "#0A0A0A",
              display: "flex",
            }}
          >
            WHOLESAIL
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
          {/* Eyebrow */}
          <div
            style={{
              fontSize: "16px",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#2A52BE",
              marginBottom: "24px",
              fontFamily: "monospace",
              display: "flex",
            }}
          >
            B2B Distribution Portals
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: "76px",
              fontWeight: "400",
              color: "#0A0A0A",
              fontFamily: "Georgia, serif",
              lineHeight: 1.05,
              marginBottom: "28px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Your wholesale business,</span>
            <span>fully automated.</span>
          </div>

          {/* Subline */}
          <div
            style={{
              fontSize: "22px",
              color: "#555555",
              lineHeight: 1.5,
              fontFamily: "monospace",
              display: "flex",
            }}
          >
            Client portal · Admin panel · SMS ordering · Stripe billing
          </div>
        </div>

        {/* Domain pill */}
        <div
          style={{
            backgroundColor: "#2A52BE",
            color: "#ffffff",
            fontSize: "16px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "12px 28px",
            fontFamily: "monospace",
            display: "flex",
          }}
        >
          wholesailhub.com
        </div>
      </div>
    ),
    { ...size }
  );
}
