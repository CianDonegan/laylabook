import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const WORKING_HOURS = { start: 9, end: 18 }
const BLOCKED_DAYS = [0, 1] // 0 = Sunday, 1 = Monday

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

export default function BookingPage() {
  const [step, setStep] = useState(1)
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [takenSlots, setTakenSlots] = useState([])
  const [form, setForm] = useState({ name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    supabase.from('services').select('*').eq('active', true).order('name')
      .then(({ data }) => setServices(data || []))
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

  const [blockedDates, setBlockedDates] = useState([])

  useEffect(() => {
    supabase.from('blocked_times').select('date').then(({ data }) => {
      setBlockedDates((data || []).map(b => b.date))
    })
  }, [])

  const isDateBlocked = (dateStr) => {
    const day = new Date(dateStr).getDay()
    return BLOCKED_DAYS.includes(day) || blockedDates.includes(dateStr)
  }

  const getTodayString = () => new Date().toISOString().split('T')[0]

  const handleSubmit = async () => {
    setLoading(true)
    const startTime = `${selectedDate}T${selectedTime}:00`
    const endMins = selectedService.duration_minutes
    const [h, m] = selectedTime.split(':').map(Number)
    const endTotal = h * 60 + m + endMins
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

  if (submitted) return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
        <div className="text-4xl mb-4">🌸</div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Request sent!</h2>
        <p className="text-gray-500">Layla will confirm your booking shortly. You'll receive a text message once it's confirmed.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-pink-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center py-8">
          <h1 className="text-3xl font-semibold text-gray-800">Book an appointment</h1>
          <p className="text-gray-400 mt-1">Layla's Beauty</p>
        </div>

        {/* Step 1 — Pick service */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-semibold text-gray-700 mb-4">1. Choose a service</h2>
          <div className="grid gap-2">
            {services.map(s => (
              <button key={s.id}
                onClick={() => { setSelectedService(s); setSelectedTime(''); setStep(2) }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selectedService?.id === s.id
                    ? 'border-pink-400 bg-pink-50 text-pink-700'
                    : 'border-gray-100 hover:border-pink-200'
                }`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-800">{s.name}</span>
                  <span className="text-gray-400 text-sm">€{s.price} · {s.duration_minutes}min</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — Pick date */}
        {step >= 2 && selectedService && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <h2 className="font-semibold text-gray-700 mb-4">2. Choose a date</h2>
            <input type="date"
              min={getTodayString()}
              value={selectedDate}
              onChange={e => {
                if (isDateBlocked(e.target.value)) return
                setSelectedDate(e.target.value)
                setSelectedTime('')
                setStep(3)
              }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pink-400"
            />
            {selectedDate && isDateBlocked(selectedDate) && (
              <p className="text-red-400 text-sm mt-2">This day is not available. Please choose another date.</p>
            )}
          </div>
        )}

        {/* Step 3 — Pick time */}
        {step >= 3 && selectedDate && !isDateBlocked(selectedDate) && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <h2 className="font-semibold text-gray-700 mb-4">3. Choose a time</h2>
            <div className="grid grid-cols-3 gap-2">
              {generateTimeSlots(selectedService.duration_minutes).map(slot => {
                const taken = takenSlots.includes(slot.value)
                return (
                  <button key={slot.value}
                    disabled={taken}
                    onClick={() => { setSelectedTime(slot.value); setStep(4) }}
                    className={`py-2 rounded-xl text-sm border transition-all ${
                      taken ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                      : selectedTime === slot.value ? 'bg-pink-400 text-white border-pink-400'
                      : 'border-gray-200 hover:border-pink-300 text-gray-700'
                    }`}>
                    {slot.label.split(' – ')[0]}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 4 — Details */}
        {step >= 4 && selectedTime && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <h2 className="font-semibold text-gray-700 mb-4">4. Your details</h2>
            <div className="grid gap-3">
              <input placeholder="Your name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pink-400"
              />
              <input placeholder="Phone number"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pink-400"
              />
            </div>

            {/* Summary */}
            <div className="mt-4 bg-pink-50 rounded-xl p-4 text-sm text-gray-600">
              <div className="flex justify-between mb-1">
                <span>Service</span><span className="font-medium">{selectedService.name}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Date</span><span className="font-medium">{selectedDate}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Time</span><span className="font-medium">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Price</span><span className="font-medium">€{selectedService.price}</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!form.name || !form.phone || loading}
              className="w-full mt-4 bg-pink-400 hover:bg-pink-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-4 rounded-xl transition-all">
              {loading ? 'Sending...' : 'Request booking'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}