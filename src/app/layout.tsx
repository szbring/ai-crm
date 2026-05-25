import type { Metadata } from "next";
import "./globals.css";
import ChatWindow from "@/components/ChatWindow";

export const metadata: Metadata = {
  title: "薄云 AI-CRM",
  description: "B2B 销售 AI 助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-8">
          <a href="/" className="text-lg font-bold text-gray-900">薄云 AI-CRM</a>
          <a href="/customers" className="text-gray-600 hover:text-gray-900">客户</a>
          <a href="/opportunities" className="text-gray-600 hover:text-gray-900">商机</a>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </main>
        <ChatWindow />
      </body>
    </html>
  );
}
