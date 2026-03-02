import AutoLaunch from 'auto-launch'

const launch = new AutoLaunch({ name: 'Frame' })

export const enable = launch.enable.bind(launch)
export const disable = launch.disable.bind(launch)
export const status = (cb: (err: Error | null, enabled?: boolean) => void) =>
  launch
    .isEnabled()
    .then((enabled: boolean) => cb(null, enabled))
    .catch(cb)
