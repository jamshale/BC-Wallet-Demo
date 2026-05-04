import type { Showcase } from '../types'
import type { AuthContextProps } from 'react-oidc-context'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from 'react-oidc-context'

import { publicBaseUrl, getAvailableImages, uploadImage, updateShowcase } from '../api/adminApi'

interface ImageUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectImage: (imagePath: string) => void | Promise<void>
  showcase?: Showcase | null
  propertyPath?: string
  onImageUpdated?: () => void | Promise<void>
}

export function ImageUploadModal({
  isOpen,
  onClose,
  onSelectImage,
  showcase,
  propertyPath,
  onImageUpdated,
}: ImageUploadModalProps) {
  const auth = useAuth() as AuthContextProps
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [availableImages, setAvailableImages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const loadAvailableImages = async () => {
    setIsLoading(true)
    try {
      const images = await getAvailableImages(auth)
      setAvailableImages(images)
      setUploadError(null)
    } catch {
      setUploadError('Failed to load available images')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadAvailableImages()
    }
  }, [isOpen])

  const handleSelectImage = async (imagePath: string) => {
    try {
      // If showcase and propertyPath are provided, update the showcase directly
      if (showcase && propertyPath && auth.user?.access_token) {
        const updatedShowcase = { ...showcase }
        const keys = propertyPath.split('.')
        let obj: any = updatedShowcase

        // Navigate to the parent object
        for (let i = 0; i < keys.length - 1; i++) {
          obj = obj[keys[i]]
        }

        // Set the property
        obj[keys[keys.length - 1]] = imagePath

        // Update via API
        await updateShowcase(auth, showcase.name, updatedShowcase)
        await onImageUpdated?.()
      } else {
        // Fallback: just call the callback
        await onSelectImage(imagePath)
      }

      onClose()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error updating image:', error)
      setUploadError('Failed to update image')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type - allow all image types
    const allowedExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!allowedExtensions.includes(fileExtension)) {
      setUploadError('Please upload an image file (SVG, PNG, JPG, JPEG, GIF, WEBP)')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB')
      return
    }

    // Upload file
    try {
      const result = await uploadImage(auth, file)
      await handleSelectImage(result.path)
    } catch {
      setUploadError('Failed to upload file')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-bcgov-black">Upload Image</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Available Images Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-bcgov-black mb-4">Select from available images</h3>
          {isLoading ? (
            <p className="text-gray-500">Loading images...</p>
          ) : availableImages.length > 0 ? (
            <div className="grid grid-cols-6 gap-2">
              {availableImages.map((imagePath) => (
                <button
                  key={imagePath}
                  onClick={() => void handleSelectImage(imagePath)}
                  className="flex flex-col items-center justify-center p-2 border-2 border-gray-300 rounded-lg hover:border-bcgov-blue transition-colors bg-gray-50 h-20"
                >
                  <img src={`${publicBaseUrl}${imagePath}`} alt={imagePath} className="w-12 h-12 object-contain" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No images available</p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 my-8"></div>

        {/* Upload Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-bcgov-black mb-4">Or upload a new image</h3>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-bcgov-blue transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <p className="text-gray-600 mb-2">Drag and drop your image file here, or click to select</p>
            <p className="text-xs text-gray-500">Supported formats: SVG, PNG, JPG, JPEG, GIF, WEBP (up to 5MB)</p>
          </div>
          {uploadError && <p className="text-red-500 text-sm mt-2">{uploadError}</p>}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-bcgov-black font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
