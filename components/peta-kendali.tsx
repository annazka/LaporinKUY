'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

export interface ReportItem {
  id: string;
  title: string;
  description?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  photo_path?: string | null;
  status: string;
  priority: string;
  progress: number;
  support_count?: number | null;
  target_date?: string | null;
  [key: string]: any;
}

const FALLBACK_REPORTS: ReportItem[] = [
  {
    id: 'C0CD9DCD',
    title: 'jalanan rusak',
    description: 'jalanan rusak',
    address: 'pasar pondok labu',
    latitude: -6.3125,
    longitude: 106.7942,
    photo_path: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=900&q=80',
    status: 'in_progress',
    priority: 'medium',
    progress: 99,
    support_count: 3,
    target_date: '2026-11-26',
  },
];

export function getUrgency(report: any) {
  const isOverdue =
    report?.target_date &&
    new Date(report.target_date) < new Date() &&
    report?.status !== 'completed';

  if (
    report?.priority === 'urgent' ||
    report?.priority === 'high' ||
    isOverdue ||
    (report?.support_count ?? 0) >= 5
  ) {
    return {
      key: 'urgent' as const,
      label: 'Sangat Darurat',
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.16)',
      border: 'rgba(239, 68, 68, 0.45)',
      pulse: true,
    };
  }

  if (report?.priority === 'medium' || report?.status === 'in_progress') {
    return {
      key: 'medium' as const,
      label: 'Sedang',
      color: '#eab308',
      bg: 'rgba(234, 179, 8, 0.16)',
      border: 'rgba(234, 179, 8, 0.45)',
      pulse: false,
    };
  }

  return {
    key: 'low' as const,
    label: 'Bisa Nanti',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.16)',
    border: 'rgba(16, 185, 129, 0.45)',
    pulse: false,
  };
}

function formatStatusLabel(status: string) {
  const map: Record<string, string> = {
    submitted: 'Verifikasi baru',
    verified: 'Terverifikasi',
    in_progress: 'Dalam perbaikan',
    awaiting_confirmation: 'Menunggu konfirmasi',
    completed: 'Selesai',
  };
  return map[status] || status;
}

