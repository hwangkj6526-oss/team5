import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hydro Pace | 나만의 수분 페이스",
  description: "운동 조건에 맞춰 수분과 전해질 섭취 계획을 안내합니다."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
