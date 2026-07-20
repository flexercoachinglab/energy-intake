export const metadata = {
  title: "FLEXER 摂取カロリー設定",
  description: "FLEXERオリジナルの活動係数に基づく摂取カロリー算出ツール",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
