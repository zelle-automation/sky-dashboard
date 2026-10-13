import type { Metadata } from "next";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./admin.css";
import { ICON_SPRITE } from "@/admin/icons";
import { adminThemeInit } from "@/admin/theme-init";

export const metadata: Metadata = {
  title: { default: "Control deck · Sky Holidays", template: "%s · Sky Holidays admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: adminThemeInit }} />
      </head>
      <body>
        <div dangerouslySetInnerHTML={{ __html: ICON_SPRITE }} style={{ display: "contents" }} />
        {children}
      </body>
    </html>
  );
}
