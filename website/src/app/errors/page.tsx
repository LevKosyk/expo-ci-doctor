import Link from "next/link";
import { Header } from "@/components/Header";

export default function Errors() {
  return <div className="shell"><Header /><main className="movedPage"><p className="sectionEyebrow">ERROR LIBRARY ARCHIVE</p><h1>Error library moved to GitHub.</h1><p>The archived diagnostic rules, matched signals, likely causes, and suggested fixes remain available in the repository.</p><a className="button primary" href="https://github.com/LevKosyk/expo-ci-doctor/blob/main/docs/error-library.md">Open error library <span>→</span></a><Link className="button secondary" href="/">Back home</Link></main></div>;
}
