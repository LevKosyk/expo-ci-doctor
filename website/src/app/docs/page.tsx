import Link from "next/link";
import { Header } from "@/components/Header";

export default function Docs() {
  return <div className="shell"><Header /><main className="movedPage"><p className="sectionEyebrow">DOCUMENTATION ARCHIVE</p><h1>Documentation moved to GitHub.</h1><p>The complete Expo CI Doctor documentation is preserved with the source code, even though the package is no longer actively maintained.</p><a className="button primary" href="https://github.com/LevKosyk/expo-ci-doctor/tree/main/docs">Open documentation <span>→</span></a><Link className="button secondary" href="/">Back home</Link></main></div>;
}
