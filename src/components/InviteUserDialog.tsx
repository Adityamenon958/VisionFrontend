// src/components/InviteUserDialog.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FormFieldWrapper } from "@/components/FormFieldWrapper";
import { useFormValidation } from "@/hooks/useFormValidation";
import { inviteUserSchema, type InviteUserFormData } from "@/lib/validations/authSchemas";

interface Props {
  companyId: string;
  accessToken: string; // pass supabase session access token
}

export const InviteUserDialog: React.FC<Props> = ({
  companyId,
  accessToken,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [showAlreadyMemberError, setShowAlreadyMemberError] = useState(false);

  const inviteForm = useFormValidation({
    schema: inviteUserSchema,
    initialValues: {
      email: "",
      name: "",
    },
    validateOnChange: false,
    validateOnBlur: true,
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    
    if (!inviteForm.validateForm()) {
      toast({
        title: "Please check your details",
        description: "Fix the highlighted errors before sending invite.",
        variant: "destructive",
      });
      return;
    }

    if (!companyId) {
      toast({
        title: "Error",
        description: "Company id missing",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/create-invite`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          companyId,
          inviteEmail: inviteForm.values.email,
          inviteName: inviteForm.values.name,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { raw: text };
      }

      console.log("create-invite response:", res.status, data);

      if (!res.ok || data?.success === false) {
        const msg =
          data?.error ||
          data?.message ||
          data?.raw ||
          `Invite failed with status ${res.status}`;
        
        // Check if error is "User already a member"
        if (data?.errorCode === "USER_ALREADY_MEMBER" || msg.includes("already a member")) {
          setShowAlreadyMemberError(true);
          inviteForm.setValue("email", ""); // Clear email field
          setLoading(false);
          return;
        }
        
        toast({
          title: "Invite failed",
          description: msg,
          variant: "destructive",
        });
        if (data?.inviteLink) {
          console.log("Manual invite link:", data.inviteLink);
          setLastInviteLink(data.inviteLink);
        }
        setLoading(false);
        return;
      }

      // success
      if (data?.inviteLink) {
        setLastInviteLink(data.inviteLink);
      }

      inviteForm.resetForm();
      setShowAlreadyMemberError(false);
      toast({
        title: "Invite sent successfully",
        description: "The invitation has been sent to the user.",
      });
    } catch (err: any) {
      console.error("invite_error", err);
      toast({
        title: "Invite failed",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!lastInviteLink) return;
    navigator.clipboard
      .writeText(lastInviteLink)
      .then(() => {
        toast({
          title: "Link copied",
          description: "Invite link has been copied to clipboard.",
        });
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "Failed to copy invite link.",
          variant: "destructive",
        });
      });
  }

  return (
    <div className="space-y-4">
      {/* FORM SECTION */}
      <form
        onSubmit={handleInvite}
        className="flex flex-col gap-3 items-stretch"
      >
        <FormFieldWrapper
          label="Email"
          name="email"
          type="email"
          value={inviteForm.values.email}
          onChange={(e) => {
            inviteForm.handleChange("email")(e);
            setShowAlreadyMemberError(false); // Clear error when user types
          }}
          onBlur={inviteForm.handleBlur("email")}
          error={inviteForm.getFieldError("email")}
          touched={inviteForm.isFieldTouched("email")}
          placeholder="user@example.com"
          required
        />
        <FormFieldWrapper
          label="Name (Optional)"
          name="name"
          type="text"
          value={inviteForm.values.name || ""}
          onChange={inviteForm.handleChange("name")}
          onBlur={inviteForm.handleBlur("name")}
          error={inviteForm.getFieldError("name")}
          touched={inviteForm.isFieldTouched("name")}
          placeholder="Optional name"
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Invite"}
          </Button>
        </div>
      </form>

      {/* ALREADY A MEMBER ERROR + VIEW MEMBERS BUTTON */}
      {showAlreadyMemberError && (
        <div className="flex flex-col gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive font-medium">
            User already a member
          </p>
          <p className="text-xs text-muted-foreground">
            This user is already a member of your company.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigate("/dashboard?view=members");
            }}
            className="w-full"
          >
            View Members
          </Button>
        </div>
      )}

      {/* LAST INVITE LINK + COPY BUTTON BELOW INPUTS */}
      {lastInviteLink && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Last invite link:</span>
          <div className="flex items-center gap-2">
            <a
              href={lastInviteLink}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 underline break-all"
            >
              {lastInviteLink}
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteUserDialog;