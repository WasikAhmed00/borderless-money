import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "xPay — Send more home",
  description: "See the exact amount that arrives in Bangladesh before you send.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* AuthProvider wraps entire app to provide JWT + role via localStorage */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
