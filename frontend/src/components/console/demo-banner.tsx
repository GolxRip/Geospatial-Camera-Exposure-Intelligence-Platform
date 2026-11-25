/** Persistent banner on every preview page: the data under it is scripted and says nothing about any device. */
export function DemoBanner() {
  return (
    <div
      role="status"
      className="border-b border-dashed border-bone-2/60 bg-ink-1 px-4 py-2 text-center text-sm text-bone"
    >
      Demo data: scripted sample devices for design review. None of it is real, and no backend is
      connected.
    </div>
  );
}
