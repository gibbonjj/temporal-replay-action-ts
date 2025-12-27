import * as fs from 'fs/promises'
import {
  detectPackageManager,
  getInstallCommand,
  getBuildCommand
} from '../../../../src/build/package-manager'

jest.mock('fs/promises')

describe('Package Manager Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('detectPackageManager', () => {
    it('should detect pnpm from pnpm-lock.yaml', async () => {
      const mockAccess = fs.access as jest.Mock
      mockAccess.mockImplementation((path: string) => {
        if (path.endsWith('pnpm-lock.yaml')) {
          return Promise.resolve()
        }
        return Promise.reject(new Error('File not found'))
      })

      const result = await detectPackageManager('/test/dir')

      expect(result).toBe('pnpm')
    })

    it('should detect yarn from yarn.lock', async () => {
      const mockAccess = fs.access as jest.Mock
      mockAccess.mockImplementation((path: string) => {
        if (path.endsWith('yarn.lock')) {
          return Promise.resolve()
        }
        return Promise.reject(new Error('File not found'))
      })

      const result = await detectPackageManager('/test/dir')

      expect(result).toBe('yarn')
    })

    it('should detect bun from bun.lockb', async () => {
      const mockAccess = fs.access as jest.Mock
      mockAccess.mockImplementation((path: string) => {
        if (path.endsWith('bun.lockb')) {
          return Promise.resolve()
        }
        return Promise.reject(new Error('File not found'))
      })

      const result = await detectPackageManager('/test/dir')

      expect(result).toBe('bun')
    })

    it('should detect npm from package-lock.json', async () => {
      const mockAccess = fs.access as jest.Mock
      mockAccess.mockImplementation((path: string) => {
        if (path.endsWith('package-lock.json')) {
          return Promise.resolve()
        }
        return Promise.reject(new Error('File not found'))
      })

      const result = await detectPackageManager('/test/dir')

      expect(result).toBe('npm')
    })

    it('should default to npm when no lock file found', async () => {
      const mockAccess = fs.access as jest.Mock
      mockAccess.mockRejectedValue(new Error('File not found'))

      const result = await detectPackageManager('/test/dir')

      expect(result).toBe('npm')
    })

    it('should prioritize pnpm over other package managers', async () => {
      const mockAccess = fs.access as jest.Mock
      mockAccess.mockImplementation((path: string) => {
        // Both pnpm and npm lock files exist
        if (path.endsWith('pnpm-lock.yaml') || path.endsWith('package-lock.json')) {
          return Promise.resolve()
        }
        return Promise.reject(new Error('File not found'))
      })

      const result = await detectPackageManager('/test/dir')

      expect(result).toBe('pnpm')
    })

    it('should prioritize yarn over npm', async () => {
      const mockAccess = fs.access as jest.Mock
      mockAccess.mockImplementation((path: string) => {
        // Both yarn and npm lock files exist
        if (path.endsWith('yarn.lock') || path.endsWith('package-lock.json')) {
          return Promise.resolve()
        }
        return Promise.reject(new Error('File not found'))
      })

      const result = await detectPackageManager('/test/dir')

      expect(result).toBe('yarn')
    })
  })

  describe('getInstallCommand', () => {
    it('should return npm ci for npm', () => {
      expect(getInstallCommand('npm')).toBe('npm ci')
    })

    it('should return yarn install --frozen-lockfile for yarn', () => {
      expect(getInstallCommand('yarn')).toBe('yarn install --frozen-lockfile')
    })

    it('should return pnpm install --frozen-lockfile for pnpm', () => {
      expect(getInstallCommand('pnpm')).toBe('pnpm install --frozen-lockfile')
    })

    it('should return bun install --frozen-lockfile for bun', () => {
      expect(getInstallCommand('bun')).toBe('bun install --frozen-lockfile')
    })
  })

  describe('getBuildCommand', () => {
    it('should return npm run build for npm', () => {
      expect(getBuildCommand('npm')).toBe('npm run build')
    })

    it('should return yarn build for yarn', () => {
      expect(getBuildCommand('yarn')).toBe('yarn build')
    })

    it('should return pnpm build for pnpm', () => {
      expect(getBuildCommand('pnpm')).toBe('pnpm build')
    })

    it('should return bun run build for bun', () => {
      expect(getBuildCommand('bun')).toBe('bun run build')
    })
  })
})
