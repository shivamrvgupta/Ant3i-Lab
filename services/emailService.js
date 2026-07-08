const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendReportEmail({ to, reportNo, customerName, createdByName, pdfBuffer }) {
  const transporter = createTransport();
  const safeNo = reportNo.replace(/\//g, '-');

  await transporter.sendMail({
    from:    `"Lab Reports" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Test Report ${reportNo} — ${customerName}`,
    html: `
      <p>Hello,</p>
      <p>A new test report has been generated.</p>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Report No.</td><td><strong>${reportNo}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Customer</td><td>${customerName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Created By</td><td>${createdByName}</td></tr>
      </table>
      <p>Please find the report PDF attached.</p>
      <p style="color:#999;font-size:12px">This is an automated message from the Lab Report System.</p>
    `,
    attachments: [
      {
        filename: `report-${safeNo}.pdf`,
        content:  pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

async function sendBookingConfirmationEmail({ to, name, requestNo, tests, preferredDate, total }) {
  const transporter = createTransport();
  const dateStr = new Date(preferredDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const testRows = tests.map(t =>
    `<tr><td style="padding:3px 12px 3px 0;color:#555">${t.name}</td><td style="padding:3px 0;color:#555">${t.method}</td><td style="padding:3px 0 3px 12px;text-align:right">&#8377;${t.rate}</td></tr>`
  ).join('');

  await transporter.sendMail({
    from:    `"ANT 3I Lab" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Booking Request Received — ${requestNo}`,
    html: `
      <p>Dear ${name},</p>
      <p>Thank you for submitting your test request. We have received it and will confirm shortly.</p>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;margin-bottom:12px">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Request No.</td><td><strong>${requestNo}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Preferred Date</td><td>${dateStr}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Total Amount</td><td><strong>&#8377;${total} (incl. 18% GST)</strong></td></tr>
      </table>
      <p><strong>Selected Tests:</strong></p>
      <table style="font-family:sans-serif;font-size:13px;border-collapse:collapse;border:1px solid #e5e7eb">
        <thead><tr style="background:#f3f4f6"><th style="padding:5px 12px;text-align:left">Test</th><th style="padding:5px 12px;text-align:left">Method</th><th style="padding:5px 12px;text-align:right">Rate</th></tr></thead>
        <tbody>${testRows}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:16px">This is an automated confirmation from ANT 3I Lab.</p>
    `,
  });
}

async function sendBookingAcceptedEmail({ to, name, requestNo, preferredDate, invoicePdfBuffer }) {
  const transporter = createTransport();
  const dateStr = new Date(preferredDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const safeNo = requestNo.replace(/\//g, '-');

  await transporter.sendMail({
    from:    `"ANT 3I Lab" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Booking Confirmed — ${requestNo}`,
    html: `
      <p>Dear ${name},</p>
      <p>Your test request <strong>${requestNo}</strong> has been <strong style="color:#16a34a">confirmed</strong>.</p>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Request No.</td><td><strong>${requestNo}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Scheduled Date</td><td>${dateStr}</td></tr>
      </table>
      <p>Please find your invoice attached. Bring your sample to the lab on the scheduled date.</p>
      <p style="color:#999;font-size:12px;margin-top:16px">ANT 3I Lab — Automated Notification</p>
    `,
    attachments: invoicePdfBuffer ? [{
      filename: `invoice-${safeNo}.pdf`,
      content:  invoicePdfBuffer,
      contentType: 'application/pdf',
    }] : [],
  });
}

async function sendReportToCustomerEmail({ to, name, requestNo, reportNo, pdfBuffer }) {
  const transporter = createTransport();
  const safeNo = reportNo.replace(/\//g, '-');
  await transporter.sendMail({
    from:    `"ANT 3I Lab" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Your Test Report Ready — ${reportNo}`,
    html: `
      <p>Dear ${name},</p>
      <p>Your test report for booking request <strong>${requestNo}</strong> is now ready.</p>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;margin-bottom:12px">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Request No.</td><td><strong>${requestNo}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Report No.</td><td><strong>${reportNo}</strong></td></tr>
      </table>
      <p>Please find your test report PDF attached to this email.</p>
      <p style="color:#999;font-size:12px;margin-top:16px">ANT 3I Lab — Automated Notification</p>
    `,
    attachments: [{
      filename: `report-${safeNo}.pdf`,
      content:  pdfBuffer,
      contentType: 'application/pdf',
    }],
  });
}

// ── WhatsApp via Meta Cloud API ───────────────────────────────────────────────

function normalizePhone(phone) {
  // Remove all non-digit characters (including unicode, spaces, +, -, etc)
  const digits = String(phone).replace(/\D/g, '');

  console.log('[Phone] Raw input:', { original: phone, cleaned: digits, length: digits.length });

  // Case 1: Already has 91 at start and is 12 digits (e.g., 918850664191)
  if (digits.length === 12 && digits.startsWith('91')) {
    console.log('[Phone] Valid: 12 digits starting with 91');
    return digits;
  }

  // Case 2: Has 91 but more than 12 digits (take last 12)
  if (digits.length > 12 && digits.endsWith('91') === false) {
    const last12 = digits.slice(-12);
    if (last12.startsWith('91')) {
      console.log('[Phone] Extracted: Last 12 digits with 91');
      return last12;
    }
  }

  // Case 3: Exactly 10 digits (e.g., 8850664191 or 9137593041) - needs 91 prefix
  if (digits.length === 10) {
    const normalized = `91${digits}`;
    console.log('[Phone] Normalized: 10 digits → added 91 prefix');
    return normalized;
  }

  // Case 4: 11 digits with 91 prefix (e.g., 918850664191 entered as 91-8850664191)
  if (digits.length === 11 && digits.startsWith('91')) {
    const normalized = digits; // Already has 91 but missing a digit?
    console.log('[Phone] Warning: 11 digits with 91 prefix - might be invalid');
    return normalized;
  }

  // Case 5: 11 digits without 91 prefix (e.g., 18850664191)
  if (digits.length === 11) {
    // Take last 10 digits and add 91
    const normalized = `91${digits.slice(-10)}`;
    console.log('[Phone] Normalized: 11 digits → took last 10 and added 91');
    return normalized;
  }

  // Case 6: Less than 10 digits or invalid
  if (digits.length < 10) {
    console.error('[Phone] Invalid: Too short', { digits, length: digits.length });
    return null;
  }

  // Case 7: More than 12 digits - take last 10
  if (digits.length > 12) {
    const normalized = `91${digits.slice(-10)}`;
    console.log('[Phone] Normalized: >12 digits → took last 10 and added 91');
    return normalized;
  }

  // Fallback
  console.warn('[Phone] Fallback: Could not normalize', { digits });
  return `91${digits.slice(-10)}`;
}

function metaRequest(path, bodyObj) {
  const https = require('https');
  const token = process.env.META_WA_TOKEN;
  const body  = JSON.stringify(bodyObj);
  return new Promise((resolve) => {
    const opts = {
      hostname: 'graph.facebook.com',
      path,
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization':  `Bearer ${token}`,
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            console.error('[WhatsApp API error]', {
              statusCode: res.statusCode,
              path,
              response: parsed,
            });
          } else {
            console.log('[WhatsApp API] Success', { statusCode: res.statusCode, messageId: parsed.messages?.[0]?.id });
          }
          resolve(parsed);
        } catch (e) {
          console.error('[WhatsApp API parse error]', data);
          resolve({});
        }
      });
    });
    req.on('error', e => {
      console.error('[WhatsApp API error]', { message: e.message, code: e.code });
      resolve({});
    });
    req.write(body);
    req.end();
  });
}

// Upload PDF buffer to Meta media API → returns media_id
async function uploadWhatsAppMedia(pdfBuffer, filename) {
  const https   = require('https');
  const token   = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_ID;

  if (!token || !phoneId) {
    console.error('[WhatsApp] Media upload failed: missing credentials');
    return null;
  }

  const boundary = '----FormBoundary' + Date.now();
  const CRLF     = '\r\n';

  const header =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="messaging_product"${CRLF}${CRLF}whatsapp${CRLF}` +
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="type"${CRLF}${CRLF}application/pdf${CRLF}` +
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
    `Content-Type: application/pdf${CRLF}${CRLF}`;
  const footer = `${CRLF}--${boundary}--${CRLF}`;

  const headerBuf = Buffer.from(header);
  const footerBuf = Buffer.from(footer);
  const totalLen  = headerBuf.length + pdfBuffer.length + footerBuf.length;

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'graph.facebook.com',
      path:     `/v22.0/${phoneId}/media`,
      method:   'POST',
      headers: {
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLen,
        'Authorization':  `Bearer ${token}`,
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.id) {
            console.log('[WhatsApp] Media uploaded successfully', { mediaId: json.id });
            resolve(json.id);
          } else {
            console.error('[WhatsApp] Media upload failed', { statusCode: res.statusCode, response: json });
            resolve(null);
          }
        } catch (e) {
          console.error('[WhatsApp] Media upload parse error', { data });
          resolve(null);
        }
      });
    });
    req.on('error', e => {
      console.error('[WhatsApp] Media upload network error', { message: e.message, code: e.code });
      resolve(null);
    });
    req.write(headerBuf);
    req.write(pdfBuffer);
    req.write(footerBuf);
    req.end();
  });
}

