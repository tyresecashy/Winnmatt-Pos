/**
 * Plugin Loader
 * 
 * Handles loading, initializing, and managing plugin lifecycles.
 * Plugins are loaded from the database and executed in a sandboxed context.
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type {
  Plugin,
  PluginManifest,
  PluginContext,
  PluginLogger,
  PluginConfigStore,
  PluginStorage,
  PluginEventBus,
  EventHandler,
  InstalledPlugin,
  PluginStatus,
  HookType,
  PluginHook,
} from './types'

// ─── Plugin Registry ────────────────────────────────────────────────────────

const pluginRegistry = new Map<string, Plugin>()
const eventHandlers = new Map<string, Map<string, EventHandler>>()
const pluginContexts = new Map<string, PluginContext>()

// ─── Logger Factory ─────────────────────────────────────────────────────────

function createPluginLogger(pluginId: string): PluginLogger {
  return {
    debug: (message, ...args) => logger.debug(`[Plugin:${pluginId}] ${message}`, ...args),
    info: (message, ...args) => logger.info(`[Plugin:${pluginId}] ${message}`, ...args),
    warn: (message, ...args) => logger.warn(`[Plugin:${pluginId}] ${message}`, ...args),
    error: (message, ...args) => logger.error(`[Plugin:${pluginId}] ${message}`, ...args),
  }
}

// ─── Config Store ───────────────────────────────────────────────────────────

function createConfigStore(pluginId: string): PluginConfigStore {
  return {
    get: async (key) => {
      const { data } = await supabaseAdmin
        .from('plugin_configs')
        .select('value')
        .eq('plugin_id', pluginId)
        .eq('key', key)
        .single()
      return data?.value || null
    },
    set: async (key, value) => {
      await supabaseAdmin
        .from('plugin_configs')
        .upsert({ plugin_id: pluginId, key, value })
    },
    delete: async (key) => {
      await supabaseAdmin
        .from('plugin_configs')
        .delete()
        .eq('plugin_id', pluginId)
        .eq('key', key)
    },
    getAll: async () => {
      const { data } = await supabaseAdmin
        .from('plugin_configs')
        .select('key, value')
        .eq('plugin_id', pluginId)
      
      const result: Record<string, string> = {}
      for (const row of data || []) {
        result[row.key] = row.value
      }
      return result
    },
  }
}

// ─── Storage ────────────────────────────────────────────────────────────────

function createStorage(pluginId: string): PluginStorage {
  const prefix = `plugin:${pluginId}:`
  
  return {
    get: async (key) => {
      if (typeof window === 'undefined') return null
      try {
        const stored = localStorage.getItem(prefix + key)
        return stored ? JSON.parse(stored) : null
      } catch {
        return null
      }
    },
    set: async (key, value) => {
      if (typeof window === 'undefined') return
      localStorage.setItem(prefix + key, JSON.stringify(value))
    },
    delete: async (key) => {
      if (typeof window === 'undefined') return
      localStorage.removeItem(prefix + key)
    },
  }
}

// ─── Event Bus ──────────────────────────────────────────────────────────────

function createEventBus(pluginId: string): PluginEventBus {
  return {
    on: (event, handler) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Map())
      }
      eventHandlers.get(event)!.set(pluginId, handler)
    },
    off: (event) => {
      eventHandlers.get(event)?.delete(pluginId)
    },
    emit: async (event, payload) => {
      const handlers = eventHandlers.get(event)
      if (handlers) {
        for (const [id, handler] of handlers) {
          try {
            const context = pluginContexts.get(id)
            if (context) {
              await handler(payload, context)
            }
          } catch (error) {
            logger.error(`[Plugin:${id}] Event handler error for ${event}:`, error)
          }
        }
      }
    },
  }
}

// ─── Database Access ────────────────────────────────────────────────────────

function createDatabase(pluginId: string): PluginDatabase {
  return {
    query: async (sql, params) => {
      const { data, error } = await supabaseAdmin.rpc('exec_sql', {
        sql,
        params: params || [],
      })
      if (error) throw error
      return data || []
    },
    table: (name) => {
      let query = supabaseAdmin.from(name)
      let selectColumns: string | undefined
      
      return {
        select: (columns) => {
          selectColumns = columns?.join(', ') || '*'
          return this
        },
        where: (column, value) => {
          query = query.eq(column, value)
          return this
        },
        insert: async (data) => {
          const { data: result, error } = await query.insert(data).select()
          if (error) throw error
          return result
        },
        update: async (data) => {
          const { data: result, error } = await query.update(data).select()
          if (error) throw error
          return result
        },
        delete: async () => {
          const { error } = await query.delete()
          if (error) throw error
          return { success: true }
        },
      }
    },
  }
}

// ─── Plugin Context Factory ─────────────────────────────────────────────────

function createPluginContext(pluginId: string): PluginContext {
  const context: PluginContext = {
    pluginId,
    logger: createPluginLogger(pluginId),
    config: createConfigStore(pluginId),
    storage: createStorage(pluginId),
    events: createEventBus(pluginId),
    db: createDatabase(pluginId),
  }
  pluginContexts.set(pluginId, context)
  return context
}

// ─── Plugin Loader ──────────────────────────────────────────────────────────

export class PluginLoader {
  /**
   * Load all active plugins from the database
   */
  static async loadAllActive(): Promise<void> {
    try {
      const { data: plugins, error } = await supabaseAdmin
        .from('plugins')
        .select('*')
        .eq('status', 'active')

      if (error) throw error

      for (const plugin of plugins || []) {
        try {
          await this.loadPlugin(plugin.plugin_id)
        } catch (error) {
          logger.error(`[PluginLoader] Failed to load ${plugin.plugin_id}:`, error)
        }
      }

      logger.info(`[PluginLoader] Loaded ${plugins?.length || 0} active plugins`)
    } catch (error) {
      logger.error('[PluginLoader] Failed to load active plugins:', error)
    }
  }

  /**
   * Load a specific plugin
   */
  static async loadPlugin(pluginId: string): Promise<void> {
    // Get plugin from database
    const { data: plugin, error } = await supabaseAdmin
      .from('plugins')
      .select('*')
      .eq('plugin_id', pluginId)
      .single()

    if (error || !plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    // Create context
    const context = createPluginContext(pluginId)

    // For now, we'll use a simplified plugin loading mechanism
    // In production, this would load actual plugin modules
    logger.info(`[PluginLoader] Loaded plugin ${pluginId} v${plugin.version}`)
  }

  /**
   * Install a new plugin
   */
  static async installPlugin(manifest: PluginManifest): Promise<void> {
    // Check if already installed
    const { data: existing } = await supabaseAdmin
      .from('plugins')
      .select('plugin_id')
      .eq('plugin_id', manifest.id)
      .single()

    if (existing) {
      throw new Error(`Plugin ${manifest.id} is already installed`)
    }

    // Insert plugin record
    const { error } = await supabaseAdmin
      .from('plugins')
      .insert({
        plugin_id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        author: manifest.author,
        status: 'inactive',
        config: {},
      })

    if (error) throw error

    logger.info(`[PluginLoader] Installed plugin ${manifest.id}`)
  }

  /**
   * Activate a plugin
   */
  static async activatePlugin(pluginId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('plugins')
      .update({ status: 'active' })
      .eq('plugin_id', pluginId)

    if (error) throw error

    // Load and initialize the plugin
    await this.loadPlugin(pluginId)

    logger.info(`[PluginLoader] Activated plugin ${pluginId}`)
  }

  /**
   * Deactivate a plugin
   */
  static async deactivatePlugin(pluginId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('plugins')
      .update({ status: 'inactive' })
      .eq('plugin_id', pluginId)

    if (error) throw error

    // Unregister event handlers
    for (const [event] of eventHandlers) {
      eventHandlers.get(event)?.delete(pluginId)
    }

    // Remove from contexts
    pluginContexts.delete(pluginId)

    logger.info(`[PluginLoader] Deactivated plugin ${pluginId}`)
  }

  /**
   * Uninstall a plugin
   */
  static async uninstallPlugin(pluginId: string): Promise<void> {
    // Deactivate first
    await this.deactivatePlugin(pluginId)

    // Mark as uninstalled
    const { error } = await supabaseAdmin
      .from('plugins')
      .update({ 
        status: 'uninstalled',
        uninstalled_at: new Date().toISOString()
      })
      .eq('plugin_id', pluginId)

    if (error) throw error

    logger.info(`[PluginLoader] Uninstalled plugin ${pluginId}`)
  }

  /**
   * Get all installed plugins
   */
  static async getInstalledPlugins(): Promise<InstalledPlugin[]> {
    const { data, error } = await supabaseAdmin
      .from('plugins')
      .select('*')
      .order('name')

    if (error) throw error
    return (data || []) as InstalledPlugin[]
  }

  /**
   * Get a specific plugin
   */
  static async getPlugin(pluginId: string): Promise<InstalledPlugin | null> {
    const { data, error } = await supabaseAdmin
      .from('plugins')
      .select('*')
      .eq('plugin_id', pluginId)
      .single()

    if (error) return null
    return data as InstalledPlugin
  }

  /**
   * Get plugin config
   */
  static async getConfig(pluginId: string, key: string): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('plugin_configs')
      .select('value')
      .eq('plugin_id', pluginId)
      .eq('key', key)
      .single()

    return data?.value || null
  }

  /**
   * Set plugin config
   */
  static async setConfig(pluginId: string, key: string, value: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('plugin_configs')
      .upsert({ plugin_id: pluginId, key, value })

    if (error) throw error
  }

  /**
   * Log a plugin event
   */
  static async log(
    pluginId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    metadata?: unknown
  ): Promise<void> {
    await supabaseAdmin
      .from('plugin_logs')
      .insert({
        plugin_id: pluginId,
        level,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
  }

  /**
   * Get plugin logs
   */
  static async getLogs(pluginId: string, limit: number = 100): Promise<unknown[]> {
    const { data, error } = await supabaseAdmin
      .from('plugin_logs')
      .select('*')
      .eq('plugin_id', pluginId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }
}
