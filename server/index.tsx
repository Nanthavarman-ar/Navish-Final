import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import { csrf } from 'npm:hono/csrf'
import { createClient } from 'npm:@supabase/supabase-js'
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from 'npm:@aws-sdk/client-s3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner'
import * as kv from './kv_store.tsx'
import { getIoTService } from './iot_service.tsx'

const app = new Hono()

// Middleware
app.use('*', cors())
app.use('*', logger(console.log))
const csrfMiddleware = csrf()
app.use('*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  const hasBearerToken = Boolean(c.req.header('authorization'));
  const isSignupPath = c.req.path === '/make-server-cf230d31/signup';
  const isResolveLoginPath = c.req.path === '/make-server-cf230d31/resolve-login';
  if (
    method === 'OPTIONS' ||
    hasBearerToken ||
    isSignupPath ||
    isResolveLoginPath ||
    c.req.path === '/make-server-cf230d31/billing/webhook'
  ) {
    await next()
    return
  }
  return csrfMiddleware(c, next)
})

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Helper function to verify admin access
async function verifyAdmin(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return { error: 'No authorization token provided', user: null };
  }
  
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return { error: 'Invalid token', user: null };
  }
  
  // Check if user is admin from metadata or a dedicated table
  const userRole = user.user_metadata?.role || 'client';
  if (userRole !== 'admin') {
    return { error: 'Admin access required', user: null };
  }
  
  return { error: null, user };
}

// Helper function to verify any authenticated user
async function verifyUser(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return { error: 'No authorization token provided', user: null };
  }
  
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return { error: 'Invalid token', user: null };
  }
  
  return { error: null, user };
}

// Helper function to sanitize input
function sanitizeInput(input: string): string {
  return input.replace(/[<>"'&]/g, (match) => {
    const entities: { [key: string]: string } = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '&': '&amp;'
    };
    return entities[match] || match;
  });
}

// Helper function to log audit events
async function logAuditEvent(userId: string, username: string, action: string, target: string, details: string, ipAddress: string, userAgent: string) {
  try {
    const auditEvent = {
      user_id: sanitizeInput(userId),
      username: sanitizeInput(username),
      action: sanitizeInput(action),
      target: sanitizeInput(target),
      details: sanitizeInput(details),
      ip_address: sanitizeInput(ipAddress),
      user_agent: sanitizeInput(userAgent),
      timestamp: new Date().toISOString(),
      severity: action.includes('DELETE') ? 'warning' : action.includes('FAIL') ? 'error' : 'info'
    };
    
    await kv.set(`audit_log:${Date.now()}:${userId}`, auditEvent);
    console.log('Audit event logged:', auditEvent);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// Initialize storage buckets on startup
async function initializeStorage() {
  try {
    const bucketName = 'make-cf230d31-models';
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(bucketName, { public: false });
      if (error) {
        console.error('Error creating storage bucket:', error);
      } else {
        console.log('Storage bucket created successfully');
      }
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
}

// Initialize on startup
initializeStorage();

type PlanDuration = 'hourly' | 'daily' | 'monthly' | 'unlimited'
type PlanTier = 'silver' | 'gold' | 'platinum'

interface ServerSubscription {
  planId: string
  tier: PlanTier
  duration: PlanDuration
  startDate: string
  endDate: string | null
  status: 'active' | 'expired' | 'cancelled'
  uploadsUsed: number
  uploadLimit: number
}

interface ServerPlan {
  tier: PlanTier
  duration: PlanDuration
  uploadLimit: number
  priceCents: number
  currency: 'usd'
  label: string
}

const SERVER_PLANS = new Map<string, ServerPlan>([
  ['single-upload', { tier: 'silver', duration: 'unlimited', uploadLimit: 1, priceCents: 999, currency: 'usd', label: 'Single Upload (One-Time)' }],
  ['silver-hourly', { tier: 'silver', duration: 'hourly', uploadLimit: 3, priceCents: 299, currency: 'usd', label: 'Silver Hourly' }],
  ['silver-daily', { tier: 'silver', duration: 'daily', uploadLimit: 10, priceCents: 999, currency: 'usd', label: 'Silver Daily' }],
  ['silver-monthly', { tier: 'silver', duration: 'monthly', uploadLimit: 50, priceCents: 2999, currency: 'usd', label: 'Silver Monthly' }],
  ['silver-unlimited', { tier: 'silver', duration: 'unlimited', uploadLimit: 200, priceCents: 9999, currency: 'usd', label: 'Silver Unlimited' }],
  ['gold-hourly', { tier: 'gold', duration: 'hourly', uploadLimit: 10, priceCents: 499, currency: 'usd', label: 'Gold Hourly' }],
  ['gold-daily', { tier: 'gold', duration: 'daily', uploadLimit: 50, priceCents: 1999, currency: 'usd', label: 'Gold Daily' }],
  ['gold-monthly', { tier: 'gold', duration: 'monthly', uploadLimit: 200, priceCents: 5999, currency: 'usd', label: 'Gold Monthly' }],
  ['gold-unlimited', { tier: 'gold', duration: 'unlimited', uploadLimit: -1, priceCents: 19999, currency: 'usd', label: 'Gold Unlimited' }],
  ['platinum-hourly', { tier: 'platinum', duration: 'hourly', uploadLimit: 25, priceCents: 999, currency: 'usd', label: 'Platinum Hourly' }],
  ['platinum-daily', { tier: 'platinum', duration: 'daily', uploadLimit: 100, priceCents: 3999, currency: 'usd', label: 'Platinum Daily' }],
  ['platinum-monthly', { tier: 'platinum', duration: 'monthly', uploadLimit: 500, priceCents: 11999, currency: 'usd', label: 'Platinum Monthly' }],
  ['platinum-unlimited', { tier: 'platinum', duration: 'unlimited', uploadLimit: -1, priceCents: 49999, currency: 'usd', label: 'Platinum Unlimited' }]
]);

function calculateEndDate(start: Date, duration: PlanDuration): string | null {
  if (duration === 'unlimited') return null;
  if (duration === 'hourly') return new Date(start.getTime() + 60 * 60 * 1000).toISOString();
  if (duration === 'daily') return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const monthlyEnd = new Date(start);
  monthlyEnd.setMonth(monthlyEnd.getMonth() + 1);
  return monthlyEnd.toISOString();
}

function normalizeSubscription(raw: any): ServerSubscription | null {
  if (!raw) return null;
  const endDate = raw.endDate || null;
  if (raw.status !== 'active') return null;
  if (endDate && new Date(endDate).getTime() < Date.now()) return null;
  return {
    planId: String(raw.planId),
    tier: raw.tier as PlanTier,
    duration: raw.duration as PlanDuration,
    startDate: String(raw.startDate),
    endDate,
    status: 'active',
    uploadsUsed: Number(raw.uploadsUsed || 0),
    uploadLimit: Number(raw.uploadLimit ?? -1)
  };
}

async function getActiveSubscription(userId: string): Promise<ServerSubscription | null> {
  const raw = await kv.get(`subscription:${userId}`);
  const subscription = normalizeSubscription(raw);
  if (!subscription && raw) {
    await kv.del(`subscription:${userId}`);
  }
  return subscription;
}

function getEnvOrThrow(name: string): string {
  const value = Deno.env.get(name)?.trim() || '';
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Cloudflare R2 - large model uploads moved here from Supabase Storage, whose Free plan
// hard-caps every bucket at 50MB (see supabase/migrations/0003_raise_model_bucket_size_limit.sql).
// R2 is S3-compatible, so the AWS SDK works against it unchanged aside from a custom
// endpoint and region: 'auto'.
function getR2Client(): S3Client {
  const accountId = getEnvOrThrow('R2_ACCOUNT_ID');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: getEnvOrThrow('R2_ACCESS_KEY_ID'),
      secretAccessKey: getEnvOrThrow('R2_SECRET_ACCESS_KEY'),
    },
  });
}

function getR2Bucket(): string {
  return getEnvOrThrow('R2_BUCKET_NAME');
}

// The bucket's "Public access" r2.dev URL, or a connected custom domain - either way, no
// trailing slash. Files are served directly from here rather than through time-limited
// signed URLs, since these public-development URLs (or a custom domain) don't expire.
function getR2PublicUrlBase(): string {
  return getEnvOrThrow('R2_PUBLIC_URL_BASE').replace(/\/+$/, '');
}

function requireAdminRole(user: any): { isAdmin: boolean; username: string } {
  const userRole = user.user_metadata?.role || 'client';
  const username = user.user_metadata?.username || user.email || 'user';
  return { isAdmin: userRole === 'admin', username };
}

function normalizePlanEnvKey(planId: string): string {
  return `STRIPE_PRICE_${planId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

function parseStripeSignature(header: string): { timestamp: string | null; signatures: string[] } {
  const parts = header.split(',').map(part => part.trim());
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (!k || !v) continue;
    if (k === 't') timestamp = v;
    if (k === 'v1') signatures.push(v);
  }
  return { timestamp, signatures };
}

function hexEncode(buffer: Uint8Array): string {
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function computeHmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return hexEncode(new Uint8Array(signature));
}

async function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string): Promise<boolean> {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  const toleranceMs = 5 * 60 * 1000;
  if (Math.abs(Date.now() - timestampMs) > toleranceMs) return false;

  const secret = getEnvOrThrow('STRIPE_WEBHOOK_SECRET');
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await computeHmacSha256Hex(secret, signedPayload);
  return signatures.some(sig => timingSafeEqual(sig, expected));
}

function getAllowedAppOrigin(): string | null {
  const origin = Deno.env.get('APP_BASE_URL')?.trim() || '';
  if (!origin) return null;
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function normalizeRedirectUrl(url: string, fallbackPath: string): string {
  const allowedOrigin = getAllowedAppOrigin();
  const fallback = allowedOrigin ? `${allowedOrigin}${fallbackPath}` : fallbackPath;
  try {
    const parsed = new URL(url);
    if (!allowedOrigin) return parsed.toString();
    if (parsed.origin !== allowedOrigin) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

// Routes

// Health check
app.get('/make-server-cf230d31/health', async (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Scene persistence endpoints for Babylon.js workspace
//
// All routes below were registered without the '/make-server-cf230d31' prefix that
// every client caller's functionsBaseUrl actually includes (see components/
// VersionHistoryPanel.tsx:20, ApprovalPanel.tsx and others: `https://<project>.
// supabase.co/functions/v1/make-server-cf230d31`) - Supabase Edge Functions pass the
// full path including the function name through to this Hono app, so an unprefixed
// route here can never match a real incoming request and 404s unconditionally. The
// annotations routes elsewhere in this file already had this exact bug fixed; these
// scene routes were missed in that pass.

// Save scene state
app.post('/make-server-cf230d31/api/scenes/:roomId', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const roomId = c.req.param('roomId');
    const { sceneData, thumbnail } = await c.req.json();

    const sceneKey = `scene:${roomId}`;

    // Snapshot the previous state into version history before overwriting it, so
    // there's an actual undo/rollback trail. Without this, every save just clobbered
    // the single scene:{roomId} key with no way to go back to an earlier point.
    const previousScene = await kv.get(sceneKey);
    if (previousScene) {
      const versionKey = `scene_version:${roomId}:${previousScene.version || Date.now()}`;
      await kv.set(versionKey, previousScene);
    }

    const sceneInfo = {
      id: roomId,
      data: sceneData,
      thumbnail,
      lastModified: new Date().toISOString(),
      lastModifiedBy: user.id,
      lastModifiedByUsername: user.user_metadata?.username || user.email,
      version: Date.now()
    };

    await kv.set(sceneKey, sceneInfo);

    // Log audit event
    await logAuditEvent(
      user.id,
      user.user_metadata?.username || user.email,
      'SCENE_SAVED',
      roomId,
      `Saved scene state for room: ${sanitizeInput(roomId)}`,
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );

    return c.json({
      message: 'Scene saved successfully',
      scene: sceneInfo
    });

  } catch (error) {
    console.error('Scene save error:', error);
    return c.json({ error: 'Failed to save scene' }, 500);
  }
});

