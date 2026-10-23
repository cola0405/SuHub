export type AssetType = 'video' | 'image' | 'audio'

export type SortKey = 'recent' | 'name' | 'size' | 'duration'

export interface AssetTag {
  id: number
  name: string
}

export interface Asset {
  id: number
  path: string
  filename: string
  ext: string
  type: AssetType
  size: number
  duration: number | null
  width: number | null
  height: number | null
  thumb: string | null
  missing: number
  createdAt: number
  tags: AssetTag[]
  folderIds: number[]
}

export interface Tag {
  id: number
  name: string
  count: number
}

export interface Folder {
  id: number
  name: string
  parentId: number | null
  count: number
}

export interface AssetFilter {
  view: 'all' | AssetType | 'missing' | `tag:${number}` | `folder:${number}`
  search?: string
  sort?: SortKey
}

export interface LibraryStats {
  all: number
  video: number
  image: number
  audio: number
  missing: number
}

export interface ImportProgress {
  phase: 'scan' | 'process'
  done: number
  total: number
  label: string
}
