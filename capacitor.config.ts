export interface CapacitorConfig {
  appId: string
  appName: string
  webDir: string
  server?: {
    androidScheme?: string
    cleartext?: boolean
    allowNavigation?: string[]
  }
  plugins?: Record<string, any>
}

const config: CapacitorConfig = {
  appId: 'ae.swkproperties.one',
  appName: 'SWK ONE',
  webDir: 'dist/web',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*'],
  },
  plugins: {
    SwkNative: {
      foregroundChannelId: 'swk_one_field_duty_channel',
      foregroundChannelName: 'SWK ONE Active Field Duty Location Sharing',
      strictOffDutyPrivacy: true,
    },
  },
}

export default config
