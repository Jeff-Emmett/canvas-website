import { handleUnfurlRequest } from "cloudflare-workers-unfurl"
import { AutoRouter, cors, error, IRequest } from "itty-router"
import { handleAssetDownload, handleAssetUpload } from "./assetUploads"
import { Environment } from "./types"
import Stripe from "stripe"

// make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from "./TldrawDurableObject"

// Helper function to get price amount
async function getPriceAmount(priceId: string, stripe: Stripe): Promise<number> {
  const price = await stripe.prices.retrieve(priceId);
  return price.unit_amount || 0;
}

// Define security headers
const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; connect-src 'self' wss: https:; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

// we use itty-router (https://itty.dev/) to handle routing. in this example we turn on CORS because
// we're hosting the worker separately to the client. you should restrict this to your own domain.
const { preflight, corsify } = cors({
  origin: (origin) => {
    const allowedOrigins = [
      "https://jeffemmett.com",
      "https://www.jeffemmett.com",
      "https://jeffemmett-canvas.jeffemmett.workers.dev",
      "https://jeffemmett.com/board/*",
    ]

    // Always allow if no origin (like from a local file)
    if (!origin) return "*"

    // Check exact matches
    if (allowedOrigins.includes(origin)) {
      return origin
    }

    // For development - check if it's a localhost or local IP (both http and https)
    if (
      origin.match(
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|169\.254\.|10\.)/,
      )
    ) {
      return origin
    }

    // If no match found, return * to allow all origins
    return "*"
  },
  allowMethods: ["GET", "POST", "HEAD", "OPTIONS", "UPGRADE"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "Upgrade",
    "Connection",
    "Sec-WebSocket-Key",
    "Sec-WebSocket-Version",
    "Sec-WebSocket-Extensions",
    "Sec-WebSocket-Protocol",
    "Content-Length",
    "Content-Range",
    "Range",
    "If-None-Match",
    "If-Modified-Since",
    "*"
  ],
  maxAge: 86400,
  credentials: true,
})
const router = AutoRouter<IRequest, [env: Environment, ctx: ExecutionContext]>({
  before: [preflight],
  finally: [
    (response) => {
      // Add security headers to all responses except WebSocket upgrades
      if (response.status !== 101) {
        Object.entries(securityHeaders).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
      }
      return corsify(response)
    },
  ],
  catch: (e: Error) => {
    // Silently handle WebSocket errors, but log other errors
    if (e.message?.includes("WebSocket")) {
      console.debug("WebSocket error:", e)
      return new Response(null, { status: 400 })
    }
    console.error(e)
    return error(e)
  },
})
  // requests to /connect are routed to the Durable Object, and handle realtime websocket syncing
  .get("/connect/:roomId", (request, env) => {
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.TLDRAW_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      headers: request.headers,
      body: request.body,
      method: request.method,
    })
  })

  // assets can be uploaded to the bucket under /uploads:
  .post("/uploads/:uploadId", handleAssetUpload)

  // they can be retrieved from the bucket too:
  .get("/uploads/:uploadId", handleAssetDownload)

  // bookmarks need to extract metadata from pasted URLs:
  .get("/unfurl", handleUnfurlRequest)

  .get("/room/:roomId", (request, env) => {
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.TLDRAW_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      headers: request.headers,
      body: request.body,
      method: request.method,
    })
  })

  .post("/room/:roomId", async (request, env) => {
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId)
    const room = env.TLDRAW_DURABLE_OBJECT.get(id)
    return room.fetch(request.url, {
      method: "POST",
      body: request.body,
    })
  })

  .post("/daily/rooms", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      })

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Add new transcription endpoints
  .post("/daily/rooms/:roomName/start-transcription", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    const { roomName } = req.params
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}/transcription/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  .post("/daily/rooms/:roomName/stop-transcription", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    const { roomName } = req.params
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}/transcription/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Add endpoint to get transcript access link
  .get("/daily/transcript/:transcriptId/access-link", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    const { transcriptId } = req.params
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(`https://api.daily.co/v1/transcript/${transcriptId}/access-link`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Add endpoint to get transcript text
  .get("/daily/transcript/:transcriptId", async (req) => {
    const apiKey = req.headers.get('Authorization')?.split('Bearer ')[1]
    const { transcriptId } = req.params
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key provided' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const response = await fetch(`https://api.daily.co/v1/transcripts/${transcriptId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  // Stripe API routes
  .post("/api/stripe/create-subscription", async (req, env) => {
    try {
      const body = await req.json() as {
        priceId: string;
        customerEmail?: string;
        metadata?: Record<string, string>;
      };

      // Initialize Stripe with your secret key
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-05-28.basil',
      });

      // Create or get customer
      let customer;
      if (body.customerEmail) {
        const existingCustomers = await stripe.customers.list({
          email: body.customerEmail,
          limit: 1,
        });
        
        if (existingCustomers.data.length > 0) {
          customer = existingCustomers.data[0];
        } else {
          customer = await stripe.customers.create({
            email: body.customerEmail,
            metadata: body.metadata,
          });
        }
      } else {
        customer = await stripe.customers.create({
          metadata: body.metadata,
        });
      }

      // Create a payment intent for the first payment
      const paymentIntent = await stripe.paymentIntents.create({
        amount: await getPriceAmount(body.priceId, stripe),
        currency: 'cad',
        customer: customer.id,
        description: `Subscription payment for ${body.metadata?.planName || 'plan'}`,
        metadata: {
          ...body.metadata,
          price_id: body.priceId,
          customer_id: customer.id,
        },
        automatic_payment_methods: {
          enabled: true,
        },
        setup_future_usage: 'off_session', // Allow future payments for subscription
      });

      console.log('Payment intent created:', paymentIntent.id);

      return new Response(JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        customer_id: customer.id,
        price_id: body.priceId,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Stripe subscription creation error:', error);
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  })

  .post("/api/stripe/create-payment-intent", async (req: Request, env: Environment) => {
    try {
      const body = await req.json() as {
        amount: number;
        currency: string;
        description: string;
        customerEmail?: string;
        metadata?: Record<string, string>;
      };

      // Initialize Stripe with your secret key
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-05-28.basil',
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: body.amount,
        currency: body.currency,
        description: body.description,
        receipt_email: body.customerEmail,
        metadata: body.metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return new Response(JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  })

  .post("/api/stripe/webhook", async (req: Request, env: Environment) => {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature', { status: 400 });
    }

    try {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-05-28.basil',
      });

      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );

      switch (event.type) {
        case 'customer.subscription.created':
          const subscription = event.data.object;
          console.log('Subscription created:', subscription.id);
          await notifySubscriptionCreated(subscription);
          break;

        case 'customer.subscription.updated':
          const updatedSubscription = event.data.object;
          console.log('Subscription updated:', updatedSubscription.id);
          await notifySubscriptionUpdated(updatedSubscription);
          break;

        case 'customer.subscription.deleted':
          const deletedSubscription = event.data.object;
          console.log('Subscription deleted:', deletedSubscription.id);
          await notifySubscriptionDeleted(deletedSubscription);
          break;

        case 'invoice.payment_succeeded':
          const invoice = event.data.object;
          console.log('Invoice payment succeeded:', invoice.id);
          await notifyInvoicePaymentSucceeded(invoice);
          break;

        case 'invoice.payment_failed':
          const failedInvoice = event.data.object;
          console.log('Invoice payment failed:', failedInvoice.id);
          await notifyInvoicePaymentFailed(failedInvoice);
          break;

        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          console.log('Payment succeeded:', paymentIntent.id);
          await notifyPaymentSuccess(paymentIntent);
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          console.log('Payment failed:', failedPayment.id);
          await notifyPaymentFailure(failedPayment);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return new Response('Webhook handled', { status: 200 });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('Webhook error', { status: 400 });
    }
  })

async function notifySubscriptionCreated(subscription: any) {
  console.log('Subscription created notification:', subscription.id);
}

async function notifySubscriptionUpdated(subscription: any) {
  console.log('Subscription updated notification:', subscription.id);
}

async function notifySubscriptionDeleted(subscription: any) {
  console.log('Subscription deleted notification:', subscription.id);
}

async function notifyInvoicePaymentSucceeded(invoice: any) {
  console.log('Invoice payment succeeded notification:', invoice.id);
}

async function notifyInvoicePaymentFailed(invoice: any) {
  console.log('Invoice payment failed notification:', invoice.id);
}

async function notifyPaymentSuccess(paymentIntent: any) {
  // Implementation depends on your notification system
  // Could update database, send email, or trigger real-time updates
  console.log('Payment success notification:', paymentIntent.id);
}

async function notifyPaymentFailure(paymentIntent: any) {
  // Implementation depends on your notification system
  console.log('Payment failure notification:', paymentIntent.id);
}

async function backupAllBoards(env: Environment) {
  try {
    // List all room files from TLDRAW_BUCKET
    const roomsList = await env.TLDRAW_BUCKET.list({ prefix: 'rooms/' })
    
    const date = new Date().toISOString().split('T')[0]
    
    // Process each room
    for (const room of roomsList.objects) {
      try {
        // Get the room data
        const roomData = await env.TLDRAW_BUCKET.get(room.key)
        if (!roomData) continue

        // Get the data as text since it's already stringified JSON
        const jsonData = await roomData.text()
        
        // Create backup key with date only
        const backupKey = `${date}/${room.key}`
        
        // Store in backup bucket as JSON
        await env.BOARD_BACKUPS_BUCKET.put(backupKey, jsonData)
        
        console.log(`Backed up ${room.key} to ${backupKey}`)
      } catch (error) {
        console.error(`Failed to backup room ${room.key}:`, error)
      }
    }
    
    // Clean up old backups (keep last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const oldBackups = await env.BOARD_BACKUPS_BUCKET.list({
      prefix: thirtyDaysAgo.toISOString().split('T')[0]
    })
    
    for (const backup of oldBackups.objects) {
      await env.BOARD_BACKUPS_BUCKET.delete(backup.key)
    }
    
    return { success: true, message: 'Backup completed successfully' }
  } catch (error) {
    console.error('Backup failed:', error)
    return { success: false, message: (error as Error).message }
  }
}

router
  .get("/backup", async (_, env) => {
    const result = await backupAllBoards(env)
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })
  })

// export our router for cloudflare
export default router
