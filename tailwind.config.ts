import type { Config } from "tailwindcss";

// Tailwind v4 is CSS-first (see the `@theme inline` block in globals.css) and
// auto-detects content — this file is kept only because components.json
// points shadcn's CLI at a config path.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};
export default config;
