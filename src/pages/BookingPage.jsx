import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const WORKING_HOURS = { start: 9, end: 18 }
const BLOCKED_DAYS = [0, 1]

const BRAND = {
  bg: '#F0F1EC',
  card: '#ffffff',
  sage: '#a8b89a',
  sageLight: '#e8ede5',
  text: '#2c2c2c',
  muted: '#9a9a9a',
  border: '#ebebeb',
}

function generateTimeSlots(durationMinutes) {
  const slots = []
  for (let h = WORKING_HOURS.start; h < WORKING_HOURS.end; h++) {
    for (let m = 0; m < 60; m += 30) {
      const totalMins = h * 60 + m
      const endMins = totalMins + durationMinutes
      if (endMins <= WORKING_HOURS.end * 60) {
        const format = (mins) => {
          const hh = Math.floor(mins / 60)
          const mm = mins % 60
          return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
        }
        slots.push({ label: `${format(totalMins)} – ${format(endMins)}`, value: format(totalMins) })
      }
    }
  }
  return slots
}

const CATEGORIES = [
  { label: 'Manicure', keywords: ['gel polish', 'biab', 'acrylic', 'manicure removal'] },
  { label: 'Pedicure', keywords: ['pedicure', 'gel polish on toes'] },
  { label: 'Nail Art', keywords: ['nail art'] },
  { label: 'Waxing', keywords: ['wax'] },
  { label: 'Lashes & Brows', keywords: ['lash', 'brow'] },
  { label: 'Makeup', keywords: ['makeup'] },
  { label: 'Spray Tan', keywords: ['tan'] },
]

function categorise(services) {
  const result = []
  const used = new Set()
  for (const cat of CATEGORIES) {
    const matched = services.filter(s =>
      cat.keywords.some(k => s.name.toLowerCase().includes(k)) && !used.has(s.id)
    )
    if (matched.length) {
      matched.forEach(s => used.add(s.id))
      result.push({ label: cat.label, items: matched })
    }
  }
  const rest = services.filter(s => !used.has(s.id))
  if (rest.length) result.push({ label: 'Other', items: rest })
  return result
}