// Load scene state
app.get('/make-server-cf230d31/api/scenes/:roomId', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const roomId = c.req.param('roomId');
    const sceneKey = `scene:${roomId}`;
    const scene = await kv.get(sceneKey);

    if (!scene) {
      return c.json({ error: 'Scene not found' }, 404);
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      user.user_metadata?.username || user.email,
      'SCENE_LOADED',
      sanitizeInput(roomId),
      `Loaded scene state for room: ${sanitizeInput(roomId)}`,
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );

    return c.json({ scene });

  } catch (error) {
    console.error('Scene load error:', error);
    return c.json({ error: 'Failed to load scene' }, 500);
  }
});

// List user's scenes
app.get('/make-server-cf230d31/api/scenes', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const allScenes = await kv.getByPrefix('scene:');
    const userScenes = allScenes.filter(scene =>
      scene.lastModifiedBy === user.id
    );

    return c.json({ scenes: userScenes });

  } catch (error) {
    console.error('Scenes list error:', error);
    return c.json({ error: 'Failed to list scenes' }, 500);
  }
});

// Delete scene
app.delete('/make-server-cf230d31/api/scenes/:roomId', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const roomId = c.req.param('roomId');
    const sceneKey = `scene:${roomId}`;
    const scene = await kv.get(sceneKey);

    if (!scene) {
      return c.json({ error: 'Scene not found' }, 404);
    }

    // Check if user owns the scene
    if (scene.lastModifiedBy !== user.id) {
      return c.json({ error: 'Access denied' }, 403);
    }

    await kv.del(sceneKey);

    // Log audit event
    await logAuditEvent(
      user.id,
      user.user_metadata?.username || user.email,
      'SCENE_DELETED',
      roomId,
      `Deleted scene: ${roomId}`,
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );

    return c.json({ message: 'Scene deleted successfully' });

  } catch (error) {
    console.error('Scene delete error:', error);
    return c.json({ error: 'Failed to delete scene' }, 500);
  }
});

// Get scene versions/history (for future implementation)
app.get('/make-server-cf230d31/api/scenes/:roomId/versions', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const roomId = c.req.param('roomId');
    const versions = await kv.getByPrefix(`scene_version:${roomId}:`);
    // Most recent first
    const sorted = (versions || []).sort((a: any, b: any) => (b.version || 0) - (a.version || 0));

    return c.json({ versions: sorted });

  } catch (error) {
    console.error('Scene versions error:', error);
    return c.json({ error: 'Failed to get scene versions' }, 500);
  }
});

