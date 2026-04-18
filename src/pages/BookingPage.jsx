import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const WORKING_HOURS = { start: 9, end: 18 }
const BLOCKED_DAYS = [0, 1]

const   BRAND = {
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

export default function BookingPage() {
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [step, setStep] = useState(1)
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [takenSlots, setTakenSlots] = useState([])
  const [blockedDates, setBlockedDates] = useState([])
  const [form, setForm] = useState({ name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [openCategory, setOpenCategory] = useState(null)

  useEffect(() => {
    supabase.from('services').select('*').eq('active', true).order('name')
      .then(({ data }) => setServices(data || []))
    supabase.from('blocked_times').select('date').then(({ data }) => {
      setBlockedDates((data || []).map(b => b.date))
    })
  }, [])

  useEffect(() => {
    if (!selectedDate || !selectedService) return
    supabase.from('bookings')
      .select('start_time')
      .eq('status', 'confirmed')
      .gte('start_time', `${selectedDate}T00:00:00`)
      .lte('start_time', `${selectedDate}T23:59:59`)
      .then(({ data }) => {
        setTakenSlots((data || []).map(b => b.start_time.slice(11, 16)))
      })
  }, [selectedDate, selectedService])

  const isDateBlocked = (dateStr) => {
    const day = new Date(dateStr).getDay()
    return BLOCKED_DAYS.includes(day) || blockedDates.includes(dateStr)
  }

  const getTodayString = () => new Date().toISOString().split('T')[0]

  const handleSubmit = async () => {
    setLoading(true)
    const startTime = `${selectedDate}T${selectedTime}:00`
    const [h, m] = selectedTime.split(':').map(Number)
    const endTotal = h * 60 + m + selectedService.duration_minutes
    const endTime = `${selectedDate}T${Math.floor(endTotal/60).toString().padStart(2,'0')}:${(endTotal%60).toString().padStart(2,'0')}:00`

    const { error } = await supabase.from('bookings').insert({
      client_name: form.name,
      client_phone: form.phone,
      service_id: selectedService.id,
      start_time: startTime,
      end_time: endTime,
      status: 'pending'
    })

    setLoading(false)
    if (!error) setSubmitted(true)
  }

  const categorised = categorise(services)

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
      <div className="max-w-lg mx-auto px-4 pb-12">

        {/* Hero */}
        <div className="text-center pt-10 pb-8">
          <img src="/laylalogo.jpg" alt="Beauty by Layla" className="w-44 mx-auto mb-4" />
        </div>

        {/* Policy modal */}
        {!policyAccepted && (
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-6">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-base font-medium mb-4" style={{color: BRAND.text}}>Booking Policy</h2>
              <div className="space-y-3 text-sm mb-5" style={{color: BRAND.muted}}>
                {[
                  ['Payment', 'Cash only. Please bring exact change.'],
                  ['Cancellations', '24 hours notice required for all cancellations.'],
                  ['Punctuality', 'Late arrivals over 10 mins may result in a shortened service or rescheduling.'],
                  ['No-Shows', 'Clients who do not attend without notice will be unable to book future appointments.'],
                  ['Patch Testing', 'Required for waxing and tinting services — please schedule in advance.'],
                  ['Location', 'Clondalkin, D22. Text when you arrive and I\'ll come to bring you in.'],
                ].map(([title, text]) => (
                  <div key={title} className="flex gap-3">
                    <span className="font-medium shrink-0" style={{color: BRAND.text}}>{title}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setPolicyAccepted(true)}
                className="w-full py-3.5 rounded-2xl text-sm font-medium transition-all"
                style={{background: BRAND.sage, color: '#fff'}}>
                I understand — continue to booking
              </button>
            </div>
          </div>
        )}

        {/* Booking steps */}
        {policyAccepted && (
          <>
            {/* Step 1 — Service */}
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
              <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{borderBottom: `1px solid ${BRAND.border}`}}>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium" style={{background: BRAND.sage}}>1</span>
                  <h2 className="font-medium text-sm" style={{color: BRAND.text}}>Choose a service</h2>
                </div>
                {selectedService && (
                  <button onClick={() => { setSelectedService(null); setSelectedDate(''); setSelectedTime(''); setStep(1) }}
                    className="text-xs" style={{color: BRAND.muted}}>Change</button>
                )}
              </div>
              {selectedService && (
                <div className="px-6 py-3 text-sm font-medium" style={{color: BRAND.sage}}>{selectedService.name} — €{selectedService.price}</div>
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
                              onClick={() => { setSelectedService(s); setSelectedTime(''); setStep(2); setOpenCategory(null) }}
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
                    <input type="date"
                      min={getTodayString()}
                      value={selectedDate}
                      onChange={e => {
                        if (isDateBlocked(e.target.value)) return
                        setSelectedDate(e.target.value)
                        setSelectedTime('')
                        setStep(3)
                      }}
                      className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
                      style={{border: `1px solid ${BRAND.border}`, background: BRAND.bg, color: BRAND.text}}
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
                    {generateTimeSlots(selectedService.duration_minutes).map(slot => {
                      const taken = takenSlots.includes(slot.value)
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
                      {[
                        ['Service', selectedService.name],
                        ['Date', new Date(selectedDate).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })],
                        ['Time', selectedTime],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span style={{color: BRAND.muted}}>{label}</span>
                          <span style={{color: BRAND.text}}>{value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-2" style={{borderTop: `1px solid ${BRAND.border}`}}>
                        <span style={{color: BRAND.muted}}>Total</span>
                        <span className="font-semibold" style={{color: BRAND.sage}}>€{selectedService.price}</span>
                      </div>
                    </div>
                  </div>

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