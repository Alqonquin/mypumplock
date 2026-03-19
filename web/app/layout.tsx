import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PumpLock — Never Overpay for Gas Again",
  description: "Lock in your gas price today. 6-month protection plan, one upfront payment. If prices rise, you pay nothing extra.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
