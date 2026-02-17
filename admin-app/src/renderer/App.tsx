import React, { useEffect, useState } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import QuotesPage from './pages/QuotesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import InventoryPage from './pages/InventoryPage';
import SettingsPage from './pages/SettingsPage';

type Route = 'dashboard' | 'quotes' | 'analytics' | 'inventory' | 'settings';

export default function App() {
  const [route, setRoute] = useState<Route>('dashboard');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await (window as any).electronAPI.storeGetAll();
        if (all?.apiBaseUrl && all?.adminToken) setRoute('quotes');
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  async function handleRefresh() {
    setLastUpdated(new Date().toLocaleString());
  }

  function renderContent() {
    switch (route) {
      case 'dashboard': return <DashboardPage />;
      case 'quotes': return <QuotesPage onRefresh={handleRefresh} />;
      case 'analytics': return <AnalyticsPage />;
      case 'inventory': return <InventoryPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  }

  const titleMap: Record<Route, string> = {
    dashboard: 'Dashboard',
    quotes: 'Quotes',
    analytics: 'Analytics',
    inventory: 'Inventory',
    settings: 'Settings',
  };

  return (
    <ChakraProvider>
      <Layout title={titleMap[route]} onRefresh={handleRefresh} lastUpdated={lastUpdated} route={route} setRoute={setRoute}>
        {renderContent()}
      </Layout>
    </ChakraProvider>
  );
}
