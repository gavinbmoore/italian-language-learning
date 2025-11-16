/**
 * Anki Card Content Renderer
 * Renders card content with support for:
 * - HTML formatting
 * - Images
 * - Audio
 * - Cloze deletions
 */

import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface AnkiCardContentProps {
  html: string;
  audioFiles?: string[];
  className?: string;
  deckId: string;
}

export function AnkiCardContent({ html, audioFiles = [], className = '', deckId }: AnkiCardContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [processedHtml, setProcessedHtml] = useState('');

  useEffect(() => {
    // Process the HTML content
    const processed = processCardContent(html, deckId);
    setProcessedHtml(processed);
  }, [html, deckId]);

  // Auto-play audio when content changes
  useEffect(() => {
    if (audioFiles.length > 0 && contentRef.current) {
      // Find all audio players in the content
      const audioElements = contentRef.current.querySelectorAll('audio');
      audioElements.forEach((audio) => {
        audio.load(); // Ensure audio is loaded
      });
    }
  }, [audioFiles, processedHtml]);

  return (
    <div className={`anki-card-content ${className}`}>
      <div
        ref={contentRef}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
        className="prose prose-sm dark:prose-invert max-w-none"
      />
      {/* Audio files listed separately (if not embedded in content) */}
      {audioFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {audioFiles.map((filename, idx) => (
            <AudioPlayer key={idx} filename={filename} deckId={deckId} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Audio player component for Anki audio files
 */
function AudioPlayer({ filename, deckId }: { filename: string; deckId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
      <Button
        size="sm"
        variant="ghost"
        onClick={handlePlay}
        className="flex items-center gap-2"
      >
        <Volume2 className={`h-4 w-4 ${isPlaying ? 'text-primary' : ''}`} />
        <span className="text-xs">{filename}</span>
      </Button>
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      >
        <source src={`${API_BASE_URL}/api/v1/protected/anki/decks/${deckId}/media/${encodeURIComponent(filename)}`} />
      </audio>
    </div>
  );
}

/**
 * Process card content:
 * - Sanitize HTML
 * - Replace image references with proper URLs
 * - Replace sound tags with audio players
 * - Process cloze deletions
 */
function processCardContent(html: string, deckId: string): string {
  let processed = html;

  // Replace [sound:filename.mp3] with embedded audio player
  processed = processed.replace(
    /\[sound:([^\]]+)\]/g,
    (match, filename) => {
      return `<div class="inline-flex items-center">
        <audio controls class="inline-block max-w-xs">
          <source src="${API_BASE_URL}/api/v1/protected/anki/decks/${deckId}/media/${encodeURIComponent(filename)}" />
          Your browser does not support audio.
        </audio>
      </div>`;
    }
  );

  // Replace image src attributes to point to our media endpoint
  // Anki images are referenced as <img src="filename.jpg">
  processed = processed.replace(
    /<img([^>]+)src=["']([^"']+)["']/g,
    (match, attrs, src) => {
      // Only process if not already a full URL
      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
        const mediaUrl = `${API_BASE_URL}/api/v1/protected/anki/decks/${deckId}/media/${encodeURIComponent(src)}`;
        return `<img${attrs}src="${mediaUrl}" loading="lazy"`;
      }
      return match;
    }
  );

  // Style cloze deletions (if any remain as [...])
  processed = processed.replace(
    /\[\.\.\.]/g,
    '<span class="inline-block px-3 py-1 bg-primary/20 text-primary rounded border border-primary/30 font-mono">[...]</span>'
  );

  // Sanitize HTML to prevent XSS
  processed = DOMPurify.sanitize(processed, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'span', 'div',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'img', 'audio', 'source', 'table', 'tr', 'td', 'th',
      'pre', 'code', 'blockquote', 'a', 'sup', 'sub',
    ],
    ALLOWED_ATTR: [
      'class', 'style', 'src', 'alt', 'title', 'href', 'target',
      'controls', 'loading', 'width', 'height',
    ],
    ALLOW_DATA_ATTR: false,
  });

  return processed;
}

/**
 * Extract media filenames from HTML content
 */
export function extractMediaFromHTML(html: string): {
  images: string[];
  audio: string[];
} {
  const images: string[] = [];
  const audio: string[] = [];

  // Extract image filenames
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
      images.push(src);
    }
  }

  // Extract audio filenames from [sound:] tags
  const soundRegex = /\[sound:([^\]]+)\]/g;
  while ((match = soundRegex.exec(html)) !== null) {
    audio.push(match[1]);
  }

  return { images, audio };
}

