"use client";

import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import {
  Copy,
  RefreshCw,
  Clock,
  Zap,
  Database,
  Settings2,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResponseMetadata {
  modelName?: string;
  totalDuration?: number;
  loadDuration?: number;
  promptEvalCount?: number;
  promptEvalDuration?: number;
  evalCount?: number;
  evalDuration?: number;
  timestamp?: string;
  inferenceLocation?: "local" | "cloud";
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  contextWindow?: number;
}

interface ResponseMetadataHoverCardProps {
  children: React.ReactNode;
  metadata: ResponseMetadata;
  responseContent: string;
  onRegenerate?: () => void;
  className?: string;
}

export function ResponseMetadataHoverCard({
  children,
  metadata,
  responseContent,
  onRegenerate,
  className,
}: ResponseMetadataHoverCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(responseContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate tokens per second
  const tokensPerSecond =
    metadata.evalCount && metadata.evalDuration
      ? (metadata.evalCount / (metadata.evalDuration / 1_000_000_000)).toFixed(
          2,
        )
      : null;

  // Calculate total tokens
  const totalTokens =
    (metadata.promptEvalCount || 0) + (metadata.evalCount || 0);

  // Convert nanoseconds to milliseconds
  const totalMs = metadata.totalDuration
    ? (metadata.totalDuration / 1_000_000).toFixed(0)
    : null;

  const loadMs = metadata.loadDuration
    ? (metadata.loadDuration / 1_000_000).toFixed(0)
    : null;

  const promptEvalMs = metadata.promptEvalDuration
    ? (metadata.promptEvalDuration / 1_000_000).toFixed(0)
    : null;

  const evalMs = metadata.evalDuration
    ? (metadata.evalDuration / 1_000_000).toFixed(0)
    : null;

  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <div className={cn("cursor-default", className)}>{children}</div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-80 p-3 mt-3 text-xs"
      >
        <div className="space-y-3">
          {/* Model Info */}
          {metadata.modelName && (
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{metadata.modelName}</span>
              </div>
              {metadata.inferenceLocation && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="text-[10px] uppercase">
                    {metadata.inferenceLocation}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Performance Metrics */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
              <Zap className="h-3 w-3" />
              <span className="font-medium text-foreground">Performance</span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pl-5">
              {tokensPerSecond && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Speed:</span>
                  <span className="font-mono">{tokensPerSecond} t/s</span>
                </div>
              )}
              {totalMs && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-mono">{totalMs}ms</span>
                </div>
              )}
              {loadMs && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Load:</span>
                  <span className="font-mono">{loadMs}ms</span>
                </div>
              )}
              {evalMs && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Eval:</span>
                  <span className="font-mono">{evalMs}ms</span>
                </div>
              )}
            </div>
          </div>

          {/* Token Usage */}
          {(metadata.promptEvalCount || metadata.evalCount) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <Clock className="h-3 w-3" />
                <span className="font-medium text-foreground">Tokens</span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pl-5">
                {metadata.promptEvalCount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input:</span>
                    <span className="font-mono">
                      {metadata.promptEvalCount}
                    </span>
                  </div>
                )}
                {metadata.evalCount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Output:</span>
                    <span className="font-mono">{metadata.evalCount}</span>
                  </div>
                )}
                {totalTokens > 0 && (
                  <div className="flex justify-between col-span-2 pt-1 border-t">
                    <span className="text-muted-foreground font-medium">
                      Total:
                    </span>
                    <span className="font-mono font-medium">{totalTokens}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Model Parameters */}
          {(metadata.temperature !== undefined ||
            metadata.topP !== undefined ||
            metadata.maxTokens !== undefined ||
            metadata.contextWindow !== undefined) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <Settings2 className="h-3 w-3" />
                <span className="font-medium text-foreground">Parameters</span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pl-5">
                {metadata.temperature !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Temperature:</span>
                    <span className="font-mono">{metadata.temperature}</span>
                  </div>
                )}
                {metadata.topP !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Top-P:</span>
                    <span className="font-mono">{metadata.topP}</span>
                  </div>
                )}
                {metadata.maxTokens !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max tokens:</span>
                    <span className="font-mono">{metadata.maxTokens}</span>
                  </div>
                )}
                {metadata.contextWindow !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Context:</span>
                    <span className="font-mono">{metadata.contextWindow}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          {metadata.timestamp && (
            <div className="text-[10px] text-muted-foreground pt-2 border-t">
              Generated at {new Date(metadata.timestamp).toLocaleString()}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleCopy}
            >
              <Copy className="h-3 w-3 mr-1.5" />
              {copied ? "Copied!" : "Copy"}
            </Button>
            {onRegenerate && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={onRegenerate}
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Regenerate
              </Button>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
