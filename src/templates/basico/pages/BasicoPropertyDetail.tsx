import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, BedDouble, Bath, Maximize2, MessageCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';

export default function BasicoPropertyDetail() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  const identifier = slug || id;

  useEffect(() => {
    if (!identifier || !tenant?.id) return;
    setLoading(true);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    let query = supabase.from('properties').select('*').eq('company_id', tenant.id);

    if (isUuid) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('slug', identifier);
    }

    query.single().then(({ data, error }) => {
      if (error || !data) {
        navigate('/imoveis');
        return;
      }
      setProperty(data);
      setLoading(false);
    });
  }, [identifier, tenant?.id]);

  if (loading || !property) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const whatsappNumber = tenant?.phone?.replace(/\D/g, '');

  return (
    <div className="pt-24 pb-20 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <Link to="/imoveis" className="inline-flex items-center gap-2 text-slate-500 hover:text-brand-600 mb-8 transition-colors">
          <ArrowLeft size={20} /> Voltar para imóveis
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Galeria */}
          <div className="space-y-4">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-lg">
              <img
                src={property.images?.[activeImage] || 'https://via.placeholder.com/800x600'}
                alt={property.title}
                className="w-full h-full object-cover"
              />
            </div>
            {property.images?.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {property.images.map((img: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      activeImage === idx ? 'border-brand-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="inline-block bg-brand-100 text-brand-700 px-4 py-1.5 rounded-full text-sm font-bold mb-6">
              {property.transaction_type === 'venda' ? 'Para Venda' : 'Para Aluguel'}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{property.title}</h1>
            <p className="text-xl text-slate-600 mb-8 flex items-center gap-2">
              <MapPin size={24} className="text-brand-500" /> {property.city}, {property.state}
            </p>
            <div className="text-4xl font-bold text-brand-600 mb-8">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price)}
            </div>

            <div className="grid grid-cols-3 gap-6 py-8 border-y border-slate-100 mb-8">
              <div className="text-center">
                <BedDouble size={28} className="mx-auto text-slate-400 mb-2" />
                <div className="font-bold text-slate-900">{property.bedrooms}</div>
                <div className="text-sm text-slate-500">Quartos</div>
              </div>
              <div className="text-center border-l border-slate-100">
                <Bath size={28} className="mx-auto text-slate-400 mb-2" />
                <div className="font-bold text-slate-900">{property.bathrooms}</div>
                <div className="text-sm text-slate-500">Banhos</div>
              </div>
              <div className="text-center border-l border-slate-100">
                <Maximize2 size={28} className="mx-auto text-slate-400 mb-2" />
                <div className="font-bold text-slate-900">{property.area}m²</div>
                <div className="text-sm text-slate-500">Área</div>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-4">Descrição</h3>
            <div className="text-slate-600 leading-relaxed whitespace-pre-line mb-10">
              {property.description}
            </div>

            <a
              href={`https://wa.me/${whatsappNumber}?text=Olá! Tenho interesse no imóvel: ${property.title}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-brand-700 transition-colors shadow-lg"
            >
              <MessageCircle size={24} /> Falar com Corretor
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
