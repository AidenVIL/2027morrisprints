import React, { useEffect, useState } from 'react';
import { Heading, Input, Button, VStack } from '@chakra-ui/react';
import PageContainer from '../components/PageContainer';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    (async () => {
      const all = await (window as any).electronAPI.storeGetAll();
      setSettings(all || {});
    })();
  }, []);

  async function save() {
    for (const k of Object.keys(settings)) {
      // @ts-ignore
      await (window as any).electronAPI.storeSet(k, settings[k]);
    }
  }

  return (
    <PageContainer>
      <Heading size="md" mb={4}>Settings</Heading>
      <VStack align="stretch">
        <Input placeholder="API Base URL" value={settings.apiBaseUrl || ''} onChange={e => setSettings(s => ({ ...s, apiBaseUrl: e.target.value }))} />
        <Input placeholder="Admin Token" value={settings.adminToken || ''} onChange={e => setSettings(s => ({ ...s, adminToken: e.target.value }))} />
        <Button onClick={save}>Save</Button>
      </VStack>
    </PageContainer>
  );
}
