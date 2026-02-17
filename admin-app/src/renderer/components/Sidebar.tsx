import React from 'react';
import { Box, VStack, Button, Text } from '@chakra-ui/react';
import { Monitor, FileText, BarChart2, Box as BoxIcon, Settings } from 'lucide-react';

type Props = {
  onNavigate: (route: string) => void;
  route: string;
};

const NavItem = ({ label, icon: Icon, routeKey, active, onClick }: any) => (
  <Button justifyContent="flex-start" variant={active ? 'solid' : 'ghost'} colorScheme={active ? 'blue' : undefined} w="100%" onClick={() => onClick(routeKey)} leftIcon={<Icon />}>{label}</Button>
);

export default function Sidebar({ onNavigate, route }: Props) {
  return (
    <Box width="220px" bg="white" borderRightWidth={1} p={4}>
      <Text fontSize="lg" fontWeight="bold" mb={6}>Admin</Text>
      <VStack spacing={2} align="stretch">
        <NavItem label="Dashboard" icon={Monitor} routeKey="dashboard" active={route === 'dashboard'} onClick={onNavigate} />
        <NavItem label="Quotes" icon={FileText} routeKey="quotes" active={route === 'quotes'} onClick={onNavigate} />
        <NavItem label="Analytics" icon={BarChart2} routeKey="analytics" active={route === 'analytics'} onClick={onNavigate} />
        <NavItem label="Inventory" icon={BoxIcon} routeKey="inventory" active={route === 'inventory'} onClick={onNavigate} />
        <NavItem label="Settings" icon={Settings} routeKey="settings" active={route === 'settings'} onClick={onNavigate} />
      </VStack>
    </Box>
  );
}
