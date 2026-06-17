import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #081124 0%, #0c1e3d 60%, #0e2a52 100%)",
          borderRadius: 120,
          position: "relative",
        }}
      >
        {/* Glow backdrop */}
        <div
          style={{
            position: "absolute",
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(6,182,212,0.22) 0%, transparent 70%)",
            top: 116,
            left: 116,
          }}
        />

        {/* PF text */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 224,
            fontWeight: 900,
            letterSpacing: "-8px",
            background: "linear-gradient(135deg, #67e8f9 0%, #38bdf8 40%, #818cf8 100%)",
            backgroundClip: "text",
            color: "transparent",
            lineHeight: 1,
            marginTop: 8,
          }}
        >
          PF
        </div>
      </div>
    ),
    { ...size }
  );
}
