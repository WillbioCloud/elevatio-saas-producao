export type Agent = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  revenue: number;
  deals: number;
  conversion: number;
  level: number;
  color: string;
  weeklyData: number[];
  badges: { id: string; icon: string; label: string; description: string }[];
};

export const agents: Agent[] = [
  {
    id: '1',
    name: 'Ana Silva',
    avatar: 'https://i.pravatar.cc/150?u=1',
    score: 12450,
    revenue: 2450000,
    deals: 12,
    conversion: 28,
    level: 42,
    color: '#3b82f6',
    weeklyData: [65, 78, 90, 85, 100, 88, 95],
    badges: [
      { id: 'b1', icon: '🎯', label: 'Sniper', description: 'Taxa de conversão > 25%' },
      { id: 'b2', icon: '💎', label: 'High Roller', description: 'Venda > R$ 1M' },
    ],
  },
  {
    id: '2',
    name: 'Carlos Santos',
    avatar: 'https://i.pravatar.cc/150?u=2',
    score: 11200,
    revenue: 1850000,
    deals: 15,
    conversion: 22,
    level: 38,
    color: '#10b981',
    weeklyData: [50, 60, 55, 70, 65, 80, 75],
    badges: [{ id: 'b3', icon: '🚀', label: 'Rising Star', description: '5 vendas em 1 semana' }],
  },
  {
    id: '3',
    name: 'Marina Costa',
    avatar: 'https://i.pravatar.cc/150?u=3',
    score: 9800,
    revenue: 1200000,
    deals: 8,
    conversion: 18,
    level: 31,
    color: '#8b5cf6',
    weeklyData: [40, 45, 50, 48, 55, 60, 58],
    badges: [{ id: 'b4', icon: '🤝', label: 'Closer', description: '10 negócios fechados' }],
  },
  {
    id: '4',
    name: 'Roberto Almeida',
    avatar: 'https://i.pravatar.cc/150?u=4',
    score: 8500,
    revenue: 950000,
    deals: 6,
    conversion: 15,
    level: 27,
    color: '#f59e0b',
    weeklyData: [30, 35, 32, 40, 38, 45, 42],
    badges: [],
  },
  {
    id: '5',
    name: 'Juliana Lima',
    avatar: 'https://i.pravatar.cc/150?u=5',
    score: 7200,
    revenue: 800000,
    deals: 5,
    conversion: 12,
    level: 22,
    color: '#ec4899',
    weeklyData: [20, 25, 28, 30, 35, 32, 38],
    badges: [],
  },
];

export const activities = [
  {
    id: 'a1',
    agentName: 'Ana Silva',
    action: 'fechou um contrato de venda',
    value: 'R$ 850.000',
    time: 'Há 2 horas',
    icon: '🎉',
    type: 'sale',
  },
  {
    id: 'a2',
    agentName: 'Carlos Santos',
    action: 'avançou um lead para',
    value: 'Proposta',
    time: 'Há 4 horas',
    icon: '🔥',
    type: 'deal',
  },
  {
    id: 'a3',
    agentName: 'Marina Costa',
    action: 'recebeu o emblema',
    value: 'Closer',
    time: 'Há 5 horas',
    icon: '🏅',
    type: 'badge',
  },
  {
    id: 'a4',
    agentName: 'Roberto Almeida',
    action: 'agendou uma',
    value: 'Visita',
    time: 'Há 1 dia',
    icon: '📅',
    type: 'meeting',
  },
];
