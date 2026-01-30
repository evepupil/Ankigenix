"use client";

import { FileText, Sparkles, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeDocumentAction,
  generateFlashcardsAction,
  generateFromOutlineAction,
} from "@/features/flashcards/actions/generate";
import { useTaskStatus } from "@/features/flashcards/hooks/use-task-status";
import { cn } from "@/lib/utils";
import { FileUpload } from "./file-upload";
import { OutlineSelector } from "./outline-selector";
import { TaskStatusDisplay } from "./task-status";

const MAX_TEXT_LENGTH = 1000;
const MIN_TEXT_LENGTH = 10;

type InputMode = "text" | "file";
type FileFlowPhase = "upload" | "analyzing" | "select" | "generating";

interface UploadedFile {
  url: string;
  filename: string;
  fileKey: string;
}

export function GenerateForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<InputMode>("text");
  const [textContent, setTextContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  // Text flow state
  const [textTaskId, setTextTaskId] = useState<string | null>(null);

  // File flow state (two-phase)
  const [fileFlowPhase, setFileFlowPhase] = useState<FileFlowPhase>("upload");
  const [fileTaskId, setFileTaskId] = useState<string | null>(null);

  // Hook for polling file task status
  const { task: fileTask, refresh: refreshFileTask } = useTaskStatus(
    fileTaskId,
    { enabled: !!fileTaskId }
  );

  // Text generation action (legacy flow)
  const { execute: executeTextGenerate, isPending: isTextPending } = useAction(
    generateFlashcardsAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success && data.taskId) {
          setTextTaskId(data.taskId);
          toast.success("Generation started!");
        }
      },
      onError: ({ error }) => {
        handleActionError(error);
      },
    }
  );

  // Phase A: Analyze document
  const { execute: executeAnalyze, isPending: isAnalyzing } = useAction(
    analyzeDocumentAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success && data.taskId) {
          setFileTaskId(data.taskId);
          setFileFlowPhase("analyzing");
          toast.success("Document analysis started!");
        }
      },
      onError: ({ error }) => {
        handleActionError(error);
      },
    }
  );

  // Phase B: Generate from outline
  const { execute: executeFromOutline, isPending: isGeneratingFromOutline } =
    useAction(generateFromOutlineAction, {
      onSuccess: ({ data }) => {
        if (data?.success) {
          setFileFlowPhase("generating");
          refreshFileTask();
          toast.success(`Generation started! (${data.creditsCost} credits)`);
        }
      },
      onError: ({ error }) => {
        handleActionError(error);
      },
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleActionError(error: any) {
    if (error?.serverError) {
      toast.error(error.serverError);
    } else if (error?.validationErrors) {
      const extractErrors = (obj: unknown): string[] => {
        if (!obj || typeof obj !== "object") return [];
        const errors: string[] = [];
        for (const value of Object.values(obj)) {
          if (Array.isArray(value)) {
            for (const item of value) {
              if (typeof item === "string") {
                errors.push(item);
              } else if (item && typeof item === "object" && "_errors" in item) {
                errors.push(...(item._errors as string[]));
              }
            }
          } else if (value && typeof value === "object" && "_errors" in value) {
            errors.push(...((value as { _errors: string[] })._errors));
          }
        }
        return errors;
      };
      const errors = extractErrors(error.validationErrors);
      toast.error(errors.join(", ") || "Validation failed");
    } else {
      toast.error("An unexpected error occurred");
    }
  }

  // Text flow handlers
  const handleTextSubmit = useCallback(() => {
    if (textContent.length < MIN_TEXT_LENGTH) {
      toast.error(`Content must be at least ${MIN_TEXT_LENGTH} characters`);
      return;
    }
    if (textContent.length > MAX_TEXT_LENGTH) {
      toast.error(`Content exceeds ${MAX_TEXT_LENGTH} character limit`);
      return;
    }
    executeTextGenerate({
      sourceType: "text",
      content: textContent,
    });
  }, [textContent, executeTextGenerate]);

  // File flow handlers
  const handleFileAnalyze = useCallback(() => {
    if (!uploadedFile) {
      toast.error("Please upload a file first");
      return;
    }
    executeAnalyze({
      sourceUrl: uploadedFile.url,
      sourceFilename: uploadedFile.filename,
      fileKey: uploadedFile.fileKey,
    });
  }, [uploadedFile, executeAnalyze]);

  const handleSelectChapters = useCallback(
    (selectedChapters: number[]) => {
      if (!fileTaskId) return;
      executeFromOutline({
        taskId: fileTaskId,
        selectedChapters,
      });
    },
    [fileTaskId, executeFromOutline]
  );

  const handleUploadComplete = useCallback(
    (fileUrl: string, filename: string, fileKey: string) => {
      setUploadedFile({ url: fileUrl, filename, fileKey });
    },
    []
  );

  const handleUploadRemove = useCallback(() => {
    setUploadedFile(null);
  }, []);

  const handleTextRetry = useCallback(() => {
    setTextTaskId(null);
  }, []);

  const handleFileRetry = useCallback(() => {
    setFileTaskId(null);
    setFileFlowPhase("upload");
    setUploadedFile(null);
  }, []);

  const handleComplete = useCallback(
    (deckId: string) => {
      setTimeout(() => {
        router.push(`/dashboard/decks/${deckId}`);
      }, 2000);
    },
    [router]
  );

  // Handle outline ready callback
  const handleOutlineReady = useCallback(() => {
    setFileFlowPhase("select");
  }, []);

  // Validation
  const isTextValid =
    textContent.length >= MIN_TEXT_LENGTH &&
    textContent.length <= MAX_TEXT_LENGTH;
  const isFileValid = uploadedFile !== null;
  const canSubmitText = !isTextPending && !textTaskId && isTextValid;
  const canSubmitFile =
    !isAnalyzing && fileFlowPhase === "upload" && isFileValid;

  const characterCountColor = cn(
    "text-sm transition-colors",
    textContent.length === 0
      ? "text-muted-foreground"
      : textContent.length > MAX_TEXT_LENGTH
        ? "text-destructive font-medium"
        : textContent.length >= MIN_TEXT_LENGTH
          ? "text-green-600"
          : "text-muted-foreground"
  );

  // TEXT FLOW: Show task status if we have a taskId
  if (activeTab === "text" && textTaskId) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <TaskStatusDisplay
          taskId={textTaskId}
          onComplete={handleComplete}
          onRetry={handleTextRetry}
        />
        <div className="mt-6 flex justify-center">
          <Button variant="outline" size="lg" onClick={handleTextRetry}>
            Generate Another
          </Button>
        </div>
      </div>
    );
  }

  // FILE FLOW: Show appropriate phase UI
  if (activeTab === "file" && fileFlowPhase !== "upload") {
    // Phase: Analyzing or Generating - show task status
    if (
      fileFlowPhase === "analyzing" ||
      (fileFlowPhase === "generating" && fileTask?.status !== "outline_ready")
    ) {
      return (
        <div className="rounded-xl border bg-card p-8">
          {fileTaskId && (
            <TaskStatusDisplay
              taskId={fileTaskId}
              onComplete={handleComplete}
              onRetry={handleFileRetry}
              onOutlineReady={handleOutlineReady}
            />
          )}
          <div className="mt-6 flex justify-center">
            <Button variant="outline" size="lg" onClick={handleFileRetry}>
              Start Over
            </Button>
          </div>
        </div>
      );
    }

    // Phase: Select chapters - show outline selector
    if (fileFlowPhase === "select" && fileTask?.documentOutline) {
      return (
        <div className="rounded-xl border bg-card p-6">
          <OutlineSelector
            outline={fileTask.documentOutline}
            filename={fileTask.sourceFilename}
            onGenerate={handleSelectChapters}
            isGenerating={isGeneratingFromOutline}
          />
          <div className="mt-4 flex justify-center border-t pt-4">
            <Button variant="ghost" size="sm" onClick={handleFileRetry}>
              Upload a different file
            </Button>
          </div>
        </div>
      );
    }
  }

  // Default: Show input form
  return (
    <div className="rounded-xl border bg-card">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as InputMode)}
        className="w-full"
      >
        {/* Tab Header */}
        <div className="border-b px-6 py-4">
          <TabsList className="h-11 bg-muted/50 p-1">
            <TabsTrigger value="text" className="gap-2 px-6 py-2.5 text-sm">
              <FileText className="size-4" />
              Text Input
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-2 px-6 py-2.5 text-sm">
              <Upload className="size-4" />
              File Upload
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <TabsContent value="text" className="mt-0">
            <div className="space-y-4">
              <Textarea
                placeholder="Paste or type the content you want to turn into flashcards...

