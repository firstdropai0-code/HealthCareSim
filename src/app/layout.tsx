import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { IntroSplash } from "@/components/layout/IntroSplash";
import { AuthProvider } from "@/lib/firebase/AuthProvider";
import "./globals.css";

/**
 * Runs before the first paint, so the splash is either shown or gone — never
 * shown and then yanked. Only touches a class on <html>, which React does not
 * manage, so there is nothing here for hydration to disagree about.
 */
/**
 * Clears the splash by injecting a <style>, NOT by adding a class to <html>.
 *
 * React renders className on <html>, so it reconciles it during hydration and
 * strips anything a pre-paint script added — which both undid the skip and
 * produced a hydration mismatch warning. A style element appended at runtime
 * sits outside React's tree, so it survives.
 *
 * The splash otherwise plays on every real page load. In-app navigation never
 * replays it, because the App Router keeps the root layout mounted.
 */
const introScript = `(function(){
  var done = false;
  function clearSplash(){
    if (done) return;
    done = true;
    var s = document.createElement('style');
    s.textContent = '#intro-splash{display:none !important}';
    (document.head || document.documentElement).appendChild(s);
  }

  // Loaded in a background tab: CSS animations are frozen while a document is
  // hidden, so the splash would sit there and then play whenever the tab is
  // finally focused, long after the user has "arrived".
  if (document.hidden) { clearSplash(); return; }

  // Failsafe. The splash covers the whole viewport, so anything that stops the
  // animation finishing — a dropped stylesheet, a frozen tab, an engine that
  // ignores the keyframes — would otherwise lock the user out of the app.
  setTimeout(clearSplash, 4000);
})();`;

// One neutral UI face for everything. Both variables point at it so the
// `.font-display` helper and globals.css keep working; typographic hierarchy
// comes from size and weight, not from a second typeface.
const uiFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FirstDropAI Healthcare Simulation",
  description: "Communication-focused healthcare roleplay simulation prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={uiFont.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body>
        <IntroSplash />
        {/*
          Mounted here rather than inside AppShell: the feedback page renders
          AppShell from three separate return branches, so a provider in there
          would tear down and re-subscribe auth on every state transition.
        */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
