'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Save, X, Plus, Loader2, Upload } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { teamMembers, teamCategories, teamPositions } from '@/lib/team-data-client';
import type { TeamMember } from '@/lib/team-data-client';
import { updateTeamMember } from './actions';

export default function TeamEditor() {
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>(teamMembers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<TeamMember>>({});

  const startEdit = (member: TeamMember) => {
    setEditingId(member.slug);
    setEditForm({...member});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!editForm.slug) return;

    setSaving(true);
    try {
      const result = await updateTeamMember(editForm as TeamMember);
      
      if (result.success) {
        setMembers(prev => 
          prev.map(m => m.slug === editForm.slug ? editForm as TeamMember : m)
        );
        toast({
          title: 'Success!',
          description: 'Team member updated successfully',
        });
        cancelEdit();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'profileImage' | 'truckImage') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Here you would upload to Vercel Blob and get back a URL
    // For now, just show a toast
    toast({
      title: 'Upload image',
      description: 'Image upload functionality coming soon. For now, paste a Google Drive link.',
    });
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="font-headline text-4xl font-bold mb-2">Team Members</h1>
        <p className="text-muted-foreground">Manage your team member profiles</p>
      </div>

      <div className="grid gap-6">
        {members.map((member) => {
          const isEditing = editingId === member.slug;

          return (
            <Card key={member.slug}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage 
                        src={isEditing ? editForm.profileImage : member.profileImage} 
                        alt={member.name} 
                      />
                      <AvatarFallback>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle>{member.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{member.position}</p>
                    </div>
                  </div>
                  {!isEditing && (
                    <Button variant="outline" onClick={() => startEdit(member)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>

              {isEditing && (
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={editForm.category}
                        onValueChange={(val) => setEditForm({...editForm, category: val as any})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {teamCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="position">Position</Label>
                      <Select
                        value={editForm.position}
                        onValueChange={(val) => setEditForm({...editForm, position: val})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {editForm.category && teamPositions[editForm.category]?.map(pos => (
                            <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="displayOrder">Display Order</Label>
                      <Input
                        id="displayOrder"
                        type="number"
                        value={editForm.displayOrder || 0}
                        onChange={(e) => setEditForm({...editForm, displayOrder: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input
                      id="tagline"
                      value={editForm.tagline || ''}
                      onChange={(e) => setEditForm({...editForm, tagline: e.target.value})}
                      placeholder="A brief one-line description"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={editForm.bio || ''}
                      onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                      className="min-h-[150px]"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="profileImage">Profile Image URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="profileImage"
                          value={editForm.profileImage || ''}
                          onChange={(e) => setEditForm({...editForm, profileImage: e.target.value})}
                          placeholder="Paste Google Drive link or upload"
                        />
                        <Button variant="outline" size="icon" asChild>
                          <label>
                            <Upload className="h-4 w-4" />
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => handleImageUpload(e, 'profileImage')}
                            />
                          </label>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="truckImage">Truck Image URL (Optional)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="truckImage"
                          value={editForm.truckImage || ''}
                          onChange={(e) => setEditForm({...editForm, truckImage: e.target.value})}
                          placeholder="Paste Google Drive link or upload"
                        />
                        <Button variant="outline" size="icon" asChild>
                          <label>
                            <Upload className="h-4 w-4" />
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => handleImageUpload(e, 'truckImage')}
                            />
                          </label>
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
