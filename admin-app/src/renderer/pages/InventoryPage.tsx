import React, { useEffect, useState } from 'react';
import {
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Box,
  Stack,
  Input,
  NumberInput,
  NumberInputField,
  Switch,
  Badge,
  Text,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  IconButton,
} from '@chakra-ui/react';
import PageContainer from '../components/PageContainer';
import { adminFetch } from '../lib/adminFetch';
import { Plus, History } from 'lucide-react';

type Item = {
  id: string;
  material: string;
  colour: string;
  grams_available: number;
  grams_reserved: number;
  cost_per_kg_pence: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const toast = useToast();

  const { isOpen, onOpen, onClose } = useDisclosure();
  const addDisclosure = useDisclosure();
  const [selected, setSelected] = useState<Item | null>(null);
  const [movements, setMovements] = useState<any[]>([]);

  const [newMaterial, setNewMaterial] = useState('');
  const [newColour, setNewColour] = useState('');
  const [newGrams, setNewGrams] = useState<number>(0);
  const [newCost, setNewCost] = useState<number>(0);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch('/api/admin/inventory');
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message || String(e), status: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function gramsFree(it: Item) {
    return (it.grams_available || 0) - (it.grams_reserved || 0);
  }

  function costDisplay(pence: number) {
    return `£${(pence/100).toFixed(2)}`;
  }

  async function openHistory(it: Item) {
    setSelected(it);
    onOpen();
    try {
      const data = await adminFetch(`/api/admin/inventory/${it.id}/movements`);
      setMovements(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message || String(e), status: 'error' });
    }
  }

  async function toggleActive(it: Item) {
    try {
      await adminFetch('/api/admin/inventory/toggle', { method: 'POST', body: JSON.stringify({ item_id: it.id, is_active: !it.is_active }) });
      toast({ title: 'Updated', status: 'success' });
      load();
    } catch (e: any) {
      toast({ title: 'Failed to toggle', description: e.message || String(e), status: 'error' });
    }
  }

  return (
    <PageContainer>
      <Stack direction="row" justify="space-between" align="center" mb={4}>
        <Heading size="md">Inventory</Heading>
        <Stack direction="row">
          <Button leftIcon={<Plus size={14} />} colorScheme="green" onClick={addDisclosure.onOpen}>Add</Button>
        </Stack>
      </Stack>

      <Table variant="simple" size="sm">
        <Thead>
          <Tr>
            <Th>Material</Th>
            <Th>Colour</Th>
            <Th isNumeric>Grams Available</Th>
            <Th isNumeric>Grams Reserved</Th>
            <Th isNumeric>Grams Free</Th>
            <Th isNumeric>Cost / KG</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {items.filter(i => {
            if (!filter) return true;
            const s = (i.material + ' ' + i.colour).toLowerCase();
            return s.includes(filter.toLowerCase());
          }).map(it => (
            <Tr key={it.id} opacity={it.is_active ? 1 : 0.5}>
              <Td>{it.material}</Td>
              <Td>{it.colour}</Td>
              <Td isNumeric>{it.grams_available}</Td>
              <Td isNumeric>{it.grams_reserved}</Td>
              <Td isNumeric>{gramsFree(it)}</Td>
              <Td isNumeric>{costDisplay(it.cost_per_kg_pence || 0)}</Td>
              <Td>
                <Badge colorScheme={it.is_active ? 'green' : 'gray'}>{it.is_active ? 'Active' : 'Inactive'}</Badge>
              </Td>
              <Td>
                <Stack direction="row" spacing={2}>
                  <IconButton aria-label="history" icon={<History size={14} />} size="sm" onClick={() => openHistory(it)} />
                  <Button size="sm" onClick={() => toggleActive(it)}>{it.is_active ? 'Disable' : 'Enable'}</Button>
                </Stack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Box mt={4}>
        <Text mb={2}>Filter</Text>
        <Input placeholder="Search material or colour" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Movement History</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selected && (
              <Box>
                <Text fontWeight="bold">{selected.material} — {selected.colour}</Text>
                <Table size="sm" mt={2}>
                  <Thead>
                    <Tr><Th>Date</Th><Th>Type</Th><Th isNumeric>Grams</Th><Th>Note</Th></Tr>
                  </Thead>
                  <Tbody>
                    {movements.map(m => (
                      <Tr key={m.id}>
                        <Td>{new Date(m.created_at).toLocaleString()}</Td>
                        <Td>{m.type}</Td>
                        <Td isNumeric>{m.grams}</Td>
                        <Td>{m.note}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Item Modal */}
      <Modal isOpen={addDisclosure.isOpen} onClose={addDisclosure.onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Inventory Item</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Input placeholder="Material" value={newMaterial} onChange={(e) => setNewMaterial(e.target.value)} />
              <Input placeholder="Colour" value={newColour} onChange={(e) => setNewColour(e.target.value)} />
              <NumberInput value={newGrams} min={0} onChange={(v) => setNewGrams(Number(v))}>
                <NumberInputField placeholder="Grams available" />
              </NumberInput>
              <NumberInput value={newCost} min={0} step={0.01} onChange={(v) => setNewCost(Number(v))}>
                <NumberInputField placeholder="Cost per KG (£)" />
              </NumberInput>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={addDisclosure.onClose}>Cancel</Button>
            <Button colorScheme="green" onClick={async () => {
              if (!newMaterial.trim() || !newColour.trim()) {
                toast({ title: 'Missing fields', description: 'Material and colour are required', status: 'warning' });
                return;
              }
              const grams = Number(newGrams || 0);
              const costPence = Math.round(Number(newCost || 0) * 100);
              try {
                await adminFetch('/api/admin/inventory/create', { method: 'POST', body: JSON.stringify({ material: newMaterial.trim(), colour: newColour.trim(), grams_available: grams, cost_per_kg_pence: costPence }) });
                toast({ title: 'Created', status: 'success' });
                addDisclosure.onClose();
                setNewMaterial(''); setNewColour(''); setNewGrams(0); setNewCost(0);
                load();
              } catch (e: any) {
                toast({ title: 'Failed', description: e.message || String(e), status: 'error' });
              }
            }}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PageContainer>
  );
}
