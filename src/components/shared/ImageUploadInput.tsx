import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, Link, Loader2, X, Image as ImageIcon } from "lucide-react";

interface ImageUploadInputProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  bucket?: string;
  folder?: string;
  accept?: string;
  required?: boolean;
  previewVariant?: "video" | "logo";
}

export const ImageUploadInput = ({
  value,
  onChange,
  label = "Image",
  bucket = "homepage-assets",
  folder = "images",
  accept = "image/*",
  required = false,
  previewVariant = "video",
}: ImageUploadInputProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [inputMode, setInputMode] = useState<"upload" | "url">(value?.startsWith("http") && !value.includes(bucket) ? "url" : "upload");
  const [urlInput, setUrlInput] = useState(value || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast.success("Image uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image: " + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      toast.success("Image URL saved");
    }
  };

  const handleClear = () => {
    onChange("");
    setUrlInput("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {label && <Label>{label}{required && " *"}</Label>}
      
      <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "upload" | "url")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-2">
            <Link className="h-4 w-4" />
            URL
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="mt-3">
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileUpload}
              className="hidden"
              id={`file-upload-${label}`}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Choose File
                </>
              )}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="url" className="mt-3">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/image.jpg"
              onBlur={handleUrlSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
            >
              Set
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview */}
      {value && (
        <div className="relative">
          {previewVariant === "logo" ? (
            <div className="bg-muted rounded-lg overflow-hidden border h-48 w-full flex items-center justify-center p-3">
              <img
                src={value}
                alt="Preview"
                className="max-w-full max-h-full w-auto h-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border">
              <img
                src={value}
                alt="Preview"
                className="absolute inset-0 block w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground mt-1 truncate">{value}</p>
        </div>
      )}

      {!value && (
        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border border-dashed">
          <div className="text-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">No image selected</p>
          </div>
        </div>
      )}
    </div>
  );
};
