export interface YoutubeVideoInfo {
  id: string
  title: string
  duration: number // seconds (0 when unknown, e.g. live streams)
  url: string
}
