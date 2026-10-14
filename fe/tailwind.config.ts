import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-alt": "var(--surface-alt)",
        border: "var(--border)",
        "border-light": "var(--border-light)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-muted": "var(--text-muted)",
        chevron: "var(--chevron)",
        primary: "var(--primary)",
        "primary-text": "var(--primary-text)",
        "primary-bg": "var(--primary-bg)",
        "primary-border": "var(--primary-border)",
        "accent-purple": "var(--accent-purple)",
        "accent-green": "var(--accent-green)",
        "success-bg": "var(--success-bg)",
        "warn-bg": "var(--warn-bg)",
        "warn-border": "var(--warn-border)",
        "warn-text": "var(--warn-text)",
        "danger-bg": "var(--danger-bg)",
        "danger-text": "var(--danger-text)",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        sans: ["'Hanken Grotesk'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [typography],
} satisfies Config;
