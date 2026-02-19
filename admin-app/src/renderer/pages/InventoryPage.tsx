import React, { useEffect, useState, useRef } from 'react';
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
  FormControl,
  FormLabel,
  InputGroup,
  InputRightElement,
  InputLeftElement,
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
import InventoryItemForm, { InventoryItem } from '../components/InventoryItemForm';
import { adminFetch } from '../lib/adminFetch';
import { Plus, History } from 'lucide-react';

type Item = {
  id: string;
  material: string;
  colour: string;
  grams_available: number;
  grams_reserved: number;
  cost_per_kg_pence?: number;
  cost_per_kg_gbp?: number;
  density_g_per_cm3?: number;
  support_multiplier?: number;
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
  const addFormRef = useRef<any>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [movements, setMovements] = useState<any[]>([]);

  // Add modal state handled via InventoryItemForm

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
    return `£${(pence / 100).toFixed(2)}`;
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

  // Edit flow
  const editDisclosure = useDisclosure();
  const [editItem, setEditItem] = useState<Item | null>(null);
  const editFormRef = useRef<any>(null);

  function openEdit(it: Item) {
    setEditItem(it);
    editDisclosure.onOpen();
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
            <Th isNumeric>Density (g/cm³)</Th>
            <Th isNumeric>Support ×</Th>
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
              <Td isNumeric>{(it.density_g_per_cm3 ?? (it as any).density ?? 1.24).toFixed(2)}</Td>
              <Td isNumeric>{(it.support_multiplier ?? (it as any).supportMultiplier ?? 1.18).toFixed(2)}</Td>
              <Td isNumeric>{
                (() => {
                  const pence = typeof it.cost_per_kg_pence === 'number' ? it.cost_per_kg_pence : Math.round((it.cost_per_kg_gbp || 0) * 100);
                  return costDisplay(pence);
                })()
              }</Td>
              <Td>
                <Badge colorScheme={it.is_active ? 'green' : 'gray'}>{it.is_active ? 'Active' : 'Inactive'}</Badge>
              </Td>
              <Td>
                <Stack direction="row" spacing={2}>
                  <IconButton aria-label="history" icon={<History size={14} />} size="sm" onClick={() => openHistory(it)} />
                  <Button size="sm" onClick={() => openEdit(it)}>Edit</Button>
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

      {/* Edit Item Modal */}
      <Modal isOpen={editDisclosure.isOpen} onClose={editDisclosure.onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Inventory Item</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {editItem && (
              <InventoryItemForm
                ref={editFormRef}
                mode="edit"
                initialValue={{
                  id: editItem.id,
                  material: editItem.material,
                  colour: editItem.colour,
                  is_active: editItem.is_active,
                  grams_available_g: editItem.grams_available,
                  grams_reserved_g: editItem.grams_reserved,
                  cost_per_kg_pence: editItem.cost_per_kg_pence,
                  density_g_per_cm3: editItem.density_g_per_cm3 ?? (editItem as any).density,
                  support_multiplier: editItem.support_multiplier ?? (editItem as any).supportMultiplier,
                }}
                onSubmit={async (values) => {
                  try {
                    const payload: any = {
                      item_id: editItem.id,
                      material: values.material,
                      colour: values.colour,
                      is_active: !!values.is_active,
                      grams_available: Number(values.grams_available_g || 0),
                      grams_reserved: Number(values.grams_reserved_g || 0),
                      cost_per_kg_pence: Number(values.cost_per_kg_pence || 0),
                    };
                    if (typeof values.density_g_per_cm3 === 'number') payload.density_g_per_cm3 = Number(values.density_g_per_cm3);
                    if (typeof values.support_multiplier === 'number') payload.support_multiplier = Number(values.support_multiplier);

                    await adminFetch('/api/admin/inventory/update', { method: 'POST', body: JSON.stringify(payload) });
                    toast({ title: 'Saved', status: 'success' });
                    editDisclosure.onClose();
                    load();
                  } catch (e: any) {
                    const body = e?.body ? JSON.stringify(e.body) : undefined;
                    toast({ title: 'Failed to save', description: body || e.message || String(e), status: 'error' });
                    console.error('save inventory error', e);
                  }
                }}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editDisclosure.onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={() => editFormRef.current?.submit()}>Save</Button>
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
            <InventoryItemForm
              ref={addFormRef}
              mode="create"
              initialValue={{ is_active: true, grams_available_g: 0, grams_reserved_g: 0 }}
              onSubmit={async (values) => {
                if (!values.material || !values.colour) {
                  toast({ title: 'Missing fields', description: 'Material and colour are required', status: 'warning' });
                  return;
                }
                try {
                  const payload: any = {
                    material: values.material,
                    colour: values.colour,
                    grams_available: Number(values.grams_available_g || 0),
                    grams_reserved: Number(values.grams_reserved_g || 0),
                    cost_per_kg_pence: Number(values.cost_per_kg_pence || 0),
                    is_active: !!values.is_active,
                  };
                  if (typeof values.density_g_per_cm3 === 'number') payload.density_g_per_cm3 = Number(values.density_g_per_cm3);
                  if (typeof values.support_multiplier === 'number') payload.support_multiplier = Number(values.support_multiplier);

                  await adminFetch('/api/admin/inventory/create', { method: 'POST', body: JSON.stringify(payload) });
                  toast({ title: 'Created', status: 'success' });
                  addDisclosure.onClose();
                  load();
                } catch (e: any) {
                  const body = e?.body ? JSON.stringify(e.body) : undefined;
                  toast({ title: 'Failed', description: body || e.message || String(e), status: 'error' });
                  console.error('create inventory error', e);
                }
              }}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={addDisclosure.onClose}>Cancel</Button>
            <Button colorScheme="green" onClick={() => addFormRef.current?.submit()}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PageContainer>
  );
}