For example:
- Study notes from a lecture
- Key concepts from a textbook chapter
- Vocabulary words with definitions
- Important facts or formulas"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                disabled={isTextPending}
                className="min-h-[400px] resize-y text-base leading-relaxed"
              />
              <div className="flex items-center justify-between">
                <p className={characterCountColor}>
                  {textContent.length} / {MAX_TEXT_LENGTH} characters
                  {textContent.length > 0 &&
                    textContent.length < MIN_TEXT_LENGTH && (
                      <span className="ml-2 text-muted-foreground">
                        (need at least {MIN_TEXT_LENGTH})
                      </span>
                    )}
                </p>
                <p className="text-sm text-muted-foreground">
                  Cost:{" "}
                  <span className="font-medium text-foreground">1 credit</span>
                </p>
              </div>

              {/* Submit Button */}
              <div className="mt-4">
                <Button
                  onClick={handleTextSubmit}
                  disabled={!canSubmitText}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Sparkles className="size-5" />
                  {isTextPending ? "Starting..." : "Generate Flashcards"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="file" className="mt-0">
            <div className="space-y-4">
              <FileUpload
                onUploadComplete={handleUploadComplete}
                onRemove={handleUploadRemove}
                disabled={isAnalyzing}
              />

              <div className="rounded-lg border border-dashed bg-muted/20 p-4">
                <h4 className="text-sm font-medium">How it works</h4>
                <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>1. Upload your file (PDF, Word, Markdown)</li>
                  <li>2. We analyze and extract the document structure</li>
                  <li>3. Select which chapters to generate cards from</li>
                  <li>4. Get your flashcards!</li>
                </ol>
                <p className="mt-3 text-xs text-muted-foreground">
                  Document analysis is <strong>free</strong>. You only pay for
                  the chapters you generate.
                </p>
              </div>

              {/* Submit Button */}
              <div className="mt-4">
                <Button
                  onClick={handleFileAnalyze}
                  disabled={!canSubmitFile}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Sparkles className="size-5" />
                  {isAnalyzing ? "Uploading..." : "Analyze Document"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
