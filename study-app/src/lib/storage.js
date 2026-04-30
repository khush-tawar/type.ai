import { supabase } from './supabase'

/**
 * Upload a drawing PNG (base64 data URL) to Supabase Storage.
 * Returns the storage path string, or null if upload fails.
 *
 * The bucket must exist: drawings/  (create in Supabase dashboard → Storage)
 * RLS policy: anon INSERT allowed.
 */
export async function uploadDrawing(participantId, stimulusId, dataUrl) {
  if (!dataUrl) return null

  try {
    // Strip metadata by re-rendering through a canvas (removes any EXIF/metadata)
    const clean = await stripMetadata(dataUrl)
    const blob = dataUrlToBlob(clean)
    const path = `${participantId}/${stimulusId}.png`

    const { error } = await supabase.storage
      .from('drawings')
      .upload(path, blob, { contentType: 'image/png', upsert: true })

    if (error) {
      console.error('[storage] Drawing upload failed:', error.message)
      return null
    }

    return path
  } catch (err) {
    console.error('[storage] Drawing upload error:', err)
    return null
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// Re-render via canvas to strip any embedded metadata
function stripMetadata(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}
