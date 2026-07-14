import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 沿用沙盒版（apps/web）的蒼瀾主題色，兩款遊戲共享同一個世界的視覺語言。
        abyss: "#0b1526",
        wave: "#12283f",
        foam: "#9fc3e0",
        gold: "#d9a441",
      },
    },
  },
  plugins: [],
} satisfies Config;