// Restore a scene to a previous version. The current state is itself snapshotted
// first, so restoring is non-destructive and can be undone by restoring again.
app.post('/make-server-cf230d31/api/scenes/:roomId/versions/:version/restore', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const roomId = c.req.param('roomId');
    const version = c.req.param('version');
    const versionKey = `scene_version:${roomId}:${version}`;
    const versionData = await kv.get(versionKey);

    if (!versionData) {
      return c.json({ error: 'Version not found' }, 404);
    }

    const sceneKey = `scene:${roomId}`;
    const currentScene = await kv.get(sceneKey);
    if (currentScene) {
      // Preserve the current state as a version too, so restoring doesn't lose work.
      await kv.set(`scene_version:${roomId}:${currentScene.version || Date.now()}`, currentScene);
    }

    const restoredScene = {
      ...versionData,
      lastModified: new Date().toISOString(),
      lastModifiedBy: user.id,
      lastModifiedByUsername: user.user_metadata?.username || user.email,
      version: Date.now()
    };
    await kv.set(sceneKey, restoredScene);

    await logAuditEvent(
      user.id,
      user.user_metadata?.username || user.email,
      'SCENE_RESTORED',
      roomId,
      `Restored scene to version ${sanitizeInput(version)}`,
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );

    return c.json({ message: 'Scene restored successfully', scene: restoredScene });

  } catch (error) {
    console.error('Scene restore error:', error);
    return c.json({ error: 'Failed to restore scene version' }, 500);
  }
});

// Submit an approval decision on the current design state
app.post('/make-server-cf230d31/api/scenes/:roomId/approval', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const roomId = c.req.param('roomId');
    const { decision, comment } = await c.req.json();

    if (decision !== 'approved' && decision !== 'changes_requested') {
      return c.json({ error: "decision must be 'approved' or 'changes_requested'" }, 400);
    }

    const currentScene = await kv.get(`scene:${roomId}`);
    const approval = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      roomId,
      decision,
      comment: comment ? sanitizeInput(comment) : '',
      sceneVersion: currentScene?.version || null,
      byUserId: user.id,
      byUsername: user.user_metadata?.username || user.email,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`approval:${roomId}:${approval.id}`, approval);

    await logAuditEvent(
      user.id,
      user.user_metadata?.username || user.email,
      decision === 'approved' ? 'DESIGN_APPROVED' : 'DESIGN_CHANGES_REQUESTED',
      roomId,
      comment ? sanitizeInput(comment) : `Design ${decision === 'approved' ? 'approved' : 'flagged for changes'}`,
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );

    return c.json({ message: 'Approval recorded', approval });
  } catch (error) {
    console.error('Approval submission error:', error);
    return c.json({ error: 'Failed to submit approval' }, 500);
  }
});

// Get the approval history for a room
app.get('/make-server-cf230d31/api/scenes/:roomId/approval', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const roomId = c.req.param('roomId');
    const approvals = await kv.getByPrefix(`approval:${roomId}:`);
    const sorted = (approvals || []).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json({ approvals: sorted });
  } catch (error) {
    console.error('Approval history fetch error:', error);
    return c.json({ error: 'Failed to fetch approval history' }, 500);
  }
});

// Authentication routes

