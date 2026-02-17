import React, { useEffect, useMemo, useState } from 'react';
import {
  Heading,
  Text,
  SimpleGrid,
  Box,
  Spinner,
  HStack,
  Select,
  Button,
  Stat,
  StatLabel,
  StatNumber,
  VStack,
  useToast,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import PageContainer from '../components/PageContainer';
import { adminFetch } from '../lib/adminFetch';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts';

type Overview = {
  totalQuotes7d: number;
  totalQuotes30d: number;
  revenue7d: number;
  revenue30d: number;
  activeNow: number;
};

export default function AnalyticsPage() {
  const [range, setRange] = useState<'7' | '30'>('7');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [traffic, setTraffic] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [funnel, setFunnel] = useState<any | null>(null);
  const toast = useToast();

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const qs = `?range=${range}`;
      const [ov, tr, ac, fu] = await Promise.all([
        adminFetch(`/api/admin/analytics/overview${qs}`),
        adminFetch(`/api/admin/analytics/traffic${qs}`),
        adminFetch(`/api/admin/analytics/active${qs}`),
        adminFetch(`/api/admin/analytics/funnel${qs}`),
      ]);
      setOverview(ov);
      setTraffic((tr && tr.rows) || []);
      setActive(ac);
      setFunnel(fu);
    } catch (e: any) {
      console.error('analytics load error', e);
      setError(e?.message || String(e));
      toast({ title: 'Failed to load analytics', status: 'error', description: String(e?.message || e) });
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [range]);

  const barData = useMemo(() => traffic.map(r => ({ country: r.country || 'Unknown', views: r.totalViews || 0, sessions: r.uniqueSessions || 0 })), [traffic]);

  const lineData = useMemo(() => {
    if (!active?.timeSeries) return [];
    return (active.timeSeries || []).map((p: any) => ({ ts: p.ts, count: p.count }));
  }, [active]);

  const funnelData = useMemo(() => {
    if (!funnel) return [];
    return [
      { name: 'Landing', value: funnel.landingViews || 0 },
      { name: 'Quote Started', value: funnel.quoteStarted || 0 },
      { name: 'Checkout Started', value: funnel.checkoutStarted || 0 },
      { name: 'Submitted', value: funnel.quoteSubmitted || 0 },
    ];
  }, [funnel]);

  return (
    <PageContainer>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Analytics</Heading>
        <HStack>
          <Select value={range} onChange={e => setRange(e.target.value as any)} w="120px">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </Select>
          <Button onClick={loadAll}>Refresh</Button>
        </HStack>
      </HStack>

      {loading && <Spinner />}
      {error && (
        <Alert status="error" mb={4}><AlertIcon />{error}</Alert>
      )}

      <SimpleGrid columns={[1, 2, 4]} spacing={4} mb={4}>
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Stat>
            <StatLabel>Total Quotes (7d)</StatLabel>
            <StatNumber>{overview ? overview.totalQuotes7d : '—'}</StatNumber>
          </Stat>
        </Box>
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Stat>
            <StatLabel>Total Quotes (30d)</StatLabel>
            <StatNumber>{overview ? overview.totalQuotes30d : '—'}</StatNumber>
          </Stat>
        </Box>
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Stat>
            <StatLabel>Revenue (7d)</StatLabel>
            <StatNumber>{overview ? `$${overview.revenue7d.toFixed(2)}` : '—'}</StatNumber>
          </Stat>
        </Box>
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <Stat>
            <StatLabel>Active Now</StatLabel>
            <StatNumber>{overview ? overview.activeNow : '—'}</StatNumber>
          </Stat>
        </Box>
      </SimpleGrid>

      <SimpleGrid columns={[1, 1, 2]} spacing={4}>
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm" minH="300px">
          <Text fontWeight="semibold" mb={2}>Views by Country</Text>
          {barData.length === 0 ? <Text color="gray.600">No data</Text> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" />
                <YAxis dataKey="country" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="views" fill="#3182CE" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>

        <Box bg="white" p={4} borderRadius="md" boxShadow="sm" minH="300px">
          <Text fontWeight="semibold" mb={2}>Active Users (15-min)</Text>
          {lineData.length === 0 ? <Text color="gray.600">No data</Text> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={lineData} margin={{ right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ts" tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <YAxis />
                <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
                <Line type="monotone" dataKey="count" stroke="#2B6CB0" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
      </SimpleGrid>

      <Box mt={4} bg="white" p={4} borderRadius="md" boxShadow="sm">
        <Text fontWeight="semibold" mb={2}>Funnel</Text>
        {funnelData.length === 0 ? <Text color="gray.600">No data</Text> : (
          <ResponsiveContainer width="100%" height={240}>
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList dataKey="name" position="inside" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        )}
        {funnel && (
          <VStack align="start" mt={3} spacing={1}>
            <Text>Landing Views: {funnel.landingViews}</Text>
            <Text>Quote Started: {funnel.quoteStarted}</Text>
            <Text>Checkout Started: {funnel.checkoutStarted}</Text>
            <Text>Quote Submitted: {funnel.quoteSubmitted}</Text>
            <Text color="gray.600">Conversion overall: {funnel.conversion?.overallSubmitFromLandingPct ?? '—'}%</Text>
          </VStack>
        )}
      </Box>
    </PageContainer>
  );
}
