import React from 'react';
import { Flex, Text, Button, HStack } from '@chakra-ui/react';
import { RefreshCw } from 'lucide-react';

type Props = {
  title?: string;
  onRefresh?: () => Promise<void> | void;
  lastUpdated?: string | null;
};

export default function Header({ title, onRefresh, lastUpdated }: Props) {
  return (
    <Flex align="center" justify="space-between" p={4} borderBottomWidth={1} bg="white">
      <Text fontSize="xl" fontWeight="semibold">{title || 'Dashboard'}</Text>
      <HStack spacing={4}>
        <Text fontSize="sm" color="gray.600">{lastUpdated ? `Last updated ${lastUpdated}` : ''}</Text>
        <Button leftIcon={<RefreshCw />} size="sm" onClick={() => onRefresh && onRefresh()}>Refresh</Button>
      </HStack>
    </Flex>
  );
}
