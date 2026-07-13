# Audit: Missing Loading/Error/Empty States in UI Pages

## Goal
Audit all pages in `app/(dashboard)/**/*.tsx` and components in `components/**/*.tsx` (excluding `dashboard/` route which is already complete) for missing loading, error, or empty states, and for raw `animate-pulse` usage instead of the standard `<Skeleton>` component.

## Constraints
- Must check `app/(dashboard)/**/*.tsx` (excluding `/dashboard/` subdirectory) and `components/**/*.tsx`
- Must flag files with no loading/error/empty handling at all
- Must flag raw `animate-pulse` divs vs project`s `<Skeleton>` component
- Target patterns: `"use client"` files with `useEffect`/`useCallback` + `fetch`, or custom hooks returning loading state
- `components/ui/skeleton.tsx` itself is excluded from raw-pulse violations
- `components/ui/data-table.tsx` has built-in loading/error/empty props — pages using it correctly are OK
- `dashboard/` files are excluded from scope (user says already done)
