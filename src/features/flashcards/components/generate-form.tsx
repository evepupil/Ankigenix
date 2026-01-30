"use client";

import { FileText, Sparkles, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { generateFlashcardsAction } from "@/features/flashcards/actions/generate";
import { cn } from "@/lib/utils";
import { FileUpload } from "./file-upload";
import { TaskStatusDisplay } from "./task-status";

const MAX_TEXT_LENGTH = 1000;
const MIN_TEXT_LENGTH = 10;

type InputMode = "text" | "file";

interface UploadedFile {
  url: string;
  filename: string;
}

export function GenerateForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<InputMode>("text");
  const [textContent, setTextContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const { execute, isPending } = useAction(generateFlashcardsAction, {
    onSuccess: ({ data }) => {
      if (data?.success && data.taskId) {
        setTaskId(data.taskId);
        toast.success("Generation started!");
      }
    },
    onError: ({ error }) => {
      if (error.serverError) {
        toast.error(error.serverError);
      } else if (error.validationErrors) {
        const errors = Object.values(error.validationErrors).flat();
        toast.error(errors.join(", ") || "Validation failed");
      } else {
        toast.error("Failed to start generation");
      }
    },
  });

  const handleTextSubmit = useCallback(() => {
    if (textContent.length < MIN_TEXT_LENGTH) {
      toast.error(`Content must be at least ${MIN_TEXT_LENGTH} characters`);
      return;
    }
    if (textContent.length > MAX_TEXT_LENGTH) {
      toast.error(`Content exceeds ${MAX_TEXT_LENGTH} character limit`);
      return;
    }
    execute({
      sourceType: "text",
      content: textContent,
    });
  }, [textContent, execute]);

  const handleFileSubmit = useCallback(() => {
    if (!uploadedFile) {
      toast.error("Please upload a file first");
      return;
    }
    execute({
      sourceType: "file",
      url: uploadedFile.url,
      filename: uploadedFile.filename,
    });
  }, [uploadedFile, execute]);

  const handleSubmit = useCallback(() => {
    if (activeTab === "text") {
      handleTextSubmit();
    } else {
      handleFileSubmit();
    }
  }, [activeTab, handleTextSubmit, handleFileSubmit]);

  const handleUploadComplete = useCallback(
    (fileUrl: string, filename: string) => {
      setUploadedFile({ url: fileUrl, filename });
    },
    []
  );

  const handleUploadRemove = useCallback(() => {
    setUploadedFile(null);
  }, []);

  const handleRetry = useCallback(() => {
    setTaskId(null);
  }, []);

  const handleComplete = useCallback(
    (deckId: string) => {
      setTimeout(() => {
        router.push(`/dashboard/decks/${deckId}`);
      }, 2000);
    },
    [router]
  );

  const isTextValid =
    textContent.length >= MIN_TEXT_LENGTH &&
    textContent.length <= MAX_TEXT_LENGTH;
  const isFileValid = uploadedFile !== null;
  const canSubmit =
    !isPending &&
    !taskId &&
    ((activeTab === "text" && isTextValid) ||
      (activeTab === "file" && isFileValid));

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

  // Show task status if we have a taskId
  if (taskId) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <TaskStatusDisplay
          taskId={taskId}
          onComplete={handleComplete}
          onRetry={handleRetry}
        />
        <div className="mt-6 flex justify-center">
          <Button variant="outline" size="lg" onClick={handleRetry}>
            Generate Another
          </Button>
        </div>
      </div>
    );
  }

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
                disabled={isPending}
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
            </div>
          </TabsContent>

          <TabsContent value="file" className="mt-0">
            <div className="space-y-4">
              <FileUpload
                onUploadComplete={handleUploadComplete}
                onRemove={handleUploadRemove}
                disabled={isPending}
              />
              <p className="text-sm text-muted-foreground">
                Cost:{" "}
                <span className="font-medium text-foreground">3 credits</span>
              </p>
            </div>
          </TabsContent>

          {/* Submit Button */}
          <div className="mt-8">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full gap-2"
              size="lg"
            >
              <Sparkles className="size-5" />
              {isPending ? "Starting Generation..." : "Generate Flashcards"}
            </Button>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
