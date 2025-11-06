import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSwitcher } from "@/components/theme-switch";

const Mont = Montserrat({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ollama Web UI",
  description:
    "Ollama Web UI is a cutting-edge, open-source platform designed for running Large Language Models (LLMs) locally in your browser, completely offline. With Ollama, you can experience fast, private, and secure AI-powered interactions without relying on the internet. Empower your device with seamless local execution of LLMs, all through an intuitive web interface.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${Mont.className} antialiased relative`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeSwitcher className="fixed top-2 right-5" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
