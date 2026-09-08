import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { PageHeader } from "@/components/pages/PageHeader";
import { LoadingState } from "@/components/pages/LoadingState";
import { EmptyState } from "@/components/pages/EmptyState";
import { AuthenticatedImage } from "@/components/AuthenticatedImage";
import { VesselConditionMap } from "@/components/corrosion/VesselConditionMap";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fadeInUpVariants } from "@/utils/animations";
import { ShieldAlert, Loader2, FileDown, Plus, Clock, CheckCircle2, XCircle, History } from "lucide-react";
import {
  listMobileInspectSurveys,
  getMobileInspectSurvey,
  downloadSurveyPdf,
  type SurveySummary,
  type SurveyDetail,
  type SurveyPart,
} from "@/lib/api/mobileInspect";
import { apiRequest, apiUrl } from "@/lib/api/config";
import {
  listActionItems,
  createActionItem,
  updateActionItem,
  type ActionItem,
  type ActionSeverity,
} from "@/lib/api/actions";

const PIXEL_DISCLAIMER =
  "% of a photo's pixels tagged as rust, not % of the real steel surface.";

const SEVERITY_STYLES: Record<string, string> = {
  low: "border-green-500 text-green-600",
  medium: "border-yellow-500 text-yellow-600",
  high: "border-orange-500 text-orange-600",
  critical: "border-red-500 text-red-600",
};

function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  if (!severity) return <Badge variant="outline">Unknown</Badge>;
  return (
    <Badge variant="outline" className={SEVERITY_STYLES[severity] || ""}>
      {severity.toUpperCase()}
    </Badge>
  );
}

function StatusBadge({ status, isOverdue }: { status: string; isOverdue?: boolean }) {
  if (isOverdue) {
    return <Badge variant="destructive">Overdue</Badge>;
  }
  const variant = status === "approved" || status === "completed" ? "secondary" : "outline";
  return <Badge variant={variant}>{status.replace("_", " ")}</Badge>;
}

function formatPct(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
}

function formatDate(d: string | null | undefined): string {
  return d ? new Date(d).toLocaleDateString() : "—";
}

type AuditEntry = {
  logId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  userId: string | null;
  details?: Record<string, unknown>;
  timestamp: string;
};

