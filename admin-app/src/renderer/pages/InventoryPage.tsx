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
  const [editGramsAvailable, setEditGramsAvailable] = useState<number>(0);
  const [editGramsReserved, setEditGramsReserved] = useState<number>(0);
  const [editCost, setEditCost] = useState<number>(0);
  const [editDensity, setEditDensity] = useState<number | undefined>(undefined);
  const [editSupportMultiplier, setEditSupportMultiplier] = useState<number | undefined>(undefined);

  function openEdit(it: Item) {
    setEditItem(it);
    setEditGramsAvailable(it.grams_available || 0);
    setEditGramsReserved(it.grams_reserved || 0);
    // load cost as GBP decimal for the form (prefer pence if present)
    const pence = typeof it.cost_per_kg_pence === 'number' ? it.cost_per_kg_pence : (typeof it.cost_per_kg_gbp === 'number' ? Math.round(it.cost_per_kg_gbp * 100) : 0);
    setEditCost((pence / 100) || 0);
    // read density/support if present on payload
    setEditDensity(it.density_g_per_cm3 ?? undefined);
    setEditSupportMultiplier(it.support_multiplier ?? undefined);
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
              <Stack spacing={3}>
                <FormControl>
                  <FormLabel>Material</FormLabel>
                  <Input value={editItem.material} onChange={(e) => setEditItem({...editItem, material: e.target.value})} />
                </FormControl>

                <FormControl>
                  <FormLabel>Colour</FormLabel>
                  <Input value={editItem.colour} onChange={(e) => setEditItem({...editItem, colour: e.target.value})} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb={0}>Active</FormLabel>
                  <Switch isChecked={!!editItem.is_active} onChange={(e) => setEditItem({...editItem, is_active: e.target.checked})} />
                </FormControl>

                <FormControl>
                  <FormLabel>Grams available (g)</FormLabel>
                  <NumberInput value={editGramsAvailable} min={0} onChange={(v) => setEditGramsAvailable(Number(v))}>
                    <NumberInputField />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Grams reserved (g)</FormLabel>
                  <NumberInput value={editGramsReserved} min={0} onChange={(v) => setEditGramsReserved(Number(v))}>
                    <NumberInputField />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Cost per KG (£)</FormLabel>
                  <NumberInput value={editCost} min={0} max={200} step={0.01} onChange={(v) => setEditCost(Number(v))}>
                    <NumberInputField />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Density (g/cm³)</FormLabel>
                  <NumberInput value={editDensity ?? 1.24} min={0.1} step={0.01} onChange={(v) => setEditDensity(Number(v))}>
                    <NumberInputField />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Support multiplier</FormLabel>
                  <NumberInput value={editSupportMultiplier ?? 1.18} min={0.5} step={0.01} onChange={(v) => setEditSupportMultiplier(Number(v))}>
                    <NumberInputField />
                  </NumberInput>
                </FormControl>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editDisclosure.onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={async () => {
              if (!editItem) return;
              // validation
              if (editCost < 0 || editCost > 200) {
                toast({ title: 'Invalid cost', description: 'Cost must be between 0 and 200', status: 'warning' });
                return;
              }
              try {
                const payload: any = {
                  item_id: editItem.id,
                  material: editItem.material,
                  colour: editItem.colour,
                  is_active: !!editItem.is_active,
                  grams_available: Number(editGramsAvailable || 0),
                  grams_reserved: Number(editGramsReserved || 0),
                  // store as pence integer
                  cost_per_kg_pence: Math.round(Number(editCost || 0) * 100),
                };
                if (typeof editDensity === 'number') payload.density_g_per_cm3 = Number(editDensity);
                if (typeof editSupportMultiplier === 'number') payload.support_multiplier = Number(editSupportMultiplier);

                await adminFetch('/api/admin/inventory/update', { method: 'POST', body: JSON.stringify(payload) });
                toast({ title: 'Saved', status: 'success' });
                editDisclosure.onClose();
                load();
              } catch (e: any) {
                toast({ title: 'Failed to save', description: e.message || String(e), status: 'error' });
              }
            }}>Save</Button>
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
              <FormControl>
                <FormLabel>Material</FormLabel>
                <Input placeholder="e.g. PLA" value={newMaterial} onChange={(e) => setNewMaterial(e.target.value)} />
              </FormControl>

              <FormControl>
                <FormLabel>Colour</FormLabel>
                <Input placeholder="e.g. White" value={newColour} onChange={(e) => setNewColour(e.target.value)} />
              </FormControl>

              <FormControl>
                <FormLabel>Grams available (g)</FormLabel>
                <InputGroup>
                  <NumberInput value={newGrams} min={0} onChange={(v) => setNewGrams(Number(v))}>
                    <NumberInputField placeholder="e.g. 1000" />
                  </NumberInput>
                  <InputRightElement pointerEvents="none">g</InputRightElement>
                </InputGroup>
              </FormControl>

              <FormControl>
                <FormLabel>Cost per KG (£)</FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">£</InputLeftElement>
                  <NumberInput value={newCost} min={0} step={0.01} onChange={(v) => setNewCost(Number(v))}>
                    <NumberInputField placeholder="e.g. 15.00" />
                  </NumberInput>
                </InputGroup>
              </FormControl>
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
              // validate cost range
              if (newCost < 0 || newCost > 200) {
                toast({ title: 'Invalid cost', description: 'Cost must be between 0 and 200', status: 'warning' });
                return;
              }
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
