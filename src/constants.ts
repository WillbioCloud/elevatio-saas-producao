import { Property, PropertyType, Lead, LeadStatus } from './types';

export const COMPANY_PHONE = '5511999999999';
export const COMPANY_NAME = 'TR Imóveis';

export const MOCK_PROPERTIES: Property[] = [
  {
    id: '1',
    slug: 'cobertura-duplex-jardins',
    title: 'Cobertura Duplex nos Jardins',
    description: 'Espetacular cobertura com vista 360º, piscina privativa e acabamentos em mármore importado.',
    price: 4500000,
    type: PropertyType.PENTHOUSE,
    bedrooms: 4,
    bathrooms: 5,
    area: 320,
    garage: 4,
    location: { city: 'São Paulo', neighborhood: 'Jardins', state: 'SP' },
    features: ['Piscina', 'Varanda Gourmet', 'Portaria 24h', 'Ar Condicionado', 'Vista Panorâmica'],
    images: [
      'https://picsum.photos/800/600?random=1',
      'https://picsum.photos/800/600?random=2',
      'https://picsum.photos/800/600?random=3'
    ],
    featured: true
  },
  {
    id: '2',
    slug: 'casa-moderna-alphaville',
    title: 'Casa Contemporânea em Alphaville',
    description: 'Projeto arquitetônico premiado, pé direito duplo e integração total com a natureza.',
    price: 3200000,
    type: PropertyType.HOUSE,
    bedrooms: 5,
    bathrooms: 6,
    area: 450,
    garage: 3,
    location: { city: 'Barueri', neighborhood: 'Alphaville', state: 'SP' },
    features: ['Condomínio Fechado', 'Cinema', 'Sauna', 'Jardim', 'Automacão'],
    images: [
      'https://picsum.photos/800/600?random=4',
      'https://picsum.photos/800/600?random=5'
    ],
    featured: true
  },
  {
    id: '3',
    slug: 'apartamento-compacto-luxo',
    title: 'Studio High-End na Vila Olímpia',
    description: 'Ideal para investimento. Totalmente mobiliado e decorado, próximo aos principais escritórios.',
    price: 850000,
    type: PropertyType.APARTMENT,
    bedrooms: 1,
    bathrooms: 1,
    area: 45,
    garage: 1,
    location: { city: 'São Paulo', neighborhood: 'Vila Olímpia', state: 'SP' },
    features: ['Academia', 'Coworking', 'Lavanderia', 'Rooftop'],
    images: [
      'https://picsum.photos/800/600?random=6',
      'https://picsum.photos/800/600?random=7'
    ]
  },
  {
    id: '4',
    slug: 'mansao-lago-sul',
    title: 'Mansão Exclusiva no Lago Sul',
    description: 'Propriedade única com acesso ao lago, heliponto e segurança armada.',
    price: 12000000,
    type: PropertyType.HOUSE,
    bedrooms: 6,
    bathrooms: 8,
    area: 1200,
    garage: 10,
    location: { city: 'Brasília', neighborhood: 'Lago Sul', state: 'DF' },
    features: ['Heliponto', 'Pier', 'Quadra de Tênis', 'Spa'],
    images: [
      'https://picsum.photos/800/600?random=8',
      'https://picsum.photos/800/600?random=9'
    ],
    featured: true
  }
];
