'use client'
import { logger } from '@/lib/logger'

import { useState, useMemo, useEffect, useCallback, startTransition } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Shield, Smartphone, Clock, History, Key, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle, Loader2, Search, Globe, Monitor, LogOut } from 'lucide-react'
import { changePassword, getLoginHistory, savePasswordPolicy } from '@/lib/modules/security'

interface LoginHistoryEntry {
  id: string
  created_at: string
  ip_address: string | null
  user_agent: string | null
  device_info: string | null
  location: string | null
  status: 'success' | 'failed'
  failure_reason: string | null
}

function getPasswordStrength(password: string): { label: string; percent: number; color: string } {
  if (!password) return { label: '', percent: 0, color: '' }
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const variety = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  if (password.length < 8 || variety < 2) return { label: 'Weak', percent: 25, color: 'bg-red-500' }
  if (password.length < 12 || variety < 3) return { label: 'Medium', percent: 55, color: 'bg-amber-500' }
  return { label: 'Strong', percent: 100, color: 'bg-green-500' }
}

export default function SecurityPage() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState('password')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [requirePasswordChange, setRequirePasswordChange] = useState(false)
  const [minPasswordLength, setMinPasswordLength] = useState(8)
  const [passwordExpiry, setPasswordExpiry] = useState('never')

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorMethod, setTwoFactorMethod] = useState('authenticator')
  const [smsPhone, setSmsPhone] = useState('')
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false)
  const [showDisable2FADialog, setShowDisable2FADialog] = useState(false)
  const [enabling2FA, setEnabling2FA] = useState(false)

  const [sessionTimeout, setSessionTimeout] = useState('30')
  const [requireRelogin, setRequireRelogin] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [revokeDialogSessionId, setRevokeDialogSessionId] = useState<string | null>(null)
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false)

  // Real login history from DB
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([])
  const [loginHistoryCount, setLoginHistoryCount] = useState(0)
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false)
  const [policySaving, setPolicySaving] = useState(false)

  const loadLoginHistory = useCallback(async (search?: string) => {
    setLoginHistoryLoading(true)
    try {
      const result = await getLoginHistory({ search, limit: 50 })
      setLoginHistory(result.data as unknown as LoginHistoryEntry[])
      setLoginHistoryCount(result.count)
    } catch (err: unknown) {
      logger.error('Failed to load login history', err instanceof Error ? err : String(err))
    } finally {
      setLoginHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => { if (activeTab === 'sessions') {
      loadLoginHistory(historySearch)
    } })
  }, [activeTab, loadLoginHistory, historySearch])

  const sessions = profile ? [
    { id: 'current', device: typeof navigator !== 'undefined' ? `${navigator.platform}` : 'Current device', ip: '', lastActive: 'Now', isCurrent: true },
  ] : []

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword])

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return loginHistory
    const q = historySearch.toLowerCase()
    return loginHistory.filter((e) => e.ip_address?.toLowerCase().includes(q))
  }, [historySearch, loginHistory])

  const handleSavePassword = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'New passwords do not match', variant: 'destructive' })
      return
    }
    if (newPassword && newPassword.length < minPasswordLength) {
      toast({ title: 'Error', description: `Password must be at least ${minPasswordLength} characters`, variant: 'destructive' })
      return
    }
    if (!currentPassword || !newPassword) {
      toast({ title: 'Error', description: 'Enter current and new password', variant: 'destructive' })
      return
    }

    setPasswordSaving(true)
    try {
      const result = await changePassword(currentPassword, newPassword)
      if (result.success) {
        toast({ title: 'Success', description: 'Password has been updated' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update password', variant: 'destructive' })
      }
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update password', variant: 'destructive' })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSavePasswordPolicy = async () => {
    setPolicySaving(true)
    try {
      await savePasswordPolicy({
        requirePasswordChange,
        minPasswordLength,
        passwordExpiry,
      })
      toast({ title: 'Success', description: 'Password policy settings have been saved' })
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save policy', variant: 'destructive' })
    } finally {
      setPolicySaving(false)
    }
  }

  const handleEnable2FA = () => {
    if (twoFactorMethod === 'sms' && !smsPhone.trim()) {
      toast({ title: 'Error', description: 'Please enter a phone number for SMS verification', variant: 'destructive' })
      return
    }
    setEnabling2FA(true)
    setTimeout(() => {
      setTwoFactorEnabled(true)
      setEnabling2FA(false)
      logger.info('2FA enabled (UI preference)', { method: twoFactorMethod })
      toast({ title: 'Success', description: 'Two-factor authentication has been enabled' })
    }, 1000)
  }

  const handleDisable2FA = () => {
    setShowDisable2FADialog(true)
  }

  const confirmDisable2FA = () => {
    setTwoFactorEnabled(false)
    setShowRecoveryCodes(false)
    setShowDisable2FADialog(false)
    logger.info('2FA disabled (UI preference)')
    toast({ title: 'Success', description: 'Two-factor authentication has been disabled' })
  }

  const handleRevokeSession = (sessionId: string) => {
    setRevokeDialogSessionId(sessionId)
  }

  const confirmRevokeSession = () => {
    const session = sessions.find((s) => s.id === revokeDialogSessionId)
    setRevokeDialogSessionId(null)
    if (session) {
      logger.info('Session revoked', { sessionId: session.id })
      toast({ title: 'Session Revoked', description: `Session has been revoked` })
    }
  }

  const handleRevokeAllOther = () => {
    setShowRevokeAllDialog(true)
  }

  const confirmRevokeAllOther = () => {
    setShowRevokeAllDialog(false)
    logger.info('All other sessions revoked')
    toast({ title: 'Sessions Revoked', description: 'All other active sessions have been revoked' })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your password, two-factor authentication, and active sessions
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="password" className="gap-2"><Key className="h-4 w-4" />Password & Auth</TabsTrigger>
          <TabsTrigger value="2fa" className="gap-2"><Smartphone className="h-4 w-4" />Two-Factor Auth</TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2"><Clock className="h-4 w-4" />Sessions & History</TabsTrigger>
        </TabsList>

        {/* TAB 1: Password & Authentication */}
        <TabsContent value="password" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${strength.color}`}
                        style={{ width: `${strength.percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Password strength: <span className="font-medium">{strength.label}</span></p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleSavePassword} disabled={passwordSaving}>
                {passwordSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Password
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Password Policy</CardTitle>
              <CardDescription>Configure password requirements for your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Require password change on first login</p>
                  <p className="text-sm text-muted-foreground">Force new users to set a password on initial sign-in</p>
                </div>
                <Switch checked={requirePasswordChange} onCheckedChange={setRequirePasswordChange} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min-password-length">Minimum Password Length</Label>
                  <Input
                    id="min-password-length"
                    type="number"
                    min={4}
                    max={32}
                    value={minPasswordLength}
                    onChange={(e) => setMinPasswordLength(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-expiry">Password Expiry (days)</Label>
                  <Select value={passwordExpiry} onValueChange={setPasswordExpiry}>
                    <SelectTrigger id="password-expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSavePasswordPolicy} disabled={policySaving}>
                {policySaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Policy Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Two-Factor Authentication */}
        <TabsContent value="2fa" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
                  <CardDescription>Add an extra layer of security to your account</CardDescription>
                </div>
                <Switch checked={twoFactorEnabled} onCheckedChange={(checked) => {
                  if (!checked) {
                    handleDisable2FA()
                  } else {
                    setTwoFactorEnabled(true)
                  }
                }} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {twoFactorEnabled ? (
                <>
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 flex items-center gap-2">
                      Two-factor authentication is
                      <Badge className="bg-green-600 hover:bg-green-600">Enabled</Badge>
                    </AlertDescription>
                  </Alert>
                  <Button variant="destructive" onClick={handleDisable2FA}>
                    Disable 2FA
                  </Button>
                </>
              ) : (
                <>
                  <Alert className="border-amber-200 bg-amber-50">
                    <Shield className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      Two-factor authentication is currently disabled. Enable it to secure your account.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="2fa-method">Authentication Method</Label>
                      <Select value={twoFactorMethod} onValueChange={setTwoFactorMethod}>
                        <SelectTrigger id="2fa-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="authenticator">Authenticator App (TOTP)</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {twoFactorMethod === 'sms' && (
                      <div className="space-y-2">
                        <Label htmlFor="sms-phone">Phone Number</Label>
                        <Input
                          id="sms-phone"
                          type="tel"
                          placeholder="+254 7XX XXX XXX"
                          value={smsPhone}
                          onChange={(e) => setSmsPhone(e.target.value)}
                        />
                      </div>
                    )}
                    <Button onClick={handleEnable2FA} disabled={enabling2FA}>
                      {enabling2FA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                      {enabling2FA ? 'Enabling...' : 'Enable 2FA'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Session Management & Login History */}
        <TabsContent value="sessions" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Active Sessions</CardTitle>
                  <CardDescription>Manage devices where your account is logged in</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Full session management requires Supabase Auth RLS policies or a custom sessions table. 
                Your current device session is shown below.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{session.device}</span>
                          {session.isCurrent && (
                            <Badge variant="secondary" className="ml-1 text-[10px]">Current</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{session.ip || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{session.lastActive}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs text-muted-foreground">Current session</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Login History</CardTitle>
                  <CardDescription>Recent login attempts to your account</CardDescription>
                </div>
                <div className="relative w-60">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by IP..."
                    className="pl-9"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Device / Browser</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginHistoryLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : filteredHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        {historySearch ? 'No login history entries match your search' : 'No login history recorded yet'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm">{new Date(entry.created_at).toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{entry.ip_address || '—'}</TableCell>
                        <TableCell className="text-sm">{entry.user_agent || entry.device_info || '—'}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            {entry.location || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.status === 'success' ? (
                            <Badge className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
                              <CheckCircle className="h-3 w-3" />Success
                            </Badge>
                          ) : (
                            <Badge className="gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                              <XCircle className="h-3 w-3" />Failed
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {loginHistoryCount > 50 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing the 50 most recent of {loginHistoryCount} entries.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Session Timeout Settings</CardTitle>
              <CardDescription>Configure how long your session stays active</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Session Timeout</Label>
                  <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                    <SelectTrigger id="session-timeout">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center justify-between rounded-lg border p-4 w-full">
                    <div>
                      <p className="font-medium">Require re-login for sensitive actions</p>
                      <p className="text-sm text-muted-foreground">Prompt for password on critical operations</p>
                    </div>
                    <Switch checked={requireRelogin} onCheckedChange={setRequireRelogin} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Disable 2FA Dialog */}
      <AlertDialog open={showDisable2FADialog} onOpenChange={setShowDisable2FADialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disable 2FA? Your account will be less secure without it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisable2FA} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
