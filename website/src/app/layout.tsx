import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://levkosyk.github.io/expo-ci-doctor/"),
  title: { default: "Expo CI Doctor — Explain failed Expo builds", template: "%s — Expo CI Doctor" },
  description: "Find the root cause of failed EAS, Xcode, Gradle, CocoaPods, and Metro builds from the build log.",
  keywords: ["Expo build failed", "EAS build error", "React Native CI", "Xcode build log", "Gradle error"],
  openGraph: { title: "Expo CI Doctor", description: "Build logs in. Root cause and exact fix out.", url: "/", siteName: "Expo CI Doctor", type: "website" },
  twitter: { card: "summary_large_image", title: "Expo CI Doctor", description: "Build logs in. Root cause and exact fix out." },
  alternates: { canonical: "/" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
