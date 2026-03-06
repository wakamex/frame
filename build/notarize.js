const fs = require('fs')
const { execFileSync } = require('child_process')
const path = require('path')
const electronNotarize = require('@electron/notarize')

module.exports = async function (params) {
  if (process.platform !== 'darwin') return

  // Skip notarization when signing credentials aren't available
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('Skipping notarization — Apple credentials not configured')
    return
  }

  const appId = 'sh.framed.app'
  const appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`)
  if (!fs.existsSync(appPath)) throw new Error(`Cannot find application at: ${appPath}`)

  console.log(`Notarizing ${appId} found at ${appPath}`)

  try {
    await electronNotarize.notarize({
      tool: 'notarytool',
      appBundleId: appId,
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    })

    // verify signed and notarized application
    execFileSync(
      'spctl',
      ['--assess', '--type', 'execute', '--verbose', '--ignore-cache', '--no-cache', appPath],
      {}
    )

    console.log(`Successfully notarized ${appId}`)
  } catch (error) {
    console.error(error)
    throw error
  }
}
