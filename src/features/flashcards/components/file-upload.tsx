"use client";

import { File, Loader2, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onUploadComplete: (fileUrl: string, filename: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".md", ".txt"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf(".")).toLowerCase();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeBadge(filename: string): string {
  const ext = getFileExtension(filename);
  switch (ext) {
    case ".pdf":
      return "PDF";
    case ".docx":
    case ".doc":
      return "Word";
    case ".md":
      return "Markdown";
    case ".txt":
      return "Text";
    default:
      return "File";
  }
}

export function FileUpload({
  onUploadComplete,
  onRemove,
  disabled = false,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`;
    }
    return null;
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        // Get presigned URL
        const presignedResponse = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            fileSize: file.size,
          }),
        });

        if (!presignedResponse.ok) {
          const errorData = await presignedResponse.json();
          throw new Error(errorData.error || "Failed to get upload URL");
        }

        const { presignedUrl, fileUrl } = await presignedResponse.json();

        // Upload file using XMLHttpRequest for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(progress);
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error("Upload failed"));
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Upload failed"));
          });

          xhr.open("PUT", presignedUrl);
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream"
          );
          xhr.send(file);
        });

        setUploadedUrl(fileUrl);
        onUploadComplete(fileUrl, file.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setSelectedFile(null);
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadComplete]
  );

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      setSelectedFile(file);
      uploadFile(file);
    },
    [validateFile, uploadFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !isUploading) {
        setIsDragOver(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, isUploading, handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading && !uploadedUrl) {
      inputRef.current?.click();
    }
  }, [disabled, isUploading, uploadedUrl]);

  const handleRemove = useCallback(() => {
    setSelectedFile(null);
    setUploadedUrl(null);
    setUploadProgress(0);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onRemove();
  }, [onRemove]);

  // Show uploaded file state
  if (uploadedUrl && selectedFile) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <File className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selectedFile.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">
                {getFileTypeBadge(selectedFile.name)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Show uploading state
  if (isUploading && selectedFile) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selectedFile.name}</p>
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Uploading... {uploadProgress}%
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show drop zone
  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={handleInputChange}
          disabled={disabled}
          className="sr-only"
        />

        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Upload className="size-6 text-muted-foreground" />
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm font-medium">
            {isDragOver
              ? "Drop file here"
              : "Drag and drop a file, or click to select"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, Word, Markdown, or Text (max 10MB)
          </p>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