// Resolves a plain username to its account email so the login form can
// accept "admin" instead of requiring an email address. Public/unauthenticated
// by necessity (called before the user has a session) - only ever returns an
// email address, never a password or session, and the caller still has to
// complete a normal signInWithPassword with the correct password.
app.post('/make-server-cf230d31/resolve-login', async (c) => {
  try {
    const body = await c.req.json();
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';

    if (!identifier) {
      return c.json({ error: 'Missing identifier' }, 400);
    }

    if (identifier.includes('@')) {
      return c.json({ email: identifier.toLowerCase() });
    }

    const needle = identifier.toLowerCase();
    let page = 1;
    const perPage = 200;
    let match: { email?: string } | undefined;

    while (!match) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error('resolve-login listUsers error:', error);
        break;
      }
      match = data.users.find(
        (u) => (u.user_metadata?.username || '').toLowerCase() === needle
      );
      if (match || data.users.length < perPage) break;
      page += 1;
    }

    if (!match?.email) {
      return c.json({ error: 'Account not found' }, 404);
    }

    return c.json({ email: match.email });
  } catch (error) {
    console.error('resolve-login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/make-server-cf230d31/signup', async (c) => {
  try {
    const body = await c.req.json();
    const { name, username, email, password } = body;
    // Public signup can only ever create client accounts. The single admin
    // account is provisioned out-of-band (see scripts/create-admin.mjs) and
    // must never be reachable through a client-supplied field here.
    const role = 'client';

    if (!name || !username || !email || !password) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        name, 
        username, 
        role 
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });
    
    if (error) {
      console.error('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }
    
    // Store additional user data in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      name,
      username,
      email,
      role,
      createdAt: new Date().toISOString(),
      assignedModels: [],
      lastActive: new Date().toISOString()
    });
    
    // Log audit event
    await logAuditEvent(
      data.user.id, 
      username, 
      'USER_CREATED', 
      username, 
      `New ${role} account created`, 
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );
    
    return c.json({ 
      message: 'User created successfully', 
      user: { 
        id: data.user.id, 
        name, 
        username, 
        email, 
        role 
      } 
    });
    
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get current user profile
app.get('/make-server-cf230d31/profile', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);
  
  if (error) {
    return c.json({ error }, 401);
  }
  
  try {
    const userData = await kv.get(`user:${user.id}`);
    return c.json({ user: userData || user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

// Billing: get current subscription
app.get('/make-server-cf230d31/billing/subscription', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const subscription = await getActiveSubscription(user.id);
    return c.json({ subscription });
  } catch (e) {
    console.error('Subscription fetch error:', e);
    return c.json({ error: 'Failed to fetch subscription' }, 500);
  }
});

// Stripe webhook: validates signature and updates user entitlements.
app.post('/make-server-cf230d31/billing/webhook', async (c) => {
  try {
    const signatureHeader = c.req.header('stripe-signature') || '';
    const rawBody = await c.req.text();
    if (!signatureHeader) {
      return c.json({ error: 'Missing stripe-signature header' }, 400);
    }

    const isValid = await verifyStripeWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      return c.json({ error: 'Invalid webhook signature' }, 400);
    }

    const event = JSON.parse(rawBody);
    const eventType = String(event?.type || '');
    const session = event?.data?.object || {};

    if (eventType === 'checkout.session.completed') {
      const userId = String(session?.metadata?.user_id || '');
      const planId = String(session?.metadata?.plan_id || '');
      const paymentStatus = String(session?.payment_status || '');
      const sessionId = String(session?.id || '');

      if (userId && planId && paymentStatus === 'paid') {
        const plan = SERVER_PLANS.get(planId);
        if (plan) {
          const now = new Date();
          const subscription: ServerSubscription = {
            planId,
            tier: plan.tier,
            duration: plan.duration,
            startDate: now.toISOString(),
            endDate: calculateEndDate(now, plan.duration),
            status: 'active',
            uploadsUsed: 0,
            uploadLimit: plan.uploadLimit
          };

          await kv.set(`subscription:${userId}`, subscription);
          await kv.set(`payment:${sessionId}`, {
            sessionId,
            userId,
            planId,
            amountTotal: Number(session?.amount_total || 0),
            currency: String(session?.currency || '').toUpperCase(),
            status: paymentStatus,
            paidAt: new Date().toISOString()
          });

          await logAuditEvent(
            userId,
            'system',
            'SUBSCRIPTION_ACTIVATED',
            planId,
            `Activated via Stripe webhook for session ${sessionId}`,
            c.req.header('cf-connecting-ip') || 'unknown',
            'stripe-webhook'
          );
        }
      }
    }

    if (eventType === 'charge.refunded') {
      const charge = event?.data?.object || {};
      const sessionId = String(charge?.payment_intent || '');
      if (sessionId) {
        await kv.set(`refund:${sessionId}`, {
          sessionId,
          refundedAt: new Date().toISOString(),
          amountRefunded: Number(charge?.amount_refunded || 0)
        });
      }
    }

    return c.json({ received: true });
  } catch (e) {
    console.error('Stripe webhook error:', e);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// Billing: create Stripe checkout session.
app.post('/make-server-cf230d31/billing/checkout', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const userRole = user.user_metadata?.role || 'client';
    if (userRole !== 'client') {
      return c.json({ error: 'Checkout is only required for client accounts' }, 400);
    }

    const body = await c.req.json();
    const planId = sanitizeInput(String(body?.planId || ''));
    const successUrl = normalizeRedirectUrl(String(body?.successUrl || ''), '/client/upload');
    const cancelUrl = normalizeRedirectUrl(String(body?.cancelUrl || ''), '/client/upload');
    const plan = SERVER_PLANS.get(planId);

    if (!plan) {
      return c.json({ error: 'Invalid plan' }, 400);
    }

    const stripeSecretKey = getEnvOrThrow('STRIPE_SECRET_KEY');
    const formBody = new URLSearchParams();
    formBody.set('mode', 'payment');
    formBody.set('success_url', successUrl);
    formBody.set('cancel_url', cancelUrl);
    formBody.set('metadata[user_id]', user.id);
    formBody.set('metadata[plan_id]', planId);
    formBody.set('metadata[user_role]', userRole);

    if (user.email) {
      formBody.set('customer_email', user.email);
    }

    const envPriceIdKey = normalizePlanEnvKey(planId);
    const configuredPriceId = Deno.env.get(envPriceIdKey)?.trim() || '';
    if (configuredPriceId) {
      formBody.set('line_items[0][price]', configuredPriceId);
      formBody.set('line_items[0][quantity]', '1');
    } else {
      // Fallback to inline price_data when a Stripe Price ID is not configured.
      formBody.set('line_items[0][price_data][currency]', plan.currency);
      formBody.set('line_items[0][price_data][unit_amount]', String(plan.priceCents));
      formBody.set('line_items[0][price_data][product_data][name]', plan.label);
      formBody.set('line_items[0][quantity]', '1');
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stripe checkout creation failed:', errorText);
      return c.json({ error: 'Failed to create Stripe checkout session' }, 502);
    }

    const checkoutSession = await response.json();
    const checkoutUrl = String(checkoutSession?.url || '');
    if (!checkoutUrl) {
      return c.json({ error: 'Stripe did not return checkout URL' }, 502);
    }

    return c.json({ checkoutUrl });
  } catch (e) {
    console.error('Checkout error:', e);
    return c.json({ error: 'Failed to start checkout' }, 500);
  }
});

// Billing: increment usage after successful upload
app.post('/make-server-cf230d31/billing/usage/increment', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const subscription = await getActiveSubscription(user.id);
    if (!subscription) {
      return c.json({ error: 'Active subscription required' }, 403);
    }

    if (subscription.uploadLimit !== -1 && subscription.uploadsUsed >= subscription.uploadLimit) {
      return c.json({ error: 'Upload limit reached' }, 403);
    }

    subscription.uploadsUsed += 1;
    await kv.set(`subscription:${user.id}`, subscription);
    return c.json({ subscription });
  } catch (e) {
    console.error('Usage increment error:', e);
    return c.json({ error: 'Failed to increment usage' }, 500);
  }
});

// Upload model (admin unlimited, client requires active subscription)
app.post('/make-server-cf230d31/upload-model', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);
  
  if (error) {
    return c.json({ error }, 401);
  }
  
  try {
    const userRole = user.user_metadata?.role || 'client';
    const isAdmin = userRole === 'admin';
    const username = user.user_metadata?.username || user.email || 'user';

    // Uploads are admin-only by design - there's no client-facing upload UI, but this
    // endpoint previously still accepted uploads from any client with an active
    // subscription if called directly (e.g. via the API, bypassing the UI entirely).
    // Enforcing it server-side closes that instead of relying on "no button for it".
    if (!isAdmin) {
      return c.json({ error: 'Only administrators can upload models' }, 403);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const thumbnailFile = formData.get('thumbnail') as File | null;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const tags = String(formData.get('tags') || '');
    const assignedClientsRaw = JSON.parse(formData.get('assignedClients') as string || '[]');

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    const assignedClients = isAdmin ? assignedClientsRaw : [username];

    // Upload file to Supabase Storage
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `models/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('make-cf230d31-models')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // This is the actual, verified cause of "model doesn't get stored" on a fresh
      // Supabase project: the storage bucket this backend uploads to was never created
      // there (see supabase/migrations/0001_init_kv_store_and_storage.sql). Without this
      // specific check, the caller only ever saw a generic "Failed to upload file" with
      // no indication that the fix is a one-time SQL script, not a retry.
      if (/bucket not found/i.test(uploadError.message || '')) {
        return c.json({
          error: 'Storage not set up: the "make-cf230d31-models" bucket does not exist in this Supabase project yet. Run supabase/migrations/0001_init_kv_store_and_storage.sql in the Supabase Dashboard > SQL Editor once, then try uploading again.'
        }, 500);
      }
      return c.json({ error: 'Failed to upload file' }, 500);
    }

    // Create signed URL for access
    const { data: signedUrlData } = await supabase.storage
      .from('make-cf230d31-models')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

    // Thumbnail is optional and user-supplied at upload time - there is no automatic
    // model-to-image rendering on the server, so without this the model has no thumbnail
    // at all until one is manually picked here.
    let thumbnailUrl: string | undefined;
    if (thumbnailFile && thumbnailFile.size > 0) {
      const thumbFileName = `${Date.now()}-${thumbnailFile.name}`;
      const thumbPath = `thumbnails/${thumbFileName}`;
      const { error: thumbUploadError } = await supabase.storage
        .from('make-cf230d31-models')
        .upload(thumbPath, thumbnailFile);
      if (thumbUploadError) {
        console.error('Thumbnail upload error:', thumbUploadError);
      } else {
        const { data: thumbSignedUrlData } = await supabase.storage
          .from('make-cf230d31-models')
          .createSignedUrl(thumbPath, 60 * 60 * 24 * 365);
        thumbnailUrl = thumbSignedUrlData?.signedUrl;
      }
    }

    // Store model metadata
    const modelId = `model_${Date.now()}`;
    const modelData = {
      id: modelId,
      name: title,
      description,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
      fileName,
      filePath,
      fileSize: file.size,
      format: file.name.split('.').pop()?.toLowerCase(),
      uploadedBy: user.id,
      uploadedByUsername: username,
      assignedClients,
      uploadDate: new Date().toISOString(),
      views: 0,
      signedUrl: signedUrlData?.signedUrl,
      thumbnail: thumbnailUrl
    };

    await kv.set(`model:${modelId}`, modelData);
    
    // Update assigned clients
    for (const clientUsername of assignedClients) {
      const clients = await kv.getByPrefix('user:');
      const client = clients.find(c => c.username === clientUsername);
      if (client) {
        client.assignedModels = client.assignedModels || [];
        client.assignedModels.push(modelId);
        await kv.set(`user:${client.id}`, client);
      }
    }
    
    // Log audit event
    await logAuditEvent(
      user.id,
      username,
      'MODEL_UPLOADED',
      title,
      `Uploaded model: ${title} (${file.size} bytes)`,
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );

    return c.json({
      message: 'Model uploaded successfully',
      model: modelData 
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : String(error);
    // Same root cause as the storage-bucket check above, but on the metadata side: the
    // kv_store_cf230d31 table itself missing (also fixed by the same migration).
    if (/kv_store_cf230d31/i.test(message) || /relation .* does not exist/i.test(message)) {
      return c.json({
        error: 'Database not set up: the "kv_store_cf230d31" table does not exist in this Supabase project yet. Run supabase/migrations/0001_init_kv_store_and_storage.sql in the Supabase Dashboard > SQL Editor once, then try uploading again.'
      }, 500);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Finalizes a model record for a file the client already uploaded DIRECTLY to Supabase
// Storage (via the TUS resumable protocol - see UserUploadForm.tsx/admin/UploadPage.tsx),
// instead of proxying the whole file body through this Edge Function the way
// /upload-model above does. Edge Functions are not a reliable path for large request
// bodies - fine for a small file, but this app needs to support uploads up to 5GB, well
// beyond what should ever be sent through a function invocation. The direct-upload path
// relies on the storage.objects RLS policies in
// supabase/migrations/0002_direct_upload_storage_policies.sql for the actual admin-only
// enforcement at upload time; this endpoint's own admin check below still gates who can
// create the resulting model record, and (re-)verifies the file really exists at the
// given path rather than trusting the client's claim about what it uploaded.
app.post('/make-server-cf230d31/finalize-model-upload', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const userRole = user.user_metadata?.role || 'client';
    const isAdmin = userRole === 'admin';
    const username = user.user_metadata?.username || user.email || 'user';

    if (!isAdmin) {
      return c.json({ error: 'Only administrators can upload models' }, 403);
    }

    const body = await c.req.json();
    const { filePath, r2Key, fileName, fileSize, format, thumbnailPath, thumbnailR2Key, title, description, tags, assignedClients: assignedClientsRaw } = body;

    if ((!filePath && !r2Key) || !fileName || !title) {
      return c.json({ error: 'Missing required fields (filePath or r2Key, fileName, title)' }, 400);
    }
    const assignedClients = Array.isArray(assignedClientsRaw) ? assignedClientsRaw : [];

    let resolvedSignedUrl: string;
    if (r2Key) {
      // R2 objects are served from the bucket's public-access URL directly (see
      // getR2PublicUrlBase) rather than a time-limited signed URL - the multipart
      // upload completing successfully (checked in /r2-complete-upload before this
      // endpoint is ever called) is what confirms the object exists, so there's no
      // separate existence check to make here the way the Supabase path below needs.
      resolvedSignedUrl = `${getR2PublicUrlBase()}/${r2Key}`;
    } else {
      // Confirm the file actually landed in Storage at the claimed path rather than
      // trusting the client - createSignedUrl fails for a path with no object there.
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('make-cf230d31-models')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('Finalize upload error - file not found in storage:', signedUrlError);
        return c.json({ error: 'Uploaded file not found in storage at the given path - the upload may not have completed' }, 400);
      }
      resolvedSignedUrl = signedUrlData.signedUrl;
    }

    let thumbnailUrl: string | undefined;
    if (thumbnailR2Key) {
      thumbnailUrl = `${getR2PublicUrlBase()}/${thumbnailR2Key}`;
    } else if (thumbnailPath) {
      const { data: thumbSignedUrlData } = await supabase.storage
        .from('make-cf230d31-models')
        .createSignedUrl(thumbnailPath, 60 * 60 * 24 * 365);
      thumbnailUrl = thumbSignedUrlData?.signedUrl;
    }

    const modelId = `model_${Date.now()}`;
    const modelData = {
      id: modelId,
      name: title,
      description,
      tags: String(tags || '').split(',').map((tag: string) => tag.trim()).filter(Boolean),
      fileName,
      filePath: filePath || r2Key,
      storageProvider: r2Key ? 'r2' : 'supabase',
      fileSize: Number(fileSize) || 0,
      format: String(format || fileName.split('.').pop() || '').toLowerCase(),
      uploadedBy: user.id,
      uploadedByUsername: username,
      assignedClients,
      uploadDate: new Date().toISOString(),
      views: 0,
      signedUrl: resolvedSignedUrl,
      thumbnail: thumbnailUrl
    };

    await kv.set(`model:${modelId}`, modelData);

    for (const clientUsername of assignedClients) {
      const clients = await kv.getByPrefix('user:');
      const client = clients.find((c: any) => c.username === clientUsername);
      if (client) {
        client.assignedModels = client.assignedModels || [];
        client.assignedModels.push(modelId);
        await kv.set(`user:${client.id}`, client);
      }
    }

    await logAuditEvent(
      user.id,
      username,
      'MODEL_UPLOADED',
      title,
      `Uploaded model: ${title} (${modelData.fileSize} bytes, direct-to-storage)`,
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );

    return c.json({
      message: 'Model uploaded successfully',
      model: modelData
    });

  } catch (error) {
    console.error('Finalize upload error:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (/kv_store_cf230d31/i.test(message) || /relation .* does not exist/i.test(message)) {
      return c.json({
        error: 'Database not set up: the "kv_store_cf230d31" table does not exist in this Supabase project yet. Run supabase/migrations/0001_init_kv_store_and_storage.sql in the Supabase Dashboard > SQL Editor once, then try uploading again.'
      }, 500);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Cloudflare R2 multipart upload (large model files) - four small steps instead of one
// endpoint receiving the file, so the actual bytes go directly from the browser to R2 and
// never pass through this Edge Function at all:
//   1. /r2-start-upload      - opens a multipart upload, returns { uploadId, key }
//   2. /r2-part-url          - a presigned PUT URL for ONE part (client uploads to R2
//                              directly with this, retrying just that one part on failure -
//                              this per-part retry is what gives large uploads real
//                              resilience on a bad connection, the same goal Supabase's TUS
//                              protocol served for the smaller Supabase-Storage path)
//   3. /r2-complete-upload   - finalizes the object once every part has succeeded
//   4. /r2-abort-upload      - cleans up an in-progress upload that won't be finished
//                              (otherwise incomplete parts sit in the bucket accruing
//                              storage cost indefinitely)
// All four require the same admin role /upload-model already enforces - R2 has no
// equivalent to Supabase's storage.objects RLS policies, so this Edge Function is the
// only gate here, not an extra/redundant one.

async function requireAdminForR2(c: any): Promise<{ user: any; username: string } | Response> {
  const { error, user } = await verifyUser(c.req.raw);
  if (error) return c.json({ error }, 401);
  const { isAdmin, username } = requireAdminRole(user);
  if (!isAdmin) return c.json({ error: 'Only administrators can upload models' }, 403);
  return { user, username };
}

app.post('/make-server-cf230d31/r2-start-upload', async (c) => {
  const auth = await requireAdminForR2(c);
  if (auth instanceof Response) return auth;

  try {
    const { fileName, contentType, pathPrefix } = await c.req.json();
    if (!fileName) {
      return c.json({ error: 'Missing fileName' }, 400);
    }
    const safePrefix = pathPrefix === 'thumbnails' ? 'thumbnails' : 'models';
    const key = `${safePrefix}/${Date.now()}-${String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const client = getR2Client();
    const result = await client.send(new CreateMultipartUploadCommand({
      Bucket: getR2Bucket(),
      Key: key,
      ContentType: contentType || 'application/octet-stream'
    }));

    return c.json({ uploadId: result.UploadId, key });
  } catch (error) {
    console.error('R2 start upload error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to start upload' }, 500);
  }
});

