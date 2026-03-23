import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PumpLock Gas Saver",
  description: "Lock in your gas price today. 1, 3, or 6-month protection plans, one upfront payment. If prices rise, you pay nothing extra.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
