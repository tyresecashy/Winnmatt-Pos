'use client'

import { motion } from 'framer-motion'
import { pageVariants } from '@/lib/motion'

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

/**
 * Page transition wrapper using framer-motion.
 * Wrap page content to get a subtle fade-in + slide-up entrance.
 * Respects prefers-reduced-motion by being subtle by default.
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  )
}
