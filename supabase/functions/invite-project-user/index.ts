// functions/invite-project-user/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Normalize APP_URL to remove trailing slashes
const APP_URL = Deno.env.get("APP_URL")!.replace(/\/+$/, ''); // e.g. https://app.yourdomain.com

if (!RESEND_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !APP_URL) {
  console.error(
    "Missing required env vars: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL",
  );
}

const resend = new Resend(RESEND_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  projectId: string;
  inviteEmail: string;
  inviteName?: string;
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body: Body = await req.json().catch(() => ({} as Body));
    const { projectId, inviteEmail, inviteName } = body ?? {};

    if (!projectId || !inviteEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "projectId and inviteEmail are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // Validate caller via access token (passed from client)
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;
    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authorization bearer token required",
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // Validate token and get inviter id
    const whoRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!whoRes.ok) {
      const t = await whoRes.text();
      console.error("auth.v1/user failed:", whoRes.status, t);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid auth token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }
    const inviter = await whoRes.json();
    const inviterId = inviter?.id;
    if (!inviterId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unable to determine inviter id",
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // Verify inviter is project admin/owner
    const { data: projectRow, error: projectErr } = await supabase
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", projectId)
      .limit(1)
      .maybeSingle();

    if (projectErr) {
      console.error("project lookup error:", projectErr);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to load project" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }
    if (!projectRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Project not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    let isProjectAdmin = inviterId === projectRow.owner_id;

    if (!isProjectAdmin) {
      const { data: pm, error: pmErr } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", inviterId)
        .limit(1)
        .maybeSingle();

      if (pmErr) {
        console.error("project_members lookup error:", pmErr);
      } else if (pm?.role === "admin" || pm?.role === "owner") {
        isProjectAdmin = true;
      }
    }

    if (!isProjectAdmin) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Insufficient permissions to invite",
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    // Create invite row
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const insertPayload = {
      project_id: projectId,
      email: inviteEmail,
      token: inviteToken,
      created_by: inviterId,
      expires_at: expiresAt,
      status: "pending",
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("project_invites")
      .insert([insertPayload])
      .select()
      .single();

    if (insertErr) {
      console.error("project_invites insert error:", insertErr);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create project invite" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    const inviteId = inserted.id;
    const projectName = projectRow.name ?? "your project";

    const inviteLink = `${APP_URL}/auth?project_invite=${encodeURIComponent(
      inviteToken,
    )}`;

    try {
      await resend.emails.send({
        from: "VisionM <no-reply@your-verified-domain.com>",
        to: [inviteEmail],
        subject: `You were invited to the project "${projectName}"`,
        html: `
          <h2>Project Invitation</h2>
          <p>Hello${inviteName ? ` ${inviteName}` : ""},</p>
          <p>You have been invited to access the project <strong>${projectName}</strong> on VisionM.</p>
          <p>Click the button below to accept the invitation and create an account (if you don't have one):</p>
          <p style="margin:18px 0;">
            <a href="${inviteLink}" style="display:inline-block;padding:10px 16px;background:#0ea5e9;color:#fff;border-radius:6px;text-decoration:none;">Accept Invitation</a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p>${inviteLink}</p>
          <hr/>
          <small>This invite expires on ${expiresAt}.</small>
        `,
      });

      await supabase
        .from("project_invites")
        .update({ status: "email_sent" })
        .eq("id", inviteId);

      return new Response(
        JSON.stringify({ success: true, inviteId }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
      );
    } catch (sendErr) {
      console.error("Resend send error:", sendErr);

      await supabase
        .from("project_invites")
        .update({
          status: "email_failed",
          error_message: String(sendErr),
        })
        .eq("id", inviteId);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Invite created but email failed",
          details: String(sendErr),
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }
  } catch (err: any) {
    console.error("Unhandled error invite-project-user:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message ?? String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
    );
  }
});