app.post('/make-server-cf230d31/r2-part-url', async (c) => {
  const auth = await requireAdminForR2(c);
  if (auth instanceof Response) return auth;

  try {
    const { key, uploadId, partNumber } = await c.req.json();
    if (!key || !uploadId || !partNumber) {
      return c.json({ error: 'Missing key, uploadId, or partNumber' }, 400);
    }

    const client = getR2Client();
    const url = await getSignedUrl(client, new UploadPartCommand({
      Bucket: getR2Bucket(),
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber
    }), { expiresIn: 3600 }); // 1 hour - generous for one ~8MB part even on a slow link

    return c.json({ url });
  } catch (error) {
    console.error('R2 part URL error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to get part upload URL' }, 500);
  }
});

app.post('/make-server-cf230d31/r2-complete-upload', async (c) => {
  const auth = await requireAdminForR2(c);
  if (auth instanceof Response) return auth;

  try {
    const { key, uploadId, parts } = await c.req.json();
    if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      return c.json({ error: 'Missing key, uploadId, or parts' }, 400);
    }

    const client = getR2Client();
    await client.send(new CompleteMultipartUploadCommand({
      Bucket: getR2Bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p: { partNumber: number; eTag: string }) => ({ PartNumber: p.partNumber, ETag: p.eTag }))
      }
    }));

    return c.json({ key, url: `${getR2PublicUrlBase()}/${key}` });
  } catch (error) {
    console.error('R2 complete upload error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to complete upload' }, 500);
  }
});

