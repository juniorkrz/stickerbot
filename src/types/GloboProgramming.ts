export interface GProgrammingResponse {
  status: boolean
  message: string
  result: GChannelInfo
}

export interface GChannelInfo {
  name: string
  code: string
  GCategory: string
  liveNow: GProgram
  programs: GProgram[]
}

export interface GProgram {
  id: number
  name: string
  time: string
  endTime: string | null
  logo: string
  live: boolean
  preview?: string
  synopsis?: string
  genre?: string
  parentalRating?: number
}

export interface GChannel {
  name: string;
  url: string;
}

export interface GCategory {
  name: string;
  channels: { [key: string]: GChannel };
}

export interface GChannelResponse {
  status: boolean;
  result: GCategory[];
}
