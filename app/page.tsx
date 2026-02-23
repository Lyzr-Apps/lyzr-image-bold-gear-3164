'use client'

import React, { useState, useRef, useCallback } from 'react'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import type { AIAgentResponse } from '@/lib/aiAgent'
import { FiUpload, FiDownload, FiX, FiImage, FiRefreshCw, FiCheck, FiAlertCircle, FiLoader } from 'react-icons/fi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

const AGENT_ID = '699c802522d60b5dbc439726'

const ACCEPTED_FORMATS = ['image/png', 'image/jpeg', 'image/webp']
const FORMAT_LABELS = ['PNG', 'JPG', 'WEBP']

// --- Sample Data ---
const SAMPLE_TRANSFORMATION_DETAILS = {
  transformation_description: 'The original image was reimagined with Lyzr brand aesthetics. Deep purple gradients were applied as background overlays, and key visual elements were enhanced with electric blue accents and clean geometric lines to evoke a modern, tech-forward feel consistent with Lyzr\'s identity.',
  style_elements_applied: 'Clean gradient overlays, geometric accent lines, rounded containers, soft shadows with purple hues, tech-forward minimalist composition, brand-consistent iconography treatment',
  color_palette_used: 'Deep Purple (#7458e8), Midnight Violet (#2D1B69), Electric Blue (#3B82F6), Soft Lavender (#A78BFA), White (#FFFFFF), Dark Background (#0A0612)'
}
const SAMPLE_IMAGE_URL = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=400&fit=crop'

// --- Markdown Renderer ---
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

// --- Error Boundary ---
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- Detail Row ---
function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground leading-relaxed">{renderMarkdown(value)}</div>
    </div>
  )
}

// --- Agent Status Card ---
function AgentStatusCard({ isActive }: { isActive: boolean }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground/40'}`} />
          <div>
            <p className="text-xs font-semibold text-foreground">Lyzr Style Transformer Agent</p>
            <p className="text-xs text-muted-foreground">Image generation -- DALL-E 3</p>
          </div>
        </div>
        <Badge variant="outline" className={`text-xs ${isActive ? 'border-green-500/40 text-green-400' : 'border-border text-muted-foreground'}`}>
          {isActive ? 'Active' : 'Idle'}
        </Badge>
      </CardContent>
    </Card>
  )
}