app.post('/make-server-cf230d31/r2-abort-upload', async (c) => {
  const auth = await requireAdminForR2(c);
  if (auth instanceof Response) return auth;

  try {
    const { key, uploadId } = await c.req.json();
    if (!key || !uploadId) {
      return c.json({ error: 'Missing key or uploadId' }, 400);
    }

    const client = getR2Client();
    await client.send(new AbortMultipartUploadCommand({
      Bucket: getR2Bucket(),
      Key: key,
      UploadId: uploadId
    }));

    return c.json({ message: 'Upload aborted' });
  } catch (error) {
    console.error('R2 abort upload error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to abort upload' }, 500);
  }
});

// Get models (different for admin vs client)
app.get('/make-server-cf230d31/models', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);
  
  if (error) {
    return c.json({ error }, 401);
  }
  
  try {
    const allModels = await kv.getByPrefix('model:');
    const userRole = user.user_metadata?.role || 'client';
    
    let models = [];
    
    if (userRole === 'admin') {
      // Admin can see all models
      models = allModels;
    } else {
      // Client can see assigned models and models they uploaded.
      const userData = await kv.get(`user:${user.id}`);
      const assignedModelIds = userData?.assignedModels || [];
      const username = user.user_metadata?.username;
      models = allModels.filter(model => 
        model.uploadedBy === user.id ||
        (username && Array.isArray(model.assignedClients) && model.assignedClients.includes(username)) ||
        assignedModelIds.includes(model.id)
      );
    }
    
    // Refresh signed URLs if needed
    for (const model of models) {
      if (!model.signedUrl) {
        const { data: signedUrlData } = await supabase.storage
          .from('make-cf230d31-models')
          .createSignedUrl(model.filePath, 60 * 60 * 24 * 365);
        
        if (signedUrlData?.signedUrl) {
          model.signedUrl = signedUrlData.signedUrl;
          await kv.set(`model:${model.id}`, model);
        }
      }
    }
    
    return c.json({ models });
    
  } catch (error) {
    console.error('Models fetch error:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (/kv_store_cf230d31/i.test(message) || /relation .* does not exist/i.test(message)) {
      return c.json({
        error: 'Database not set up: the "kv_store_cf230d31" table does not exist in this Supabase project yet. Run supabase/migrations/0001_init_kv_store_and_storage.sql in the Supabase Dashboard > SQL Editor once, then reload.'
      }, 500);
    }
    return c.json({ error: 'Failed to fetch models' }, 500);
  }
});

