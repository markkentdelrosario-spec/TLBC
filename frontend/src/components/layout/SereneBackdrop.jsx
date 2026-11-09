export default function SereneBackdrop() {
  return (
    <div aria-hidden="true" className="serene-backdrop fixed inset-0 -z-10 overflow-hidden">
      <div className="serene-backdrop__glow serene-backdrop__glow--one" />
      <div className="serene-backdrop__glow serene-backdrop__glow--two" />
      <div className="serene-backdrop__horizon" />
    </div>
  );
}
