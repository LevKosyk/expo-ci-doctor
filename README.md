# Expo CI Doctor

A powerful CLI tool that helps Expo & React Native developers detect, analyze, and prevent CI and EAS build failures before they waste time.

No telemetry.  
No cloud processing.  
Runs locally and in CI.

---

## ✨ Why Expo CI Doctor?

CI failures are expensive.

You push → GitHub Actions runs → EAS builds → 10 minutes later… ❌ failed.

Expo CI Doctor analyzes your project before CI does and gives you:

- Clear root-cause diagnostics  
- File-level pointers  
- Dependency compatibility warnings  
- Upgrade safety checks  
- Build readiness scoring  
- Noise filtering for CI logs  

---

## 🚀 Installation

### Global install

```bash
npm install -g expo-ci-doctor
```

### Or run directly

```bash
npx expo-ci-doctor@latest check
```

---

## ⚡ Quick Start (5 minutes)

1. Install the CLI
2. Run:

```bash
expo-ci-doctor check
```

3. Review actionable output before pushing to CI

---

## 🧪 Example Output

### ❌ Before

```
EAS Build failed.
```

### ✅ After Expo CI Doctor

```
✔ Dependency compatibility: OK
⚠ Expo SDK mismatch detected

Root cause:
- expo-updates is incompatible with SDK 51

Location:
- app.config.ts:42

Suggested fix:
- Upgrade expo-updates to ^0.20.0

Build Readiness Score: 72 / 100 (Medium Risk)
```

---

## 📦 Core Commands

### Check project configuration

```bash
expo-ci-doctor check
```

Validates:
- app.json / app.config.js
- SDK compatibility
- Dependency alignment
- Known CI pitfalls

---

### Deep analysis

```bash
expo-ci-doctor analyze
```

Performs:
- Root cause grouping
- Stage-based failure detection
- Risk ranking
- Context-aware diagnostics

---

### Generate CI-friendly Markdown report

```bash
expo-ci-doctor analyze --markdown
```

Outputs structured Markdown ready for GitHub Actions logs or PR comments.

---

### Upgrade safety check

```bash
expo-ci-doctor check --upgrade
```

Simulates upgrade risk before bumping Expo SDK or dependencies.

---

### Build readiness score

```bash
expo-ci-doctor check --score
```

Returns:

- Risk rating
- Stability score
- Recommended actions

---

### CI noise filter

```bash
expo-ci-doctor analyze --noise=low
```

Reduces noisy logs and surfaces actionable issues only.

---

## 🛠 Configuration

Create `.expo-ci-doctorrc` in your project root:

```json
{
  "ignoreWarnings": ["expo-asset-mismatch"],
  "ciMode": true,
  "output": "standard"
}
```

---

## 🔍 What It Analyzes

- Expo SDK compatibility
- EAS build config
- app.json / app.config.ts
- Native dependency mismatches
- Version alignment
- Known breaking changes
- CI environment patterns

---

## 🧠 How It Works

Expo CI Doctor uses deterministic rule-based analysis:

- Static configuration validation
- Dependency compatibility graph checks
- Heuristic CI failure pattern detection
- Risk scoring based on known failure signals

No source code is uploaded.  
Everything runs locally unless you run it inside CI.

---

## 🔐 Security & Privacy

- No telemetry
- No analytics tracking inside CLI
- No source code uploads
- No cloud dependency required

Safe for local development and CI environments.

---

## 📈 Typical Use Cases

- Before pushing to GitHub
- Before upgrading Expo SDK
- Debugging EAS failures
- Adding CI safety checks to pipelines
- Preventing repetitive build crashes

---

## 🤝 Contributing

Pull requests are welcome.

If you find a CI pattern that should be detected, open an issue with:
- Expo SDK version
- Relevant config
- Error output (sanitized)

---

## 📜 License

MIT

---

## ⭐ If This Saves You Time

Star the repository and share it with other Expo developers.
