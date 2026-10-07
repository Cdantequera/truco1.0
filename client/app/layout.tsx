import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Truco Argentino Online - 1 vs 1 en Tiempo Real',
  description: 'Juego de Truco Argentino online autoritativo con Next.js, Node.js y Socket.io',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-stone-950 text-stone-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
