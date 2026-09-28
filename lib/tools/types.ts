export type ToolCategory = {
  slug: string
  name: string
  description: string
}

export type PublicTool = {
  id: string
  slug: string
  name: string
  description: string
  shortDescription: string
  icon: string
  type: 'utility' | 'ai'
  isFeatured: boolean
  isFree: boolean
  requiresAuthentication: boolean
  instructions: string
  seoTitle: string | null
  seoDescription: string | null
  category: ToolCategory | null
}

export type ToolRecord = PublicTool & {
  dailyLimit: number | null
  monthlyLimit: number | null
  configuration: Record<string, unknown>
}
