import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aurora Research Dashboard",
  description: "自动化数据抓取 · 大模型分析 · 用户洞察看板",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {/* Aurora ambient glow — fixed, behind all content */}
        <div className="aurora-ambient" aria-hidden="true">
          <div className="aurora-blob aurora-blob--teal" />
          <div className="aurora-blob aurora-blob--purple" />
          <div className="aurora-blob aurora-blob--rose" />
        </div>

        {/* Page content — sits above the glow layer */}
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
