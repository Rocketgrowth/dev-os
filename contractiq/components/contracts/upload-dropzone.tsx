'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/constants/limits'
import { Button } from '@/components/ui/button'

interface UploadDropzoneProps {
  file: File | null
  onFileSelect: (file: File | null) => void
  disabled?: boolean
}

export function UploadDropzone({
  file,
  onFileSelect,
  disabled,
}: UploadDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0])
      }
    },
    [onFileSelect]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: {
        'application/pdf': ['.pdf'],
      },
      maxSize: MAX_FILE_SIZE_BYTES,
      maxFiles: 1,
      disabled,
    })

  const error = fileRejections[0]?.errors[0]

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onFileSelect(null)}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <input {...getInputProps()} />
          <Upload
            className={cn(
              'h-10 w-10 mb-4',
              isDragActive ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <p className="text-lg font-medium">
            {isDragActive ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse (max {MAX_FILE_SIZE_MB}MB)
          </p>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive">
          {error.code === 'file-too-large'
            ? `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`
            : error.code === 'file-invalid-type'
            ? 'Please upload a PDF file.'
            : error.message}
        </p>
      )}
    </div>
  )
}
