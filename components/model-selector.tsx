"use client";

import * as React from "react";
import {
  Brain,
  Check,
  ChevronDown,
  Cloud,
  Eye,
  Pencil,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  hasCapability,
  getCapabilities,
  type Capability,
} from "@/public/modelCapabilities";

interface ModelSelectorProps {
  models: string[];
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

// Capability icons
const capabilityIcons: Record<Capability, React.ReactNode> = {
  text: <Pencil className="inline h-3.5 w-3.5" />,
  tool: <Wrench className="inline h-3.5 w-3.5" />,
  vision: <Eye className="inline h-3.5 w-3.5" />,
  thinking: <Brain className="inline h-3.5 w-3.5" />,
  embedding: <span>🔗</span>,
  cloud: <Cloud className="inline h-3.5 w-3.5" />,
};

export function CompactModelSelector({
  models,
  value,
  onValueChange,
  className,
  placeholder = "Select model",
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const filteredModels = React.useMemo(() => {
    return models.filter((model) => !hasCapability(model, "embedding"));
  }, [models]);

  const selectedModelCapabilities = value ? getCapabilities(value) : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          size="sm"
          className={cn(
            "justify-between rounded-full min-w-[180px]",
            !value && "text-muted-foreground",
            className,
          )}
          disabled={disabled || filteredModels.length === 0}
        >
          <div className="flex items-center gap-1.5 truncate">
            {value ? (
              <>
                {selectedModelCapabilities.length > 0 && (
                  <div className="flex items-center gap-0.5">
                    {selectedModelCapabilities.slice(0, 2).map((cap) => (
                      <span key={cap} className="text-xs">
                        {capabilityIcons[cap]}
                      </span>
                    ))}
                  </div>
                )}
                <span className="truncate text-sm">{value}</span>
              </>
            ) : (
              placeholder
            )}
          </div>
          <ChevronDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-xs p-0" align="end">
        <Command>
          <CommandInput placeholder="Search models..." className="h-9" />
          <ScrollArea className="max-h-[350px]">
            <CommandList>
              <CommandEmpty>No models found.</CommandEmpty>
              <CommandGroup>
                {filteredModels.map((model) => {
                  const capabilities = getCapabilities(model);
                  const isSelected = value === model;

                  return (
                    <CommandItem
                      key={model}
                      value={model}
                      onSelect={(currentValue) => {
                        onValueChange?.(
                          currentValue === value ? "" : currentValue,
                        );
                        setOpen(false);
                      }}
                      className="flex items-center gap-2 py-2"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{model}</span>
                        </div>
                        {capabilities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {capabilities
                              .filter((cap) => cap !== "text")
                              .map((capability) => (
                                <Badge
                                  key={capability}
                                  variant="secondary"
                                  className="text-xs px-1.5 py-0 h-5 font-normal"
                                >
                                  <span className="mr-0.5">
                                    {capabilityIcons[capability]}
                                  </span>
                                  {capability}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
