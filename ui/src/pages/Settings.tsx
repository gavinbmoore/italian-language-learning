import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { User, Brain } from 'lucide-react';

export function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
  });

  const [grammarSettings, setGrammarSettings] = useState({
    enableCorrections: true,
    correctionStyle: 'gentle', // 'gentle' or 'detailed'
    minimumSeverity: 'medium', // 'low', 'medium', 'high'
    showInlineTips: true,
    includeinLessonSummary: true,
    autoAddWeakConceptsToReview: true,
  });

  const handleSave = () => {
    // TODO: Implement save functionality with API call
    console.log('Saving settings...', { profile, grammarSettings });
    alert('Settings saved! (Note: Settings persistence will be implemented with backend integration)');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        <Separator />

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile
            </CardTitle>
            <CardDescription>
              Update your personal information and profile details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={profile.displayName}
                  onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                  placeholder="Enter your display name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="Enter your email"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grammar Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Grammar Corrections
            </CardTitle>
            <CardDescription>
              Customize how grammar corrections appear during your Italian conversations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable Corrections */}
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="enable-corrections" className="text-base">
                  Enable Grammar Corrections
                </Label>
                <p className="text-sm text-muted-foreground">
                  Show AI-powered grammar tips during conversations
                </p>
              </div>
              <Switch
                id="enable-corrections"
                checked={grammarSettings.enableCorrections}
                onCheckedChange={(checked) =>
                  setGrammarSettings({ ...grammarSettings, enableCorrections: checked })
                }
              />
            </div>

            <Separator />

            {/* Correction Style */}
            <div className="space-y-3">
              <Label htmlFor="correction-style" className="text-base">
                Correction Style
              </Label>
              <select
                id="correction-style"
                value={grammarSettings.correctionStyle}
                onChange={(e) =>
                  setGrammarSettings({ ...grammarSettings, correctionStyle: e.target.value })
                }
                disabled={!grammarSettings.enableCorrections}
                className="w-full px-3 py-2 border rounded-md bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="gentle">
                  ✨ Gentle - Brief, encouraging tips
                </option>
                <option value="detailed">
                  🧠 Detailed - Comprehensive explanations
                </option>
              </select>
              <p className="text-sm text-muted-foreground">
                {grammarSettings.correctionStyle === 'gentle'
                  ? 'Brief, encouraging tips that don\'t interrupt the conversation flow'
                  : 'Comprehensive explanations with grammar rules and examples'}
              </p>
            </div>

            <Separator />

            {/* Minimum Severity */}
            <div className="space-y-3">
              <Label htmlFor="severity" className="text-base">
                Minimum Error Severity
              </Label>
              <select
                id="severity"
                value={grammarSettings.minimumSeverity}
                onChange={(e) =>
                  setGrammarSettings({ ...grammarSettings, minimumSeverity: e.target.value })
                }
                disabled={!grammarSettings.enableCorrections}
                className="w-full px-3 py-2 border rounded-md bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="low">
                  All Errors (Low+) - Show every grammar mistake, even minor ones
                </option>
                <option value="medium">
                  Medium+ Errors - Show important errors that affect meaning (recommended)
                </option>
                <option value="high">
                  Critical Errors Only - Only show serious mistakes that change meaning
                </option>
              </select>
            </div>

            <Separator />

            {/* Additional Options */}
            <div className="space-y-4">
              <Label className="text-base">Additional Options</Label>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="inline-tips" className="font-normal">
                    Show Inline Tips
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Display grammar corrections directly in the chat
                  </p>
                </div>
                <Switch
                  id="inline-tips"
                  checked={grammarSettings.showInlineTips}
                  onCheckedChange={(checked) =>
                    setGrammarSettings({ ...grammarSettings, showInlineTips: checked })
                  }
                  disabled={!grammarSettings.enableCorrections}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="lesson-summary" className="font-normal">
                    Include in Lesson Summary
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show grammar insights when ending a lesson
                  </p>
                </div>
                <Switch
                  id="lesson-summary"
                  checked={grammarSettings.includeinLessonSummary}
                  onCheckedChange={(checked) =>
                    setGrammarSettings({ ...grammarSettings, includeinLessonSummary: checked })
                  }
                  disabled={!grammarSettings.enableCorrections}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-review" className="font-normal">
                    Auto-add Weak Concepts to Review
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically add problematic grammar concepts to your SRS review queue
                  </p>
                </div>
                <Switch
                  id="auto-review"
                  checked={grammarSettings.autoAddWeakConceptsToReview}
                  onCheckedChange={(checked) =>
                    setGrammarSettings({ ...grammarSettings, autoAddWeakConceptsToReview: checked })
                  }
                  disabled={!grammarSettings.enableCorrections}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} className="w-full md:w-auto">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
} 