// Delete model (Admin only)
app.delete('/make-server-cf230d31/models/:id', async (c) => {
  const { error, user } = await verifyAdmin(c.req.raw);
  
  if (error) {
    return c.json({ error }, 401);
  }
  
  try {
    const modelId = c.req.param('id');
    const model = await kv.get(`model:${modelId}`);
    
    if (!model) {
      return c.json({ error: 'Model not found' }, 404);
    }
    
    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from('make-cf230d31-models')
      .remove([model.filePath]);
    
    if (deleteError) {
      console.error('Storage delete error:', deleteError);
    }
    
    // Remove from KV store
    await kv.del(`model:${modelId}`);
    
    // Remove from assigned clients
    const allUsers = await kv.getByPrefix('user:');
    for (const userData of allUsers) {
      if (userData.assignedModels && userData.assignedModels.includes(modelId)) {
        userData.assignedModels = userData.assignedModels.filter(id => id !== modelId);
        await kv.set(`user:${userData.id}`, userData);
      }
    }
    
    // Log audit event
    await logAuditEvent(
      user.id,
      user.user_metadata?.username || 'admin',
      'MODEL_DELETED',
      model.name,
      `Deleted model: ${model.name}`,
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );
    
    return c.json({ message: 'Model deleted successfully' });
    
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get clients (Admin only)
app.get('/make-server-cf230d31/clients', async (c) => {
  const { error, user } = await verifyAdmin(c.req.raw);
  
  if (error) {
    return c.json({ error }, 401);
  }
  
  try {
    const allUsers = await kv.getByPrefix('user:');
    const clients = allUsers.filter(userData => userData.role === 'client');
    
    return c.json({ clients });
    
  } catch (error) {
    console.error('Clients fetch error:', error);
    return c.json({ error: 'Failed to fetch clients' }, 500);
  }
});

// Assign model to client (Admin only)
app.post('/make-server-cf230d31/assign-model', async (c) => {
  const { error, user } = await verifyAdmin(c.req.raw);
  
  if (error) {
    return c.json({ error }, 401);
  }
  
  try {
    const { modelId, clientUsernames } = await c.req.json();
    
    const model = await kv.get(`model:${modelId}`);
    if (!model) {
      return c.json({ error: 'Model not found' }, 404);
    }
    
    // Update model's assigned clients
    model.assignedClients = clientUsernames;
    await kv.set(`model:${modelId}`, model);
    
    // Update clients' assigned models
    const allUsers = await kv.getByPrefix('user:');
    for (const userData of allUsers) {
      if (userData.role === 'client') {
        userData.assignedModels = userData.assignedModels || [];
        
        if (clientUsernames.includes(userData.username)) {
          // Add model if not already assigned
          if (!userData.assignedModels.includes(modelId)) {
            userData.assignedModels.push(modelId);
          }
        } else {
          // Remove model if previously assigned
          userData.assignedModels = userData.assignedModels.filter(id => id !== modelId);
        }
        
        await kv.set(`user:${userData.id}`, userData);
      }
    }
    
    // Log audit event
    await logAuditEvent(
      user.id,
      user.user_metadata?.username || 'admin',
      'MODEL_ASSIGNED',
      `${sanitizeInput(model.name)} → ${clientUsernames.map(sanitizeInput).join(', ')}`,
      `Assigned model to clients: ${clientUsernames.map(sanitizeInput).join(', ')}`,
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );
    
    return c.json({ message: 'Model assigned successfully' });
    
  } catch (error) {
    console.error('Assignment error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get audit logs (Admin only)
app.get('/make-server-cf230d31/audit-logs', async (c) => {
  const { error, user } = await verifyAdmin(c.req.raw);
  
  if (error) {
    return c.json({ error }, 401);
  }
  
  try {
    const logs = await kv.getByPrefix('audit_log:');
    
    // Sort by timestamp (most recent first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return c.json({ logs });
    
  } catch (error) {
    console.error('Audit logs fetch error:', error);
    return c.json({ error: 'Failed to fetch audit logs' }, 500);
  }
});

// Update model view count
app.post('/make-server-cf230d31/models/:id/view', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);
  
  if (error) {
    return c.json({ error }, 401);
  }
  
  try {
    const modelId = c.req.param('id');
    const model = await kv.get(`model:${modelId}`);
    
    if (!model) {
      return c.json({ error: 'Model not found' }, 404);
    }
    
    // Check if user has access to this model
    const userRole = user.user_metadata?.role || 'client';
    if (userRole !== 'admin' && !model.assignedClients.includes(user.user_metadata?.username)) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Increment view count
    model.views = (model.views || 0) + 1;
    await kv.set(`model:${modelId}`, model);
    
    // Log audit event
    await logAuditEvent(
      user.id,
      user.user_metadata?.username || 'user',
      'MODEL_VIEWED',
      model.name,
      `Viewed model in workspace`,
      c.req.header('cf-connecting-ip') || 'unknown',
      c.req.header('user-agent') || 'unknown'
    );
    
    return c.json({ message: 'View recorded', views: model.views });
    
  } catch (error) {
    console.error('View update error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// System stats (Admin only)
app.get('/make-server-cf230d31/stats', async (c) => {
  const { error, user } = await verifyAdmin(c.req.raw);
  
  if (error) {
    return c.json({ error }, 401);
  }
  
  try {
    const models = await kv.getByPrefix('model:');
    const users = await kv.getByPrefix('user:');
    const clients = users.filter(u => u.role === 'client');
    const logs = await kv.getByPrefix('audit_log:');
    
    const totalSize = models.reduce((sum, model) => sum + (model.fileSize || 0), 0);
    const recentLogs = logs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      return logTime > oneDayAgo;
    });
    
    const stats = {
      totalModels: models.length,
      totalClients: clients.length,
      totalUsers: users.length,
      storageUsed: (totalSize / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      storageBytes: totalSize,
      totalViews: models.reduce((sum, model) => sum + (model.views || 0), 0),
      recentActivity: recentLogs.length,
      errorCount: logs.filter(log => log.severity === 'error').length,
      warningCount: logs.filter(log => log.severity === 'warning').length
    };
    
    return c.json({ stats });
    
  } catch (error) {
    console.error('Stats fetch error:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// IoT API Endpoints

// Get all sensors
app.get('/api/iot/sensors', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    const sensors = iotService.getAllSensors();

    return c.json({ sensors });

  } catch (error) {
    console.error('IoT sensors fetch error:', error);
    return c.json({ error: 'Failed to fetch sensors' }, 500);
  }
});

// Get all devices
// Get audit logs (already written by logAuditEvent() throughout this file, but never
// exposed via a route until now - the admin Audit Logs page showed static mock data)
// Get annotations for a workspace
// NOTE: registered under /make-server-cf230d31/... like every other route in
// this file, since Supabase routes the whole /functions/v1/make-server-cf230d31/*
// path to this one function - a bare /api/annotations/:roomId (missing that
// prefix) never matched any real incoming request and 404'd unconditionally.
app.get('/make-server-cf230d31/api/annotations/:roomId', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const roomId = c.req.param('roomId');
    const annotations = await kv.getByPrefix(`annotation:${roomId}:`);
    return c.json({ annotations: annotations || [] });
  } catch (error) {
    console.error('Annotations fetch error:', error);
    return c.json({ error: 'Failed to fetch annotations' }, 500);
  }
});

// Create an annotation
app.post('/make-server-cf230d31/api/annotations/:roomId', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const roomId = c.req.param('roomId');
    const { text, position } = await c.req.json();
    if (!text || !position) {
      return c.json({ error: 'text and position are required' }, 400);
    }

    const annotation = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      roomId,
      text: sanitizeInput(text),
      position,
      authorId: user.id,
      authorName: user.user_metadata?.username || user.email,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`annotation:${roomId}:${annotation.id}`, annotation);

    return c.json({ message: 'Annotation created', annotation });
  } catch (error) {
    console.error('Annotation create error:', error);
    return c.json({ error: 'Failed to create annotation' }, 500);
  }
});

// Delete an annotation
app.delete('/make-server-cf230d31/api/annotations/:roomId/:annotationId', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const roomId = c.req.param('roomId');
    const annotationId = c.req.param('annotationId');
    const key = `annotation:${roomId}:${annotationId}`;
    const annotation = await kv.get(key);

    if (!annotation) {
      return c.json({ error: 'Annotation not found' }, 404);
    }
    // Only the author or an admin can delete an annotation
    const userRole = user.user_metadata?.role || 'client';
    if (annotation.authorId !== user.id && userRole !== 'admin') {
      return c.json({ error: 'Access denied' }, 403);
    }

    await kv.del(key);
    return c.json({ message: 'Annotation deleted' });
  } catch (error) {
    console.error('Annotation delete error:', error);
    return c.json({ error: 'Failed to delete annotation' }, 500);
  }
});

app.get('/make-server-cf230d31/api/admin/audit-logs', async (c) => {
  const { error, user } = await verifyAdmin(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const entries = await kv.getByPrefix('audit_log:');
    // Most recent first
    const logs = (entries || []).sort((a: any, b: any) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return c.json({ logs });
  } catch (error) {
    console.error('Audit logs fetch error:', error);
    return c.json({ error: 'Failed to fetch audit logs' }, 500);
  }
});

// Get admin settings
app.get('/make-server-cf230d31/api/admin/settings', async (c) => {
  const { error, user } = await verifyAdmin(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const settings = await kv.get('admin_settings');
    return c.json({ settings: settings || null });
  } catch (error) {
    console.error('Admin settings fetch error:', error);
    return c.json({ error: 'Failed to fetch settings' }, 500);
  }
});

// Save admin settings
app.put('/make-server-cf230d31/api/admin/settings', async (c) => {
  const { error, user } = await verifyAdmin(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const settings = await c.req.json();
    await kv.set('admin_settings', settings);
    return c.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Admin settings save error:', error);
    return c.json({ error: 'Failed to save settings' }, 500);
  }
});

app.get('/api/iot/devices', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    const devices = iotService.getAllDevices();

    return c.json({ devices });

  } catch (error) {
    console.error('IoT devices fetch error:', error);
    return c.json({ error: 'Failed to fetch devices' }, 500);
  }
});

// Get sensor value
app.get('/api/iot/sensors/:sensorId', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const sensorId = c.req.param('sensorId');
    const iotService = getIoTService();
    const value = iotService.getSensorValue(sensorId);

    if (value === null) {
      return c.json({ error: 'Sensor not found' }, 404);
    }

    return c.json({ sensorId, value });

  } catch (error) {
    console.error('IoT sensor value fetch error:', error);
    return c.json({ error: 'Failed to fetch sensor value' }, 500);
  }
});

