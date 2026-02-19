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
import { adminFetch } from '../lib/adminFetch';

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
  const [schema, setSchema] = useState<any[] | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // initialize values map from initialValue using common keys expected by schema
    const init: Record<string, any> = {};
    init.material = initialValue.material ?? '';
    init.colour = initialValue.colour ?? '';
    init.active = typeof initialValue.is_active === 'boolean' ? initialValue.is_active : (initialValue as any).active ?? true;
    init.grams_available = initialValue.grams_available_g ?? initialValue.grams_available ?? 0;
    init.grams_reserved = initialValue.grams_reserved_g ?? initialValue.grams_reserved ?? 0;
    const pence = typeof initialValue.cost_per_kg_pence === 'number' ? initialValue.cost_per_kg_pence : Math.round(((initialValue as any).cost_per_kg_gbp || 0) * 100);
    init.cost_per_kg_gbp = Number((pence / 100).toFixed(2));
    init.density_g_per_cm3 = initialValue.density_g_per_cm3 ?? (initialValue as any).density ?? 1.24;
    init.support_multiplier = initialValue.support_multiplier ?? (initialValue as any).supportMultiplier ?? 1.18;
    setValues(init);
  }, [initialValue]);

  useEffect(() => {
    // fetch schema from server
    let mounted = true;
    async function load() {
      setLoadingSchema(true);
      try {
        const data = await adminFetch('/api/admin/inventory/schema');
        if (!mounted) return;
        setSchema(Array.isArray(data?.fields) ? data.fields : null);
      } catch (e: any) {
        console.error('failed to load inventory schema', e);
      } finally {
        if (mounted) setLoadingSchema(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};
    // material/colour required
    if (!String(values.material || '').trim()) e.material = 'Material is required';
    if (!String(values.colour || '').trim()) e.colour = 'Colour is required';
    // numeric checks
    if (Number(values.grams_available) < 0 || isNaN(Number(values.grams_available))) e.grams_available = 'Must be ≥ 0';
    if (Number(values.grams_reserved) < 0 || isNaN(Number(values.grams_reserved))) e.grams_reserved = 'Must be ≥ 0';
    if (Number(values.density_g_per_cm3) <= 0 || isNaN(Number(values.density_g_per_cm3))) e.density_g_per_cm3 = 'Must be > 0';
    if (Number(values.support_multiplier) < 1 || isNaN(Number(values.support_multiplier))) e.support_multiplier = 'Must be ≥ 1';
    if (Number(values.cost_per_kg_gbp) < 0 || isNaN(Number(values.cost_per_kg_gbp))) e.cost_per_kg_gbp = 'Must be ≥ 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    // map UI keys to DB payload keys; do not send derived cost_per_kg_gbp
    const payload: any = {};
    if (typeof values.material === 'string') payload.material = String(values.material).trim();
    if (typeof values.colour === 'string') payload.colour = String(values.colour).trim();
    if (typeof values.active === 'boolean') payload.is_active = values.active;
    if (typeof values.grams_available !== 'undefined') payload.grams_available = Number(values.grams_available || 0);
    if (typeof values.grams_reserved !== 'undefined') payload.grams_reserved = Number(values.grams_reserved || 0);
    if (typeof values.cost_per_kg_gbp === 'number' || typeof values.cost_per_kg_gbp === 'string') payload.cost_per_kg_pence = Math.round(Number(values.cost_per_kg_gbp || 0) * 100);
    if (typeof values.density_g_per_cm3 !== 'undefined') payload.density_g_per_cm3 = Number(values.density_g_per_cm3);
    if (typeof values.support_multiplier !== 'undefined') payload.support_multiplier = Number(values.support_multiplier);

    // include id for edit flows
    if (initialValue.id) payload.item_id = initialValue.id;

    void Promise.resolve(onSubmit(payload as any));
  }

  useImperativeHandle(ref, () => ({
    submit: handleSubmit,
  }), [values, initialValue]);

  const gramsFree = Math.max(Number(values.grams_available || 0) - Number(values.grams_reserved || 0), 0);

  // render dynamic fields from schema; fall back to existing layout if schema not loaded
  if (!schema) {
    return <Text>Loading form...</Text>;
  }

  return (
    <Stack spacing={3}>
      {schema.map((f: any) => {
        const key = f.key;
        const val = values[key];
        const isErr = !!errors[key];
        // render types
        if (f.type === 'text') {
          return (
            <FormControl key={key} isInvalid={isErr} isRequired={!!f.required}>
              <FormLabel>{f.label}</FormLabel>
              <Input value={val ?? ''} onChange={(e) => setValues({...values, [key]: e.target.value})} />
              <FormErrorMessage>{errors[key]}</FormErrorMessage>
            </FormControl>
          );
        }

        if (f.type === 'boolean') {
          return (
            <FormControl key={key} display="flex" alignItems="center">
              <FormLabel mb={0}>{f.label}</FormLabel>
              <Switch isChecked={!!val} onChange={(e) => setValues({...values, [key]: e.target.checked})} />
            </FormControl>
          );
        }

        if (f.type === 'money_gbp') {
          return (
            <FormControl key={key} isInvalid={isErr}>
              <FormLabel>{f.label}</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">£</InputLeftElement>
                <NumberInput value={Number(val ?? 0)} min={f.min ?? 0} step={0.01} onChange={(v) => setValues({...values, [key]: Number(v)})}>
                  <NumberInputField />
                </NumberInput>
              </InputGroup>
              <FormErrorMessage>{errors[key]}</FormErrorMessage>
            </FormControl>
          );
        }

        if (f.type === 'number') {
          // special read-only grams free
          if (key === 'grams_free') {
            return (
              <FormControl key={key}>
                <FormLabel>{f.label}</FormLabel>
                <Input value={String(gramsFree)} isReadOnly />
              </FormControl>
            );
          }
          return (
            <FormControl key={key} isInvalid={isErr}>
              <FormLabel>{f.label}</FormLabel>
              <NumberInput value={Number(val ?? 0)} min={f.min} step={f.step ?? 1} onChange={(v) => setValues({...values, [key]: Number(v)})}>
                <NumberInputField />
              </NumberInput>
              <FormErrorMessage>{errors[key]}</FormErrorMessage>
            </FormControl>
          );
        }

        return null;
      })}

      <Text as="button" onClick={handleSubmit} style={{ textAlign: 'left', display: 'none' }} />
    </Stack>
  );
}
export default forwardRef(InventoryItemForm as any);
