import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 蒼瀾主題色（暫定，M6 統一視覺）
        abyss: "#0b1526",
        wave: "#12283f",
        foam: "#9fc3e0",
        gold: "#d9a441",
      },
    },
  },
  plugins: [],
} satisfies Config;
