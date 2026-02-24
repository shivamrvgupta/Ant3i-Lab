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

module.exports = { sendReportEmail };
