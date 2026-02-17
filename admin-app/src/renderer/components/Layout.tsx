import React from 'react';
import { Box, Flex } from '@chakra-ui/react';
import Sidebar from './Sidebar';
import Header from './Header';

type LayoutProps = {
  title?: string;
  onRefresh?: () => Promise<void> | void;
  lastUpdated?: string | null;
  route: string;
  setRoute: (r: string) => void;
  children: React.ReactNode;
};

export default function Layout({ title, onRefresh, lastUpdated, route, setRoute, children }: LayoutProps) {
  return (
    <Flex height="100vh">
      <Sidebar route={route} onNavigate={setRoute} />
      <Flex direction="column" flex="1">
        <Header title={title} onRefresh={onRefresh} lastUpdated={lastUpdated} />
        <Box as="main" flex="1" p={6} overflowY="auto" bg="gray.50">
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