export default function CorrosionDashboardPage() {
  const { sessionReady, user, profile, company, hasPermission, loading: profileLoading } = useProfile();
  const { toast } = useToast();

  const companyName = company?.name || (profile as { companies?: { name?: string } })?.companies?.name || "";
  const canManage = hasPermission("manageActions");
  const canApprove = hasPermission("approveActions");

  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectName, setSelectedProjectName] = useState("");

  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);
  const [selectedSurveyName, setSelectedSurveyName] = useState("");

  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(false);

  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [exportingPdf, setExportingPdf] = useState(false);

  // filename(s) of the latest completed visit's photos, per area — the
  // survey endpoint only returns aggregate stats, so one extra fetch per
  // area's job pulls the actual image list to render a thumbnail.
  const [partImages, setPartImages] = useState<Record<string, string[]>>({});

  const [activeTab, setActiveTab] = useState("condition");

  const [raiseDialogPart, setRaiseDialogPart] = useState<SurveyPart | null>(null);
  const [raiseTitle, setRaiseTitle] = useState("");
  const [raiseDescription, setRaiseDescription] = useState("");
  const [raiseSeverity, setRaiseSeverity] = useState<ActionSeverity>("medium");
  const [raiseDueDate, setRaiseDueDate] = useState("");
  const [raising, setRaising] = useState(false);

  // --- Load projects ---
  const loadProjects = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("company_id", profile.company_id)
        .eq("project_type", "corrosion")
        .order("name", { ascending: true });
      if (error) throw error;
      const list = (data || []).map((p) => ({ id: String(p.id), name: String(p.name) }));
      setProjects(list);
      // Most companies only have one vessel — default to it instead of
      // making the user open a dropdown to pick the only option.
      if (list.length > 0) {
        setSelectedProjectName((prev) => (prev && list.some((p) => p.name === prev) ? prev : list[0].name));
      }
    } catch (err) {
      toast({
        title: "Could not load projects (vessels)",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingProjects(false);
    }
  }, [profile?.company_id, toast]);

  useEffect(() => {
    if (!sessionReady || profileLoading) return;
    if (user && profile?.company_id) loadProjects();
  }, [sessionReady, user, profile?.company_id, profileLoading, loadProjects]);

  // --- Load surveys for the selected project ---
  const loadSurveys = useCallback(async () => {
    if (!companyName || !selectedProjectName) {
      setSurveys([]);
      setSelectedSurveyName("");
      return;
    }
    setLoadingSurveys(true);
    try {
      const res = await listMobileInspectSurveys(companyName, selectedProjectName);
      setSurveys(res.surveys || []);
      if (res.surveys?.length && !res.surveys.some((s) => s.surveyName === selectedSurveyName)) {
        setSelectedSurveyName(res.surveys[0].surveyName);
      }
    } catch (err) {
      toast({
        title: "Could not load surveys",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingSurveys(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, selectedProjectName]);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  // --- Load survey detail (condition by area) ---
  const loadSurvey = useCallback(async () => {
    if (!companyName || !selectedProjectName || !selectedSurveyName) {
      setSurvey(null);
      return;
    }
    setLoadingSurvey(true);
    try {
      const res = await getMobileInspectSurvey(companyName, selectedProjectName, selectedSurveyName);
      setSurvey(res.survey);
    } catch (err) {
      toast({
        title: "Could not load survey",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingSurvey(false);
    }
  }, [companyName, selectedProjectName, selectedSurveyName, toast]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  // Fetch one photo's filename per area, for the condition-by-area thumbnails.
  useEffect(() => {
    if (!survey) {
      setPartImages({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        survey.parts
          .filter((p) => p.latestCompleted)
          .map(async (p) => {
            try {
              const res = await apiRequest<{ results?: { images?: { filename: string }[] } }>(
                `/inference/${p.latestCompleted!.inferenceId}/results`
              );
              const filenames = (res.results?.images || []).map((i) => i.filename).slice(0, 1);
              return [p.regionName, filenames] as const;
            } catch {
              return [p.regionName, []] as const;
            }
          })
      );
      if (!cancelled) setPartImages(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [survey]);

  // --- Load action items for the project ---
  const loadActions = useCallback(async () => {
    if (!companyName || !selectedProjectName) {
      setActions([]);
      return;
    }
    setLoadingActions(true);
    try {
      const res = await listActionItems({ company: companyName, project: selectedProjectName, limit: 200 });
      setActions(res.actions || []);
    } catch (err) {
      toast({
        title: "Could not load actions",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingActions(false);
    }
  }, [companyName, selectedProjectName, toast]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  // --- Load audit history for the project ---
  const loadAudit = useCallback(async () => {
    if (!companyName || !selectedProjectName) {
      setAuditEntries([]);
      return;
    }
    setLoadingAudit(true);
    try {
      const qs = new URLSearchParams({
        company: companyName,
        project: selectedProjectName,
        resourceType: "action_item",
        limit: "50",
      });
      const res = await apiRequest<{ logs?: AuditEntry[] }>(`/audit/log?${qs.toString()}`);
      setAuditEntries(res.logs || []);
    } catch (err) {
      toast({
        title: "Could not load audit history",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingAudit(false);
    }
  }, [companyName, selectedProjectName, toast]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const openActions = useMemo(
    () => actions.filter((a) => !["approved", "rejected", "completed"].includes(a.status)),
    [actions]
  );
  const overdueActions = useMemo(() => openActions.filter((a) => a.isOverdue), [openActions]);
  const approvedByRegion = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const a of actions) {
      if (!a.regionName || !["approved", "completed"].includes(a.status)) continue;
      if (!map.has(a.regionName)) map.set(a.regionName, []);
      map.get(a.regionName)!.push(a);
    }
    return map;
  }, [actions]);

  const openRaiseDialog = (part: SurveyPart) => {
    setRaiseDialogPart(part);
    setRaiseTitle(`Follow-up: ${part.regionName}`);
    setRaiseDescription("");
    setRaiseSeverity(part.severityBand || "medium");
    setRaiseDueDate("");
  };

  const submitRaiseAction = async () => {
    if (!raiseDialogPart || !companyName || !selectedProjectName) return;
    if (!raiseTitle.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setRaising(true);
    try {
      await createActionItem({
        company: companyName,
        project: selectedProjectName,
        surveyName: selectedSurveyName,
        regionName: raiseDialogPart.regionName,
        inferenceId: raiseDialogPart.latestCompleted?.inferenceId || null,
        title: raiseTitle.trim(),
        description: raiseDescription.trim(),
        severity: raiseSeverity,
        dueDate: raiseDueDate || null,
        findingSnapshot: {
          meanCorrosionPercent: raiseDialogPart.meanCorrosionPercent,
          byClass: raiseDialogPart.byClass,
        },
      });
      toast({ title: "Action raised", description: `"${raiseTitle.trim()}" added for ${raiseDialogPart.regionName}.` });
      setRaiseDialogPart(null);
      loadActions();
      loadAudit();
    } catch (err) {
      toast({
        title: "Could not raise action",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setRaising(false);
    }
  };

  const approveOrReject = async (action: ActionItem, status: "approved" | "rejected") => {
    try {
      await updateActionItem(action.actionId, { status });
      toast({ title: status === "approved" ? "Action approved" : "Action rejected" });
      loadActions();
      loadAudit();
    } catch (err) {
      toast({
        title: "Could not update action",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const handleSelectArea = (regionName: string) => {
    setActiveTab("condition");
    requestAnimationFrame(() => {
      document
        .getElementById(`area-${regionName}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const exportPdf = async () => {
    if (!companyName || !selectedProjectName || !selectedSurveyName) return;
    setExportingPdf(true);
    try {
      await downloadSurveyPdf(companyName, selectedProjectName, selectedSurveyName);
    } catch (err) {
      toast({
        title: "Could not export PDF",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  if (!sessionReady || profileLoading) {
    return <LoadingState message="Loading corrosion dashboard..." />;
  }
  if (sessionReady && !user) return null;

  if (!profile?.company_id) {
    return (
      <div>
        <PageHeader title="Corrosion Dashboard" />
        <EmptyState
          icon={ShieldAlert}
          title="No workspace"
          description="You need to be part of a workspace to view the corrosion dashboard."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Corrosion Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Single-vessel condition by area, open actions, and overdue reviews
          </p>
        </div>
        {selectedSurveyName ? (
          <Button onClick={exportPdf} disabled={exportingPdf}>
            {exportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Export PDF
          </Button>
        ) : null}
      </div>

      <motion.div className="space-y-6" variants={fadeInUpVariants} initial="hidden" animate="visible">
        <Card>
          <CardHeader>
            <CardTitle>Vessel & survey</CardTitle>
            <CardDescription>One project is one vessel.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="space-y-2 min-w-[220px]">
              <Label>Vessel (project)</Label>
              <Select
                value={selectedProjectName}
                onValueChange={setSelectedProjectName}
                disabled={loadingProjects || projects.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingProjects ? "Loading..." : "Select a vessel"} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-[260px]">
              <Label>Survey</Label>
              <Select
                value={selectedSurveyName}
                onValueChange={setSelectedSurveyName}
                disabled={loadingSurveys || surveys.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingSurveys ? "Loading..." : surveys.length === 0 ? "No surveys yet" : "Select a survey"} />
                </SelectTrigger>
                <SelectContent>
                  {surveys.map((s) => (
                    <SelectItem key={s.surveyName} value={s.surveyName}>
                      {s.surveyName} · {formatPct(s.overallMeanCorrosionPercent)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!selectedProjectName ? (
          <EmptyState icon={ShieldAlert} title="Select a vessel" description="Choose a vessel above to see its condition." />
        ) : (
          <>
          {survey && survey.parts.length > 0 ? (
            <VesselConditionMap parts={survey.parts} onSelectArea={handleSelectArea} />
          ) : null}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="condition">Condition by area</TabsTrigger>
              <TabsTrigger value="actions">
                Open actions & overdue reviews
                {overdueActions.length > 0 ? (
                  <Badge variant="destructive" className="ml-2">{overdueActions.length}</Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="audit">Audit history</TabsTrigger>
            </TabsList>

            {/* --- Condition by area --- */}
            <TabsContent value="condition" className="space-y-4 pt-4">
              {loadingSurvey ? (
                <LoadingState message="Loading condition..." />
              ) : !survey || survey.parts.length === 0 ? (
                <EmptyState icon={ShieldAlert} title="No inspected areas yet" description="Survey a part with the mobile app first." />
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Overall mean corrosion: <span className="font-medium text-foreground">{formatPct(survey.overallMeanCorrosionPercent)}</span>
                    {" "}· {PIXEL_DISCLAIMER}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {survey.parts.map((part) => (
                      <Card key={part.regionName} id={`area-${part.regionName}`}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base">{part.regionName}</CardTitle>
                            <SeverityBadge severity={part.severityBand} />
                          </div>
                          <CardDescription>
                            {formatPct(part.meanCorrosionPercent)}
                            {part.changeFromPrevious ? (
                              <span className={part.changeFromPrevious.delta > 0 ? "text-red-600" : "text-green-600"}>
                                {" "}({part.changeFromPrevious.delta > 0 ? "+" : ""}{part.changeFromPrevious.delta.toFixed(2)}% since last visit)
                              </span>
                            ) : (
                              " (first completed visit)"
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {part.latestCompleted && partImages[part.regionName]?.[0] ? (
                            <AuthenticatedImage
                              src={apiUrl(
                                `/inference/${part.latestCompleted.inferenceId}/image/${encodeURIComponent(
                                  partImages[part.regionName][0]
                                )}`
                              )}
                              alt={part.regionName}
                              className="w-full h-40 object-cover rounded-md"
                            />
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {part.visitCount} visit(s) · {part.imageCount} photo(s) in latest completed visit
                          </p>

                          {(approvedByRegion.get(part.regionName) || []).length > 0 ? (
                            <div className="text-xs bg-muted rounded p-2">
                              <span className="font-medium">Approved action:</span>{" "}
                              {approvedByRegion.get(part.regionName)![0].title}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">No approved action on file.</div>
                          )}

                          {canManage && (
                            <Button size="sm" variant="outline" onClick={() => openRaiseDialog(part)}>
                              <Plus className="mr-2 h-3.5 w-3.5" />
                              Raise action
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* --- Open actions & overdue reviews --- */}
            <TabsContent value="actions" className="space-y-4 pt-4">
              {loadingActions ? (
                <LoadingState message="Loading actions..." />
              ) : openActions.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No open actions" description="Nothing outstanding for this vessel." />
              ) : (
                <div className="space-y-2">
                  {openActions.map((action) => (
                    <Card key={action.actionId}>
                      <CardContent className="flex items-center justify-between gap-4 py-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{action.title}</span>
                            <SeverityBadge severity={action.severity} />
                            <StatusBadge status={action.status} isOverdue={action.isOverdue} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {action.regionName || "(no area)"} · due {formatDate(action.dueDate)} · assigned: {action.assignedTo || "—"}
                          </p>
                          {action.description ? (
                            <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                          ) : null}
                        </div>
                        {canApprove ? (
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="outline" onClick={() => approveOrReject(action, "approved")}>
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => approveOrReject(action, "rejected")}>
                              <XCircle className="mr-1.5 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* --- Audit history --- */}
            <TabsContent value="audit" className="space-y-2 pt-4">
              {loadingAudit ? (
                <LoadingState message="Loading audit history..." />
              ) : auditEntries.length === 0 ? (
                <EmptyState icon={History} title="No audit history yet" description="Actions raised/approved for this vessel will show up here." />
              ) : (
                <div className="space-y-2">
                  {auditEntries.map((entry) => (
                    <div key={entry.logId} className="flex items-center gap-3 text-sm border-b py-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                      <span className="font-medium capitalize">{entry.action}</span>
                      <span className="text-muted-foreground">action item {entry.resourceId}</span>
                      <span className="text-muted-foreground">by {entry.userId || "unknown"}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          </>
        )}
      </motion.div>

      <Dialog open={!!raiseDialogPart} onOpenChange={(open) => !open && setRaiseDialogPart(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise an action — {raiseDialogPart?.regionName}</DialogTitle>
            <DialogDescription>Creates a follow-up task tracked through to approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={raiseTitle} onChange={(e) => setRaiseTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={raiseDescription} onChange={(e) => setRaiseDescription(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-4">
              <div className="space-y-1.5 flex-1">
                <Label>Severity</Label>
                <Select value={raiseSeverity} onValueChange={(v) => setRaiseSeverity(v as ActionSeverity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1">
                <Label>Due date</Label>
                <Input type="date" value={raiseDueDate} onChange={(e) => setRaiseDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRaiseDialogPart(null)}>
              Cancel
            </Button>
            <Button onClick={submitRaiseAction} disabled={raising}>
              {raising ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Raise action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
