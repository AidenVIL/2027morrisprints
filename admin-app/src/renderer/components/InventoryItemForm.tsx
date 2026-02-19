import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Stack,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  NumberInput,
  NumberInputField,
  Switch,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Text,
} from '@chakra-ui/react';

export type InventoryItem = {
  id?: string;
  material: string;
  colour: string;
  is_active?: boolean;
  grams_available_g?: number;
  grams_reserved_g?: number;
  cost_per_kg_pence?: number;
  density_g_per_cm3?: number;
  support_multiplier?: number;
};

type Props = {
  mode: 'create' | 'edit';
  initialValue?: Partial<InventoryItem>;
  onSubmit: (values: InventoryItem) => void | Promise<void>;
};

function InventoryItemForm({ mode, initialValue = {}, onSubmit }: Props, ref: any) {
  const [material, setMaterial] = useState(initialValue.material || '');
  const [colour, setColour] = useState(initialValue.colour || '');
  const [isActive, setIsActive] = useState(!!initialValue.is_active);
  const [gramsAvailable, setGramsAvailable] = useState<number>(initialValue.grams_available_g ?? initialValue.grams_available ?? 0);
  const [gramsReserved, setGramsReserved] = useState<number>(initialValue.grams_reserved_g ?? initialValue.grams_reserved ?? 0);
  // show cost in GBP decimal in UI
  const initialPence = typeof initialValue.cost_per_kg_pence === 'number' ? initialValue.cost_per_kg_pence : Math.round((initialValue as any).cost_per_kg_gbp * 100 || 0);
  const [costGbp, setCostGbp] = useState<number>(initialPence / 100 || 0);
  const [density, setDensity] = useState<number>(initialValue.density_g_per_cm3 ?? 1.24);
  const [supportMultiplier, setSupportMultiplier] = useState<number>(initialValue.support_multiplier ?? 1.18);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setMaterial(initialValue.material || '');
    setColour(initialValue.colour || '');
    setIsActive(!!initialValue.is_active);
    setGramsAvailable(initialValue.grams_available_g ?? initialValue.grams_available ?? 0);
    setGramsReserved(initialValue.grams_reserved_g ?? initialValue.grams_reserved ?? 0);
    const p = typeof initialValue.cost_per_kg_pence === 'number' ? initialValue.cost_per_kg_pence : Math.round((initialValue as any).cost_per_kg_gbp * 100 || 0);
    setCostGbp(p / 100 || 0);
    setDensity(initialValue.density_g_per_cm3 ?? 1.24);
    setSupportMultiplier(initialValue.support_multiplier ?? 1.18);
  }, [initialValue]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!material.trim()) e.material = 'Material is required';
    if (!colour.trim()) e.colour = 'Colour is required';
    if (isNaN(gramsAvailable) || gramsAvailable < 0) e.grams_available = 'Must be ≥ 0';
    if (isNaN(gramsReserved) || gramsReserved < 0) e.grams_reserved = 'Must be ≥ 0';
    if (isNaN(density) || density <= 0) e.density = 'Must be > 0';
    if (isNaN(supportMultiplier) || supportMultiplier < 1) e.support = 'Must be ≥ 1';
    if (isNaN(costGbp) || costGbp < 0) e.cost = 'Must be ≥ 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const values: InventoryItem = {
      id: initialValue.id,
      material: material.trim(),
      colour: colour.trim(),
      is_active: !!isActive,
      grams_available_g: Number(gramsAvailable || 0),
      grams_reserved_g: Number(gramsReserved || 0),
      cost_per_kg_pence: Math.round(Number(costGbp || 0) * 100),
      density_g_per_cm3: Number(density),
      support_multiplier: Number(supportMultiplier),
    };
    void Promise.resolve(onSubmit(values));
  }

  useImperativeHandle(ref, () => ({
    submit: handleSubmit,
  }), [material, colour, isActive, gramsAvailable, gramsReserved, costGbp, density, supportMultiplier]);

  const gramsFree = Math.max((gramsAvailable || 0) - (gramsReserved || 0), 0);

  return (
    <Stack spacing={3}>
      <FormControl isInvalid={!!errors.material} isRequired>
        <FormLabel>Material</FormLabel>
        <Input value={material} onChange={(e) => setMaterial(e.target.value)} />
        <FormErrorMessage>{errors.material}</FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!errors.colour} isRequired>
        <FormLabel>Colour</FormLabel>
        <Input value={colour} onChange={(e) => setColour(e.target.value)} />
        <FormErrorMessage>{errors.colour}</FormErrorMessage>
      </FormControl>

      <FormControl display="flex" alignItems="center">
        <FormLabel mb={0}>Active</FormLabel>
        <Switch isChecked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      </FormControl>

      <FormControl isInvalid={!!errors.grams_available}>
        <FormLabel>Grams available (g)</FormLabel>
        <NumberInput value={gramsAvailable} min={0} onChange={(v) => setGramsAvailable(Number(v))}>
          <NumberInputField />
        </NumberInput>
        <FormErrorMessage>{errors.grams_available}</FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!errors.grams_reserved}>
        <FormLabel>Grams reserved (g)</FormLabel>
        <NumberInput value={gramsReserved} min={0} onChange={(v) => setGramsReserved(Number(v))}>
          <NumberInputField />
        </NumberInput>
        <FormErrorMessage>{errors.grams_reserved}</FormErrorMessage>
      </FormControl>

      <FormControl>
        <FormLabel>Grams free</FormLabel>
        <Input value={String(gramsFree)} isReadOnly />
      </FormControl>

      <FormControl isInvalid={!!errors.cost}>
        <FormLabel>Cost per KG (£)</FormLabel>
        <InputGroup>
          <InputLeftElement pointerEvents="none">£</InputLeftElement>
          <NumberInput value={costGbp} min={0} step={0.01} onChange={(v) => setCostGbp(Number(v))}>
            <NumberInputField />
          </NumberInput>
        </InputGroup>
        <FormErrorMessage>{errors.cost}</FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!errors.density}>
        <FormLabel>Density (g/cm³)</FormLabel>
        <NumberInput value={density} min={0.0001} step={0.01} onChange={(v) => setDensity(Number(v))}>
          <NumberInputField />
        </NumberInput>
        <FormErrorMessage>{errors.density}</FormErrorMessage>
      </FormControl>

      <FormControl isInvalid={!!errors.support}>
        <FormLabel>Support multiplier</FormLabel>
        <NumberInput value={supportMultiplier} min={0.01} step={0.01} onChange={(v) => setSupportMultiplier(Number(v))}>
          <NumberInputField />
        </NumberInput>
        <FormErrorMessage>{errors.support}</FormErrorMessage>
      </FormControl>

      <Text as="button" onClick={handleSubmit} style={{ textAlign: 'left', display: 'none' }} />
    </Stack>
  );
}
export default forwardRef(InventoryItemForm as any);