// Control device
app.post('/api/iot/devices/:deviceId/control', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const deviceId = c.req.param('deviceId');
    const { command } = await c.req.json();

    if (!['on', 'off', 'toggle'].includes(command)) {
      return c.json({ error: 'Invalid command' }, 400);
    }

    const iotService = getIoTService();
    const success = await iotService.controlDevice(deviceId, command);

    if (!success) {
      return c.json({ error: 'Failed to control device' }, 400);
    }

    return c.json({ message: 'Device controlled successfully', deviceId, command });

  } catch (error) {
    console.error('IoT device control error:', error);
    return c.json({ error: 'Failed to control device' }, 500);
  }
});

// Get energy history
app.get('/api/iot/energy-history', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const hours = parseInt(c.req.query('hours') || '24');
    const iotService = getIoTService();
    const history = iotService.getEnergyHistory(hours);

    return c.json({ history });

  } catch (error) {
    console.error('IoT energy history fetch error:', error);
    return c.json({ error: 'Failed to fetch energy history' }, 500);
  }
});

// Get sensor alerts
app.get('/api/iot/alerts', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    const alerts = iotService.getSensorAlerts();

    return c.json({ alerts });

  } catch (error) {
    console.error('IoT alerts fetch error:', error);
    return c.json({ error: 'Failed to fetch alerts' }, 500);
  }
});

// Get simulation status
app.get('/api/iot/simulation/status', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    const status = iotService.getSimulationStatus();

    return c.json({ status });

  } catch (error) {
    console.error('IoT simulation status fetch error:', error);
    return c.json({ error: 'Failed to fetch simulation status' }, 500);
  }
});

// Start simulation
app.post('/api/iot/simulation/start', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    iotService.startSimulation();

    return c.json({ message: 'IoT simulation started' });

  } catch (error) {
    console.error('IoT simulation start error:', error);
    return c.json({ error: 'Failed to start simulation' }, 500);
  }
});

// Stop simulation
app.post('/api/iot/simulation/stop', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    iotService.stopSimulation();

    return c.json({ message: 'IoT simulation stopped' });

  } catch (error) {
    console.error('IoT simulation stop error:', error);
    return c.json({ error: 'Failed to stop simulation' }, 500);
  }
});

// Update simulation config
app.put('/api/iot/simulation/config', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const config = await c.req.json();
    const iotService = getIoTService();
    iotService.updateSimulationConfig(config);

    return c.json({ message: 'Simulation config updated' });

  } catch (error) {
    console.error('IoT simulation config update error:', error);
    return c.json({ error: 'Failed to update simulation config' }, 500);
  }
});

// Export IoT data
app.get('/api/iot/export', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    const data = iotService.exportIoTData();

    return c.json({ data });

  } catch (error) {
    console.error('IoT data export error:', error);
    return c.json({ error: 'Failed to export IoT data' }, 500);
  }
});

// Simulate environmental conditions
app.post('/api/iot/environment/simulate', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    const conditions = await iotService.simulateEnvironmentalConditions();

    return c.json({ conditions });

  } catch (error) {
    console.error('IoT environmental simulation error:', error);
    return c.json({ error: 'Failed to simulate environmental conditions' }, 500);
  }
});

// Create automation rule
app.post('/api/iot/automation/rules', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const { trigger, action } = await c.req.json();
    const iotService = getIoTService();
    const ruleId = await iotService.createAutomationRule(trigger, action);

    return c.json({ message: 'Automation rule created', ruleId });

  } catch (error) {
    console.error('IoT automation rule creation error:', error);
    return c.json({ error: 'Failed to create automation rule' }, 500);
  }
});

// Execute automation rule
app.post('/api/iot/automation/rules/:ruleId/execute', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const ruleId = c.req.param('ruleId');
    const iotService = getIoTService();
    const success = await iotService.executeAutomationRule(ruleId);

    if (!success) {
      return c.json({ error: 'Rule not found or execution failed' }, 404);
    }

    return c.json({ message: 'Automation rule executed successfully' });

  } catch (error) {
    console.error('IoT automation rule execution error:', error);
    return c.json({ error: 'Failed to execute automation rule' }, 500);
  }
});

// Energy optimization
app.get('/api/iot/energy/optimize', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    const optimization = await iotService.optimizeEnergyUsage();

    return c.json({ optimization });

  } catch (error) {
    console.error('IoT energy optimization error:', error);
    return c.json({ error: 'Failed to optimize energy usage' }, 500);
  }
});

// Predictive maintenance
app.get('/api/iot/maintenance/predict', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    const predictions = await iotService.predictMaintenanceNeeds();

    return c.json({ predictions });

  } catch (error) {
    console.error('IoT predictive maintenance error:', error);
    return c.json({ error: 'Failed to predict maintenance needs' }, 500);
  }
});

// Create smart schedule
app.post('/api/iot/schedules', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const { deviceId, schedule } = await c.req.json();
    const iotService = getIoTService();
    const success = await iotService.createSmartSchedule(deviceId, schedule);

    if (!success) {
      return c.json({ error: 'Failed to create smart schedule' }, 400);
    }

    return c.json({ message: 'Smart schedule created successfully' });

  } catch (error) {
    console.error('IoT smart schedule creation error:', error);
    return c.json({ error: 'Failed to create smart schedule' }, 500);
  }
});

// Environmental impact analysis
app.get('/api/iot/environment/impact', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const iotService = getIoTService();
    const impact = await iotService.calculateEnvironmentalImpact();

    return c.json({ impact });

  } catch (error) {
    console.error('IoT environmental impact analysis error:', error);
    return c.json({ error: 'Failed to calculate environmental impact' }, 500);
  }
});

// Add custom sensor
app.post('/api/iot/sensors', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const sensor = await c.req.json();
    const iotService = getIoTService();
    iotService.addSensor(sensor);

    return c.json({ message: 'Sensor added successfully' });

  } catch (error) {
    console.error('IoT sensor addition error:', error);
    return c.json({ error: 'Failed to add sensor' }, 500);
  }
});

// Add custom device
app.post('/api/iot/devices', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const device = await c.req.json();
    const iotService = getIoTService();
    iotService.addDevice(device);

    return c.json({ message: 'Device added successfully' });

  } catch (error) {
    console.error('IoT device addition error:', error);
    return c.json({ error: 'Failed to add device' }, 500);
  }
});

// Remove sensor
app.delete('/api/iot/sensors/:sensorId', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const sensorId = c.req.param('sensorId');
    const iotService = getIoTService();
    const success = iotService.removeSensor(sensorId);

    if (!success) {
      return c.json({ error: 'Sensor not found' }, 404);
    }

    return c.json({ message: 'Sensor removed successfully' });

  } catch (error) {
    console.error('IoT sensor removal error:', error);
    return c.json({ error: 'Failed to remove sensor' }, 500);
  }
});

// Remove device
app.delete('/api/iot/devices/:deviceId', async (c) => {
  const { error, user } = await verifyUser(c.req.raw);

  if (error) {
    return c.json({ error }, 401);
  }

  try {
    const deviceId = c.req.param('deviceId');
    const iotService = getIoTService();
    const success = iotService.removeDevice(deviceId);

    if (!success) {
      return c.json({ error: 'Device not found' }, 404);
    }

    return c.json({ message: 'Device removed successfully' });

  } catch (error) {
    console.error('IoT device removal error:', error);
    return c.json({ error: 'Failed to remove device' }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

Deno.serve(app.fetch);
