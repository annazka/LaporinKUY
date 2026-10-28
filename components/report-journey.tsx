"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Camera,
  CalendarClock,
  Gift,
  Check,
  MapPin,
  ScanLine,
  ArrowRight,
  Ticket,
  Clock3,
} from "lucide-react";

const steps = [
  {
    icon: Camera,
    title: "Kirim foto dan lokasi",
    text: "Tambahkan foto dan lokasi. AI membantu membaca kerusakan, lalu operator memverifikasi laporanmu.",
  },
  {
    icon: CalendarClock,
    title: "Pantau penanganan",
    text: "Lihat target perbaikan dan pembaruan harian. Jika jadwal berubah, alasannya tetap tercatat.",
  },
  {
    icon: Gift,
    title: "Konfirmasi perbaikan",
    text: "Konfirmasi hasil perbaikan. Setelah tuntas dan terverifikasi, poinmu bisa ditukar dengan voucher simulasi.",
  },
];
export function ReportJourney({heading}: {heading: ReactNode}) {
  const [active, setActive] = useState(0), [progress, setProgress] = useState(0);
  const scrollbar = useRef<HTMLDivElement>(null);
  const drag = useRef<{pointer: number; offset: number} | null>(null);
  const track = useRef<HTMLDivElement>(null), layout = useRef<HTMLDivElement>(null);
  const geometry = useRef({top: 112, distance: 0, pinned: false});
  const [scrollLayout, setScrollLayout] = useState({top: 112, distance: 0, pinned: false, height: 0});
  useEffect(() => {
    const outer = track.current, inner = layout.current;
    if (!outer || !inner) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const {top, distance} = geometry.current;
      if (!distance) return;
      const progress = Math.max(0, Math.min(1, (top - outer.getBoundingClientRect().top) / distance));
      setProgress(progress);
      setActive(Math.min(steps.length - 1, Math.floor(progress * steps.length)));
    };
    const schedule = () => {if (!frame) frame = requestAnimationFrame(update);};
    const measure = () => {
      const header = document.querySelector<HTMLElement>('.landing-header');
      const top = Math.max(96, (header?.getBoundingClientRect().bottom ?? 80) + 16);
      const height = inner.getBoundingClientRect().height;
      // The viewport constrains the content, never disables the walkthrough.
      const next = {top, pinned: true, height, distance: Math.round(window.innerHeight * 1.5)};
      geometry.current = next;
      setScrollLayout(previous => previous.height === next.height && previous.top === next.top && previous.distance === next.distance && previous.pinned === next.pinned ? previous : next);
      schedule();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', measure);
    window.addEventListener('pageshow', measure);
    document.addEventListener('visibilitychange', schedule);
    measure();
    return () => {cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll', schedule);window.removeEventListener('resize', measure);window.removeEventListener('pageshow', measure);document.removeEventListener('visibilitychange', schedule);};
  }, []);
  function seek(value: number, smooth = true) {
    const outer = track.current;
    if (!outer) return;
    const next = Math.max(0, Math.min(1, value));
    const {top, distance, pinned} = geometry.current;
    const bounds = outer.getBoundingClientRect();
    const start = window.scrollY + bounds.top;
    const target = pinned ? start - top + distance * next : start + bounds.height * next - window.innerHeight * .5;
    window.scrollTo({top: target, behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'});
  }
  function dragTo(clientY: number, smooth = false) {
    const rail = scrollbar.current?.getBoundingClientRect();
    if (!rail) return;
    const thumbHeight = rail.height / steps.length;
    seek((clientY - rail.top - (drag.current?.offset ?? thumbHeight / 2)) / (rail.height - thumbHeight), smooth);
  }
  function select(index: number) {
    setActive(index);
    const {top, distance, pinned} = geometry.current;
    if (pinned && track.current) {
      const start = window.scrollY + track.current.getBoundingClientRect().top - top;
      window.scrollTo({top: start + distance * ((index + .5) / steps.length), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    }
  }
  return (
    <div ref={track} className={`journey-scroll-track${scrollLayout.pinned ? " is-scroll-driven" : ""}`} style={{"--journey-height": `${scrollLayout.height}px`, "--journey-top": `${scrollLayout.top}px`, "--journey-distance": `${scrollLayout.distance}px`} as CSSProperties}>
    <div ref={layout} className="journey-sticky">
    {heading}
    <div className="journey-layout">
      <div className="journey-navigation">
      <div ref={scrollbar} className="journey-scrollbar" role="scrollbar" tabIndex={0} aria-label="Posisi Cara kerja" aria-orientation="vertical" aria-controls="journey-preview" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-valuetext={`${Math.round(progress * 100)} persen, ${steps[active].title}`}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();event.currentTarget.focus({preventScroll:true});
          const thumb = event.currentTarget.querySelector<HTMLElement>('.journey-scroll-thumb');
          const offset = event.target === thumb ? event.clientY - thumb.getBoundingClientRect().top : event.currentTarget.clientHeight / steps.length / 2;
          drag.current = {pointer: event.pointerId, offset};
          event.currentTarget.setPointerCapture(event.pointerId);dragTo(event.clientY, true);
        }}
        onPointerMove={event => {if (drag.current?.pointer === event.pointerId) dragTo(event.clientY);}}
        onPointerUp={event => {if (drag.current?.pointer === event.pointerId) {drag.current = null;event.currentTarget.releasePointerCapture(event.pointerId);}}}
        onPointerCancel={() => {drag.current = null;}}
        onLostPointerCapture={() => {drag.current = null;}}
        onKeyDown={event => {
          const values: Record<string, number> = {ArrowDown: progress + .05, ArrowRight: progress + .05, ArrowUp: progress - .05, ArrowLeft: progress - .05, PageDown: progress + 1/3, PageUp: progress - 1/3, Home: 0, End: 1};
          if (event.key in values) {event.preventDefault();seek(values[event.key]);}
        }}>
        <span className="journey-scroll-thumb" style={{transform:`translateY(${progress * (steps.length - 1) * 100}%)`}}/>
      </div><div
        className="journey-choices"
        role="tablist"
        aria-label="Tahap pelaporan"
      >
        {steps.map((step, i) => (
          <button
            id={`journey-tab-${i}`}
            role="tab"
            aria-selected={active === i}
            aria-controls="journey-preview"
            tabIndex={active === i ? 0 : -1}
            key={step.title}
            className={`step-choice ${active === i ? "active" : ""}`}
            onClick={() => select(i)}
            onKeyDown={(e) => {
              if (
                [
                  "ArrowDown",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowLeft",
                  "Home",
                  "End",
                ].includes(e.key)
              ) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 2
                      : (active +
                          (e.key === "ArrowDown" || e.key === "ArrowRight"
                            ? 1
                            : 2)) %
                        3;
                select(next);
                document.getElementById(`journey-tab-${next}`)?.focus();
              }
            }}
          >
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
            <step.icon size={21} />
          </button>
        ))}
      </div><p className="journey-mobile-description">{steps[active].text}</p></div>
      <div
        id="journey-preview"
        role="tabpanel"
        aria-labelledby={`journey-tab-${active}`}
        className="demo-stage"
      >
        <div className="demo-top">
          <span>Contoh alur laporan</span>
        </div>
        <div className="journey-panels">{steps.map((_, index) => <div className="demo-content journey-panel" key={index} aria-hidden={active !== index} inert={active !== index}>
          {index === 0 ? (
            <>
              <div className="demo-photo">
                <div className="demo-road">
                  <div className="demo-pothole" />
                </div>
                <span className="demo-photo-label">
                  <ScanLine size={13} /> Pemeriksaan foto
                </span>
              </div>
              <div className="demo-report-title">
                <MapPin size={16} />
                <div>
                  <strong>Jalan berlubang di sekitar halte</strong>
                  <small>Lokasi dan bukti dikirim oleh warga</small>
                </div>
              </div>
              <div className="demo-status">
                Menunggu verifikasi operator
                <ArrowRight size={16} />
              </div>
            </>
          ) : index === 1 ? (
            <>
              <div className="demo-progress-heading">
                <div>
                  <small>Status penanganan</small>
                  <h3>Dalam perbaikan</h3>
                </div>
                <strong>
                  65<span>%</span>
                </strong>
              </div>
              <div className="progress-track">
                <span style={{ width: "65%" }} />
              </div>
              <div className="demo-deadline">
                <CalendarClock size={19} />
                <span>
                  Estimasi perbaikan<b>5 hari pengerjaan</b>
                </span>
                <span className="badge success">Contoh estimasi</span>
              </div>
              <div className="demo-timeline">
                <div>
                  <i className="done" />
                  <span>
                    <strong>Laporan diverifikasi</strong>
                    <small>Operator menetapkan jadwal dan prioritas.</small>
                  </span>
                  <Check size={14} />
                </div>
                <div>
                  <i className="done" />
                  <span>
                    <strong>Material disiapkan</strong>
                    <small>Persiapan lokasi dan perlengkapan.</small>
                  </span>
                  <Check size={14} />
                </div>
                <div>
                  <i />
                  <span>
                    <strong>Pengaspalan berlangsung</strong>
                    <small>Pembaruan harian dari operator.</small>
                  </span>
                  <Clock3 size={14} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="demo-reward">
                <div className="gift-icon">
                  <Gift size={45} strokeWidth={1.4} />
                </div>
                <span className="badge success">
                  <Check size={12} />
                  Perbaikan terkonfirmasi
                </span>
                <h3>Perbaikan selesai</h3>
                <p>
                  Poin masuk setelah laporan selesai
                  <br />
                  dan hasil perbaikannya terverifikasi.
                </p>
              </div>
              <div className="demo-ticket">
                <Ticket size={25} />
                <div>
                  <strong>Jelajah museum</strong>
                  <small>Contoh voucher simulasi</small>
                </div>
                <ArrowRight size={18} />
              </div>
            </>
          )}
        </div>)}</div>
        <div className="demo-footnote">
          Ilustrasi penggunaan. Angka dan progres di atas adalah contoh.
        </div>
      </div>
    </div></div></div>
  );
}