export function PetaKendali({
  reports = [],
  onManageReport,
}: {
  reports?: any[];
  onManageReport?: (report: any) => void;
}) {
  const dataList: ReportItem[] =
    Array.isArray(reports) && reports.length > 0 ? reports : FALLBACK_REPORTS;

  const [items, setItems] = useState<ReportItem[]>(dataList);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'medium' | 'low' | 'new'>('all');
  const [selectedId, setSelectedId] = useState<string>(dataList[0]?.id || '');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  useEffect(() => {
    if (Array.isArray(reports) && reports.length > 0) {
      setItems(reports);
      if (!selectedId) setSelectedId(reports[0].id);
    }
  }, [reports]);

  const filteredItems = items.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'new') return r.status === 'submitted';
    return getUrgency(r).key === filter;
  });

  const selectedReport =
    items.find((r) => r.id === selectedId) || filteredItems[0] || items[0];

  const handlePriorityChange = (newPriority: 'urgent' | 'medium' | 'low') => {
    if (!selectedReport) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedReport.id
          ? {
              ...item,
              priority: newPriority,
              support_count:
                newPriority === 'urgent' ? Math.max(item.support_count || 0, 5) : 1,
            }
          : item
      )
    );
  };

  useEffect(() => {
    let isMounted = true;

    async function renderMap() {
      const L: any = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          center: [
            selectedReport?.latitude || -6.3125,
            selectedReport?.longitude || 106.7942,
          ],
          zoom: 14,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);

        markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      }

      const layer = markersLayerRef.current;
      if (!layer) return;
      layer.clearLayers();

      filteredItems.forEach((rep) => {
        const u = getUrgency(rep);
        const isSelected = selectedReport?.id === rep.id;

        const icon = L.divIcon({
          className: '',
          html: `
            <div class="lk-pin ${u.pulse ? 'lk-pin-pulse' : ''}" style="
              width: ${isSelected ? '24px' : '18px'};
              height: ${isSelected ? '24px' : '18px'};
              background: ${u.color};
              border: 3px solid #ffffff;
              box-shadow: 0 0 0 3px #0a0a0a, 0 0 14px ${u.color};
            "></div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([rep.latitude, rep.longitude], { icon });
        marker.on('click', () => {
          setSelectedId(rep.id);
        });
        marker.addTo(layer);
      });
    }

    renderMap();
    return () => {
      isMounted = false;
    };
  }, [filteredItems, selectedReport]);

  const activeUrgency = selectedReport ? getUrgency(selectedReport) : null;

  return (
    <div style={{ color: '#e5e5e5', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <style>{`
        @keyframes lkUrgentRadar {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.85), 0 0 0 3px #0a0a0a; }
          70% { box-shadow: 0 0 0 16px rgba(239, 68, 68, 0), 0 0 0 3px #0a0a0a; }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0), 0 0 0 3px #0a0a0a; }
        }
        .lk-pin { border-radius: 50%; cursor: pointer; transition: transform 0.2s ease; }
        .lk-pin:hover { transform: scale(1.25); }
        .lk-pin-pulse { animation: lkUrgentRadar 1.4s infinite; }
        .lk-filter-btn {
          background: #121212; color: #a3a3a3; border: 1px solid #262626;
          padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 600;
          cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
        }
        .lk-filter-btn.active { background: #1f1f1f; color: #ffffff; border-color: #525252; }
        .lk-map-grid { display: grid; grid-template-columns: 1.65fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 960px) { .lk-map-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button className={`lk-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Semua titik
        </button>
        <button className={`lk-filter-btn ${filter === 'urgent' ? 'active' : ''}`} onClick={() => setFilter('urgent')}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
          Sangat Darurat
        </button>
        <button className={`lk-filter-btn ${filter === 'medium' ? 'active' : ''}`} onClick={() => setFilter('medium')}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} />
          Sedang
        </button>
        <button className={`lk-filter-btn ${filter === 'low' ? 'active' : ''}`} onClick={() => setFilter('low')}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
          Bisa Nanti
        </button>
        <button className={`lk-filter-btn ${filter === 'new' ? 'active' : ''}`} onClick={() => setFilter('new')}>
          Verifikasi baru
        </button>
      </div>

      <div className="lk-map-grid">
        <div style={{ background: '#121212', border: '1px solid #262626', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
          <div ref={mapContainerRef} style={{ height: '540px', width: '100%' }} />
        </div>

        {selectedReport && activeUrgency && (
          <div style={{ background: '#121212', border: '1px solid #262626', borderRadius: '16px', padding: '22px' }}>
            <div style={{ fontSize: '11px', color: '#8a8a8a', fontFamily: 'monospace', marginBottom: '10px' }}>
              #{String(selectedReport.id).slice(0, 8).toUpperCase()}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <span style={{ background: '#1e293b', color: '#93c5fd', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                {formatStatusLabel(selectedReport.status)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: activeUrgency.bg, color: activeUrgency.color, border: `1px solid ${activeUrgency.border}` }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: activeUrgency.color }} />
                {activeUrgency.label}
              </span>
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>{selectedReport.title}</h3>
            <p style={{ fontSize: '13px', color: '#a3a3a3', margin: '0 0 16px 0' }}>{selectedReport.address}</p>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '6px' }}>Ubah Tingkat Urgensi:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button type="button" onClick={() => handlePriorityChange('urgent')} style={{ padding: '6px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: activeUrgency.key === 'urgent' ? 'rgba(239,68,68,0.2)' : '#1a1a1a', color: '#f87171', border: '1px solid #262626' }}>🔴 Darurat</button>
                <button type="button" onClick={() => handlePriorityChange('medium')} style={{ padding: '6px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: activeUrgency.key === 'medium' ? 'rgba(234,179,8,0.2)' : '#1a1a1a', color: '#facc15', border: '1px solid #262626' }}>🟡 Sedang</button>
                <button type="button" onClick={() => handlePriorityChange('low')} style={{ padding: '6px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: activeUrgency.key === 'low' ? 'rgba(16,185,129,0.2)' : '#1a1a1a', color: '#34d399', border: '1px solid #262626' }}>🟢 Bisa Nanti</button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #262626', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a3a3a3' }}>Progres</span>
                <strong style={{ color: '#ffffff' }}>{selectedReport.progress ?? 0}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a3a3a3' }}>Target</span>
                <strong style={{ color: '#ffffff' }}>{selectedReport.target_date || '26 Nov 2026'}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onManageReport?.(selectedReport)}
              style={{ width: '100%', background: '#f5f5f5', color: '#0a0a0a', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              Kelola laporan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PetaKendali;