/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '../../../componentSetup'
import Dropdown from '../../../../resources/Components/Dropdown'

const options = [
  { value: 'a', text: 'Alpha' },
  { value: 'b', text: 'Beta' },
  { value: 'c', text: 'Gamma' }
]

function getDropdownEl() {
  return screen.getByRole('listbox').parentElement
}

it('renders with initial selected value displayed', () => {
  render(<Dropdown options={options} syncValue='b' onChange={jest.fn()} />)

  const selected = screen.getByRole('option', { selected: true })
  expect(selected.textContent).toContain('Beta')
})

it('clicking opens the dropdown', async () => {
  const { user } = render(<Dropdown options={options} syncValue='a' onChange={jest.fn()} />)

  const dropdown = getDropdownEl()
  expect(dropdown.classList.contains('dropdownExpanded')).toBe(false)

  await user.click(dropdown)

  expect(dropdown.classList.contains('dropdownExpanded')).toBe(true)
})

it('clicking again closes the dropdown', async () => {
  const { user } = render(<Dropdown options={options} syncValue='a' onChange={jest.fn()} />)

  const dropdown = getDropdownEl()
  await user.click(dropdown)
  expect(dropdown.classList.contains('dropdownExpanded')).toBe(true)

  await user.click(dropdown)
  expect(dropdown.classList.contains('dropdownExpanded')).toBe(false)
})

it('shows all options', () => {
  render(<Dropdown options={options} syncValue='a' onChange={jest.fn()} />)

  const items = screen.getAllByRole('option')
  expect(items).toHaveLength(3)
})

it('selecting an option calls onChange with correct value', async () => {
  const onChange = jest.fn()
  const { user } = render(<Dropdown options={options} syncValue='a' onChange={onChange} />)

  const dropdown = getDropdownEl()
  await user.click(dropdown)

  const betaOption = screen.getAllByRole('option')[1]
  await user.click(betaOption)

  expect(onChange).toHaveBeenCalledWith('b')
})

it('selecting an option closes the dropdown', async () => {
  const { user } = render(<Dropdown options={options} syncValue='a' onChange={jest.fn()} />)

  const dropdown = getDropdownEl()
  await user.click(dropdown)
  expect(dropdown.classList.contains('dropdownExpanded')).toBe(true)

  const betaOption = screen.getAllByRole('option')[1]
  await user.click(betaOption)

  expect(dropdown.classList.contains('dropdownExpanded')).toBe(false)
})

it('does not call onChange when selecting already-selected option', async () => {
  const onChange = jest.fn()
  const { user } = render(<Dropdown options={options} syncValue='a' onChange={onChange} />)

  const dropdown = getDropdownEl()
  await user.click(dropdown)

  const alphaOption = screen.getAllByRole('option')[0]
  await user.click(alphaOption)

  expect(onChange).not.toHaveBeenCalled()
})

it('click outside closes the dropdown', async () => {
  const { user } = render(
    <div>
      <Dropdown options={options} syncValue='a' onChange={jest.fn()} />
      <button>Outside</button>
    </div>
  )

  const dropdown = getDropdownEl()
  await user.click(dropdown)
  expect(dropdown.classList.contains('dropdownExpanded')).toBe(true)

  await user.click(screen.getByRole('button', { name: 'Outside' }))

  expect(dropdown.classList.contains('dropdownExpanded')).toBe(false)
})

it('renders indicator when option has an indicator value', () => {
  const optionsWithIndicator = [
    { value: 'a', text: 'Alpha', indicator: 'good' },
    { value: 'b', text: 'Beta', indicator: 'bad' }
  ]
  render(<Dropdown options={optionsWithIndicator} syncValue='a' onChange={jest.fn()} />)

  const goodIndicator = document.querySelector('.dropdownItemIndicatorGood')
  expect(goodIndicator).not.toBeNull()

  const badIndicator = document.querySelector('.dropdownItemIndicatorBad')
  expect(badIndicator).not.toBeNull()
})
