"use client";
import { useState } from "react";

const samples = {
  ios: "error: No profiles for 'dev.example.app' were found: Xcode couldn't find any iOS App Development provisioning profiles matching 'dev.example.app'.",
  android: "Execution failed for task ':app:checkReleaseDuplicateClasses'.\nDuplicate class kotlin.collections.jdk8 found in modules kotlin-stdlib-1.8.0 and kotlin-stdlib-jdk8-1.6.21",
  metro: "Error: Unable to resolve module @/components/Card from /app/index.tsx: None of these files exist."
};

function diagnose(value: string) {
  if (/No profiles for|provisioning profile|CodeSign/i.test(value)) return { tag: "iOS · HIGH CONFIDENCE", title: "iOS signing or provisioning failed", evidence: value.split("\n").find((line) => /profiles|provisioning|CodeSign/i.test(line)) ?? value, fixes: ["Verify the bundleIdentifier matches the Apple profile.", "Run eas credentials and repair the affected profile.", "Check capabilities against profile entitlements."] };
  if (/Duplicate class|DuplicateClasses/i.test(value)) return { tag: "ANDROID · HIGH CONFIDENCE", title: "Duplicate Android classes detected", evidence: value.split("\n").find((line) => /Duplicate class/i.test(line)) ?? value, fixes: ["Find both dependency paths with ./gradlew app:dependencies.", "Align or exclude the older transitive dependency.", "Run npx expo install --fix."] };
  if (/Unable to resolve module|Module not found|None of these files exist/i.test(value)) return { tag: "METRO · HIGH CONFIDENCE", title: "Metro cannot resolve a module", evidence: value.split("\n").find((line) => /resolve module|Module not found/i.test(line)) ?? value, fixes: ["Check filename casing for Linux CI.", "Confirm the package is declared in dependencies.", "Verify workspace exports and clear Metro cache."] };
  return null;
}

export function Playground() {
  const [value, setValue] = useState(samples.ios);
  const result = diagnose(value);
  return <section className="playground" id="demo"><div className="sectionEyebrow">TRY IT NOW · NO UPLOAD</div><div className="playgroundGrid"><div><div className="panelHead"><span>build.log</span><div className="sampleTabs">{Object.entries(samples).map(([key, sample]) => <button key={key} onClick={() => setValue(sample)}>{key}</button>)}</div></div><textarea aria-label="Build log" value={value} onChange={(event) => setValue(event.target.value)} spellCheck={false} /></div><div className="resultPanel"><div className="panelHead"><span>diagnosis</span><span className="localBadge">runs locally</span></div>{result ? <div className="diagnosis"><small>{result.tag}</small><h3>{result.title}</h3><blockquote>{result.evidence}</blockquote><h4>Recommended fix</h4><ol>{result.fixes.map((fix) => <li key={fix}>{fix}</li>)}</ol></div> : <div className="emptyResult"><span>?</span><p>No known root cause in this snippet.</p><small>Try a larger section around the first error.</small></div>}</div></div></section>;
}
