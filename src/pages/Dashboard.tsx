import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { JoinCompanyDialog } from "@/components/JoinCompanyDialog";

type ViewMode = "overview" | "projects" | "simulation";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // sidebar state
  const [activeView, setActiveView] = useState<ViewMode>("overview");
  const [projectMenuOpen, setProjectMenuOpen] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    loadProfile(session.user.id);
  };

  const loadProfile = async (userId: string) => {
    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load your profile.",
        variant: "destructive",
      });
      return;
    }

    // No profile yet → ask for company details
    if (!profileData) {
      console.log("No profile found yet for this user.");
      setShowCompanyDialog(true);
      return;
    }

    // Profile exists
    if (profileData.company_id) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profileData.company_id)
        .single();

      setProfile({ ...profileData, companies: companyData });
      loadProjects(profileData.company_id);
    } else {
      setProfile(profileData);
      setShowCompanyDialog(true);
    }
  };

  const loadProjects = async (companyId: string) => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (data) {
      setProjects(data);
    }
  };

  // Create / update company AND link profile.company_id
  const handleSaveCompany = async () => {
    if (!companyName || !companyEmail) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "No authenticated user found.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1) Create company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          user_id: user.id,
          name: companyName,
          email: companyEmail,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // 2) Ensure profile row exists and link to this company
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          company_id: company.id,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // 3) Update local state and enable projects
      setProfile({ ...profileRow, companies: company });
      setShowCompanyDialog(false);
      loadProjects(company.id);

      toast({
        title: "Company details saved",
        description: "Your company has been created successfully.",
      });
    } catch (error: any) {
      console.error("Error saving company:", error);
      toast({
        title: "Error",
        description: error.message ?? "Failed to save company.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateProject = () => {
    if (!profile || !profile.company_id) {
      toast({
        title: "Company required",
        description: "Please add your company details before creating a project.",
        variant: "destructive",
      });
      setShowCompanyDialog(true);
      return;
    }
    setShowProjectDialog(true);
  };

  const handleCreateProject = async () => {
    if (!projectName) {
      toast({
        title: "Error",
        description: "Please enter a project name",
        variant: "destructive",
      });
      return;
    }

    if (!profile || !profile.company_id) {
      toast({
        title: "Company required",
        description: "Please add your company details before creating a project.",
        variant: "destructive",
      });
      setShowCompanyDialog(true);
      return;
    }

    setLoading(true);

    try {
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          name: projectName,
          description: projectDescription,
          company_id: profile.company_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // refresh list
      loadProjects(profile.company_id);

      // close dialog and reset
      setShowProjectDialog(false);
      setProjectName("");
      setProjectDescription("");

      // go straight to dataset view for this project
      navigate(`/dataset/${project.id}`);
    } catch (error: any) {
      console.error("Error creating project:", error);
      toast({
        title: "Error",
        description: error.message ?? "Failed to create project.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const displayName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "User";

  // ---------- RENDER ----------

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Top navbar */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">VisionM</h1>
          <div className="flex gap-4 items-center">
            {/* Join Company dialog button */}
            <JoinCompanyDialog />
            {/* Sign out */}
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
              Menu
            </p>
          </div>

          <div className="px-2 py-4 space-y-1">
            {/* Projects group */}
            <button
              onClick={() => setProjectMenuOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted"
            >
              <span>Projects</span>
              <span className="text-xs text-muted-foreground">
                {projectMenuOpen ? "▾" : "▸"}
              </span>
            </button>

            {projectMenuOpen && (
              <div className="ml-4 mt-1 space-y-1">
                <button
                  onClick={openCreateProject}
                  className="w-full text-left px-4 py-2 text-sm rounded-lg hover:bg-muted"
                >
                  Create Project
                </button>
                <button
                  onClick={() => setActiveView("projects")}
                  className={`w-full text-left px-4 py-2 text-sm rounded-lg hover:bg-muted ${
                    activeView === "projects" ? "bg-muted" : ""
                  }`}
                >
                  Manage Projects
                </button>
              </div>
            )}

            {/* Simulation item */}
            <button
              onClick={() => setActiveView("simulation")}
              className={`w-full text-left px-4 py-2 text-sm rounded-lg hover:bg-muted ${
                activeView === "simulation" ? "bg-muted" : ""
              }`}
            >
              Simulation
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 container mx-auto px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-1">
              Welcome, {displayName}
            </h2>
            {profile?.companies && (
              <p className="text-muted-foreground">
                {profile.companies.name}
              </p>
            )}
          </div>

          {/* Overview view (default) */}
          {activeView === "overview" && (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground text-sm">
                Select an option from the sidebar to get started.
              </p>
            </div>
          )}

          {/* Manage Projects view */}
          {activeView === "projects" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-semibold">Manage Projects</h3>
                <Button onClick={openCreateProject}>Create Project</Button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <Card
                    key={project.id}
                    className="hover:border-primary transition-colors cursor-pointer"
                  >
                    <CardHeader>
                      <CardTitle>{project.name}</CardTitle>
                      <CardDescription>
                        {project.description || "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate(`/dataset/${project.id}`)}
                      >
                        Manage Dataset
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {projects.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="flex items-center justify-center py-12">
                      <p className="text-muted-foreground text-sm">
                        No projects yet. Use &quot;Create Project&quot; to add
                        your first project.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Simulation view (placeholder for now) */}
          {activeView === "simulation" && (
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold mb-2">Simulation</h3>
              <Card>
                <CardContent className="py-10">
                  <p className="text-muted-foreground text-sm">
                    Simulation module placeholder. Connect this view to your
                    antenna / vision simulation pages when ready.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Company Details Dialog (for new user or when required) */}
      <Dialog open={showCompanyDialog} onOpenChange={setShowCompanyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Company Details</DialogTitle>
            <DialogDescription>
              Please provide your company information to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company Inc."
              />
            </div>
            <div>
              <Label htmlFor="company-email">Admin Email</Label>
              <Input
                id="company-email"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="admin@company.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCompany} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter details for your new dataset project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Dataset Project"
              />
            </div>
            <div>
              <Label htmlFor="project-description">Description (Optional)</Label>
              <Textarea
                id="project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Describe your project..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowProjectDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
