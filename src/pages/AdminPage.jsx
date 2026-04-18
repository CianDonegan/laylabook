import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
}

function formatTime(datetimeStr) {
  return new Date(datetimeStr).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(datetimeStr) {
  return new Date(datetimeStr).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function PinScreen({ onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handlePin = () => {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('admin_authed', 'true')
      onSuccess()
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-sm text-center">
        <div className="text-3xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Admin access</h2>
        <input
          type="password"
          placeholder="Enter PIN"
          value={pin}
          onChange={e => { setPin(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && handlePin()}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:border-pink-400 mb-3"
        />
        {error && <p className="text-red-400 text-sm mb-3">Incorrect PIN</p>}
        <button
          onClick={handlePin}
          className="w-full bg-pink-400 hover:bg-pink-500 text-white font-semibold py-3 rounded-xl transition-all">
          Enter
        </button>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_authed') === 'true')
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)

  const fetchBookings = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, services(name, duration_minutes, price)')
      .eq('status', filter)
      .order('start_time', { ascending: true })
    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchBookings() }, [filter])

  const sendSMS = async (phone, message) => {
    await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message })
    })
  }

  const updateStatus = async (id, status) => {
    const booking = bookings.find(b => b.id === id)
    await supabase.from('bookings').update({ status }).eq('id', id)

    if (status === 'confirmed') {
      const date = formatDate(booking.start_time)
      const time = formatTime(booking.start_time)
      await sendSMS(
        booking.client_phone,
        `Hi ${booking.client_name}! Your appointment for ${booking.services?.name} on ${date} at ${time} is confirmed. See you then! 💅`
      )
    }

    if (status === 'cancelled') {
      await sendSMS(
        booking.client_phone,
        `Hi ${booking.client_name}, unfortunately we can't accommodate your booking for ${booking.services?.name}. Please contact us to rebook.`
      )
    }

    fetchBookings()
  }

  if (!authed) return <PinScreen onSuccess={() => setAuthed(true)} />

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-8">
          <h1 className="text-2xl font-semibold text-gray-800">Layla's Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your bookings</p>
        </div>

        <div className="flex gap-2 mb-6">
          {['pending', 'confirmed', 'cancelled'].map(s => (
            <button key={s}
              onClick={() => setFilter(s)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                filter === s ? 'bg-pink-400 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}>
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No {filter} bookings</div>
        ) : (
          <div className="grid gap-3">
            {bookings.map(b => (
              <div key={b.id} className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{b.client_name}</h3>
                    <p className="text-gray-400 text-sm">{b.client_phone}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[b.status]}`}>
                    {b.status}
                  </span>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 mb-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Service</span>
                    <span className="font-medium text-gray-800">{b.services?.name}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Date</span>
                    <span className="font-medium text-gray-800">{formatDate(b.start_time)}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Time</span>
                    <span className="font-medium text-gray-800">{formatTime(b.start_time)} – {formatTime(b.end_time)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Price</span>
                    <span className="font-medium text-gray-800">€{b.services?.price}</span>
                  </div>
                </div>

                {b.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(b.id, 'confirmed')}
                      className="flex-1 bg-green-400 hover:bg-green-500 text-white py-2 rounded-xl text-sm font-medium transition-all">
                      Confirm
                    </button>
                    <button onClick={() => updateStatus(b.id, 'cancelled')}
                      className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 py-2 rounded-xl text-sm font-medium transition-all">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}