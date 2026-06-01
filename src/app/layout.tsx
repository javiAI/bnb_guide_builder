import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import "./design-system.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

// Serif is exposed as a token but no component currently sets it. Ship one
// weight so the `--font-serif` variable still resolves without paying for 6
// font files on every operator paint.
const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Guide Builder",
  description: "Guías inteligentes para alojamientos turísticos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${serif.variable}`}
    >
      <head>
        {/* Pre-paint: resolve stored theme preference before CSS loads to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var e=document.documentElement;var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches);e.setAttribute("data-theme",d?"dark":"light");var nc=localStorage.getItem("shell:nav-collapsed")==="true";var rc=localStorage.getItem("shell:rail-collapsed")!=="false";if(nc)e.setAttribute("data-nav-collapsed","true");if(rc)e.setAttribute("data-rail-collapsed","true");function cw(v,mn,mx,df){v=parseInt(v,10);if(isNaN(v))return df;return Math.min(mx,Math.max(mn,v));}e.style.setProperty("--sidebar-width",(nc?56:cw(localStorage.getItem("shell:nav-width"),208,360,240))+"px");e.style.setProperty("--rail-width",(rc?0:cw(localStorage.getItem("shell:rail-width"),264,440,300))+"px")}catch(e){document.documentElement.setAttribute("data-theme","light")}})();`,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
