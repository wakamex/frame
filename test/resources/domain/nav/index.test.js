import { signerPanelCrumb, accountPanelCrumb } from '../../../../resources/domain/nav'

describe('#signerPanelCrumb', () => {
  it('returns correct breadcrumb shape with signer id', () => {
    const crumb = signerPanelCrumb({ id: 'signer-1' })
    expect(crumb).toStrictEqual({ view: 'expandedSigner', data: { signer: 'signer-1' } })
  })

  it('produces different crumbs for different signer ids', () => {
    const crumb1 = signerPanelCrumb({ id: 'signer-1' })
    const crumb2 = signerPanelCrumb({ id: 'signer-2' })
    expect(crumb1.data.signer).not.toBe(crumb2.data.signer)
    expect(crumb1).not.toStrictEqual(crumb2)
  })
})

describe('#accountPanelCrumb', () => {
  it('returns correct breadcrumb shape', () => {
    const crumb = accountPanelCrumb()
    expect(crumb).toStrictEqual({ view: 'accounts', data: {} })
  })

  it('always returns same structure when called multiple times', () => {
    const crumb1 = accountPanelCrumb()
    const crumb2 = accountPanelCrumb()
    expect(crumb1).toStrictEqual(crumb2)
  })
})
