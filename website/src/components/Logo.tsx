export function Logo({ compact = false }: { compact?: boolean }) {
  return <span className="logo" aria-label="Expo CI Doctor">
    <svg className="logoMark" viewBox="0 0 40 40" role="img" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="currentColor" />
      <path className="logoSignal" d="M7.5 21h6l3.1-8.5 5.1 16 4-11 2 3.5h4.8" />
      <path className="logoCheck" d="m26.5 9.5 2.3 2.3 4.7-5" />
    </svg>
    {!compact && <span className="logoWord">expo<span>ci</span>doctor</span>}
  </span>;
}
