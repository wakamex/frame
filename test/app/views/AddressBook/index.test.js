/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor } from '../../../componentSetup'
import AddressBookView from '../../../../app/views/AddressBook/index'

const mockAddContact = jest.fn()
const mockUpdateContact = jest.fn()
const mockRemoveContact = jest.fn()

jest.mock('../../../../app/ipc', () => ({
  actions: {
    addContact: (...args) => mockAddContact(...args),
    updateContact: (...args) => mockUpdateContact(...args),
    removeContact: (...args) => mockRemoveContact(...args)
  }
}))

const mockAddressBook = {
  'contact-1': {
    address: '0xd1074e0ae85610ddba0147e29ebe0d8e5873a000',
    name: 'Alice',
    notes: 'Friend'
  },
  'contact-2': {
    address: '0xaabbccddee1122334455667788990011aabbccdd',
    name: 'Bob',
    notes: ''
  }
}

jest.mock('../../../../app/store', () => ({
  useAddressBook: jest.fn()
}))

import { useAddressBook } from '../../../../app/store'

describe('AddressBookView', () => {
  beforeEach(() => {
    mockAddContact.mockReset()
    mockUpdateContact.mockReset()
    mockRemoveContact.mockReset()
    useAddressBook.mockReturnValue(mockAddressBook)
  })

  it('renders list of saved contacts', () => {
    render(<AddressBookView />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('0xd1074e0ae85610ddba0147e29ebe0d8e5873a000')).toBeDefined()
    expect(screen.getByText('Friend')).toBeDefined()
  })

  it('shows empty state when no contacts', () => {
    useAddressBook.mockReturnValue({})
    render(<AddressBookView />)
    expect(screen.getByText('No contacts yet. Add one to get started.')).toBeDefined()
  })

  it('opens add contact modal when Add Contact button is clicked', async () => {
    const { user } = render(<AddressBookView />)
    await user.click(screen.getByText('+ Add Contact'))
    expect(screen.getByText('Add Contact', { selector: 'h2' })).toBeDefined()
    expect(screen.getByPlaceholderText('Contact name')).toBeDefined()
    expect(screen.getByPlaceholderText('0x...')).toBeDefined()
  })

  it('validates required name field before saving', async () => {
    const { user } = render(<AddressBookView />)
    await user.click(screen.getByText('+ Add Contact'))
    // Try to save without name
    await user.click(screen.getByText('Add Contact', { selector: 'button' }))
    expect(screen.getByText('Name is required')).toBeDefined()
    expect(mockAddContact).not.toHaveBeenCalled()
  })

  it('validates address format before saving', async () => {
    const { user } = render(<AddressBookView />)
    await user.click(screen.getByText('+ Add Contact'))
    await user.type(screen.getByPlaceholderText('Contact name'), 'Charlie')
    await user.type(screen.getByPlaceholderText('0x...'), 'not-valid')
    await user.click(screen.getByText('Add Contact', { selector: 'button' }))
    expect(screen.getByText('A valid Ethereum address is required (0x...)')).toBeDefined()
    expect(mockAddContact).not.toHaveBeenCalled()
  })

  it('rejects address that is too short', async () => {
    const { user } = render(<AddressBookView />)
    await user.click(screen.getByText('+ Add Contact'))
    await user.type(screen.getByPlaceholderText('Contact name'), 'Charlie')
    await user.type(screen.getByPlaceholderText('0x...'), '0xshort')
    await user.click(screen.getByText('Add Contact', { selector: 'button' }))
    expect(screen.getByText('A valid Ethereum address is required (0x...)')).toBeDefined()
    expect(mockAddContact).not.toHaveBeenCalled()
  })

  it('saves new contact with valid data', async () => {
    const { user } = render(<AddressBookView />)
    await user.click(screen.getByText('+ Add Contact'))
    await user.type(screen.getByPlaceholderText('Contact name'), 'Charlie')
    await user.type(screen.getByPlaceholderText('0x...'), '0xd1074e0ae85610ddba0147e29ebe0d8e5873a111')
    await user.click(screen.getByText('Add Contact', { selector: 'button' }))
    expect(mockAddContact).toHaveBeenCalledWith({
      address: '0xd1074e0ae85610ddba0147e29ebe0d8e5873a111',
      name: 'Charlie',
      notes: ''
    })
  })

  it('pressing Enter in the add contact form does not trigger Delete buttons outside modal', async () => {
    const { user } = render(<AddressBookView />)
    await user.click(screen.getByText('+ Add Contact'))
    await user.type(screen.getByPlaceholderText('Contact name'), 'Charlie')
    await user.type(screen.getByPlaceholderText('0x...'), '0xd1074e0ae85610ddba0147e29ebe0d8e5873a111')
    // Press Enter — should not trigger delete/remove contact actions
    await user.keyboard('{Enter}')
    expect(mockRemoveContact).not.toHaveBeenCalled()
    // Modal should still be open (Enter didn't close it unexpectedly)
    expect(screen.getByText('Add Contact', { selector: 'h2' })).toBeDefined()
  })

  it('opens edit contact modal with existing data', async () => {
    const { user } = render(<AddressBookView />)
    const editButtons = screen.getAllByText('Edit')
    await user.click(editButtons[0])
    expect(screen.getByText('Edit Contact', { selector: 'h2' })).toBeDefined()
    const nameInput = screen.getByPlaceholderText('Contact name')
    expect(nameInput.value).toBe('Alice')
    const addressInput = screen.getByPlaceholderText('0x...')
    expect(addressInput.value).toBe('0xd1074e0ae85610ddba0147e29ebe0d8e5873a000')
  })

  it('saves edited contact changes', async () => {
    const { user } = render(<AddressBookView />)
    const editButtons = screen.getAllByText('Edit')
    await user.click(editButtons[0])
    const nameInput = screen.getByPlaceholderText('Contact name')
    // Clear and retype
    await user.clear(nameInput)
    await user.type(nameInput, 'Alice Updated')
    await user.click(screen.getByText('Save Changes'))
    expect(mockUpdateContact).toHaveBeenCalledWith(
      'contact-1',
      expect.objectContaining({ name: 'Alice Updated' })
    )
  })

  it('deletes a contact when Delete is clicked', async () => {
    const { user } = render(<AddressBookView />)
    const deleteButtons = screen.getAllByText('Delete')
    await user.click(deleteButtons[0])
    expect(mockRemoveContact).toHaveBeenCalledWith('contact-1')
  })

  it('filters contacts by name search', async () => {
    const { user } = render(<AddressBookView />)
    const searchInput = screen.getByPlaceholderText('Search by name or address...')
    await user.type(searchInput, 'Alice')
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.queryByText('Bob')).toBeNull()
  })

  it('filters contacts by address search', async () => {
    const { user } = render(<AddressBookView />)
    const searchInput = screen.getByPlaceholderText('Search by name or address...')
    await user.type(searchInput, '0xaabb')
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.queryByText('Alice')).toBeNull()
  })

  it('shows no results message when search has no matches', async () => {
    const { user } = render(<AddressBookView />)
    const searchInput = screen.getByPlaceholderText('Search by name or address...')
    await user.type(searchInput, 'zzznomatch')
    expect(screen.getByText('No contacts match your search.')).toBeDefined()
  })

  it('closes modal with Escape key', async () => {
    const { user } = render(<AddressBookView />)
    await user.click(screen.getByText('+ Add Contact'))
    expect(screen.getByText('Add Contact', { selector: 'h2' })).toBeDefined()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Add Contact', { selector: 'h2' })).toBeNull()
  })
})
