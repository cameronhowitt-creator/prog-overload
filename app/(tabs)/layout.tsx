import TabBar from "./TabBar";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <div className="scroll-area">{children}</div>
      <TabBar />
    </div>
  );
}