// --- Main Page ---
export default function Page() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [styleNote, setStyleNote] = useState('')
  const [isTransforming, setIsTransforming] = useState(false)
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null)
  const [transformationDetails, setTransformationDetails] = useState<{
    transformation_description: string
    style_elements_applied: string
    color_palette_used: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [useSampleData, setUseSampleData] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (!ACCEPTED_FORMATS.includes(file.type)) {
      setError('Please upload a PNG, JPG, or WEBP image.')
      return
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setError(null)
    setResultImageUrl(null)
    setTransformationDetails(null)
    setShowComparison(false)
  }, [previewUrl])

  // Remove selected file
  const handleRemoveFile = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setResultImageUrl(null)
    setTransformationDetails(null)
    setError(null)
    setShowComparison(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [previewUrl])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  // Transform handler
  const handleTransform = async () => {
    if (!selectedFile) return
    setIsTransforming(true)
    setError(null)
    setResultImageUrl(null)
    setTransformationDetails(null)
    setStatusMessage('Uploading image...')

    try {
      // Step 1: Upload file
      const uploadResult = await uploadFiles(selectedFile)
      if (!uploadResult.success || !Array.isArray(uploadResult.asset_ids) || uploadResult.asset_ids.length === 0) {
        throw new Error(uploadResult.error || 'Failed to upload image')
      }
      const assetId = uploadResult.asset_ids[0]

      setStatusMessage('Transforming with AI...')

      // Step 2: Build message
      let message = 'Transform this uploaded image into Lyzr brand style using the company color palette (deep purples #7458e8, vibrant blues, electric accents) with clean gradients and modern tech-forward aesthetic.'
      if (styleNote.trim()) {
        message += ` Additional style direction: ${styleNote.trim()}`
      }

      // Step 3: Call agent
      const result: AIAgentResponse = await callAIAgent(message, AGENT_ID, { assets: [assetId] })

      if (!result.success) {
        throw new Error(result.error || result.response?.message || 'Transformation failed')
      }

      // Step 4: Extract generated image from module_outputs (TOP LEVEL)
      const artifactFiles = result.module_outputs?.artifact_files
      if (Array.isArray(artifactFiles) && artifactFiles.length > 0) {
        setResultImageUrl(artifactFiles[0].file_url)
      } else {
        throw new Error('No image was generated. Please try again.')
      }

      // Step 5: Extract transformation details
      const agentResult = result.response?.result
      if (agentResult && typeof agentResult === 'object') {
        setTransformationDetails({
          transformation_description: (agentResult as Record<string, string>).transformation_description || '',
          style_elements_applied: (agentResult as Record<string, string>).style_elements_applied || '',
          color_palette_used: (agentResult as Record<string, string>).color_palette_used || '',
        })
      }

      setStatusMessage(null)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(errorMessage)
      setStatusMessage(null)
    } finally {
      setIsTransforming(false)
    }
  }

  // Download handler
  const handleDownload = async () => {
    const url = useSampleData ? SAMPLE_IMAGE_URL : resultImageUrl
    if (!url) return
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = 'lyzr-styled-image.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  // Determine what to display
  const displayImageUrl = useSampleData ? SAMPLE_IMAGE_URL : resultImageUrl
  const displayDetails = useSampleData ? SAMPLE_TRANSFORMATION_DETAILS : transformationDetails
  const hasResult = displayImageUrl !== null
  const displayPreviewUrl = useSampleData ? 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop' : previewUrl
  const showComparisonToggle = hasResult && (useSampleData || previewUrl)

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground font-sans">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-[-0.01em] text-foreground">
                Lyzr Style Transformer
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                Transform any image into Lyzr brand aesthetic with AI
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">
                Sample Data
              </Label>
              <Switch
                id="sample-toggle"
                checked={useSampleData}
                onCheckedChange={setUseSampleData}
              />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left Panel - Upload & Controls */}
            <div className="space-y-4">
              <Card className="bg-card border-border shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <FiUpload className="w-4 h-4 text-muted-foreground" />
                    Upload Image
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Dropzone */}
                  {!selectedFile && !useSampleData ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 py-12 px-6 ${isDragOver ? 'border-[hsl(262,70%,50%)] bg-[hsl(262,70%,50%)]/5' : 'border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-secondary/30'}`}
                    >
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
                        <FiImage className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        Drag and drop your image here
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        or click to browse files
                      </p>
                      <div className="flex gap-2">
                        {FORMAT_LABELS.map((fmt) => (
                          <Badge key={fmt} variant="secondary" className="text-xs bg-secondary text-muted-foreground">
                            {fmt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-border bg-secondary/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={useSampleData ? 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop' : (previewUrl || '')}
                        alt="Selected image preview"
                        className="w-full h-56 object-cover"
                      />
                      {!useSampleData && (
                        <button
                          onClick={handleRemoveFile}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors duration-200"
                          aria-label="Remove image"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      )}
                      <div className="p-3 bg-card border-t border-border">
                        <p className="text-xs text-muted-foreground truncate">
                          {useSampleData ? 'sample-landscape.jpg' : selectedFile?.name}
                        </p>
                        <p className="text-xs text-muted-foreground/60">
                          {useSampleData ? '2.4 MB' : selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={handleInputChange}
                  />

                  {/* Style Note */}
                  <div className="space-y-2">
                    <Label htmlFor="style-note" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Style Direction (optional)
                    </Label>
                    <Input
                      id="style-note"
                      placeholder="Add style direction (optional)..."
                      value={styleNote}
                      onChange={(e) => setStyleNote(e.target.value)}
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 rounded-xl"
                    />
                  </div>

                  {/* Transform Button */}
                  <Button
                    onClick={handleTransform}
                    disabled={(!selectedFile && !useSampleData) || isTransforming}
                    className="w-full bg-[hsl(262,70%,50%)] hover:bg-[hsl(262,70%,55%)] text-white font-semibold rounded-xl h-12 text-sm transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isTransforming ? (
                      <span className="flex items-center gap-2">
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Transforming...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <FiRefreshCw className="w-4 h-4" />
                        Transform to Lyzr Style
                      </span>
                    )}
                  </Button>

                  {/* Status Message */}
                  {statusMessage && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
                      <FiLoader className="w-3 h-3 animate-spin flex-shrink-0" />
                      <span>{statusMessage}</span>
                    </div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-start gap-2 text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                      <FiAlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-red-400 text-sm">{error}</p>
                        <button
                          onClick={() => {
                            setError(null)
                            handleTransform()
                          }}
                          className="text-xs text-red-300 hover:text-red-200 underline mt-1"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Agent Status */}
              <AgentStatusCard isActive={isTransforming} />
            </div>

            {/* Right Panel - Result Display */}
            <div className="space-y-4">
              <Card className="bg-card border-border shadow-lg min-h-[400px] flex flex-col">
                <CardHeader className="pb-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      <FiImage className="w-4 h-4 text-muted-foreground" />
                      Result
                    </CardTitle>
                    {showComparisonToggle && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor="compare-toggle" className="text-xs text-muted-foreground cursor-pointer">
                          Compare
                        </Label>
                        <Switch
                          id="compare-toggle"
                          checked={showComparison}
                          onCheckedChange={setShowComparison}
                        />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {/* Loading State */}
                  {isTransforming && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-8">
                      <Skeleton className="w-full h-48 rounded-xl" />
                      <Skeleton className="w-3/4 h-4 rounded" />
                      <Skeleton className="w-1/2 h-4 rounded" />
                      <p className="text-sm text-muted-foreground animate-pulse mt-4">
                        Generating your Lyzr-styled image...
                      </p>
                    </div>
                  )}

                  {/* Empty State */}
                  {!isTransforming && !hasResult && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                        <FiImage className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground mb-1">
                        Your Lyzr-styled image will appear here
                      </p>
                      <p className="text-xs text-muted-foreground/60 max-w-[240px] leading-relaxed">
                        Upload an image and click Transform to see it reimagined in Lyzr brand style
                      </p>
                    </div>
                  )}

                  {/* Result State */}
                  {!isTransforming && hasResult && (
                    <ScrollArea className="flex-1">
                      <div className="space-y-4">
                        {/* Comparison View */}
                        {showComparison && displayPreviewUrl ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Original</p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={displayPreviewUrl}
                                alt="Original image"
                                className="w-full rounded-xl border border-border object-cover aspect-square"
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-[hsl(262,70%,60%)] uppercase tracking-wider text-center">Lyzr Styled</p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={displayImageUrl || ''}
                                alt="Lyzr styled image"
                                className="w-full rounded-xl border border-[hsl(262,70%,50%)]/30 object-cover aspect-square"
                              />
                            </div>
                          </div>
                        ) : (
                          /* Single Image View */
                          <div className="relative rounded-xl overflow-hidden border border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={displayImageUrl || ''}
                              alt="Lyzr styled result"
                              className="w-full rounded-xl object-cover"
                            />
                            <div className="absolute top-2 left-2">
                              <Badge className="bg-[hsl(262,70%,50%)] text-white border-none text-xs">
                                <FiCheck className="w-3 h-3 mr-1" />
                                Lyzr Styled
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* Download Button */}
                        <Button
                          onClick={handleDownload}
                          variant="outline"
                          className="w-full rounded-xl border-border hover:bg-secondary text-foreground h-10"
                        >
                          <FiDownload className="w-4 h-4 mr-2" />
                          Download Image
                        </Button>

                        {/* Transformation Details */}
                        {displayDetails && (
                          <>
                            <Separator className="bg-border" />
                            <div className="space-y-4">
                              <DetailRow
                                label="Transformation"
                                value={displayDetails.transformation_description}
                              />
                              <DetailRow
                                label="Style Elements Applied"
                                value={displayDetails.style_elements_applied}
                              />
                              <DetailRow
                                label="Color Palette Used"
                                value={displayDetails.color_palette_used}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border mt-8 py-4">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-muted-foreground/50">
              Powered by Lyzr AI -- Image generation via DALL-E 3
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
