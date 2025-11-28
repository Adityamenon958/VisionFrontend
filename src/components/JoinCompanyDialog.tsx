import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function JoinCompanyDialog() {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleRequest = async () => {
    if (!companyName || !adminEmail) {
      toast({
        title: "Missing information",
        description: "Company name and Admin email are required.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1) Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        toast({
          title: "Not signed in",
          description: "Please sign in again and try requesting access.",
          variant: "destructive",
        });
        return;
      }

      // 2) Call your edge function with userId + companyName + adminEmail
      const { error } = await supabase.functions.invoke("send-workspace-request", {
        body: {
          userId: user.id,
          companyName,
          adminEmail,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Request sent",
        description: "The workspace admin has been notified by email.",
      });

      setCompanyName("");
      setAdminEmail("");
      setOpen(false);
    } catch (err: any) {
      toast({
        title: "Request failed",
        description: err.message ?? "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Join Company
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request access to workspace</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Company Name</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div>
              <Label>Admin Email</Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>

            <Button className="w-full" onClick={handleRequest} disabled={loading}>
              {loading ? "Sending..." : "Request Access"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
