'use client'

import { useState, useRef, type ReactNode } from 'react'
import {
  Search,
  Mic,
  ArrowUp,
  Plus,
  FileText,
  Code,
  BookOpen,
  PenTool,
  BrainCircuit,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { logger } from '@/lib/logger'

interface AIAssistantInterfaceProps {
  onSendMessage?: (message: string) => void
  onUploadFile?: () => Promise<string | null>
  placeholder?: string
  disabled?: boolean
}

export function AIAssistantInterface({
  onSendMessage,
  onUploadFile,
  placeholder = 'Ask me anything...',
  disabled = false,
}: AIAssistantInterfaceProps) {
  const [inputValue, setInputValue] = useState('')
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false)
  const [reasonEnabled, setReasonEnabled] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [showUploadAnimation, setShowUploadAnimation] = useState(false)
  const [activeCommandCategory, setActiveCommandCategory] = useState<
    string | null
  >(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const commandSuggestions = {
    learn: [
      'Explain the Big Bang theory',
      'How does photosynthesis work?',
      'What are black holes?',
      'Explain quantum computing',
      'How does the human brain work?',
    ],
    code: [
      'Create a React component for a todo list',
      'Write a Python function to sort a list',
      'How to implement authentication in Next.js',
      'Explain async/await in JavaScript',
      'Create a CSS animation for a button',
    ],
    write: [
      'Write a professional email to a client',
      'Create a product description for a smartphone',
      'Draft a blog post about AI',
      'Write a creative story about space exploration',
      'Create a social media post about sustainability',
    ],
  }

  const handleUploadFile = async () => {
    if (disabled) return
    setShowUploadAnimation(true)

    if (onUploadFile) {
      const result = await onUploadFile()
      if (result) {
        setUploadedFiles((prev) => [...prev, result])
      }
    } else {
      // Simulate file upload
      setTimeout(() => {
        const newFile = `Document.pdf`
        setUploadedFiles((prev) => [...prev, newFile])
        setShowUploadAnimation(false)
      }, 1500)
    }
    setShowUploadAnimation(false)
  }

  const handleCommandSelect = (command: string) => {
    setInputValue(command)
    setActiveCommandCategory(null)
    inputRef.current?.focus()
  }

  const handleSendMessage = () => {
    if (inputValue.trim() && !disabled) {
      logger.info('[AI] Sending message:', { message: inputValue })
      onSendMessage?.(inputValue)
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
        {/* Animated logo */}
        <div className="mb-8 w-20 h-20 relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 200 200"
            width="100%"
            height="100%"
            className="w-full h-full"
          >
            <g clipPath="url(#cs_clip_1_ellipse-12)">
              <mask
                id="cs_mask_1_ellipse-12"
                style={{ maskType: 'alpha' }}
                width="200"
                height="200"
                x="0"
                y="0"
                maskUnits="userSpaceOnUse"
              >
                <path
                  fill="#fff"
                  fillRule="evenodd"
                  d="M100 150c27.614 0 50-22.386 50-50s-22.386-50-50-50-50 22.386-50 50 22.386 50 50 50zm0 50c55.228 0 100-44.772 100-100S155.228 0 100 0 0 44.772 0 100s44.772 100 100 100z"
                  clipRule="evenodd"
                />
              </mask>
              <g mask="url(#cs_mask_1_ellipse-12)">
                <path fill="#fff" d="M200 0H0v200h200V0z" />
                <path
                  fill="#0066FF"
                  fillOpacity="0.33"
                  d="M200 0H0v200h200V0z"
                />
                <g
                  filter="url(#filter0_f_844_2811)"
                  className="animate-gradient"
                >
                  <path fill="#0066FF" d="M110 32H18v68h92V32z" />
                  <path fill="#0044FF" d="M188-24H15v98h173v-98z" />
                  <path fill="#0099FF" d="M175 70H5v156h170V70z" />
                  <path fill="#00CCFF" d="M230 51H100v103h130V51z" />
                </g>
              </g>
            </g>
            <defs>
              <filter
                id="filter0_f_844_2811"
                width="385"
                height="410"
                x="-75"
                y="-104"
                colorInterpolationFilters="sRGB"
                filterUnits="userSpaceOnUse"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend
                  in="SourceGraphic"
                  in2="BackgroundImageFix"
                  result="shape"
                />
                <feGaussianBlur
                  result="effect1_foregroundBlur_844_2811"
                  stdDeviation="40"
                />
              </filter>
              <clipPath id="cs_clip_1_ellipse-12">
                <path fill="#fff" d="M0 0H200V200H0z" />
              </clipPath>
            </defs>
            <g
              style={{ mixBlendMode: 'overlay' }}
              mask="url(#cs_mask_1_ellipse-12)"
            >
              <path
                fill="gray"
                stroke="transparent"
                d="M200 0H0v200h200V0z"
                filter="url(#cs_noise_1_ellipse-12)"
              />
            </g>
            <defs>
              <filter
                id="cs_noise_1_ellipse-12"
                width="100%"
                height="100%"
                x="0%"
                y="0%"
                filterUnits="objectBoundingBox"
              >
                <feTurbulence
                  baseFrequency="0.6"
                  numOctaves="5"
                  result="out1"
                  seed="4"
                />
                <feComposite
                  in="out1"
                  in2="SourceGraphic"
                  operator="in"
                  result="out2"
                />
                <feBlend
                  in="SourceGraphic"
                  in2="out2"
                  mode="overlay"
                  result="out3"
                />
              </filter>
            </defs>
          </svg>
        </div>

        {/* Welcome message */}
        <div className="mb-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400 mb-2">
              Ready to assist you
            </h1>
            <p className="text-muted-foreground max-w-md">
              Ask me anything or try one of the suggestions below
            </p>
          </motion.div>
        </div>

        {/* Input area */}
        <div className="w-full bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="p-4">
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className="w-full text-foreground text-base outline-none placeholder:text-muted-foreground bg-transparent"
            />
          </div>

          {/* Uploaded files */}
          {uploadedFiles.length > 0 && (
            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-muted py-1 px-2 rounded-md border border-border"
                  >
                    <FileText className="w-3 h-3 text-blue-600" />
                    <span className="text-xs text-foreground">{file}</span>
                    <button
                      onClick={() =>
                        setUploadedFiles((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Toggle buttons */}
          <div className="px-4 py-3 flex items-center justify-between border-t border-border">
            <div className="flex items-center gap-2">
              <ToggleButton
                icon={<Search className="w-4 h-4" />}
                label="Search"
                active={searchEnabled}
                onClick={() => setSearchEnabled(!searchEnabled)}
              />
              <ToggleButton
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2" />
                    <circle cx="8" cy="8" r="3" fill="currentColor" />
                  </svg>
                }
                label="Deep Research"
                active={deepResearchEnabled}
                onClick={() => setDeepResearchEnabled(!deepResearchEnabled)}
              />
              <ToggleButton
                icon={<BrainCircuit className="w-4 h-4" />}
                label="Reason"
                active={reasonEnabled}
                onClick={() => setReasonEnabled(!reasonEnabled)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={disabled}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Mic className="w-5 h-5" />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || disabled}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                  inputValue.trim() && !disabled
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Upload files */}
          <div className="px-4 py-2 border-t border-border">
            <button
              onClick={handleUploadFile}
              disabled={disabled}
              className="flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground transition-colors disabled:opacity-50"
            >
              {showUploadAnimation ? (
                <motion.div
                  className="flex space-x-1"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: {
                      transition: { staggerChildren: 0.1 },
                    },
                  }}
                >
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 bg-primary rounded-full"
                      variants={{
                        hidden: { opacity: 0, y: 5 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          transition: {
                            duration: 0.4,
                            repeat: Infinity,
                            repeatType: 'mirror',
                            delay: i * 0.1,
                          },
                        },
                      }}
                    />
                  ))}
                </motion.div>
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Upload Files</span>
            </button>
          </div>
        </div>

        {/* Command categories */}
        <div className="w-full grid grid-cols-3 gap-4 mb-4">
          <CommandButton
            icon={<BookOpen className="w-5 h-5" />}
            label="Learn"
            isActive={activeCommandCategory === 'learn'}
            onClick={() =>
              setActiveCommandCategory(
                activeCommandCategory === 'learn' ? null : 'learn'
              )
            }
            disabled={disabled}
          />
          <CommandButton
            icon={<Code className="w-5 h-5" />}
            label="Code"
            isActive={activeCommandCategory === 'code'}
            onClick={() =>
              setActiveCommandCategory(
                activeCommandCategory === 'code' ? null : 'code'
              )
            }
            disabled={disabled}
          />
          <CommandButton
            icon={<PenTool className="w-5 h-5" />}
            label="Write"
            isActive={activeCommandCategory === 'write'}
            onClick={() =>
              setActiveCommandCategory(
                activeCommandCategory === 'write' ? null : 'write'
              )
            }
            disabled={disabled}
          />
        </div>

        {/* Command suggestions */}
        <AnimatePresence>
          {activeCommandCategory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full mb-6 overflow-hidden"
            >
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="p-3 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground">
                    {activeCommandCategory === 'learn'
                      ? 'Learning suggestions'
                      : activeCommandCategory === 'code'
                      ? 'Coding suggestions'
                      : 'Writing suggestions'}
                  </h3>
                </div>
                <ul className="divide-y divide-border">
                  {commandSuggestions[
                    activeCommandCategory as keyof typeof commandSuggestions
                  ].map((suggestion, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleCommandSelect(suggestion)}
                      className="p-3 hover:bg-muted cursor-pointer transition-colors duration-75"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-foreground">
                          {suggestion}
                        </span>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

interface CommandButtonProps {
  icon: ReactNode
  label: string
  isActive: boolean
  onClick: () => void
  disabled?: boolean
}

function CommandButton({ icon, label, isActive, onClick, disabled }: CommandButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
        isActive
          ? 'bg-primary/5 border-primary/20 shadow-sm'
          : 'bg-card border-border hover:border-muted-foreground/30'
      } disabled:opacity-50`}
    >
      <div className={isActive ? 'text-primary' : 'text-muted-foreground'}>
        {icon}
      </div>
      <span
        className={`text-sm font-medium ${
          isActive ? 'text-primary' : 'text-foreground'
        }`}
      >
        {label}
      </span>
    </motion.button>
  )
}

interface ToggleButtonProps {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
}

function ToggleButton({ icon, label, active, onClick }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active
          ? 'bg-primary/10 text-primary hover:bg-primary/20'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
