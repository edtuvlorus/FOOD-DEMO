import './globals.css';
import { Toaster, Ripple } from '../lib/ui';
export const metadata = { title: 'FoodDash', description: 'Pesan makanan, antar cepat' };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#F26A1F' };
export default function L({ children }) {
  return <html lang="id"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head><body>{children}<Toaster /><Ripple /></body></html>;
}
