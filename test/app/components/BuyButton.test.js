/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '../../componentSetup'
import BuyButton from '../../../app/components/BuyButton'

const mockOpenExternal = jest.fn()

jest.mock('../../../app/ipc', () => ({
  actions: {
    openExternal: (...args) => mockOpenExternal(...args)
  }
}))

const TEST_ADDRESS = '0xd1074e0ae85610ddba0147e29ebe0d8e5873a000'

beforeEach(() => {
  mockOpenExternal.mockReset()
})

describe('BuyButton', () => {
  it('renders Buy button', () => {
    render(<BuyButton address={TEST_ADDRESS} />)
    expect(screen.getByText('Buy')).toBeDefined()
  })

  it('clicking Buy opens dropdown with 3 provider options', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} />)
    await user.click(screen.getByText('Buy'))
    expect(screen.getByText('Ramp Network')).toBeDefined()
    expect(screen.getByText('MoonPay')).toBeDefined()
    expect(screen.getByText('Transak')).toBeDefined()
  })

  it('clicking Buy again toggles dropdown closed', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} />)
    await user.click(screen.getByText('Buy'))
    expect(screen.getByText('Ramp Network')).toBeDefined()
    await user.click(screen.getByText('Buy'))
    expect(screen.queryByText('Ramp Network')).toBeNull()
  })

  it('selecting Ramp Network calls openExternal with correct URL', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} />)
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('Ramp Network'))
    expect(mockOpenExternal).toHaveBeenCalledWith(
      `https://app.ramp.network/?userAddress=${TEST_ADDRESS}&hostAppName=Frame`
    )
  })

  it('selecting MoonPay calls openExternal with correct URL', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} />)
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('MoonPay'))
    expect(mockOpenExternal).toHaveBeenCalledWith(
      `https://buy.moonpay.com/?currencyCode=eth&walletAddress=${TEST_ADDRESS}&baseCurrencyCode=usd`
    )
  })

  it('selecting Transak calls openExternal with correct URL', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} />)
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('Transak'))
    expect(mockOpenExternal).toHaveBeenCalledWith(
      `https://global.transak.com/?cryptoCurrencyCode=ETH&walletAddress=${TEST_ADDRESS}&disableWalletAddressForm=true`
    )
  })

  it('Ramp URL includes chain-specific asset for Polygon (chainId=137)', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} chainId={137} />)
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('Ramp Network'))
    expect(mockOpenExternal).toHaveBeenCalledWith(
      `https://app.ramp.network/?userAddress=${TEST_ADDRESS}&hostAppName=Frame&defaultAsset=MATIC_MATIC`
    )
  })

  it('Ramp URL includes chain-specific asset for Base (chainId=8453)', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} chainId={8453} />)
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('Ramp Network'))
    expect(mockOpenExternal).toHaveBeenCalledWith(
      `https://app.ramp.network/?userAddress=${TEST_ADDRESS}&hostAppName=Frame&defaultAsset=BASE_ETH`
    )
  })

  it('Ramp URL has no defaultAsset for Ethereum mainnet (chainId=1)', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} chainId={1} />)
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('Ramp Network'))
    const url = mockOpenExternal.mock.calls[0][0]
    expect(url).not.toContain('defaultAsset')
    expect(url).toBe(
      `https://app.ramp.network/?userAddress=${TEST_ADDRESS}&hostAppName=Frame`
    )
  })

  it('Transak URL includes network for Optimism (chainId=10)', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} chainId={10} />)
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('Transak'))
    expect(mockOpenExternal).toHaveBeenCalledWith(
      `https://global.transak.com/?cryptoCurrencyCode=ETH&walletAddress=${TEST_ADDRESS}&disableWalletAddressForm=true&network=optimism`
    )
  })

  it('Transak URL has no network param for Ethereum mainnet', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} chainId={1} />)
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('Transak'))
    const url = mockOpenExternal.mock.calls[0][0]
    expect(url).not.toContain('network=')
    expect(url).toBe(
      `https://global.transak.com/?cryptoCurrencyCode=ETH&walletAddress=${TEST_ADDRESS}&disableWalletAddressForm=true`
    )
  })

  it('MoonPay URL does not change based on chainId', async () => {
    const { user: user1 } = render(<BuyButton address={TEST_ADDRESS} chainId={137} />)
    await user1.click(screen.getByText('Buy'))
    await user1.click(screen.getByText('MoonPay'))
    const urlWithChain = mockOpenExternal.mock.calls[0][0]

    mockOpenExternal.mockReset()

    const { user: user2 } = render(<BuyButton address={TEST_ADDRESS} />)
    const buyButtons = screen.getAllByText('Buy')
    await user2.click(buyButtons[buyButtons.length - 1])
    const moonPayButtons = screen.getAllByText('MoonPay')
    await user2.click(moonPayButtons[moonPayButtons.length - 1])
    const urlWithoutChain = mockOpenExternal.mock.calls[0][0]

    expect(urlWithChain).toBe(urlWithoutChain)
  })

  it('click outside dropdown closes it', async () => {
    const { user } = render(
      <div>
        <div data-testid="outside">Outside</div>
        <BuyButton address={TEST_ADDRESS} />
      </div>
    )
    await user.click(screen.getByText('Buy'))
    expect(screen.getByText('Ramp Network')).toBeDefined()

    await act(async () => {
      const event = new MouseEvent('mousedown', { bubbles: true })
      screen.getByTestId('outside').dispatchEvent(event)
    })

    expect(screen.queryByText('Ramp Network')).toBeNull()
  })

  it('selecting provider closes dropdown', async () => {
    const { user } = render(<BuyButton address={TEST_ADDRESS} />)
    await user.click(screen.getByText('Buy'))
    expect(screen.getByText('Ramp Network')).toBeDefined()
    await user.click(screen.getByText('Ramp Network'))
    expect(screen.queryByText('Ramp Network')).toBeNull()
  })

  it('address is included in all provider URLs', async () => {
    const address = '0xabcdef1234567890abcdef1234567890abcdef12'
    const { user } = render(<BuyButton address={address} />)

    // Check Ramp
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('Ramp Network'))
    expect(mockOpenExternal.mock.calls[0][0]).toContain(address)
    mockOpenExternal.mockReset()

    // Check MoonPay
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('MoonPay'))
    expect(mockOpenExternal.mock.calls[0][0]).toContain(address)
    mockOpenExternal.mockReset()

    // Check Transak
    await user.click(screen.getByText('Buy'))
    await user.click(screen.getByText('Transak'))
    expect(mockOpenExternal.mock.calls[0][0]).toContain(address)
  })
})
