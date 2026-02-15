import './globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '3D Print Quotes',
  description: 'Request quotes for 3D prints.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-gray-50 text-gray-900">{children}</main>
      </body>
    </html>
  );
}
