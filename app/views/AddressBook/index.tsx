import { useState, useMemo } from 'react'
import { useAddressBook } from '../../store'
import { actions } from '../../ipc'
import Modal from '../../components/Modal'

interface ContactForm {
  address: string
  name: string
  notes: string
}

const emptyForm: ContactForm = { address: '', name: '', notes: '' }

export default function AddressBookView() {
  const addressBook = useAddressBook()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ContactForm>(emptyForm)
  const [error, setError] = useState('')

  const contacts = useMemo(() => {
    const entries = Object.entries(addressBook)
    if (!search) return entries
    const q = search.toLowerCase()
    return entries.filter(
      ([, c]) =>
        c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)
    )
  }, [addressBook, search])

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (id: string) => {
    const entry = addressBook[id]
    if (!entry) return
    setEditingId(id)
    setForm({ address: entry.address, name: entry.name, notes: entry.notes })
    setError('')
    setModalOpen(true)
  }

  const handleSave = () => {
    const trimmedName = form.name.trim()
    const trimmedAddress = form.address.trim()

    if (!trimmedName) {
      setError('Name is required')
      return
    }
    if (!trimmedAddress || !trimmedAddress.startsWith('0x') || trimmedAddress.length !== 42) {
      setError('A valid Ethereum address is required (0x...)')
      return
    }

    if (editingId) {
      actions.updateContact(editingId, {
        address: trimmedAddress,
        name: trimmedName,
        notes: form.notes.trim()
      })
    } else {
      actions.addContact({
        address: trimmedAddress,
        name: trimmedName,
        notes: form.notes.trim()
      })
    }
    setModalOpen(false)
  }

  const handleDelete = (id: string) => {
    actions.removeContact(id)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-100">Contacts</h1>
        <button
          onClick={openAdd}
          className="px-3 py-1.5 text-sm rounded hover:bg-gray-800 text-gray-300 border border-gray-700"
        >
          + Add Contact
        </button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or address..."
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600 mb-4"
      />

      {/* Contact list */}
      {contacts.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {search ? 'No contacts match your search.' : 'No contacts yet. Add one to get started.'}
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map(([id, contact]) => (
            <div
              key={id}
              className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-100 truncate">{contact.name}</div>
                <div className="text-xs text-gray-400 font-mono truncate">{contact.address}</div>
                {contact.notes && (
                  <div className="text-xs text-gray-500 mt-1 truncate">{contact.notes}</div>
                )}
              </div>
              <div className="flex gap-2 ml-3 shrink-0">
                <button
                  onClick={() => openEdit(id)}
                  className="px-3 py-1.5 text-sm rounded hover:bg-gray-800 text-gray-400"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(id)}
                  className="px-3 py-1.5 text-sm rounded hover:bg-gray-800 text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Contact' : 'Add Contact'}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contact name"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="0x..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600 font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-600"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={handleSave}
            className="w-full py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-900 hover:bg-white transition-colors"
          >
            {editingId ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
