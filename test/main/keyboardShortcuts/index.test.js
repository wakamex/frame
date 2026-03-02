import { globalShortcut } from 'electron'

jest.mock('electron', () => ({
  app: { on: jest.fn(), getName: jest.fn(), getVersion: jest.fn(), getPath: jest.fn() },
  globalShortcut: { register: jest.fn(), unregister: jest.fn() }
}))

let registerShortcut

describe('registerShortcut', () => {
  const shortcut = {
    shortcutKey: 'Slash',
    modifierKeys: ['Alt'],
    enabled: true,
    configuring: false
  }

  beforeEach(async () => {
    const keyboardShortcuts = await import('../../../main/keyboardShortcuts')
    registerShortcut = keyboardShortcuts.registerShortcut
  })

  it('should unregister an existing shortcut', () => {
    registerShortcut(shortcut, () => {})

    expect(globalShortcut.unregister).toHaveBeenCalledWith('Alt+/')
    expect(globalShortcut.unregister).toHaveBeenCalledTimes(1)
  })

  it('should register the new shortcut', () => {
    globalShortcut.register.mockImplementationOnce((accelerator, handlerFn) => handlerFn(accelerator))

    return new Promise((resolve) => {
      const handlerFn = (accelerator) => {
        expect(accelerator).toBe('Alt+/')
        resolve()
      }
      registerShortcut(shortcut, handlerFn)

      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+/', expect.any(Function))
      expect(globalShortcut.register).toHaveBeenCalledTimes(1)
    })
  })

  describe('disabled or configuring shortcuts', () => {
    it('should not register when enabled is false', () => {
      registerShortcut({ ...shortcut, enabled: false }, () => {})

      expect(globalShortcut.unregister).toHaveBeenCalledWith('Alt+/')
      expect(globalShortcut.register).not.toHaveBeenCalled()
    })

    it('should not register when configuring is true', () => {
      registerShortcut({ ...shortcut, configuring: true }, () => {})

      expect(globalShortcut.unregister).toHaveBeenCalledWith('Alt+/')
      expect(globalShortcut.register).not.toHaveBeenCalled()
    })
  })

  describe('registration order and re-registration', () => {
    it('should always unregister before registering', () => {
      const callOrder = []
      globalShortcut.unregister.mockImplementationOnce(() => {
        callOrder.push('unregister')
      })
      globalShortcut.register.mockImplementationOnce(() => {
        callOrder.push('register')
      })

      registerShortcut(shortcut, () => {})

      expect(callOrder).toEqual(['unregister', 'register'])
    })

    it('should unregister on each call when re-registering the same shortcut', () => {
      registerShortcut(shortcut, () => {})
      registerShortcut(shortcut, () => {})

      expect(globalShortcut.unregister).toHaveBeenCalledTimes(2)
      expect(globalShortcut.unregister).toHaveBeenCalledWith('Alt+/')
    })
  })

  describe('registration failure', () => {
    it('should handle globalShortcut.register returning false without throwing', () => {
      globalShortcut.register.mockReturnValueOnce(false)

      expect(() => registerShortcut(shortcut, () => {})).not.toThrow()
      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+/', expect.any(Function))
    })
  })

  describe('key mapping', () => {
    it('should map Space shortcutKey to Space accelerator', () => {
      registerShortcut({ ...shortcut, shortcutKey: 'Space' }, () => {})

      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+Space', expect.any(Function))
    })

    it('should map letter key (KeyA) to lowercase letter in accelerator', () => {
      registerShortcut({ ...shortcut, shortcutKey: 'KeyA' }, () => {})

      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+a', expect.any(Function))
    })

    it('should map number key (Digit1) to digit character in accelerator', () => {
      registerShortcut({ ...shortcut, shortcutKey: 'Digit1' }, () => {})

      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+1', expect.any(Function))
    })

    it('should map Comma shortcutKey to comma character in accelerator', () => {
      registerShortcut({ ...shortcut, shortcutKey: 'Comma' }, () => {})

      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+,', expect.any(Function))
    })

    it('should map Slash shortcutKey to forward slash in accelerator', () => {
      registerShortcut(shortcut, () => {})

      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+/', expect.any(Function))
    })
  })

  describe('modifier key handling', () => {
    it('should work with no modifier keys, producing accelerator with just the key', () => {
      registerShortcut({ ...shortcut, modifierKeys: [], shortcutKey: 'Space' }, () => {})

      expect(globalShortcut.unregister).toHaveBeenCalledWith('Space')
      expect(globalShortcut.register).toHaveBeenCalledWith('Space', expect.any(Function))
    })

    it('should sort multiple modifier keys alphabetically in accelerator', () => {
      registerShortcut(
        { shortcutKey: 'Space', modifierKeys: ['Control', 'Alt'], enabled: true, configuring: false },
        () => {}
      )

      // Alt comes before Control alphabetically
      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+Control+Space', expect.any(Function))
    })

    it('should include all modifier keys in the accelerator', () => {
      registerShortcut(
        { shortcutKey: 'KeyA', modifierKeys: ['Alt', 'Control'], enabled: true, configuring: false },
        () => {}
      )

      expect(globalShortcut.register).toHaveBeenCalledWith('Alt+Control+a', expect.any(Function))
    })
  })
})
