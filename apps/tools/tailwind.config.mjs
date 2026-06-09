/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        void: "#07070e",
        surface: "#0f0f1c",
        "surface-2": "#161628",
        border: "#1e1e3a",
        "border-bright": "#2e2e5a",
        text: "#e8e8ff",
        muted: "#6666aa",
        dim: "#3a3a60",
        neon: "#7c6af7",
        "neon-cyan": "#22d3ee",
        "neon-green": "#4ade80",
        "neon-pink": "#f472b6",
        "neon-orange": "#fb923c",
        "neon-yellow": "#facc15",
        "neon-red": "#f87171",
      },
      keyframes: {
        pulse_dot: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.3" } },
        flicker: { "0%, 100%": { opacity: "1" }, "92%": { opacity: "1" }, "93%": { opacity: "0.8" }, "94%": { opacity: "1" }, "96%": { opacity: "0.9" }, "97%": { opacity: "1" } },
        scan: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100vh)" } },
        "glow-pulse": { "0%, 100%": { boxShadow: "0 0 8px 2px rgba(124,106,247,0.3)" }, "50%": { boxShadow: "0 0 20px 4px rgba(124,106,247,0.6)" } },
        float: { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-6px)" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        pulse_dot: "pulse_dot 2s ease-in-out infinite",
        flicker: "flicker 8s linear infinite",
        scan: "scan 6s linear infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "slide-up": "slide-up 0.4s ease-out forwards",
      },
    },
  },
  plugins: [],
};
