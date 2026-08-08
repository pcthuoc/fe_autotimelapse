import { useParams, useNavigate } from 'react-router-dom'
import CameraLiveModal from '../components/CameraLiveModal'

export default function CameraLivePage() {
  const { pk } = useParams<{ pk: string }>()
  const navigate = useNavigate()

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/cameras')
    }
  }

  if (!pk) return null

  return <CameraLiveModal camId={pk} onClose={handleClose} />
}
