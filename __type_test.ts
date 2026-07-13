import type { Database as AutoDatabase } from '@/lib/types/database'

// Manually define GenericSchema as it's defined in postgrest-js
type GenericRelationship = { foreignKeyName: string; columns: string[]; referencedRelation: string; referencedColumns: string[] }
type GenericTable = { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: GenericRelationship[] }
type GenericSchema = { Tables: Record<string, GenericTable>; Views: Record<string, GenericTable>; Functions: Record<string, { Args: Record<string, unknown> | never; Returns: unknown }> }

// Check if the auto-generated public schema extends GenericSchema
type Test = AutoDatabase['public'] extends GenericSchema ? true : false
declare const _check: Test
