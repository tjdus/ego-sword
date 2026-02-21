import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { Providers } from './providers';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: '나는 전설의 검이다',
  description: '당신은 검(에고 소드)이고, 주인과 영혼으로 연결되어 던전을 탐험한다.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '에고소드' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0B0E14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className={`${geist.variable} antialiased`}>
        <Providers>
          <div className="mx-auto max-w-140 min-h-screen relative">
            {children}
          </div>
          <Toaster theme="dark" position="bottom-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
