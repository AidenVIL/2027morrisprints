import React from 'react';
import { Heading, Text, SimpleGrid, Box, Spinner } from '@chakra-ui/react';
import PageContainer from '../components/PageContainer';

export default function DashboardPage() {
  const loading = false;
  return (
    <PageContainer>
      <Heading size="md" mb={4}>Overview</Heading>
      {loading ? (
        <Spinner />
      ) : (
        <SimpleGrid columns={[1,2,3]} spacing={4}>
          <Box p={4} bg="gray.50" borderRadius="md">Total Quotes: <Text fontWeight="bold">—</Text></Box>
          <Box p={4} bg="gray.50" borderRadius="md">Pending: <Text fontWeight="bold">—</Text></Box>
          <Box p={4} bg="gray.50" borderRadius="md">Approved: <Text fontWeight="bold">—</Text></Box>
        </SimpleGrid>
      )}
    </PageContainer>
  );
}
