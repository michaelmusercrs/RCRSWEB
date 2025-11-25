'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Loader2, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { uploadImage, deleteImage } from './actions';

type ImageCategory = 
  | 'team-profile'
  | 'team-truck'
  | 'blog'
  | 'service'
  | 'location'
  | 'certification'
  | 'static';

interface UploadedImage {
  url: string;
  category: ImageCategory;
  name: string;
  size: number;
}

export default function ImageManager() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<ImageCategory>('team-profile');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No files selected',
        description: 'Please select at least one image to upload.',
      });
      return;
    }

    setUploading(true);
    const uploaded: UploadedImage[] = [];

    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);

        const result = await uploadImage(formData);
        
        if (result.success && result.url) {
          uploaded.push({
            url: result.url,
            category,
            name: file.name,
            size: file.size,
          });
        } else {
          throw new Error(result.message || 'Upload failed');
        }
      }

      setUploadedImages(prev => [...uploaded, ...prev]);
      setSelectedFiles([]);
      
      toast({
        title: 'Upload successful!',
        description: `Successfully uploaded ${uploaded.length} image(s)`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (url: string) => {
    try {
      const result = await deleteImage(url);
      
      if (result.success) {
        setUploadedImages(prev => prev.filter(img => img.url !== url));
        toast({
          title: 'Image deleted',
          description: 'The image has been removed successfully.',
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-headline text-4xl font-bold mb-2">Image Manager</h1>
          <p className="text-muted-foreground">Upload and manage all site images</p>
        </div>

        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload Images</CardTitle>
            <CardDescription>
              Drag and drop images or click to browse. Supports JPG, PNG, WebP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="category">Image Category</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as ImageCategory)}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team-profile">Team Profile Photo</SelectItem>
                  <SelectItem value="team-truck">Team Truck Photo</SelectItem>
                  <SelectItem value="blog">Blog Post Image</SelectItem>
                  <SelectItem value="service">Service Page Image</SelectItem>
                  <SelectItem value="location">Location Page Image</SelectItem>
                  <SelectItem value="certification">Certification Badge</SelectItem>
                  <SelectItem value="static">Static Site Image</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                multiple
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">Drop images here or click to browse</p>
                <p className="text-sm text-muted-foreground">JPG, PNG, or WebP (max 10MB each)</p>
              </label>
            </div>

            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files ({selectedFiles.length})</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0}
              size="lg"
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-5 w-5" />
                  Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'Image' : 'Images'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Uploaded Images Gallery */}
        {uploadedImages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recently Uploaded</CardTitle>
              <CardDescription>Click the × to remove an image</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {uploadedImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(img.url)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-medium truncate">{img.name}</p>
                      <p className="text-xs text-muted-foreground">{img.category}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => {
                        navigator.clipboard.writeText(img.url);
                        toast({ title: 'Copied!', description: 'Image URL copied to clipboard' });
                      }}
                    >
                      Copy URL
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
