import React from 'react';
import { Box } from '@chakra-ui/react';

export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <Box bg="white" p={6} borderRadius="md" boxShadow="sm" minH="300px">
      {children}
    </Box>
  );
}
