// ── Shared types matching Django models ──────────────────

export type ClientRole = 'superadmin' | 'admin' | 'member' | null

export interface UserPerms {
  client_role: ClientRole
  can_manage_cameras: boolean
  can_manage_members: boolean
  can_manage_clients: boolean
  can_download: boolean
  can_view_renders: boolean
  can_manage_settings: boolean
}

export interface User {
  id: number
  username: string
  email: string
  full_name?: string
  is_staff: boolean
  is_active: boolean
  date_joined: string
  client_id?: string | null
  client_name?: string | null
  client_role?: ClientRole
  roles?: { id: string; code: string; name: string }[]
  perms?: UserPerms
}

export interface ClientMember {
  user_id: number
  username: string
  email: string
  full_name: string
  role: 'admin' | 'member'
  can_download: boolean
  joined_at: string
}

export interface Role {
  id: string
  code: string
  name: string
}

export interface Site {
  id: string
  name: string
  description?: string
  location?: string
  client_id?: string | null
  client_name?: string | null
  cam_count?: number
}

export interface ClientProject {
  id: string
  name: string
  location: string
  start_date?: string | null
  end_date?: string | null
  cameras: { id: string; code: string; name: string; status: string }[]
  cam_count: number
}

export interface Client {
  id: string
  name: string
  contact_name: string
  contact_email: string
  phone: string
  address: string
  notes: string
  projects: ClientProject[]
  project_count: number
  camera_count: number
  created_at: string
}

export interface CameraDevice {
  id: string
  last_seen_at: string | null
  battery_percent: number | null
  battery_voltage: number | null
  is_charging: boolean
  cell_voltages?: number[]
  solar_voltage?: number | null
  solar_percent?: number | null
  sim_signal_dbm: number | null
  sim_operator?: string
  sim_number?: string
  sim_iccid?: string
  temperature_c: number | null
  humidity_percent: number | null
  firmware_version?: string
  capture_interval_sec: number | null
  signal_bars: number   // 1-4
  signal_label: string
}

export interface CameraAccessUser {
  id: number
  username: string
  email: string
}

export interface CameraAccess {
  id: string
  user_id: number
  username: string
  email: string
  can_view: boolean
  can_manage: boolean
  can_download: boolean
  can_delete_media: boolean
  granted_at: string
}

export interface CameraAccessResponse {
  accesses: CameraAccess[]
  unassigned_users: CameraAccessUser[]
}

export interface CameraSettings {
  iso: string
  aperture: string
  shutter_speed: string
  exposure_compensation: string
  exposure_mode: string
  autofocus: string
  focus_mode: string
  focus_switch: string
  image_format: string
  image_size: string
  white_balance: string
  capture_mode: string
  capture_target: string
  high_iso_nr: string
  long_exp_nr: string
  liveview_af: string
  capabilities: Record<string, unknown>
  applied: Record<string, unknown>
  last_synced_at: string | null
}

export interface Camera {
  id: string
  code: string
  name: string
  status: 'active' | 'inactive' | 'maintenance'
  camera_model: string
  timezone: string
  mqtt_password?: string
  site: Site | null
  device: CameraDevice | null
  latest_thumb_url: string | null
  is_online: boolean
}

export interface Media {
  id: string
  camera_id: string
  taken_at: string
  size_bytes: number
  width: number
  height: number
  thumb_url: string
  view_url: string
}

export interface MediaDayStat {
  day: string          // YYYY-MM-DD
  date_label: string   // DD/MM
  count: number
  cover_thumb_url: string | null
}

export interface VideoRender {
  id: string
  camera_id: string
  camera_code?: string
  camera_name?: string
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'expired'
  progress: number
  item_count: number
  size_bytes: number | null
  download_url: string | null
  stream_url?: string | null
  error?: string
  date_from: string
  date_to: string
  fps: number
  resolution: string
  frame_interval?: number
  created_at: string
  ready_at: string | null
}

export interface DownloadItem {
  id: string
  kind: 'render' | 'archive'
  camera_code: string
  camera_name: string
  title: string
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'expired'
  progress: number
  size_bytes: number
  item_count: number
  download_url: string | null
  error: string
  meta: string
  created_at: string
  ready_at: string | null
  expires_at: string | null
}

export interface MediaArchive {
  id: string
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'expired'
  item_count: number
  size_bytes: number | null
  download_url: string | null
  expires_at: string | null
  created_at: string
}

export interface AlertSettings {
  camera_id: string
  camera_code?: string
  camera_name?: string
  site_name?: string
  client_name?: string
  enabled: boolean
  battery_low_pct: number
  battery_critical_pct: number
  signal_weak_dbm: number
  offline_minutes: number
  temperature_high_c: number
  daily_photo_min: number
  notify_email: string
}

export interface DashboardData {
  role?: 'superadmin' | 'admin' | 'member' | null
  client_name?: string | null
  total_clients?: number | null
  total_members?: number | null
  total_sites: number
  total_cameras: number
  online_count: number
  today_photos: number
  total_photos: number
  total_bytes: number
  days_7: { date: string; count: number }[]
  sites_data: {
    site: Site
    cam_count: number
    online_count: number
    today_count: number
    latest_thumb_url: string | null
    cameras: {
      cam: Camera
      online: boolean
      thumb_url: string | null
      battery: number | null
      signal: number | null
    }[]
  }[]
}
