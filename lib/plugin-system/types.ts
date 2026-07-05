/**
 * Plugin System Types
 * 
 * This file defines the core types for the WINNMATT plugin system.
 * Plugins can extend the application by adding routes, actions,
 * event handlers, UI extensions, and scheduled tasks.
 */

// ─── Plugin Manifest ────────────────────────────────────────────────────────

export interface PluginManifest {
  id: string                    // Unique plugin ID: '@winnmatt/plugin-mpesa'
  name: string                  // Display name: 'M-Pesa Integration'
  description: string           // What this plugin does
  version: string               // Semver: '1.0.0'
  author: string                // Plugin author
  homepage?: string             // Plugin homepage URL
  repository?: string           // Source code URL
  license?: string              // License type
  keywords?: string[]           // Search keywords
  dependencies?: string[]       // Other plugin IDs this depends on
  minAppVersion?: string        // Minimum WINNMATT version required
}

// ─── Plugin Lifecycle ───────────────────────────────────────────────────────

export interface PluginContext {
  pluginId: string
  logger: PluginLogger
  config: PluginConfigStore
  storage: PluginStorage
  events: PluginEventBus
  db: PluginDatabase
}

export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export interface PluginConfigStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  getAll(): Promise<Record<string, string>>
}

export interface PluginStorage {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
}

export interface PluginEventBus {
  on(event: string, handler: EventHandler): void
  off(event: string, handler: EventHandler): void
  emit(event: string, payload: unknown): Promise<void>
}

export interface PluginDatabase {
  query(sql: string, params?: unknown[]): Promise<unknown[]>
  table(name: string): PluginTableQuery
}

export interface PluginTableQuery {
  select(columns?: string[]): this
  where(column: string, value: unknown): this
  insert(data: Record<string, unknown>): Promise<unknown>
  update(data: Record<string, unknown>): Promise<unknown>
  delete(): Promise<unknown>
}

// ─── Plugin Hooks ───────────────────────────────────────────────────────────

export type HookType = 'event' | 'action' | 'route' | 'ui'

export interface EventHandler {
  (payload: unknown, context: PluginContext): Promise<void | unknown>
}

export interface ActionHandler {
  (input: unknown, context: PluginContext): Promise<unknown>
}

export interface RouteHandler {
  (request: Request, context: PluginContext): Promise<Response>
}

export interface UIExtension {
  (context: PluginContext): React.ComponentType
}

// ─── Plugin Definition ──────────────────────────────────────────────────────

export interface Plugin {
  manifest: PluginManifest
  
  // Lifecycle hooks
  install?: (ctx: PluginContext) => Promise<void>
  activate?: (ctx: PluginContext) => Promise<void>
  deactivate?: (ctx: PluginContext) => Promise<void>
  uninstall?: (ctx: PluginContext) => Promise<void>
  
  // Extensions
  routes?: RouteDefinition[]
  actions?: ActionDefinition[]
  eventHandlers?: EventHandlerDefinition[]
  uiExtensions?: UIExtensionDefinition[]
  scheduledTasks?: ScheduledTaskDefinition[]
}

// ─── Route Definitions ──────────────────────────────────────────────────────

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string                   // '/api/plugins/mpesa/webhook'
  handler: RouteHandler
  middleware?: RouteMiddleware[]
}

export interface RouteMiddleware {
  (request: Request, context: PluginContext): Promise<boolean | Response>
}

// ─── Action Definitions ─────────────────────────────────────────────────────

export interface ActionDefinition {
  name: string                   // 'mpesa.processWebhook'
  description?: string
  handler: ActionHandler
  inputSchema?: Record<string, unknown>  // JSON Schema
}

// ─── Event Handler Definitions ──────────────────────────────────────────────

export interface EventHandlerDefinition {
  event: string                  // 'sale.completed', 'customer.created'
  handler: EventHandler
  priority?: number              // Lower = higher priority
}

// ─── UI Extension Definitions ───────────────────────────────────────────────

export type UIExtensionType = 
  | 'dashboard.widget'
  | 'sidebar.item'
  | 'settings.panel'
  | 'pos.button'
  | 'report.tab'

export interface UIExtensionDefinition {
  type: UIExtensionType
  name: string
  component: React.ComponentType
  position?: string              // Where to render: 'sidebar.top', 'dashboard.grid', etc.
  permissions?: string[]         // Required roles to see this extension
}

// ─── Scheduled Task Definitions ─────────────────────────────────────────────

export interface ScheduledTaskDefinition {
  name: string
  cron: string                   // Cron expression
  handler: () => Promise<void>
  description?: string
}

// ─── Plugin Status ──────────────────────────────────────────────────────────

export type PluginStatus = 'active' | 'inactive' | 'error' | 'uninstalled'

export interface InstalledPlugin {
  id: string
  pluginId: string
  name: string
  description: string | null
  version: string
  author: string | null
  status: PluginStatus
  config: Record<string, unknown>
  installedAt: string
  updatedAt: string
  uninstalledAt: string | null
}

// ─── Plugin API ─────────────────────────────────────────────────────────────

export interface PluginAPI {
  // Plugin management
  install(manifest: PluginManifest): Promise<void>
  uninstall(pluginId: string): Promise<void>
  activate(pluginId: string): Promise<void>
  deactivate(pluginId: string): Promise<void>
  
  // Plugin queries
  getPlugin(pluginId: string): Promise<InstalledPlugin | null>
  getAllPlugins(): Promise<InstalledPlugin[]>
  getActivePlugins(): Promise<InstalledPlugin[]>
  
  // Config management
  getConfig(pluginId: string, key: string): Promise<string | null>
  setConfig(pluginId: string, key: string, value: string): Promise<void>
  
  // Event system
  registerEventHandler(pluginId: string, event: string, handler: EventHandler): void
  unregisterEventHandler(pluginId: string, event: string): void
  emitEvent(event: string, payload: unknown): Promise<void>
  
  // Logging
  log(pluginId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: unknown): Promise<void>
  
  // Hooks
  getHooks(pluginId: string, hookType: HookType): Promise<PluginHook[]>
  registerHook(pluginId: string, hookType: HookType, hookKey: string, handlerName: string, priority?: number): Promise<void>
  unregisterHook(pluginId: string, hookType: HookType, hookKey: string): Promise<void>
}

export interface PluginHook {
  id: string
  pluginId: string
  hookType: HookType
  hookKey: string
  handlerName: string
  priority: number
  enabled: boolean
}
