import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./modules/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta adaptada da identidade visual da UORT (teal + navy).
        moveo: {
          bg: "#F5FBFB",
          card: "#FFFFFF",
          ink: "#10222B",
          muted: "#5B6E73",
          border: "#DCEAEB",
          primary: "#128C90",
          primaryDark: "#0B6367",
          primarySoft: "#E7F5F5",
          right: "#128C90",
          left: "#1B3A4B",
          warn: "#D9A441",
          danger: "#D64545",
        },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
