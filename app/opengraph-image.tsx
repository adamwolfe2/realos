import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "RealEstaite, managed marketing for real estate operators.";
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
        <span
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "28px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#0A0A0A",
            display: "flex",
          }}
        >
          REALESTAITE
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
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
            Managed marketing for real estate operators
          </div>
          <div
            style={{
              fontSize: "76px",
              fontWeight: 400,
              color: "#0A0A0A",
              fontFamily: "Georgia, serif",
              lineHeight: 1.05,
              marginBottom: "28px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Marketing infrastructure that</span>
            <span style={{ color: "#2A52BE" }}>actually fills units.</span>
          </div>
          <div
            style={{
              fontSize: "22px",
              color: "#555555",
              lineHeight: 1.5,
              fontFamily: "monospace",
              display: "flex",
            }}
          >
            Site · Pixel · Chatbot · SEO · Managed ads
          </div>
        </div>

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
          realestaite.co
        </div>
      </div>
    ),
    { ...size }
  );
}
