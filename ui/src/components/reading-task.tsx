import { useState, useEffect } from 'react';
import { api } from '@/lib/serverComm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, BookOpen } from 'lucide-react';
import { ReadingReview } from './reading-review';

interface ReadingTextData {
  id: string;
  title: string;
  content: string;
  source_topic: string;
  difficulty_level: string;
  vocabulary_used: string[];
}

interface ReadingTaskProps {
  textId: string;
  onComplete: () => void;
  onClose: () => void;
}

export function ReadingTask({ textId, onComplete, onClose }: ReadingTaskProps) {
  const [text, setText] = useState<ReadingTextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unknownWords, setUnknownWords] = useState<Set<string>>(new Set());
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    loadReadingText();
  }, [textId]);

  const loadReadingText = async () => {
    try {
      setLoading(true);
      const response = await api.getReadingText(textId);
      setText(response.text);
    } catch (error) {
      console.error('Error loading reading text:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWordClick = (word: string) => {
    const normalizedWord = word.toLowerCase().trim();
    const newUnknownWords = new Set(unknownWords);
    
    if (newUnknownWords.has(normalizedWord)) {
      newUnknownWords.delete(normalizedWord);
    } else {
      newUnknownWords.add(normalizedWord);
    }
    
    setUnknownWords(newUnknownWords);
  };

  const renderClickableText = (content: string) => {
    // Split text into words and punctuation, preserving Italian characters
    // Use \p{L}+ for words (includes accented chars) and match everything else
    const regex = /([\p{L}]+|[^\p{L}\s]+|\s+)/gu;
    const parts = content.match(regex) || [];

    return (
      <div className="leading-relaxed text-lg">
        {parts.map((part, idx) => {
          // Check if this is a word (contains letters)
          const isWord = /[\p{L}]+/u.test(part);
          if (isWord) {
            const normalizedWord = part.toLowerCase().trim();
            const isSelected = unknownWords.has(normalizedWord);
            
            const selectedClass = isSelected
              ? 'bg-learning/40 dark:bg-learning/30 font-semibold ring-2 ring-learning/50'
              : '';
            
            return (
              <span
                key={idx}
                onClick={() => handleWordClick(part)}
                className={`cursor-pointer inline-block rounded px-1 transition-all duration-150 hover:bg-learning/20 hover:scale-105 ${selectedClass}`}
                title="Click to mark as unknown"
              >
                {part}
              </span>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };

  const handleFinishReading = () => {
    console.log('Finishing reading with unknown words:', unknownWords.size);
    console.log('Words:', Array.from(unknownWords));
    setShowReview(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading reading task...</p>
        </div>
      </div>
    );
  }

  if (!text) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium mb-2">Failed to load reading task</p>
            <Button onClick={onClose}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showReview) {
    return (
      <ReadingReview
        textId={textId}
        textTitle={text.title}
        unknownWords={Array.from(unknownWords)}
        textContent={text.content}
        answers={[]} // No questions, so no answers
        totalQuestions={0} // No questions
        onComplete={onComplete}
      />
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={onClose}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tasks
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{text.title}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{text.difficulty_level}</Badge>
              <span className="text-sm text-muted-foreground">
                {text.source_topic}
              </span>
            </div>
          </div>
          {unknownWords.size > 0 && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Words Selected</p>
              <p className="text-2xl font-bold text-learning">
                {unknownWords.size}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reading Text */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <CardTitle>Italian Reading</CardTitle>
          </div>
          <CardDescription>
            Click on any word you don't know to select it. Selected words will be reviewed and added to your Anki deck.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* The actual text */}
          <div className="p-4 bg-muted/30 rounded-lg">
            {renderClickableText(text.content)}
          </div>

          {/* Selected words display */}
          {unknownWords.size > 0 && (
            <div className="p-4 bg-learning/10 rounded-lg border-2 border-learning/40">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-learning">
                  📝 Selected Words ({unknownWords.size})
                </p>
                <p className="text-xs text-muted-foreground">
                  Will be added to Anki
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from(unknownWords).map(word => (
                  <Badge 
                    key={word} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-destructive/20 transition-colors" 
                    onClick={() => handleWordClick(word)}
                  >
                    {word} ×
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                💡 Click a word badge to remove it
              </p>
            </div>
          )}

          {/* Finish button */}
          <div className="flex justify-center pt-4">
            <Button 
              onClick={handleFinishReading} 
              size="lg"
              className="min-w-[200px]"
            >
              {unknownWords.size > 0 
                ? `Review ${unknownWords.size} ${unknownWords.size === 1 ? 'Word' : 'Words'}` 
                : 'Finish Reading'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

