'use client';

import { useState } from 'react';
import type { BookingSettings, ServiceCategory } from '@/lib/types';

interface ServiceItem { id: string; name: string; description: string | null; duration_minutes: number; price: number; }
interface ProItem { id: string; specialty: string | null; bio: string | null; color_code: string; profile: { full_name: string | null } | null; }
interface SlotItem { slot_start: string; slot_end: string; }
interface PatientInfo { id: string; first_name: string; last_name: string; phone: string | null; email: string | null; }
interface DependienteInfo { id: string; first_name: string; last_name: string; birth_date: string | null; }

type Step = 'category' | 'service' | 'professional' | 'date' | 'confirm' | 'success';

interface Props {
    self: PatientInfo;
    dependientes: DependienteInfo[];
    categories: ServiceCategory[];
    settings: BookingSettings | null;
}

const STEP_LABELS = ['Especialidad', 'Servicio', 'Profesional', 'Horario', 'Confirmar'];
const STEP_ORDER: Step[] = ['category', 'service', 'professional', 'date', 'confirm'];

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
function buildCalDays(year: number, month: number): Array<{ dateStr: string; day: number } | null> {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;
    const days: Array<{ dateStr: string; day: number } | null> = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
        days.push({ day: d, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
    return days;
}
function monthName(month: number, year: number) {
    return new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export function ReservarClient({ self, dependientes, categories, settings }: Props) {
    const [step, setStep] = useState<Step>('category');
    const [forPatient, setForPatient] = useState<PatientInfo>(self);
    const [category, setCategory] = useState<ServiceCategory | null>(null);
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [service, setService] = useState<ServiceItem | null>(null);
    const [professionals, setProfessionals] = useState<ProItem[]>([]);
    const [professional, setProfessional] = useState<ProItem | null>(null);
    const [date, setDate] = useState<string | null>(null);
    const [slots, setSlots] = useState<SlotItem[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slot, setSlot] = useState<SlotItem | null>(null);
    const [calYear, setCalYear] = useState(() => new Date().getFullYear());
    const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
    const [loading, setLoading] = useState(false);
    const [gdprConsent, setGdprConsent] = useState(false);
    const [informedConsent, setInformedConsent] = useState(false);
    const [marketingConsent, setMarketingConsent] = useState(false);
    const [notes, setNotes] = useState('');
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [bookedService, setBookedService] = useState('');

    const advanceDays = settings?.booking_advance_days ?? 60;
    const noticeHours = settings?.min_booking_notice_hours ?? 2;
    const now = new Date();
    const minDate = new Date(now.getTime() + noticeHours * 3600000);
    const maxDate = new Date(now.getTime() + advanceDays * 86400000);
    const stepIndex = STEP_ORDER.indexOf(step);

    // ── Handlers ──────────────────────────────────────────────────────────────

    async function handleSelectCategory(cat: ServiceCategory) {
        setCategory(cat);
        setService(null);
        setProfessional(null);
        setDate(null);
        setSlot(null);
        setLoading(true);
        try {
            const res = await fetch(`/api/portal/booking/services?category_id=${cat.id}`);
            const json = await res.json() as { services: ServiceItem[] };
            setServices(json.services ?? []);
            setStep('service');
        } finally {
            setLoading(false);
        }
    }

    async function handleSelectService(svc: ServiceItem) {
        setService(svc);
        setProfessional(null);
        setDate(null);
        setSlot(null);
        setLoading(true);
        try {
            const res = await fetch(`/api/portal/booking/professionals?service_id=${svc.id}`);
            const json = await res.json() as { professionals: ProItem[] };
            setProfessionals(json.professionals ?? []);
            setStep('professional');
        } finally {
            setLoading(false);
        }
    }

    function handleSelectProfessional(pro: ProItem) {
        setProfessional(pro);
        setDate(null);
        setSlots([]);
        setSlot(null);
        setStep('date');
    }

    async function handleSelectDate(dateStr: string) {
        if (!professional || !service) return;
        setDate(dateStr);
        setSlot(null);
        setSlotsLoading(true);
        try {
            const res = await fetch(`/api/portal/booking/slots?professional_id=${professional.id}&date=${dateStr}&duration_minutes=${service.duration_minutes}`);
            const json = await res.json() as { slots: SlotItem[] };
            const minTime = new Date(Date.now() + noticeHours * 3600000);
            setSlots((json.slots ?? []).filter(s => new Date(s.slot_start) >= minTime));
        } finally {
            setSlotsLoading(false);
        }
    }

    function handleSelectSlot(s: SlotItem) {
        setSlot(s);
        setGdprConsent(false);
        setInformedConsent(false);
        setMarketingConsent(false);
        setNotes('');
        setSubmitError(null);
        setStep('confirm');
    }

    async function handleSubmit() {
        if (!slot || !service || !professional || !gdprConsent || !informedConsent) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const body = {
                service_id: service.id,
                professional_id: professional.id,
                start_time: slot.slot_start,
                end_time: slot.slot_end,
                ...(forPatient.id !== self.id ? { for_patient_id: forPatient.id } : {}),
                notes: notes.trim() || undefined,
                gdpr_consent: true as const,
                informed_consent: true as const,
                marketing_consent: marketingConsent,
            };
            const res = await fetch('/api/portal/booking/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body),
            });
            const json = await res.json() as { id: string; service_name: string; error?: string };
            if (!res.ok) {
                if (json.error === 'slot_taken') {
                    setSubmitError('Esta hora ya no está disponible. Por favor, elige otro horario.');
                    setSlot(null);
                    setSlots([]);
                    setStep('date');
                } else {
                    setSubmitError(json.error ?? 'Error al confirmar la cita. Inténtalo de nuevo.');
                }
                return;
            }
            setBookedService(json.service_name);
            setStep('success');
        } finally {
            setSubmitting(false);
        }
    }

    function goBack() {
        const idx = STEP_ORDER.indexOf(step);
        if (idx > 0) setStep(STEP_ORDER[idx - 1]);
    }

    // ── Calendar helpers ───────────────────────────────────────────────────────

    const calDays = buildCalDays(calYear, calMonth);
    const canPrevMonth = new Date(calYear, calMonth, 1) > new Date(now.getFullYear(), now.getMonth(), 1);
    const canNextMonth = new Date(calYear, calMonth + 1, 1) <= new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 1);

    function prevMonth() {
        if (!canPrevMonth) return;
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
        setDate(null);
        setSlots([]);
    }
    function nextMonth() {
        if (!canNextMonth) return;
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
        setDate(null);
        setSlots([]);
    }

    // ── Render helpers ─────────────────────────────────────────────────────────

    function renderPatientSelector() {
        if (dependientes.length === 0) return null;
        return (
            <div style={{ background: '#f8f4ef', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#5a4a3a' }}>Reservar para:</span>
                {[{ id: self.id, first_name: self.first_name, last_name: self.last_name }, ...dependientes].map(p => (
                    <button
                        key={p.id}
                        onClick={() => {
                            if (p.id !== forPatient.id) {
                                setForPatient('phone' in p ? p as PatientInfo : { id: p.id, first_name: p.first_name, last_name: p.last_name, phone: null, email: null });
                                setStep('category');
                                setCategory(null);
                                setService(null);
                                setProfessional(null);
                                setDate(null);
                                setSlot(null);
                            }
                        }}
                        style={{
                            padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all .15s',
                            background: forPatient.id === p.id ? 'var(--brand-canela, #c8953a)' : '#fff',
                            color: forPatient.id === p.id ? '#fff' : '#5a4a3a',
                            border: forPatient.id === p.id ? '1px solid var(--brand-canela, #c8953a)' : '1px solid #d9cfc4',
                        }}
                    >
                        {p.first_name} {p.id === self.id ? '(yo)' : ''}
                    </button>
                ))}
            </div>
        );
    }

    function renderStepCategory() {
        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px', color: '#1a1816' }}>¿Qué tipo de atención necesitas?</h2>
                <p style={{ fontSize: '14px', color: '#6b5b4e', marginBottom: '20px' }}>Selecciona la especialidad</p>
                {categories.length === 0 ? (
                    <p style={{ color: '#6b5b4e', fontSize: '14px' }}>No hay especialidades disponibles.</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => { void handleSelectCategory(cat); }} disabled={loading}
                                style={{ background: '#fff', border: '1.5px solid #e8dfd6', borderRadius: '12px', padding: '20px 16px', textAlign: 'left', cursor: 'pointer', transition: 'all .15s', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}
                                onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-canela, #c8953a)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(200,149,58,.15)'; }}
                                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8dfd6'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,.04)'; }}
                            >
                                <div style={{ fontSize: '22px', marginBottom: '8px' }}>{cat.icon ?? '🏥'}</div>
                                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1816' }}>{cat.name}</div>
                                {cat.description && <div style={{ fontSize: '12px', color: '#8a7a6e', marginTop: '4px' }}>{cat.description}</div>}
                            </button>
                        ))}
                    </div>
                )}
            </>
        );
    }

    function renderStepService() {
        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px', color: '#1a1816' }}>{category?.name}</h2>
                <p style={{ fontSize: '14px', color: '#6b5b4e', marginBottom: '20px' }}>Selecciona el servicio</p>
                {services.length === 0 ? (
                    <p style={{ color: '#6b5b4e', fontSize: '14px' }}>No hay servicios disponibles en esta categoría.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {services.map(svc => (
                            <button key={svc.id} onClick={() => { void handleSelectService(svc); }} disabled={loading}
                                style={{ background: '#fff', border: '1.5px solid #e8dfd6', borderRadius: '12px', padding: '16px 18px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', transition: 'all .15s' }}
                                onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-canela, #c8953a)'; }}
                                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8dfd6'; }}
                            >
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1816' }}>{svc.name}</div>
                                    {svc.description && <div style={{ fontSize: '12px', color: '#8a7a6e', marginTop: '3px' }}>{svc.description}</div>}
                                    <div style={{ fontSize: '12px', color: '#a08060', marginTop: '5px' }}>{svc.duration_minutes} min</div>
                                </div>
                                {svc.price > 0 && (
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1816', marginLeft: '16px', whiteSpace: 'nowrap' }}>{svc.price}€</div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </>
        );
    }

    function renderStepProfessional() {
        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px', color: '#1a1816' }}>{service?.name}</h2>
                <p style={{ fontSize: '14px', color: '#6b5b4e', marginBottom: '20px' }}>Elige tu profesional</p>
                {professionals.length === 0 ? (
                    <p style={{ color: '#6b5b4e', fontSize: '14px' }}>No hay profesionales disponibles para este servicio.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {professionals.map(pro => {
                            const name = pro.profile?.full_name ?? 'Profesional';
                            const initial = name.charAt(0).toUpperCase();
                            return (
                                <button key={pro.id} onClick={() => handleSelectProfessional(pro)}
                                    style={{ background: '#fff', border: '1.5px solid #e8dfd6', borderRadius: '12px', padding: '16px 18px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'all .15s' }}
                                    onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-canela, #c8953a)'; }}
                                    onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8dfd6'; }}
                                >
                                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: pro.color_code, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '18px', flexShrink: 0 }}>{initial}</div>
                                    <div>
                                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1816' }}>{name}</div>
                                        {pro.specialty && <div style={{ fontSize: '12px', color: '#a08060' }}>{pro.specialty}</div>}
                                        {pro.bio && <div style={{ fontSize: '12px', color: '#8a7a6e', marginTop: '4px', lineHeight: 1.4 }}>{pro.bio.length > 100 ? pro.bio.slice(0, 100) + '…' : pro.bio}</div>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </>
        );
    }

    function renderStepDate() {
        const proName = professional?.profile?.full_name ?? 'Profesional';
        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '2px', color: '#1a1816' }}>Elige fecha y hora</h2>
                <p style={{ fontSize: '14px', color: '#6b5b4e', marginBottom: '20px' }}>{service?.name} · {proName}</p>

                {submitError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>
                        {submitError}
                    </div>
                )}

                {/* Calendar */}
                <div style={{ background: '#fff', border: '1.5px solid #e8dfd6', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <button onClick={prevMonth} disabled={!canPrevMonth} style={{ background: 'none', border: 'none', cursor: canPrevMonth ? 'pointer' : 'default', fontSize: '18px', color: canPrevMonth ? '#1a1816' : '#ccc', padding: '4px 8px' }}>‹</button>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1816', textTransform: 'capitalize' }}>{monthName(calMonth, calYear)}</span>
                        <button onClick={nextMonth} disabled={!canNextMonth} style={{ background: 'none', border: 'none', cursor: canNextMonth ? 'pointer' : 'default', fontSize: '18px', color: canNextMonth ? '#1a1816' : '#ccc', padding: '4px 8px' }}>›</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                            <div key={d} style={{ fontSize: '11px', fontWeight: 600, color: '#a08060', paddingBottom: '6px' }}>{d}</div>
                        ))}
                        {calDays.map((cell, i) => {
                            if (!cell) return <div key={`e-${i}`} />;
                            const dt = new Date(`${cell.dateStr}T12:00:00`);
                            const disabled = dt < minDate || dt > maxDate;
                            const isSelected = date === cell.dateStr;
                            return (
                                <button key={cell.dateStr} onClick={() => { if (!disabled) { void handleSelectDate(cell.dateStr); } }} disabled={disabled}
                                    style={{ padding: '7px 0', borderRadius: '8px', fontSize: '13px', fontWeight: isSelected ? 700 : 400, cursor: disabled ? 'default' : 'pointer', border: 'none', background: isSelected ? 'var(--brand-canela, #c8953a)' : 'transparent', color: disabled ? '#ccc' : isSelected ? '#fff' : '#1a1816', transition: 'all .1s' }}
                                >
                                    {cell.day}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Slots */}
                {date && (
                    <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#5a4a3a', marginBottom: '10px', textTransform: 'capitalize' }}>
                            {formatDate(date + 'T12:00:00')}
                        </p>
                        {slotsLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#a08060', fontSize: '14px' }}>Cargando horarios…</div>
                        ) : slots.length === 0 ? (
                            <div style={{ background: '#f8f4ef', borderRadius: '10px', padding: '16px', textAlign: 'center', fontSize: '14px', color: '#8a7a6e' }}>
                                No hay horarios disponibles este día. Prueba otro día.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                                {slots.map(s => (
                                    <button key={s.slot_start} onClick={() => handleSelectSlot(s)}
                                        style={{ padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', border: '1.5px solid var(--brand-canela, #c8953a)', background: '#fff', color: 'var(--brand-canela, #c8953a)', transition: 'all .1s' }}
                                        onMouseOver={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = 'var(--brand-canela, #c8953a)'; el.style.color = '#fff'; }}
                                        onMouseOut={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = '#fff'; el.style.color = 'var(--brand-canela, #c8953a)'; }}
                                    >
                                        {formatTime(s.slot_start)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </>
        );
    }

    function renderConfirm() {
        if (!slot || !service || !professional) return null;
        const proName = professional.profile?.full_name ?? 'Profesional';
        const gdprText = settings?.gdpr_text ?? 'Consiento el tratamiento de mis datos personales con fines de gestión sanitaria de acuerdo con el RGPD.';
        const informedText = settings?.informed_consent_text ?? 'Confirmo haber sido informado/a del tratamiento a realizar y doy mi consentimiento para proceder.';
        const missingPhone = !forPatient.phone;

        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: '#1a1816' }}>Confirma tu cita</h2>

                {/* Summary card */}
                <div style={{ background: '#f8f4ef', borderRadius: '12px', padding: '16px 18px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: professional.color_code, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '15px' }}>
                            {proName.charAt(0)}
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1816' }}>{service.name}</div>
                            <div style={{ fontSize: '12px', color: '#8a7a6e' }}>{proName}{professional.specialty ? ` · ${professional.specialty}` : ''}</div>
                        </div>
                    </div>
                    <div style={{ fontSize: '14px', color: '#1a1816', fontWeight: 600, textTransform: 'capitalize' }}>{formatDate(slot.slot_start)}</div>
                    <div style={{ fontSize: '13px', color: '#5a4a3a', marginTop: '2px' }}>{formatTime(slot.slot_start)} — {formatTime(slot.slot_end)}</div>
                    <div style={{ marginTop: '10px', fontSize: '13px', color: '#5a4a3a', borderTop: '1px solid #e8dfd6', paddingTop: '10px' }}>
                        <span style={{ fontWeight: 600 }}>Paciente:</span> {forPatient.first_name} {forPatient.last_name}
                    </div>
                    {missingPhone && (
                        <div style={{ marginTop: '8px', background: '#fef3c7', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: '#92400e' }}>
                            ⚠️ No tienes teléfono registrado. Te recomendamos añadirlo en tu perfil para que la clínica pueda contactarte.
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#5a4a3a', display: 'block', marginBottom: '6px' }}>Notas para la clínica (opcional)</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={3}
                        placeholder="Motivo de consulta, alergias conocidas, cualquier información relevante…"
                        style={{ width: '100%', borderRadius: '8px', border: '1.5px solid #e8dfd6', padding: '10px', fontSize: '13px', color: '#1a1816', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                </div>

                {/* Consents */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    <label style={{ display: 'flex', gap: '10px', cursor: 'pointer', alignItems: 'flex-start' }}>
                        <input type="checkbox" checked={gdprConsent} onChange={e => setGdprConsent(e.target.checked)} style={{ marginTop: '3px', flexShrink: 0, accentColor: 'var(--brand-canela, #c8953a)' }} />
                        <span style={{ fontSize: '12px', color: '#5a4a3a', lineHeight: 1.5 }}><strong>Consentimiento de datos *</strong><br />{gdprText}</span>
                    </label>
                    <label style={{ display: 'flex', gap: '10px', cursor: 'pointer', alignItems: 'flex-start' }}>
                        <input type="checkbox" checked={informedConsent} onChange={e => setInformedConsent(e.target.checked)} style={{ marginTop: '3px', flexShrink: 0, accentColor: 'var(--brand-canela, #c8953a)' }} />
                        <span style={{ fontSize: '12px', color: '#5a4a3a', lineHeight: 1.5 }}><strong>Consentimiento informado *</strong><br />{informedText}</span>
                    </label>
                    <label style={{ display: 'flex', gap: '10px', cursor: 'pointer', alignItems: 'flex-start' }}>
                        <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} style={{ marginTop: '3px', flexShrink: 0, accentColor: 'var(--brand-canela, #c8953a)' }} />
                        <span style={{ fontSize: '12px', color: '#5a4a3a', lineHeight: 1.5 }}>Acepto recibir comunicaciones y recordatorios por email (opcional)</span>
                    </label>
                </div>

                {submitError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>
                        {submitError}
                    </div>
                )}

                <button onClick={() => { void handleSubmit(); }} disabled={submitting || !gdprConsent || !informedConsent}
                    style={{ width: '100%', padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: submitting || !gdprConsent || !informedConsent ? 'not-allowed' : 'pointer', border: 'none', background: gdprConsent && informedConsent ? 'var(--brand-canela, #c8953a)' : '#e8dfd6', color: gdprConsent && informedConsent ? '#fff' : '#a08060', transition: 'all .15s' }}
                >
                    {submitting ? 'Confirmando…' : 'Confirmar cita'}
                </button>
            </>
        );
    }

    function renderSuccess() {
        return (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>✓</div>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1816', marginBottom: '8px' }}>¡Cita reservada!</h2>
                <p style={{ fontSize: '14px', color: '#6b5b4e', marginBottom: '6px' }}>{bookedService}</p>
                {slot && (
                    <p style={{ fontSize: '14px', color: '#5a4a3a', fontWeight: 600, textTransform: 'capitalize', marginBottom: '24px' }}>
                        {formatDate(slot.slot_start)} · {formatTime(slot.slot_start)}
                    </p>
                )}
                <p style={{ fontSize: '13px', color: '#8a7a6e', marginBottom: '28px' }}>
                    Tu solicitud está pendiente de confirmación. La clínica te contactará para confirmarla.
                </p>
                <a href="/portal/mis-citas" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: '10px', background: 'var(--brand-canela, #c8953a)', color: '#fff', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
                    Ver mis citas
                </a>
            </div>
        );
    }

    // ── Main render ────────────────────────────────────────────────────────────

    const stepContent: Record<Step, () => React.ReactNode> = {
        category: renderStepCategory,
        service: renderStepService,
        professional: renderStepProfessional,
        date: renderStepDate,
        confirm: renderConfirm,
        success: renderSuccess,
    };

    return (
        <div className="portal-page">
            <header className="portal-header">
                <div className="portal-header__brand">
                    <span className="portal-header__logo">Z</span>
                    <span className="portal-header__title">Reservar cita</span>
                </div>
                <div className="portal-header__user">
                    <a href="/portal/mis-citas" className="btn btn--ghost btn--sm">Mis citas</a>
                </div>
            </header>

            <main className="portal-main">
                {/* Progress indicator */}
                {step !== 'success' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
                        {STEP_LABELS.map((label, i) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: i < stepIndex ? 'var(--brand-canela, #c8953a)' : i === stepIndex ? 'var(--brand-canela, #c8953a)' : '#e8dfd6', color: i <= stepIndex ? '#fff' : '#a08060' }}>
                                        {i < stepIndex ? '✓' : i + 1}
                                    </div>
                                    <span style={{ fontSize: '12px', color: i === stepIndex ? '#1a1816' : '#a08060', fontWeight: i === stepIndex ? 600 : 400, display: 'none', ...(i === stepIndex ? { display: 'inline' } : {}) }}>
                                        {label}
                                    </span>
                                </div>
                                {i < STEP_LABELS.length - 1 && (
                                    <div style={{ width: '20px', height: '1.5px', background: i < stepIndex ? 'var(--brand-canela, #c8953a)' : '#e8dfd6' }} />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Patient selector */}
                {step !== 'success' && renderPatientSelector()}

                {/* Step content */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#a08060', fontSize: '14px' }}>Cargando…</div>
                ) : (
                    <div>{stepContent[step]()}</div>
                )}

                {/* Back navigation */}
                {step !== 'category' && step !== 'success' && (
                    <div style={{ marginTop: '24px' }}>
                        <button onClick={goBack} style={{ background: 'none', border: 'none', color: '#8a7a6e', fontSize: '13px', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            ← Volver
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
