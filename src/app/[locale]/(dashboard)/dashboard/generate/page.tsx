import { GenerateForm } from "@/features/flashcards/components/generate-form";

export const metadata = {
  title: "Generate Flashcards | Ankigenix",
  description: "Create flashcards from text or files using AI",
};

export default function GeneratePage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Generate Flashcards
        </h1>
        <p className="text-muted-foreground">
          Create flashcards from text or files using AI
        </p>
      </div>
      <div className="max-w-2xl">
        <GenerateForm />
      </div>
    </div>
  );
}
