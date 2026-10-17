// Static so the SW install stays fast: app/sw.ts caches this one document for every /s/<code>
export function generateStaticParams() {
  return [{ code: '_shell' }]
}

export default function ExhibitLayout({ children }: { children: React.ReactNode }) {
  return children
}
