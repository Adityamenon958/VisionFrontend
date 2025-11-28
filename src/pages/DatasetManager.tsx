import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type UploadStatus = "idle" | "uploading" | "processing" | "ready" | "failed";

interface FolderStats {
  images: number;
  labels: number;
}

interface DatasetMetadata {
  id: string;
  status?: string;
  totalImages?: number;
  sizeBytes?: number;
  thumbnailsGenerated?: boolean;
  trainCount?: number;
  valCount?: number;
  testCount?: number;
  folders?: Record<string, FolderStats>;
}

interface StatusResponse {
  status: string;
  totalImages?: number;
  trainCount?: number;
  valCount?: number;
  testCount?: number;
}

interface FileMetaEntry {
  originalName: string;
  folder: string;
}

const MAX_FILES = 1000;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "txt"];

const DatasetManager = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [version, setVersion] = useState<string>("");

  const [files, setFiles] = useState<File[]>([]);
  const [fileMeta, setFileMeta] = useState<FileMetaEntry[]>([]);

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("Idle");
  const [currentDatasetId, setCurrentDatasetId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);
  const [statusProgress, setStatusProgress] = useState<StatusResponse | null>(
    null,
  );

  const [labelledOpen, setLabelledOpen] = useState<boolean>(false);
  const [unlabelledOpen, setUnlabelledOpen] = useState<boolean>(false);

  // ------- Load auth + project / company -------
  useEffect(() => {
    const init = async () => {
      if (!projectId) {
        toast({
          title: "Invalid URL",
          description: "Project ID is missing.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth?mode=signin");
        return;
      }

      setUser(session.user);

      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, name, company_id")
        .eq("id", projectId)
        .single();

      if (projectError || !projectData) {
        toast({
          title: "Project not found",
          description: "Unable to load this project.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setProject(projectData);

      // Load company name
      if (projectData.company_id) {
        const { data: companyData } = await supabase
          .from("companies")
          .select("name")
          .eq("id", projectData.company_id)
          .single();

        if (companyData?.name) {
          setCompanyName(companyData.name);
        }
      }
    };

    void init();
  }, [projectId, navigate, toast]);

  const displayProjectName = project?.name || "Project";

  // ------- Helper: build fileMeta from folder structure -------
  const buildFileMetaFromFiles = (fileList: FileList): {
    files: File[];
    meta: FileMetaEntry[];
  } => {
    const selectedFiles = Array.from(fileList);

    // Filter + validate
    if (selectedFiles.length > MAX_FILES) {
      throw new Error(`You can upload at most ${MAX_FILES} files.`);
    }

    const validFiles: File[] = [];
    const meta: FileMetaEntry[] = [];

    for (const file of selectedFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        throw new Error(
          "Only .jpg, .jpeg, .png, and .txt files are allowed.",
        );
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`${file.name} exceeds 50 MB file size limit.`);
      }

      // @ts-ignore - webkitRelativePath is available in browsers
      const relPath: string | undefined = file.webkitRelativePath;

      let folder = "dataset"; // default folder if file in root
      if (relPath && relPath.includes("/")) {
        const firstSegment = relPath.split("/")[0]?.trim();
        if (firstSegment) folder = firstSegment;
      }

      validFiles.push(file);
      meta.push({
        originalName: file.name,
        folder,
      });
    }

    return { files: validFiles, meta };
  };

  // ------- File selection for labelled / unlabelled -------
  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;

    try {
      const { files: validFiles, meta } = buildFileMetaFromFiles(fileList);

      setFiles(validFiles);
      setFileMeta(meta);
      setStatusMessage(`Selected ${validFiles.length} files.`);
      setUploadStatus("idle");
      setMetadata(null);
      setStatusProgress(null);
    } catch (err: any) {
      toast({
        title: "Invalid selection",
        description: err.message ?? "File selection failed.",
        variant: "destructive",
      });
    }
  };

  // ------- Poll dataset status -------
  const pollDatasetStatus = useCallback(
    async (datasetId: string) => {
      setUploadStatus("processing");
      setStatusMessage("Processing dataset...");

      const interval = setInterval(async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const token = session?.access_token;

          const res = await fetch(`/api/dataset/${datasetId}/status`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });

          if (!res.ok) {
            throw new Error(`Status check failed with ${res.status}`);
          }

          const json: StatusResponse = await res.json();
          setStatusProgress(json);

          if (json.status === "ready" || json.status === "failed") {
            clearInterval(interval);

            if (json.status === "ready") {
              setUploadStatus("ready");
              setStatusMessage("Dataset is ready.");

              const metaRes = await fetch(`/api/dataset/${datasetId}`, {
                headers: token
                  ? { Authorization: `Bearer ${token}` }
                  : undefined,
              });

              if (metaRes.ok) {
                const metaJson = await metaRes.json();
                setMetadata(metaJson);
              }
            } else {
              setUploadStatus("failed");
              setStatusMessage("Dataset processing failed.");
            }
          } else {
            setStatusMessage("Processing dataset on server...");
          }
        } catch (err: any) {
          clearInterval(interval);
          setUploadStatus("failed");
          setStatusMessage("Failed to check dataset status.");
          toast({
            title: "Status error",
            description: err.message ?? "Could not check dataset status.",
            variant: "destructive",
          });
        }
      }, 3000); // 2–5 seconds as requested (here 3s)
    },
    [toast],
  );

  // ------- Upload handler -------
  const handleUpload = async () => {
    if (!project) {
      toast({
        title: "Missing project",
        description: "Project information is missing.",
        variant: "destructive",
      });
      return;
    }

    if (files.length === 0 || fileMeta.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select a folder with supported files first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadStatus("uploading");
      setStatusMessage("Uploading files...");

      const formData = new FormData();
      formData.append("project", displayProjectName);
      if (companyName) formData.append("company", companyName);
      if (version) formData.append("version", version);

      formData.append("fileMeta", JSON.stringify(fileMeta));

      files.forEach((file) => {
        formData.append("files", file, file.name);
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/dataset/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const json = await res.json();
      const datasetId = json.datasetId as string | undefined;

      if (!datasetId) {
        throw new Error("No datasetId returned from server.");
      }

      setCurrentDatasetId(datasetId);
      setStatusProgress({
        status: json.status,
        totalImages: json.totalImages,
      });

      toast({
        title: "Upload queued",
        description: `Dataset ${datasetId} queued with ${json.totalImages} images.`,
      });

      await pollDatasetStatus(datasetId);
    } catch (err: any) {
      setUploadStatus("failed");
      setStatusMessage("Upload failed.");
      toast({
        title: "Upload failed",
        description: err.message ?? "Something went wrong during upload.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // ------- Render -------
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Top navbar */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1
            className="text-2xl font-bold text-primary cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            VisionM
          </h1>
          <div className="flex gap-4 items-center">
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      {/* Layout: sidebar + main */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-background min-h-[calc(100vh-64px)]">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Project
            </p>
            <p className="mt-1 font-medium">{displayProjectName}</p>
          </div>

          <div className="px-2 py-4 space-y-1">
            <div className="px-4 py-2 text-sm rounded-lg bg-muted font-medium">
              Dataset Manager
            </div>

            <button
              onClick={() =>
                toast({
                  title: "Simulation",
                  description: "Simulation view not implemented yet.",
                })
              }
              className="w-full text-left px-4 py-2 text-sm rounded-lg hover:bg-muted"
            >
              Simulation
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 container mx-auto px-8 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                Upload dataset for {displayProjectName}
              </h2>
              {companyName && (
                <p className="text-sm text-muted-foreground">{companyName}</p>
              )}
            </div>
            <div className="w-64">
              <Label
                htmlFor="version"
                className="text-xs uppercase text-muted-foreground"
              >
                Version (optional)
              </Label>
              <Input
                id="version"
                placeholder="e.g. v1"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
          </div>

          {/* Two boxes: labelled vs unlabelled (UI only, same upload underneath) */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader
                className="cursor-pointer"
                onClick={() => {
                  setLabelledOpen((prev) => !prev);
                  setUnlabelledOpen(false);
                }}
              >
                <CardTitle className="flex justify-between items-center">
                  <span>Labelled data</span>
                  <span className="text-xs text-muted-foreground">
                    {labelledOpen ? "▾" : "▸"}
                  </span>
                </CardTitle>
                <CardDescription>
                  Upload folders containing images and label text files.
                </CardDescription>
              </CardHeader>
              {labelledOpen && (
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm">Select folder</Label>
                    <div className="mt-2 flex items-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const input = document.getElementById(
                            "labelled-folder-input",
                          ) as HTMLInputElement | null;
                          input?.click();
                        }}
                      >
                        Select Folder
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Allowed: .jpg, .jpeg, .png, .txt • Max 50 MB/file • Max
                        1000 files
                      </span>
                    </div>
                    <input
                      id="labelled-folder-input"
                      type="file"
                      multiple
                      // @ts-ignore
                      webkitdirectory="true"
                      className="hidden"
                      onChange={(e) => handleFilesSelected(e.target.files)}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader
                className="cursor-pointer"
                onClick={() => {
                  setUnlabelledOpen((prev) => !prev);
                  setLabelledOpen(false);
                }}
              >
                <CardTitle className="flex justify-between items-center">
                  <span>Unlabelled data</span>
                  <span className="text-xs text-muted-foreground">
                    {unlabelledOpen ? "▾" : "▸"}
                  </span>
                </CardTitle>
                <CardDescription>
                  Upload folders containing only images without labels.
                </CardDescription>
              </CardHeader>
              {unlabelledOpen && (
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm">Select folder</Label>
                    <div className="mt-2 flex items-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const input = document.getElementById(
                            "unlabelled-folder-input",
                          ) as HTMLInputElement | null;
                          input?.click();
                        }}
                      >
                        Select Folder
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Allowed: .jpg, .jpeg, .png, .txt • Max 50 MB/file • Max
                        1000 files
                      </span>
                    </div>
                    <input
                      id="unlabelled-folder-input"
                      type="file"
                      multiple
                      // @ts-ignore
                      webkitdirectory="true"
                      className="hidden"
                      onChange={(e) => handleFilesSelected(e.target.files)}
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Upload button + status */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleUpload}
                disabled={
                  uploadStatus === "uploading" || files.length === 0
                }
              >
                {uploadStatus === "uploading" ? "Uploading..." : "Upload"}
              </Button>
              <div className="text-sm">
                <span className="font-medium">Status: </span>
                <span>{statusMessage}</span>
              </div>
            </div>
          </div>

          {/* Simple progress bar */}
          <div className="w-full max-w-xl mb-4">
            <div className="h-2 rounded bg-muted overflow-hidden">
              <div
                className={`h-2 transition-all ${
                  uploadStatus === "idle"
                    ? "w-0"
                    : uploadStatus === "uploading"
                    ? "w-1/3 bg-primary"
                    : uploadStatus === "processing"
                    ? "w-2/3 bg-primary"
                    : uploadStatus === "ready"
                    ? "w-full bg-emerald-500"
                    : "w-full bg-destructive"
                }`}
              />
            </div>
          </div>

          {/* Status counts */}
          {statusProgress && (
            <div className="text-sm text-muted-foreground mb-8 space-x-4">
              {typeof statusProgress.totalImages === "number" && (
                <span>Total images: {statusProgress.totalImages}</span>
              )}
              {typeof statusProgress.trainCount === "number" && (
                <span>Train: {statusProgress.trainCount}</span>
              )}
              {typeof statusProgress.valCount === "number" && (
                <span>Val: {statusProgress.valCount}</span>
              )}
              {typeof statusProgress.testCount === "number" && (
                <span>Test: {statusProgress.testCount}</span>
              )}
            </div>
          )}

          {/* Metadata display when ready */}
          {metadata && (
            <div className="mt-4 max-w-2xl space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dataset summary</CardTitle>
                  <CardDescription>ID: {metadata.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {typeof metadata.totalImages === "number" && (
                    <p>
                      <span className="font-medium">Total images: </span>
                      {metadata.totalImages}
                    </p>
                  )}
                  {typeof metadata.sizeBytes === "number" && (
                    <p>
                      <span className="font-medium">Size: </span>
                      {(metadata.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  )}
                  {typeof metadata.trainCount === "number" && (
                    <p>
                      <span className="font-medium">Train: </span>
                      {metadata.trainCount}
                    </p>
                  )}
                  {typeof metadata.valCount === "number" && (
                    <p>
                      <span className="font-medium">Val: </span>
                      {metadata.valCount}
                    </p>
                  )}
                  {typeof metadata.testCount === "number" && (
                    <p>
                      <span className="font-medium">Test: </span>
                      {metadata.testCount}
                    </p>
                  )}
                  {typeof metadata.thumbnailsGenerated === "boolean" && (
                    <p>
                      <span className="font-medium">Thumbnails: </span>
                      {metadata.thumbnailsGenerated ? "Generated" : "Pending"}
                    </p>
                  )}
                </CardContent>
              </Card>

              {metadata.folders && (
                <Card>
                  <CardHeader>
                    <CardTitle>Folder breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {Object.entries(metadata.folders).map(
                      ([folderName, stats]) => (
                        <p key={folderName}>
                          <span className="font-medium">{folderName}: </span>
                          {stats.images} images, {stats.labels} labels
                        </p>
                      ),
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DatasetManager;
