import React, { useEffect, useMemo, useState } from 'react';
import {
  Heading,
  Spinner,
  Text,
  VStack,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Input,
  Select,
  HStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useToast,
  Box,
} from '@chakra-ui/react';
import PageContainer from '../components/PageContainer';
import { adminFetch } from '../lib/adminFetch';

type Quote = {
  id: string;
  created_at?: string;
  material?: string;
  colour?: string;
  estimated_grams?: number;
  estimated_price?: number;
  status?: string;
  [k: string]: any;
};

export default function QuotesPage({ onRefresh }: { onRefresh?: () => Promise<void> | void }) {
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortNewest, setSortNewest] = useState(true);

  const [selected, setSelected] = useState<Quote | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [actionLoading, setActionLoading] = useState(false);
  const toast = useToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch('/api/admin/quotes');
      if (!Array.isArray(data)) throw new Error('Unexpected response');
      setQuotes(data as Quote[]);
    } catch (e: any) {
      console.error('Failed to load quotes', e);
      setError(e?.message || 'Failed to load quotes');
      setQuotes([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    quotes.forEach(q => { if (q.status) s.add(q.status); });
    return Array.from(s).sort();
  }, [quotes]);

  const visible = useMemo(() => {
    let arr = quotes.slice();
    if (search.trim()) arr = arr.filter(q => (q.material || '').toLowerCase().includes(search.trim().toLowerCase()));
    if (statusFilter) arr = arr.filter(q => q.status === statusFilter);
    arr.sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return sortNewest ? tb - ta : ta - tb;
    });
    return arr;
  }, [quotes, search, statusFilter, sortNewest]);

  function openDetail(q: Quote) { setSelected(q); onOpen(); }

  async function doApprove(id: string) {
    setActionLoading(true);
    try {
      await adminFetch(`/api/admin/quotes/${id}/approve`, { method: 'POST' });
      toast({ status: 'success', title: 'Approved' });
      await load();
      onClose();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      toast({ status: 'error', title: 'Failed', description: e?.message || String(e) });
    }
    setActionLoading(false);
  }

  async function doDeny(id: string) {
    setActionLoading(true);
    try {
      await adminFetch(`/api/admin/quotes/${id}/deny`, { method: 'POST', body: JSON.stringify({ reason: 'Denied from admin app' }) });
      toast({ status: 'success', title: 'Denied' });
      await load();
      onClose();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      toast({ status: 'error', title: 'Failed', description: e?.message || String(e) });
    }
    setActionLoading(false);
  }

  async function doReestimate(id: string) {
    setActionLoading(true);
    try {
      await adminFetch(`/api/admin/reestimate-quote`, { method: 'POST', body: JSON.stringify({ id }) });
      toast({ status: 'success', title: 'Re-estimated' });
      await load();
      onClose();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      toast({ status: 'error', title: 'Failed', description: e?.message || String(e) });
    }
    setActionLoading(false);
  }

  return (
    <PageContainer>
      <Heading size="md" mb={4}>Quotes</Heading>

      <HStack spacing={3} mb={4}>
        <Input placeholder="Search by material" value={search} onChange={e => setSearch(e.target.value)} />
        <Select placeholder="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} w="200px">
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Button onClick={() => { setSortNewest(true); }}>Sort: Newest</Button>
        <Button onClick={() => { setSortNewest(false); }}>Sort: Oldest</Button>
        <Button colorScheme="blue" onClick={() => { load(); if (onRefresh) onRefresh(); }}>Refresh</Button>
      </HStack>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Text color="red.600">{error}</Text>
      ) : visible.length === 0 ? (
        <Text color="gray.600">No quotes found.</Text>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Created</Th>
                <Th>Material</Th>
                <Th>Colour</Th>
                <Th isNumeric>Estimated g</Th>
                <Th isNumeric>Estimated $</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {visible.map(q => (
                <Tr key={q.id} _hover={{ bg: 'gray.50', cursor: 'pointer' }} onClick={() => openDetail(q)}>
                  <Td>{q.created_at ? new Date(q.created_at).toLocaleString() : '—'}</Td>
                  <Td>{q.material || '—'}</Td>
                  <Td>{q.colour || '—'}</Td>
                  <Td isNumeric>{q.estimated_grams ?? '—'}</Td>
                  <Td isNumeric>{q.estimated_price ?? '—'}</Td>
                  <Td>{q.status || '—'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <Modal isOpen={isOpen} onClose={() => { onClose(); setSelected(null); }} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Quote Detail</ModalHeader>
          <ModalBody>
            {!selected ? <Spinner /> : (
              <VStack align="stretch">
                <Text><b>ID:</b> {selected.id}</Text>
                <Text><b>Created:</b> {selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'}</Text>
                <Text><b>Material:</b> {selected.material || '—'}</Text>
                <Text><b>Colour:</b> {selected.colour || '—'}</Text>
                <Text><b>Estimated grams:</b> {selected.estimated_grams ?? '—'}</Text>
                <Text><b>Estimated price:</b> {selected.estimated_price ?? '—'}</Text>
                <Text><b>Status:</b> {selected.status || '—'}</Text>
                <Text><b>Raw:</b></Text>
                <Box as="pre" p={2} bg="gray.50" borderRadius="md" overflowX="auto">{JSON.stringify(selected, null, 2)}</Box>
              </VStack>
            )}
          </ModalBody>

          <ModalFooter>
            <Button mr={3} onClick={() => { if (selected) doDeny(selected.id); }} colorScheme="red" isLoading={actionLoading}>Deny</Button>
            <Button mr={3} onClick={() => { if (selected) doReestimate(selected.id); }} colorScheme="blue" isLoading={actionLoading}>Re-estimate</Button>
            <Button colorScheme="green" onClick={() => { if (selected) doApprove(selected.id); }} isLoading={actionLoading}>Approve</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PageContainer>
  );
}
