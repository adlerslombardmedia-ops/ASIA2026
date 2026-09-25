import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import logoAsset from "@/assets/asia-cup-logo.png.asset.json";

// The tournament app is a client-side, realtime experience (auth, live
// scores, admin tools), so it renders only in the browser.
const TournamentApp = lazy(() => import("@/app/App.jsx"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ASIA CUP 2026 — Adlers Lombard FC | Bergamo, 27 Sept 2026" },
      {
        name: "description",
        content:
          "Live scores, groups, fixtures, knockouts and stats for the ASIA CUP 2026 football tournament presented by Adlers Lombard FC at Campo Sportivo Comunale A. Villa.",
      },
      { property: "og:title", content: "ASIA CUP 2026 — Adlers Lombard FC" },
      {
        property: "og:description",
        content: "17 Asian teams. One day. One cup. Live scores and stats from Bergamo, 27 September 2026.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Splash() {
  return (
    <div className="splash">
      <img src={logoAsset.url} alt="Asia Cup 2026" className="splash-logo" />
      <div className="splash-bar" />
    </div>
  );
}

function Index() {
  return (
    <Suspense fallback={<Splash />}>
      <TournamentApp />
    </Suspense>
  );
}
