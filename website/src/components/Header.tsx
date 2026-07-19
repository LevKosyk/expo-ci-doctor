import Link from "next/link";
import { Logo } from "./Logo";

export function Header() {
  return <><div className="maintenanceNotice"><strong>ARCHIVED</strong><span>Expo CI Doctor is no longer actively maintained.</span><a href="https://github.com/LevKosyk/expo-ci-doctor/blob/main/docs/maintenance.md">Read the maintenance notice →</a></div><header className="header"><Link className="brand" href="/"><Logo /></Link><nav aria-label="Main navigation"><a href="https://github.com/LevKosyk/expo-ci-doctor/tree/main/docs">Docs</a><a href="https://github.com/LevKosyk/expo-ci-doctor/blob/main/docs/error-library.md">Error library</a><a href="https://www.npmjs.com/package/expo-ci-doctor">npm</a><a className="githubLink" href="https://github.com/LevKosyk/expo-ci-doctor" target="_blank" rel="noreferrer" aria-label="Open Expo CI Doctor on GitHub"><span aria-hidden="true">★</span> GitHub</a></nav></header></>;
}
