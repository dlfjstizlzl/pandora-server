import type { ChangeEvent, DragEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Upload } from 'lucide-react';

type UploadZoneProps = {
  label?: string;
  description?: string;
  accept?: string;
  onUpload: (file: File) => Promise<string>;
  onUploaded?: (url: string) => void;
  onFileSelected?: (file: File | null) => void;
  onFilesSelected?: (files: File[]) => void;
  deferUpload?: boolean;
  multiple?: boolean;
};

export function UploadZone({
  label = 'Drop Sample Video Here',
  description,
  accept = 'video/*',
  onUpload,
  onUploaded,
  onFileSelected,
  deferUpload = false,
  onFilesSelected,
  multiple = false,
}: UploadZoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const file = files[0] ?? null;

  const clearPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  useEffect(() => {
    return () => clearPreview();
  }, [clearPreview]);

  const handleFiles = useCallback(
    (selected: FileList | File[] | null) => {
      clearPreview();
      setUploadedUrl(null);
      setError(null);

      const next = selected ? Array.from(selected) : [];
      const primary = next[0] ?? null;

      setFiles(next);
      onFileSelected?.(primary);
      onFilesSelected?.(next);
      setPreviewUrl(primary ? URL.createObjectURL(primary) : null);
    },
    [clearPreview, onFileSelected, onFilesSelected],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files?.length) handleFiles(event.dataTransfer.files);
  };

  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) handleFiles(event.target.files);
  };

  const startUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const url = await onUpload(file);
      setUploadedUrl(url);
      onUploaded?.(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Try again.';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`cursor-pointer border-2 border-dashed rounded-sm p-6 text-center transition ${
          isDragging ? 'border-pandora-neon bg-pandora-bg' : 'border-pandora-border hover:border-pandora-neon'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          multiple={multiple}
          onChange={onSelect}
        />
        <div className="flex flex-col items-center gap-2 text-pandora-text">
          <Upload className="text-pandora-neon" size={24} />
          <p className="text-sm font-semibold uppercase">{label}</p>
          <p className="text-xs text-pandora-muted font-mono">
            Click or drag {multiple ? 'files' : 'a file'} to begin
          </p>
          {description && <p className="text-[11px] text-pandora-muted">{description}</p>}
        </div>
      </div>

      {file && (
        <div className="border border-pandora-border bg-pandora-bg rounded-sm p-3 space-y-3">
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <p className="text-sm font-semibold text-pandora-text">{file.name}</p>
              <p className="text-xs text-pandora-muted">
                {(file.size / (1024 * 1024)).toFixed(1)} MB • {file.type || 'video'}
              </p>
              {multiple && files.length > 1 && (
                <p className="text-[11px] text-pandora-muted">{files.length - 1} more file(s) selected</p>
              )}
            </div>
            {!deferUpload && (
              <button
                onClick={startUpload}
                disabled={uploading}
                className="px-4 py-2 border border-pandora-neon text-pandora-neon text-xs uppercase rounded-sm hover:bg-pandora-neon hover:text-pandora-bg transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={14} />
                    Uploading...
                  </span>
                ) : (
                  'Upload'
                )}
              </button>
            )}
          </div>

          {previewUrl && (
            <div className="relative w-full overflow-hidden rounded-sm border border-pandora-border bg-pandora-surface">
              {file?.type?.startsWith('image') ? (
                <img src={previewUrl} alt={file.name} className="w-full h-56 object-cover" />
              ) : file?.type?.startsWith('video') ? (
                <video src={previewUrl} className="w-full h-56 object-cover" controls muted playsInline />
              ) : (
                <div className="h-24 flex items-center justify-center text-sm text-pandora-muted">{file?.name}</div>
              )}
            </div>
          )}

          <div className="min-h-[20px]">
            {deferUpload && !uploadedUrl && (
              <p className="text-xs text-pandora-muted">Will upload when you submit.</p>
            )}
            {uploading && !deferUpload && <p className="text-xs text-pandora-muted">Uploading to MinIO...</p>}
            {uploadedUrl && !deferUpload && (
              <p className="flex items-center gap-2 text-xs text-pandora-neon">
                <CheckCircle2 size={14} /> Ready to submit
              </p>
            )}
            {error && (
              <p className="flex items-center gap-2 text-xs text-pandora-pink">
                <AlertCircle size={14} /> {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