// Send a template with optional document attachment
async function sendWhatsAppTemplate({ phone, templateName, bodyParams, mediaId, filename }) {
  const token   = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_ID;

  console.log('[WhatsApp] Sending template', { phone, templateName, hasToken: !!token, hasPhoneId: !!phoneId });
  if (!token || !phoneId) {
    console.error('[WhatsApp] Missing credentials', { hasToken: !!token, hasPhoneId: !!phoneId });
    return;
  }

  const to = normalizePhone(phone);
  const components = [];

  if (mediaId) {
    components.push({
      type: 'header',
      parameters: [{ type: 'document', document: { id: mediaId, filename } }],
    });
  }

  if (bodyParams && bodyParams.length) {
    components.push({
      type: 'body',
      parameters: bodyParams.map(p => ({ type: 'text', text: String(p) })),
    });
  }

  await metaRequest(`/v22.0/${phoneId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name:       templateName,
      language:   { code: 'en' },
      components,
    },
  });
}

// ── Specific WhatsApp senders ─────────────────────────────────────────────────

async function sendWhatsAppBookingReceived({ phone, name, requestNo, preferredDate, total }) {
  const dateStr = new Date(preferredDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  await sendWhatsAppTemplate({
    phone,
    templateName: 'booking_received',
    bodyParams:   [name, requestNo, dateStr, total],
  });
}

async function sendWhatsAppBookingAccepted({ phone, name, requestNo, preferredDate, invoicePdfBuffer }) {
  const dateStr = new Date(preferredDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const safeNo  = requestNo.replace(/\//g, '-');
  let mediaId   = null;
  if (invoicePdfBuffer) {
    mediaId = await uploadWhatsAppMedia(invoicePdfBuffer, `invoice-${safeNo}.pdf`);
  }
  await sendWhatsAppTemplate({
    phone,
    templateName: 'booking_accepted_invoice',
    bodyParams:   [name, requestNo, dateStr],
    mediaId,
    filename:     `invoice-${safeNo}.pdf`,
  });
}

async function sendWhatsAppReportReady({ phone, name, reportNo, requestNo, pdfBuffer, isPaid }) {
  const safeNo = reportNo.replace(/\//g, '-');
  if (isPaid && pdfBuffer) {
    const mediaId = await uploadWhatsAppMedia(pdfBuffer, `report-${safeNo}.pdf`);
    await sendWhatsAppTemplate({
      phone,
      templateName: 'report_ready_pdf',
      bodyParams:   [name, reportNo, requestNo],
      mediaId,
      filename:     `report-${safeNo}.pdf`,
    });
  } else {
    await sendWhatsAppTemplate({
      phone,
      templateName: 'report_ready_pending',
      bodyParams:   [name, reportNo, requestNo],
    });
  }
}

// Send admin notification when new booking request arrives
async function sendWhatsAppAdminNewBooking({ requestNo, customerName, testCount, preferredDate, total }) {
  const phones = (process.env.ADMIN_PHONES || '').split(',').map(p => p.trim()).filter(Boolean);
  if (!phones.length) return;
  const dateStr = new Date(preferredDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  await Promise.all(phones.map(phone => sendWhatsAppTemplate({
    phone,
    templateName: 'admin_new_booking',
    bodyParams:   [requestNo, customerName, String(testCount), dateStr, String(total)],
  })));
}

module.exports = {
  sendReportEmail,
  sendBookingConfirmationEmail,
  sendBookingAcceptedEmail,
  sendReportToCustomerEmail,
  sendWhatsAppBookingReceived,
  sendWhatsAppBookingAccepted,
  sendWhatsAppReportReady,
  sendWhatsAppAdminNewBooking,
  sendWhatsAppTemplate,
  normalizePhone,
};
