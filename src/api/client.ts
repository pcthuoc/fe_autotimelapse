import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach CSRF token from cookie on every mutating request
api.interceptors.request.use((config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
    const match = document.cookie.match(/csrftoken=([^;]+)/)
    if (match) config.headers['X-CSRFToken'] = match[1]
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login/?next=' + encodeURIComponent(window.location.pathname)
      }
    }
    return Promise.reject(err)
  },
)


// ── Auth ──────────────────────────────────────────────
export const login = (username: string, password: string, remember: boolean) =>
  api.post('/auth/login/', { username, password, remember })

export const logout = () => api.post('/auth/logout/')

export const getMe = () => api.get('/auth/me/')

// ── Dashboard ─────────────────────────────────────────
export const getDashboard = () => api.get('/dashboard/')

// ── Cameras ───────────────────────────────────────────
export const getCameras = (params?: Record<string, string>) =>
  api.get('/cameras/', { params })

export const getCamera = (pk: string) => api.get(`/cameras/${pk}/`)

export const createCamera = (data: Record<string, unknown>) =>
  api.post('/cameras/', data)

export const getCameraCredentials = (pk: string) => api.get(`/cameras/${pk}/credentials/`)

export const regenerateCredential = (pk: string) => api.post(`/cameras/${pk}/credentials/`)

export const getCameraSimConfig = (pk: string) => api.get(`/cameras/${pk}/simconfig/`)

export const getCameraMqttStatus = (pk: string) => api.get(`/cameras/${pk}/mqtt-register/`)

export const registerCameraMqtt = (pk: string) => api.post(`/cameras/${pk}/mqtt-register/`)

export const powerOnCM4 = (pk: string) => api.post(`/cameras/${pk}/power-on-cm4/`)

export const powerOffCM4 = (pk: string) => api.post(`/cameras/${pk}/power-off-cm4/`)

export const updateCamera = (pk: string, data: Record<string, unknown>) =>
  api.patch(`/cameras/${pk}/`, data)

export const deleteCamera = (pk: string) => api.delete(`/cameras/${pk}/`)

export const getLiveLatest = (pk: string) => api.get(`/cameras/${pk}/live/latest/`)

export const getLiveFrame = (pk: string) => api.get(`/cameras/${pk}/live/frame/`)

export const getCameraDevice = (pk: string) => api.get(`/cameras/${pk}/device/`)

export const updateCameraDevice = (pk: string, data: Record<string, unknown>) =>
  api.patch(`/cameras/${pk}/device/update/`, data)

export const getCameraSettings = (pk: string) => api.get(`/cameras/${pk}/camera-settings/`)

export const updateCameraSettings = (pk: string, data: Record<string, unknown>) =>
  api.patch(`/cameras/${pk}/camera-settings/`, data)



// ── Sites ─────────────────────────────────────────────
export const getSites = () => api.get('/sites/')

export const createSite = (data: Record<string, unknown>) => api.post('/sites/', data)

// ── Media ─────────────────────────────────────────────
export const getMediaGallery = (cameraPk: string, params?: Record<string, string>) =>
  api.get(`/media/camera/${cameraPk}/`, { params })

export const createArchive = (cameraPk: string, data: Record<string, unknown>) =>
  api.post(`/media/camera/${cameraPk}/archive/`, data)

export const getArchiveStatus = (pk: string) => api.get(`/media/archive/${pk}/status/`)
// ── Downloads center ─────────────────────────────
export const getDownloads = () => api.get('/downloads/')
// ── Video Renders ─────────────────────────────────────
export const getRenders = (params?: Record<string, string>) =>
  api.get('/renders/', { params })

export const createRender = (cameraPk: string, data: Record<string, unknown>) =>
  api.post(`/cameras/${cameraPk}/render/`, data)

export const getRenderStatus = (pk: string) => api.get(`/renders/${pk}/status/`)

export const deleteRender = (pk: string) => api.delete(`/renders/${pk}/`)

export const deleteArchive = (pk: string) => api.delete(`/archives/${pk}/`)

// ── Clients / Sites ───────────────────────────────────
export const getClients = () => api.get('/clients/')

export const getClient = (pk: string) => api.get(`/clients/${pk}/`)
export const createClient = (data: Record<string, unknown>) => api.post('/clients/', data)

export const updateClient = (pk: string, data: Record<string, unknown>) =>
  api.patch(`/clients/${pk}/`, data)

export const deleteClient = (pk: string) => api.delete(`/clients/${pk}/`)

export const assignSiteClient = (sitePk: string, clientId: string | null) =>
  api.post(`/sites/${sitePk}/assign-client/`, { client_id: clientId })

// ── Client Members (phân tầng quyền) ──────────────────
export const getClientMembers = (clientId: string) =>
  api.get(`/clients/${clientId}/members/`)

export const inviteClientMember = (clientId: string, data: Record<string, unknown>) =>
  api.post(`/clients/${clientId}/members/`, data)

export const updateClientMember = (clientId: string, userId: number, data: Record<string, unknown>) =>
  api.patch(`/clients/${clientId}/members/${userId}/`, data)

export const removeClientMember = (clientId: string, userId: number) =>
  api.delete(`/clients/${clientId}/members/${userId}/`)
// ── Users ─────────────────────────────────────────────
export const getUsers = (params?: Record<string, string>) =>
  api.get('/users/', { params })
export const searchUsers = (q: string) => api.get('/users/search/', { params: { q } })

export const getRoles = () => api.get('/roles/')
export const createUser = (data: Record<string, unknown>) => api.post('/users/', data)

export const updateUser = (pk: string, data: Record<string, unknown>) =>
  api.patch(`/users/${pk}/`, data)

export const toggleUser = (pk: string) => api.post(`/users/${pk}/toggle/`)

// ── Alert Settings ────────────────────────────────────
export const getAlertSettings = () => api.get('/settings/alert/')

export const saveAlertSettings = (cameraPk: string, data: Record<string, unknown>) =>
  api.post(`/settings/alert/${cameraPk}/`, data)
