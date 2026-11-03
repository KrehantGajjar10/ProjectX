"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ProjectDetailRead } from "@/types/project";
import type {
  KnowledgeCategory,
  QAResponse,
  SearchResultsResponse,
} from "../types/search";
import {
  clientAskQuestion,
  clientPlainSearch,
  SearchClientError,
} from "../lib/search-client";
import { SearchResultCard } from "./search-result-card";
import { QAAnswerCard } from "./qa-answer-card";
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";

interface SearchViewProps {
  project: ProjectDetailRead;
  initialQuery?: string;
  initialResults?: SearchResultsResponse;
}

export function SearchView({
  project,
  initialQuery = "",
  initialResults,
}: SearchViewProps) {
  const [activeTab, setActiveTab] = React.useState<"search" | "qa">("search");

  // Search Mode State
  const [searchQuery, setSearchQuery] = React.useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = React.useState<
    KnowledgeCategory | "all"
  >("all");
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<
    SearchResultsResponse | undefined
  >(initialResults);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  // Q&A Mode State
  const [questionInput, setQuestionInput] = React.useState("");
  const [qaHistory, setQaHistory] = React.useState<QAResponse[]>([]);
  const [isAsking, setIsAsking] = React.useState(false);
  const [qaError, setQaError] = React.useState<string | null>(null);

  // Sequence ref to prevent race conditions from async searches
  const searchSequenceRef = React.useRef(0);

  // Suggested Prompts
  const suggestedQuestions = [
    "What database and ORM are used in this project?",
    "What core features are currently implemented?",
    "What is the system architecture web stack?",
    "Who are the target user personas?",
  ];

  // Execute Plain Search
  const executeSearch = React.useCallback(
    async (queryText: string, cat = selectedCategory, verified = verifiedOnly) => {
      const q = queryText.trim();
      if (!q) {
        setSearchResults(undefined);
        setSearchError(null);
        return;
      }

      const seq = ++searchSequenceRef.current;
      setIsSearching(true);
      setSearchError(null);

      try {
        const res = await clientPlainSearch(project.id, {
          q,
          category: cat,
          verified_only: verified,
          limit: 15,
        });

        // Ensure we only apply results from the latest request
        if (seq === searchSequenceRef.current) {
          setSearchResults(res);
        }
      } catch (err) {
        if (seq === searchSequenceRef.current) {
          const msg =
            err instanceof SearchClientError
              ? err.message
              : "Failed to execute search. Please try again.";
          setSearchError(msg);
        }
      } finally {
        if (seq === searchSequenceRef.current) {
          setIsSearching(false);
        }
      }
    },
    [project.id, selectedCategory, verifiedOnly]
  );

  // Debounced search on typing
  React.useEffect(() => {
    if (activeTab !== "search") return;
    const timeout = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        executeSearch(searchQuery);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchQuery, activeTab, executeSearch]);

  // Handle Search Submission (instant)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      executeSearch(searchQuery);
    }
  };

  // Handle Q&A Submission
  const handleAskSubmit = async (e?: React.FormEvent, directQuestion?: string) => {
    if (e) e.preventDefault();
    const q = (directQuestion || questionInput).trim();
    if (!q || isAsking) return;

    setIsAsking(true);
    setQaError(null);

    try {
      const response = await clientAskQuestion(project.id, {
        question: q,
        verified_only: verifiedOnly,
        top_k: 8,
        include_answer: true,
      });

      setQaHistory((prev) => [response, ...prev]);
      if (!directQuestion) {
        setQuestionInput("");
      }
    } catch (err) {
      const msg =
        err instanceof SearchClientError
          ? err.message
          : "Failed to generate AI response. Please try again.";
      setQaError(msg);
    } finally {
      setIsAsking(false);
    }
  };

  const categories: { label: string; value: KnowledgeCategory | "all" }[] = [
    { label: "All Items", value: "all" },
    { label: "Decisions", value: "decision" },
    { label: "Tasks", value: "task" },
    { label: "Risks", value: "risk" },
    { label: "Milestones", value: "milestone" },
    { label: "Insights", value: "insight" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Search & Contextual AI
            </h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-medium text-primary">
              Hybrid Retrieval
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Search across indexed project documents, verified knowledge records, and ask grounded questions powered by Gemini.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-2xs self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "search"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            Plain Search
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("qa")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "qa"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI Assistant
          </button>
        </div>
      </div>

      {/* Mode A: Plain Search */}
      {activeTab === "search" && (
        <div className="space-y-5">
          {/* Search Input Bar */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search project knowledge, specs, and documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-24 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              <div className="absolute right-2 flex items-center gap-1.5">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults(undefined);
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Clear query"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSearching || !searchQuery.trim()}
                  className="h-8 px-3 text-xs"
                >
                  {isSearching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
            </div>
          </form>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.value);
                    if (searchQuery.trim()) {
                      executeSearch(searchQuery, cat.value, verifiedOnly);
                    }
                  }}
                  className={`rounded-lg px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === cat.value
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:bg-surface"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Verified Only Filter */}
            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground select-none">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => {
                  setVerifiedOnly(e.target.checked);
                  if (searchQuery.trim()) {
                    executeSearch(searchQuery, selectedCategory, e.target.checked);
                  }
                }}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs font-medium">Verified items only</span>
            </label>
          </div>

          {/* Error Banner */}
          {searchError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{searchError}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => executeSearch(searchQuery)}
                className="text-xs text-destructive hover:bg-destructive/15"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {/* Results Summary */}
          {searchResults && !isSearching && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1 border-b border-border/50 pb-2">
              <span>
                Found{" "}
                <strong className="text-foreground">
                  {searchResults.total_results}
                </strong>{" "}
                results for &ldquo;{searchResults.query}&rdquo;
              </span>
              <span className="font-mono text-[11px] capitalize">
                Mode: {searchResults.retrieval_mode.replace("_", " ")}
              </span>
            </div>
          )}

          {/* Loading Shimmer */}
          {isSearching && (
            <div className="space-y-3 py-4">
              <div className="h-24 rounded-xl bg-card/60 border border-border animate-pulse" />
              <div className="h-24 rounded-xl bg-card/60 border border-border animate-pulse" />
              <div className="h-24 rounded-xl bg-card/60 border border-border animate-pulse" />
            </div>
          )}

          {/* Results List */}
          {!isSearching && searchResults && searchResults.results.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {searchResults.results.map((result) => (
                <SearchResultCard
                  key={result.id}
                  item={result}
                  projectId={project.id}
                />
              ))}
            </div>
          )}

          {/* Empty Results State */}
          {!isSearching && searchResults && searchResults.results.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/80 bg-surface/40 p-10 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                No matching results found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No indexed chunks or knowledge claims matched your query. Try broadening your keywords or removing filters.
              </p>
            </div>
          )}

          {/* Initial State / Search Guidance */}
          {!isSearching && !searchResults && (
            <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-8 sm:p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Search Project Knowledge
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Type above to search across technical decisions, tasks, architecture notes, and document excerpts indexed for this project.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mode B: Contextual AI Q&A */}
      {activeTab === "qa" && (
        <div className="space-y-6">
          {/* Question Input Form */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Ask Contextual Question</span>
            </div>

            <form onSubmit={handleAskSubmit} className="space-y-3">
              <div className="relative">
                <textarea
                  rows={3}
                  placeholder="Ask a natural-language question about this project (e.g. 'What database architecture is selected and why?')..."
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground select-none text-xs">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Ground only on verified evidence</span>
                </label>

                <Button
                  type="submit"
                  disabled={isAsking || !questionInput.trim()}
                  className="gap-2 h-9 px-4 text-xs font-medium"
                >
                  {isAsking ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Synthesizing...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Ask Assistant
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Suggested Starter Prompts */}
            <div className="pt-2 border-t border-border/50 space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Suggested Prompts
              </span>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuestionInput(q);
                      handleAskSubmit(undefined, q);
                    }}
                    disabled={isAsking}
                    className="rounded-lg border border-border/70 bg-surface/50 px-2.5 py-1 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-surface hover:border-primary/40 transition-colors"
                  >
                    &ldquo;{q}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Q&A Error Banner */}
          {qaError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{qaError}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAskSubmit()}
                className="text-xs text-destructive hover:bg-destructive/15"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {/* Loading Indicator */}
          {isAsking && (
            <div className="rounded-2xl border border-primary/20 bg-card/60 p-6 sm:p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
                <Sparkles className="h-6 w-6 animate-spin" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Analyzing project sources & synthesizing grounded answer...
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Retrieving relevant document chunks, verifying citations, and generating evidence-backed response via Gemini.
              </p>
            </div>
          )}

          {/* Q&A History Turns */}
          {qaHistory.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span className="font-semibold text-foreground">
                  Answer History ({qaHistory.length})
                </span>
                <button
                  type="button"
                  onClick={() => setQaHistory([])}
                  className="hover:text-foreground transition-colors"
                >
                  Clear History
                </button>
              </div>

              {qaHistory.map((qaItem, idx) => (
                <QAAnswerCard
                  key={idx}
                  response={qaItem}
                  projectId={project.id}
                />
              ))}
            </div>
          )}

          {/* Empty Q&A State */}
          {!isAsking && qaHistory.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-8 sm:p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Ask anything about {project.name}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                ProjectX AI answers questions with strict evidence grounding. Every claim is attributed to specific document chunks with exact excerpts and confidence metrics.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