function CustomCalendar({ selectedDate, onSelect, isDateBlocked, minDate }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay = new Date(viewYear, viewMonth + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const totalDays = lastDay.getDate()

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  const toStr = (d) => {
    const dd = String(d).padStart(2, '0')
    const mm = String(viewMonth + 1).padStart(2, '0')
    return `${viewYear}-${mm}-${dd}`
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-gray-50 text-gray-400 text-lg">‹</button>
        <span className="text-sm font-medium" style={{color: BRAND.text}}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-gray-50 text-gray-400 text-lg">›</button>
      </div>
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium py-1" style={{color: BRAND.muted}}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const dateStr = toStr(day)
          const blocked = isDateBlocked(dateStr)
          const past = dateStr < minDate
          const selected = dateStr === selectedDate
          const disabled = blocked || past
          return (
            <button key={dateStr}
              disabled={disabled}
              onClick={() => onSelect(dateStr)}
              className="aspect-square rounded-xl text-xs flex items-center justify-center transition-all"
              style={{
                background: selected ? BRAND.sage : 'transparent',
                color: disabled ? BRAND.border : selected ? '#fff' : BRAND.text,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontWeight: selected ? '600' : '400'
              }}>
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function BookingPage() {
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [step, setStep] = useState(1)
  const [services, setServices] = useState([])
  const [primaryService, setPrimaryService] = useState(null)
  const [selectedAddons, setSelectedAddons] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [takenSlots, setTakenSlots] = useState([])
  const [blockedDates, setBlockedDates] = useState([])
  const [form, setForm] = useState({ name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [openCategory, setOpenCategory] = useState(null)
  const [slotError, setSlotError] = useState('')

  useEffect(() => {
    supabase.from('services').select('*').eq('active', true).order('name')
      .then(({ data }) => setServices(data || []))
    supabase.from('blocked_times').select('date').then(({ data }) => {
      setBlockedDates((data || []).map(b => b.date))
    })
  }, [])

  useEffect(() => {
    if (!selectedDate || !primaryService) return
    supabase.from('bookings')
      .select('start_time, end_time')
      .in('status', ['pending', 'confirmed'])
      .gte('start_time', `${selectedDate}T00:00:00`)
      .lte('start_time', `${selectedDate}T23:59:59`)
      .then(({ data }) => {
        setTakenSlots((data || []).map(b => ({
          start: b.start_time.slice(11, 16),
          end: b.end_time.slice(11, 16)
        })))
      })
  }, [selectedDate, primaryService])

  const primaryServices = services.filter(s => !s.is_addon)
  const addonServices = services.filter(s => s.is_addon)
  const categorised = categorise(primaryServices)

  const totalDuration = primaryService
    ? [primaryService, ...selectedAddons].reduce((sum, s) => sum + s.duration_minutes, 0) + (primaryService.buffer_minutes || 15)
    : 0

  const totalPrice = primaryService
    ? [primaryService, ...selectedAddons].reduce((sum, s) => sum + parseFloat(s.price), 0)
    : 0

  const isSlotTaken = (slotValue) => {
    if (!primaryService) return false
    const [h, m] = slotValue.split(':').map(Number)
    const slotStart = h * 60 + m
    const slotEnd = slotStart + totalDuration
    return takenSlots.some(({ start, end }) => {
      const [sh, sm] = start.split(':').map(Number)
      const [eh, em] = end.split(':').map(Number)
      const bookedStart = sh * 60 + sm
      const bookedEnd = eh * 60 + em
      return slotStart < bookedEnd && slotEnd > bookedStart
    })
  }

  const isDateBlocked = (dateStr) => {
    const day = new Date(dateStr).getDay()
    return BLOCKED_DAYS.includes(day) || blockedDates.includes(dateStr)
  }

  const getTodayString = () => new Date().toISOString().split('T')[0]

  const toggleAddon = (addon) => {
    setSelectedAddons(prev =>
      prev.find(a => a.id === addon.id)
        ? prev.filter(a => a.id !== addon.id)
        : [...prev, addon]
    )
    setSelectedTime('')
    setSlotError('')
  }

  const handleSubmit = async () => {
    setLoading(true)
    setSlotError('')
    const startTime = `${selectedDate}T${selectedTime}:00`
    const [h, m] = selectedTime.split(':').map(Number)
    const endTotal = h * 60 + m + totalDuration
    const endTime = `${selectedDate}T${Math.floor(endTotal / 60).toString().padStart(2, '0')}:${(endTotal % 60).toString().padStart(2, '0')}:00`

    const { data, error } = await supabase.rpc('insert_booking_safe', {
      p_client_name: form.name,
      p_client_phone: form.phone,
      p_service_id: primaryService.id,
      p_start_time: startTime,
      p_end_time: endTime
    })

    setLoading(false)

    if (error || data?.error) {
      setSlotError(data?.error || 'Something went wrong. Please try again.')
      return
    }

    setSubmitted(true)
  }

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{background: BRAND.bg}}>
      <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-sm">
        <img src="/laylalogo.jpg" alt="Beauty by Layla" className="w-24 mx-auto mb-6 opacity-80" />
        <h2 className="text-xl font-light text-gray-800 mb-3">Request received</h2>
        <p className="text-sm leading-relaxed" style={{color: BRAND.muted}}>
          Thank you for booking with Beauty by Layla. You'll receive a text once your appointment is confirmed.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{background: BRAND.bg}}>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">

        {/* Hero */}
        <div className="mb-6 rounded-3xl overflow-hidden shadow-sm">
          <div className="relative h-56 flex items-end px-6 pb-0"
            style={{background: 'linear-gradient(160deg, #b8c9ac 0%, #8fa882 40%, #c5d4bc 100%)'}}>
            <img src="/laylalogo.jpg" alt="" aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none" />
            <div className="relative z-10 translate-y-12">
              <img src="/profile.jpg" alt="Layla"
                className="w-28 h-28 rounded-full object-cover object-top shadow-lg"
                style={{border: '4px solid white'}} />
            </div>
          </div>
          <div className="bg-white px-6 pt-16 pb-7">
            <div className="mb-4">
              <h1 className="text-2xl font-semibold tracking-tight mb-1" style={{color: BRAND.text}}>Layla Donegan</h1>
              <p className="text-xs font-medium uppercase tracking-widest" style={{color: BRAND.sage}}>Beauty by Layla · Dublin · Est. 2022</p>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{color: BRAND.muted}}>
              Welcome to Beauty by Layla. I'm a Dublin-based beauty professional specialising in nails, waxing, lashes, brows, makeup, and spray tans. I'm passionate about making every client feel their best — book your appointment below.
            </p>
            <div className="flex gap-4 text-xs font-medium" style={{color: BRAND.sage}}>
              <span>💅 Nails</span>
              <span>✨ Lashes & Brows</span>
              <span>🌿 Waxing</span>
              <span>💄 Makeup</span>
            </div>
          </div>
        </div>

        {/* Policy card */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-sm font-semibold mb-3" style={{color: BRAND.text}}>Booking Policy</h2>
            <p className="text-xs leading-relaxed mb-4" style={{color: BRAND.muted}}>
              Thank you for choosing BeautyByLayla. As a one-person business, I am committed to providing a professional and enjoyable experience. Please adhere to the following policies.
            </p>
            <div className="space-y-0 text-xs mb-4" style={{color: BRAND.muted}}>
              {[
                ['Payment', 'Cash only. Please bring exact change.'],
                ['Refills', "Refills over other artists' nails or lash work are not offered."],
                ['Punctuality', 'Late arrivals over 10 mins may result in a shortened service or rescheduling.'],
                ['Cancellations', '24 hours notice required for all cancellations.'],
                ['Confirmations', 'A confirmation text will be sent within 24 hours. If not received, please contact me.'],
                ['No-Shows', 'Clients who do not attend without notice will be unable to book future appointments.'],
                ['Patch Testing', 'Required for waxing and tinting services — please schedule in advance.'],
                ['Media Consent', 'Photos or videos taken may be posted to social media. Let me know if you do not consent.'],
                ['Location', 'Clondalkin, D22.'],
                ['Entry Protocol', 'Text when you arrive outside and I will come to let you in.'],
              ].map(([title, text]) => (
                <div key={title} className="flex gap-4 py-2.5" style={{borderBottom: `1px solid ${BRAND.border}`}}>
                  <span className="font-semibold shrink-0 w-28" style={{color: BRAND.text}}>{title}</span>
                  <span className="leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{color: BRAND.muted}}>
              I appreciate your cooperation in upholding these standards. For any questions please contact me.
            </p>
          </div>
          <div className="px-6 pb-6">
            <button
              onClick={() => setPolicyAccepted(true)}
              className="w-full py-3 rounded-2xl text-sm font-medium transition-all"
              style={{
                background: policyAccepted ? BRAND.sageLight : BRAND.sage,
                color: policyAccepted ? BRAND.sage : '#fff'
              }}>
              {policyAccepted ? '✓ Understood' : 'Okay'}
            </button>
          </div>
        </div>

        {/* Booking steps */}
        {policyAccepted && (
          <>
            {/* Step 1 — Primary Service */}
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
              <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{borderBottom: `1px solid ${BRAND.border}`}}>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium" style={{background: BRAND.sage}}>1</span>
                  <h2 className="font-medium text-sm" style={{color: BRAND.text}}>Choose a service</h2>
                </div>
                {primaryService && (
                  <button onClick={() => { setPrimaryService(null); setSelectedAddons([]); setSelectedDate(''); setSelectedTime(''); setStep(1) }}
                    className="text-xs" style={{color: BRAND.muted}}>Change</button>
                )}
              </div>
              {primaryService && (
                <div className="px-6 py-3 text-sm font-medium" style={{color: BRAND.sage}}>{primaryService.name} — €{primaryService.price}</div>
              )}
              {step === 1 && (
                <div>
                  {categorised.map(cat => (
                    <div key={cat.label} style={{borderBottom: `1px solid ${BRAND.border}`}}>
                      <button
                        onClick={() => setOpenCategory(openCategory === cat.label ? null : cat.label)}
                        className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50">
                        <span className="text-sm font-medium" style={{color: BRAND.text}}>{cat.label}</span>
                        <span style={{color: BRAND.muted}}>{openCategory === cat.label ? '−' : '+'}</span>
                      </button>
                      {openCategory === cat.label && (
                        <div style={{background: BRAND.sageLight}}>
                          {cat.items.map(s => (
                            <button key={s.id}
                              onClick={() => { setPrimaryService(s); setSelectedAddons([]); setSelectedTime(''); setStep(2); setOpenCategory(null) }}
                              className="w-full flex items-center justify-between px-8 py-3 text-left transition-colors hover:bg-green-50">
                              <span className="text-sm" style={{color: BRAND.text}}>{s.name}</span>
                              <div>
                                <span className="text-sm font-medium" style={{color: BRAND.sage}}>€{s.price}</span>
                                <span className="text-xs ml-2" style={{color: BRAND.muted}}>{s.duration_minutes}min</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add-ons */}
            {primaryService && addonServices.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
                <div className="px-6 pt-5 pb-4" style={{borderBottom: `1px solid ${BRAND.border}`}}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium" style={{background: BRAND.sage}}>+</span>
                    <h2 className="font-medium text-sm" style={{color: BRAND.text}}>Add-ons <span className="font-normal text-xs ml-1" style={{color: BRAND.muted}}>(optional)</span></h2>
                  </div>
                </div>
                <div>
                  {addonServices.map(s => {
                    const selected = selectedAddons.find(a => a.id === s.id)
                    return (
                      <button key={s.id}
                        onClick={() => toggleAddon(s)}
                        className="w-full flex items-center justify-between px-6 py-3 text-left transition-colors"
                        style={{borderBottom: `1px solid ${BRAND.border}`, background: selected ? BRAND.sageLight : 'white'}}>
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs"
                            style={{
                              border: `1.5px solid ${selected ? BRAND.sage : BRAND.border}`,
                              background: selected ? BRAND.sage : 'white',
                              color: 'white'
                            }}>
                            {selected ? '✓' : ''}
                          </span>
                          <span className="text-sm" style={{color: BRAND.text}}>{s.name}</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium" style={{color: BRAND.sage}}>+€{s.price}</span>
                          <span className="text-xs ml-2" style={{color: BRAND.muted}}>{s.duration_minutes}min</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 2 — Date */}
            {step >= 2 && (
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
                <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{borderBottom: `1px solid ${BRAND.border}`}}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium" style={{background: BRAND.sage}}>2</span>
                    <h2 className="font-medium text-sm" style={{color: BRAND.text}}>Choose a date</h2>
                  </div>
                  {selectedDate && !isDateBlocked(selectedDate) && (
                    <button onClick={() => { setSelectedDate(''); setSelectedTime(''); setStep(2) }}
                      className="text-xs" style={{color: BRAND.muted}}>Change</button>
                  )}
                </div>
                {selectedDate && !isDateBlocked(selectedDate) && (
                  <div className="px-6 py-3 text-sm font-medium" style={{color: BRAND.sage}}>
                    {new Date(selectedDate).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                )}
                {(step === 2 || !selectedDate) && (
                  <div className="p-6">
                    <CustomCalendar
                      selectedDate={selectedDate}
                      onSelect={(dateStr) => {
                        if (isDateBlocked(dateStr)) return
                        setSelectedDate(dateStr)
                        setSelectedTime('')
                        setStep(3)
                      }}
                      isDateBlocked={isDateBlocked}
                      minDate={getTodayString()}
                    />
                    {selectedDate && isDateBlocked(selectedDate) && (
                      <p className="text-red-400 text-xs mt-3 text-center">This day isn't available — please choose another date.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3 — Time */}
            {step >= 3 && selectedDate && !isDateBlocked(selectedDate) && (
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
                <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{borderBottom: `1px solid ${BRAND.border}`}}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium" style={{background: BRAND.sage}}>3</span>
                    <h2 className="font-medium text-sm" style={{color: BRAND.text}}>Choose a time</h2>
                  </div>
                  {selectedTime && (
                    <button onClick={() => { setSelectedTime(''); setStep(3) }}
                      className="text-xs" style={{color: BRAND.muted}}>Change</button>
                  )}
                </div>
                {selectedTime && (
                  <div className="px-6 py-3 text-sm font-medium" style={{color: BRAND.sage}}>{selectedTime}</div>
                )}
                {(step === 3 || !selectedTime) && (
                  <div className="p-6 grid grid-cols-4 gap-2">
                    {generateTimeSlots(totalDuration).map(slot => {
                      const taken = isSlotTaken(slot.value)
                      return (
                        <button key={slot.value}
                          disabled={taken}
                          onClick={() => { setSelectedTime(slot.value); setStep(4) }}
                          className="py-2.5 rounded-2xl text-xs transition-all"
                          style={{
                            background: taken ? BRAND.border : selectedTime === slot.value ? BRAND.sage : BRAND.sageLight,
                            color: taken ? BRAND.muted : selectedTime === slot.value ? '#fff' : BRAND.text,
                            cursor: taken ? 'not-allowed' : 'pointer'
                          }}>
                          {slot.value}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 4 — Details */}
            {step >= 4 && selectedTime && (
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
                <div className="px-6 pt-5 pb-4" style={{borderBottom: `1px solid ${BRAND.border}`}}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium" style={{background: BRAND.sage}}>4</span>
                    <h2 className="font-medium text-sm" style={{color: BRAND.text}}>Your details</h2>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid gap-3 mb-5">
                    <input placeholder="Your name"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
                      style={{border: `1px solid ${BRAND.border}`, background: BRAND.bg, color: BRAND.text}}
                    />
                    <input placeholder="Phone number"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
                      style={{border: `1px solid ${BRAND.border}`, background: BRAND.bg, color: BRAND.text}}
                    />
                  </div>

                  <div className="rounded-2xl p-4 mb-5" style={{background: BRAND.sageLight}}>
                    <p className="text-xs uppercase tracking-widest mb-3" style={{color: BRAND.sage}}>Summary</p>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span style={{color: BRAND.muted}}>Service</span>
                        <span style={{color: BRAND.text}}>{primaryService.name}</span>
                      </div>
                      {selectedAddons.map(a => (
                        <div key={a.id} className="flex justify-between">
                          <span style={{color: BRAND.muted}}>Add-on</span>
                          <span style={{color: BRAND.text}}>{a.name}</span>
                        </div>
                      ))}
                      <div className="flex justify-between">
                        <span style={{color: BRAND.muted}}>Date</span>
                        <span style={{color: BRAND.text}}>{new Date(selectedDate).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{color: BRAND.muted}}>Time</span>
                        <span style={{color: BRAND.text}}>{selectedTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{color: BRAND.muted}}>Duration</span>
                        <span style={{color: BRAND.text}}>{totalDuration - (primaryService.buffer_minutes || 15)}min</span>
                      </div>
                      <div className="flex justify-between pt-2" style={{borderTop: `1px solid ${BRAND.border}`}}>
                        <span style={{color: BRAND.muted}}>Total</span>
                        <span className="font-semibold" style={{color: BRAND.sage}}>€{totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {slotError && (
                    <p className="text-red-400 text-xs text-center mb-3">{slotError}</p>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!form.name || !form.phone || loading}
                    className="w-full py-4 rounded-2xl text-sm font-medium transition-all"
                    style={{
                      background: !form.name || !form.phone || loading ? BRAND.border : BRAND.sage,
                      color: !form.name || !form.phone || loading ? BRAND.muted : '#fff'
                    }}>
                    {loading ? 'Sending...' : 'Request appointment'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}