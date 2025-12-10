import { Environment, User, DeviceKey, VerificationToken } from './types';

// Generate a cryptographically secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate a UUID v4
function generateUUID(): string {
  return crypto.randomUUID();
}

// Send email via Resend
async function sendEmail(
  env: Environment,
  to: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  try {
    if (!env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return false;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.CRYPTID_EMAIL_FROM || 'CryptID <noreply@jeffemmett.com>',
        to: [to],
        subject,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend error:', errorText);
      return false;
    }

    const result = await response.json() as { id?: string };
    console.log('Email sent successfully, id:', result.id);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

// Clean up expired tokens
async function cleanupExpiredTokens(db: D1Database): Promise<void> {
  try {
    await db.prepare(
      "DELETE FROM verification_tokens WHERE expires_at < datetime('now') OR used = 1"
    ).run();
  } catch (error) {
    console.error('Token cleanup error:', error);
  }
}

/**
 * Link an email to an existing CryptID account (Device A)
 * POST /auth/link-email
 * Body: { email, cryptidUsername, publicKey, signature, challenge }
 */
export async function handleLinkEmail(
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const body = await request.json() as {
      email: string;
      cryptidUsername: string;
      publicKey: string;
      deviceName?: string;
    };

    const { email, cryptidUsername, publicKey, deviceName } = body;

    if (!email || !cryptidUsername || !publicKey) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if email is already linked to a different account
    const existingUser = await db.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first<User>();

    if (existingUser && existingUser.cryptid_username !== cryptidUsername) {
      return new Response(JSON.stringify({
        error: 'Email already linked to a different CryptID account'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if this public key is already registered
    const existingKey = await db.prepare(
      'SELECT * FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<DeviceKey>();

    if (existingKey) {
      // Key already registered, just need to verify email if not done
      if (existingUser && existingUser.email_verified) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Email already verified',
          emailVerified: true
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const userId = existingUser?.id || generateUUID();
    const userAgent = request.headers.get('User-Agent') || null;

    // Create or update user
    if (!existingUser) {
      await db.prepare(
        'INSERT INTO users (id, email, cryptid_username, email_verified) VALUES (?, ?, ?, 0)'
      ).bind(userId, email, cryptidUsername).run();
    }

    // Add device key if not exists
    if (!existingKey) {
      await db.prepare(
        'INSERT INTO device_keys (id, user_id, public_key, device_name, user_agent) VALUES (?, ?, ?, ?, ?)'
      ).bind(generateUUID(), userId, publicKey, deviceName || 'Primary Device', userAgent).run();
    }

    // If email not verified, send verification email
    if (!existingUser?.email_verified) {
      // Clean up old tokens
      await cleanupExpiredTokens(db);

      // Create verification token (24 hour expiry)
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await db.prepare(
        'INSERT INTO verification_tokens (id, email, token, token_type, expires_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(generateUUID(), email, token, 'email_verify', expiresAt).run();

      // Send verification email
      const verifyUrl = `${env.APP_URL || 'https://jeffemmett.com'}/verify-email?token=${token}`;
      const emailSent = await sendEmail(
        env,
        email,
        'Verify your CryptID email',
        `
        <h2>Verify your CryptID email</h2>
        <p>Click the link below to verify your email address for CryptID: <strong>${cryptidUsername}</strong></p>
        <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>This link expires in 24 hours.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        `
      );

      return new Response(JSON.stringify({
        success: true,
        message: emailSent ? 'Verification email sent' : 'Account created but email failed to send',
        emailVerified: false,
        emailSent
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Email already verified',
      emailVerified: true
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Link email error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Verify email via token (clicked from email)
 * GET /auth/verify-email/:token
 */
export async function handleVerifyEmail(
  token: string,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find token
    const tokenRecord = await db.prepare(
      "SELECT * FROM verification_tokens WHERE token = ? AND token_type = 'email_verify' AND used = 0 AND expires_at > datetime('now')"
    ).bind(token).first<VerificationToken>();

    if (!tokenRecord) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mark email as verified
    await db.prepare(
      "UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE email = ?"
    ).bind(tokenRecord.email).run();

    // Mark token as used
    await db.prepare(
      'UPDATE verification_tokens SET used = 1 WHERE id = ?'
    ).bind(tokenRecord.id).run();

    // Return success - frontend will redirect
    return new Response(JSON.stringify({
      success: true,
      message: 'Email verified successfully',
      email: tokenRecord.email
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Verify email error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Request to link a new device (Device B enters email)
 * POST /auth/request-device-link
 * Body: { email, publicKey, deviceName }
 */
export async function handleRequestDeviceLink(
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const body = await request.json() as {
      email: string;
      publicKey: string;
      deviceName?: string;
    };

    const { email, publicKey, deviceName } = body;

    if (!email || !publicKey) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if email exists and is verified
    const user = await db.prepare(
      'SELECT * FROM users WHERE email = ? AND email_verified = 1'
    ).bind(email).first<User>();

    if (!user) {
      return new Response(JSON.stringify({
        error: 'No verified CryptID account found for this email'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if this public key is already registered
    const existingKey = await db.prepare(
      'SELECT * FROM device_keys WHERE public_key = ?'
    ).bind(publicKey).first<DeviceKey>();

    if (existingKey) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Device already linked',
        cryptidUsername: user.cryptid_username,
        alreadyLinked: true
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userAgent = request.headers.get('User-Agent') || null;

    // Clean up old tokens
    await cleanupExpiredTokens(db);

    // Create device link token (1 hour expiry for security)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db.prepare(
      'INSERT INTO verification_tokens (id, email, token, token_type, public_key, device_name, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateUUID(), email, token, 'device_link', publicKey, deviceName || 'New Device', userAgent, expiresAt).run();

    // Send device link email
    const linkUrl = `${env.APP_URL || 'https://jeffemmett.com'}/link-device?token=${token}`;
    const emailSent = await sendEmail(
      env,
      email,
      'Link new device to your CryptID',
      `
      <h2>New Device Link Request</h2>
      <p>Someone is trying to link a new device to your CryptID: <strong>${user.cryptid_username}</strong></p>
      <p><strong>Device:</strong> ${deviceName || 'New Device'}</p>
      <p>If this was you, click the button below to approve:</p>
      <p><a href="${linkUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Approve Device</a></p>
      <p>Or copy this link: ${linkUrl}</p>
      <p>This link expires in 1 hour.</p>
      <p style="color: #c00; font-size: 12px;"><strong>If you didn't request this, do not click the link.</strong> Someone may be trying to access your account.</p>
      `
    );

    return new Response(JSON.stringify({
      success: true,
      message: emailSent ? 'Verification email sent to your address' : 'Failed to send email',
      emailSent,
      cryptidUsername: user.cryptid_username
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Request device link error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Complete device link (clicked from email on Device B)
 * GET /auth/link-device/:token
 */
export async function handleLinkDevice(
  token: string,
  env: Environment
): Promise<Response> {
  try {
    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find token
    const tokenRecord = await db.prepare(
      "SELECT * FROM verification_tokens WHERE token = ? AND token_type = 'device_link' AND used = 0 AND expires_at > datetime('now')"
    ).bind(token).first<VerificationToken>();

    if (!tokenRecord) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user
    const user = await db.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(tokenRecord.email).first<User>();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add the new device key
    await db.prepare(
      'INSERT INTO device_keys (id, user_id, public_key, device_name, user_agent) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      generateUUID(),
      user.id,
      tokenRecord.public_key,
      tokenRecord.device_name,
      tokenRecord.user_agent
    ).run();

    // Mark token as used
    await db.prepare(
      'UPDATE verification_tokens SET used = 1 WHERE id = ?'
    ).bind(tokenRecord.id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Device linked successfully',
      cryptidUsername: user.cryptid_username,
      email: user.email
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Link device error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Send a backup email to set up account on another device
 * POST /api/auth/send-backup-email
 * Body: { email, username }
 *
 * This is called during registration when the user provides an email.
 * It sends an email with a link to set up their account on another device.
 */
export async function handleSendBackupEmail(
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const body = await request.json() as {
      email: string;
      username: string;
    };

    const { email, username } = body;

    if (!email || !username) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.CRYPTID_DB;
    if (!db) {
      // If no DB, still try to send email (graceful degradation)
      console.log('No database configured, attempting to send email directly');
    }

    // If DB exists, create/update user record
    if (db) {
      // Check if user already exists
      const existingUser = await db.prepare(
        'SELECT * FROM users WHERE cryptid_username = ?'
      ).bind(username).first<User>();

      if (existingUser) {
        // Update email if user exists
        await db.prepare(
          "UPDATE users SET email = ?, updated_at = datetime('now') WHERE cryptid_username = ?"
        ).bind(email, username).run();
      } else {
        // Create new user record
        const userId = crypto.randomUUID();
        await db.prepare(
          'INSERT INTO users (id, email, cryptid_username, email_verified) VALUES (?, ?, ?, 0)'
        ).bind(userId, email, username).run();
      }
    }

    // Send the backup email
    const appUrl = env.APP_URL || 'https://jeffemmett.com';
    const setupUrl = `${appUrl}/setup-device?username=${encodeURIComponent(username)}`;

    const emailSent = await sendEmail(
      env,
      email,
      `Set up CryptID "${username}" on another device`,
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .icon { font-size: 48px; margin-bottom: 10px; }
          h1 { color: #8b5cf6; margin: 0 0 10px 0; }
          .card { background: #f9fafb; border-radius: 12px; padding: 24px; margin: 20px 0; }
          .step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
          .step-number { background: #8b5cf6; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; margin: 20px 0; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
          .warning { background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 20px 0; color: #92400e; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="icon">🔐</div>
          <h1>Welcome to CryptID</h1>
          <p>Your passwordless account is ready!</p>
        </div>

        <p>Hi <strong>${username}</strong>,</p>

        <p>Your CryptID account has been created on your current device. To access your account from another device (like your phone), follow these steps:</p>

        <div class="card">
          <div class="step">
            <span class="step-number">1</span>
            <div>
              <strong>Open the link below on your other device</strong>
              <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">Use your phone, tablet, or another computer</p>
            </div>
          </div>
          <div class="step">
            <span class="step-number">2</span>
            <div>
              <strong>A new cryptographic key will be generated</strong>
              <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">This key is unique to that device and stored securely in the browser</p>
            </div>
          </div>
          <div class="step">
            <span class="step-number">3</span>
            <div>
              <strong>You're set! Both devices can now access your account</strong>
              <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">No passwords to remember - your browser handles authentication</p>
            </div>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${setupUrl}" class="button">Set Up on Another Device</a>
        </div>

        <div class="warning">
          <strong>⚠️ Security Note:</strong> Only open this link on devices you own. Each device that accesses your account stores a unique cryptographic key.
        </div>

        <div class="footer">
          <p>This email was sent because you created a CryptID account and opted for multi-device backup.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p style="margin-top: 16px;">CryptID by <a href="${appUrl}" style="color: #8b5cf6;">jeffemmett.com</a></p>
        </div>
      </body>
      </html>
      `
    );

    if (emailSent) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Backup email sent successfully',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({
        error: 'Failed to send email',
        message: 'Please check your email address and try again',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Send backup email error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Check if a public key is linked to an account
 * POST /auth/lookup
 * Body: { publicKey }
 */
export async function handleLookup(
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const body = await request.json() as { publicKey: string };
    const { publicKey } = body;

    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Missing publicKey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find device key and associated user
    const result = await db.prepare(`
      SELECT u.cryptid_username, u.email, u.email_verified, dk.device_name
      FROM device_keys dk
      JOIN users u ON dk.user_id = u.id
      WHERE dk.public_key = ?
    `).bind(publicKey).first<{
      cryptid_username: string;
      email: string;
      email_verified: number;
      device_name: string;
    }>();

    if (!result) {
      return new Response(JSON.stringify({
        found: false
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update last_used timestamp
    await db.prepare(
      "UPDATE device_keys SET last_used = datetime('now') WHERE public_key = ?"
    ).bind(publicKey).run();

    return new Response(JSON.stringify({
      found: true,
      cryptidUsername: result.cryptid_username,
      email: result.email,
      emailVerified: result.email_verified === 1,
      deviceName: result.device_name
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Lookup error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get linked devices for an account
 * POST /auth/devices
 * Body: { publicKey } - authenticates via device's public key
 */
export async function handleGetDevices(
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const body = await request.json() as { publicKey: string };
    const { publicKey } = body;

    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Missing publicKey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find user by public key
    const deviceKey = await db.prepare(`
      SELECT user_id FROM device_keys WHERE public_key = ?
    `).bind(publicKey).first<{ user_id: string }>();

    if (!deviceKey) {
      return new Response(JSON.stringify({ error: 'Device not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get all devices for this user
    const devices = await db.prepare(`
      SELECT id, device_name, user_agent, created_at, last_used, public_key
      FROM device_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(deviceKey.user_id).all<DeviceKey>();

    return new Response(JSON.stringify({
      devices: devices.results?.map((d: DeviceKey) => ({
        id: d.id,
        deviceName: d.device_name,
        userAgent: d.user_agent,
        createdAt: d.created_at,
        lastUsed: d.last_used,
        isCurrentDevice: d.public_key === publicKey
      })) || []
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Get devices error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Revoke a device
 * DELETE /auth/devices/:deviceId
 * Body: { publicKey } - authenticates via device's public key
 */
export async function handleRevokeDevice(
  deviceId: string,
  request: Request,
  env: Environment
): Promise<Response> {
  try {
    const body = await request.json() as { publicKey: string };
    const { publicKey } = body;

    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'Missing publicKey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.CRYPTID_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find user by public key
    const currentDevice = await db.prepare(`
      SELECT user_id FROM device_keys WHERE public_key = ?
    `).bind(publicKey).first<{ user_id: string }>();

    if (!currentDevice) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify the device to revoke belongs to the same user
    const targetDevice = await db.prepare(`
      SELECT user_id, public_key FROM device_keys WHERE id = ?
    `).bind(deviceId).first<{ user_id: string; public_key: string }>();

    if (!targetDevice || targetDevice.user_id !== currentDevice.user_id) {
      return new Response(JSON.stringify({ error: 'Device not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Don't allow revoking the current device
    if (targetDevice.public_key === publicKey) {
      return new Response(JSON.stringify({ error: 'Cannot revoke current device' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete the device
    await db.prepare('DELETE FROM device_keys WHERE id = ?').bind(deviceId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Device revoked'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Revoke device error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
