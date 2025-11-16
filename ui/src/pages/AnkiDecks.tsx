/**
 * Anki Decks Library Page
 * Shows all imported Anki decks with statistics
 * Allows importing new decks and studying existing ones
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/serverComm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, BookOpen, Trash2, Play, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AnkiDeck {
  id: string;
  name: string;
  description: string;
  card_count: number;
  imported_at: string;
  last_studied_at: string | null;
  stats: {
    totalCards: number;
    newCards: number;
    learningCards: number;
    reviewCards: number;
    dueCards: number;
    masteredCards: number;
  };
}

export function AnkiDecks() {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<AnkiDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  const loadDecks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getAnkiDecks();
      setDecks(response.decks || []);
    } catch (error) {
      console.error('Error loading decks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.apkg')) {
        setImportError('Please select an .apkg file');
        return;
      }
      setSelectedFile(file);
      setImportError('');
      // Suggest name from filename
      if (!customName) {
        setCustomName(file.name.replace('.apkg', ''));
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setImportError('Please select a file');
      return;
    }

    try {
      setImporting(true);
      setImportError('');
      
      console.log('Importing deck:', selectedFile.name);
      await api.importAnkiDeck(selectedFile, customName || undefined);
      
      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        setImportDialogOpen(false);
        setSelectedFile(null);
        setCustomName('');
        loadDecks(); // Reload decks
      }, 2000);
    } catch (error: any) {
      console.error('Error importing deck:', error);
      setImportError(error.message || 'Failed to import deck');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteDeck = async (deckId: string, deckName: string) => {
    if (!confirm(`Are you sure you want to delete "${deckName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteAnkiDeck(deckId);
      loadDecks(); // Reload decks
    } catch (error) {
      console.error('Error deleting deck:', error);
      alert('Failed to delete deck');
    }
  };

  const handleStudyDeck = (deckId: string) => {
    navigate(`/anki-decks/${deckId}/study`);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Anki Decks</h1>
          <p className="text-muted-foreground">
            Import and study your Anki flashcard decks
          </p>
        </div>
        <Button
          onClick={() => setImportDialogOpen(true)}
          className="btn-press bg-gradient-to-r from-primary to-primary/80"
        >
          <Upload className="h-4 w-4 mr-2" />
          Import Deck
        </Button>
      </div>

      {/* Deck Grid */}
      {decks.length === 0 ? (
        <Card className="glass-card border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Decks Yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Import your first Anki deck to start studying. You can download decks from AnkiWeb or export them from the Anki desktop app.
            </p>
            <Button onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import Your First Deck
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <Card
              key={deck.id}
              className="glass-card hover:shadow-lg transition-all cursor-pointer"
              onClick={() => handleStudyDeck(deck.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-xl mb-1 truncate">
                      {deck.name}
                    </CardTitle>
                    {deck.description && (
                      <CardDescription className="text-sm line-clamp-2">
                        {deck.description}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDeck(deck.id, deck.name);
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Statistics */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Cards</span>
                    <span className="font-semibold">{deck.stats.totalCards}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Badge variant="secondary" className="bg-due/10 text-due border-due/30">
                        {deck.stats.dueCards} Due
                      </Badge>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">
                        {deck.stats.newCards} New
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Badge variant="secondary" className="bg-learning/10 text-learning border-learning/30">
                        {deck.stats.learningCards} Learning
                      </Badge>
                      <Badge variant="secondary" className="bg-mastered/10 text-mastered border-mastered/30">
                        {deck.stats.masteredCards} Mastered
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Study Button */}
                <Button
                  className="w-full btn-press bg-gradient-to-r from-primary to-primary/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStudyDeck(deck.id);
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Study Now
                </Button>

                {/* Last Studied */}
                <div className="text-xs text-muted-foreground mt-3 text-center">
                  Last studied: {formatDate(deck.last_studied_at)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg glass-card">
          <DialogHeader>
            <DialogTitle className="text-2xl">Import Anki Deck</DialogTitle>
            <DialogDescription>
              Upload an .apkg file exported from Anki or downloaded from AnkiWeb
            </DialogDescription>
          </DialogHeader>

          {importSuccess ? (
            <div className="py-12 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-semibold text-mastered mb-2">
                Deck Imported Successfully!
              </h3>
              <p className="text-muted-foreground">
                Your deck is now ready to study
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Input */}
              <div className="space-y-2">
                <Label htmlFor="deck-file">Select .apkg File</Label>
                <Input
                  id="deck-file"
                  type="file"
                  accept=".apkg"
                  onChange={handleFileSelect}
                  disabled={importing}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* Custom Name */}
              <div className="space-y-2">
                <Label htmlFor="deck-name">Deck Name (optional)</Label>
                <Input
                  id="deck-name"
                  placeholder="Leave blank to use original name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={importing}
                />
              </div>

              {/* Error Alert */}
              {importError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{importError}</AlertDescription>
                </Alert>
              )}

              {/* Import Button */}
              <Button
                className="w-full"
                onClick={handleImport}
                disabled={!selectedFile || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Deck
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

